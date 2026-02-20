import { Request, Response, NextFunction } from "express";
import {
  hashPassword,
  comparePassword,
  issueTokenPair,
  verifyRefreshToken,
  revokeRefreshToken,
  generateOtp,
  generateOtpSessionId,
} from "../services/auth.service.js";
import { getJSON, setJSON, del } from "../services/cache.service.js";
import { sendOtpEmail } from "../services/email.service.js";
import config from "../config/env.config.js";
import {
  ROLES,
  REFRESH_TOKEN_COOKIE,
} from "../config/constants.js";
import { createError } from "../utils/error.js";
import { ResponsePayload } from "../types/payloads.types.js";
import { IUserData } from "../types/user.types.js";
import { User } from "../models/User.model.js";
import { Organization } from "../models/Organization.model.js";

// Redis OTP session key prefix
const OTP_PREFIX = "otp:";
const OTP_MAX_ATTEMPTS = 5;

interface OtpRecord {
  userId: string;
  otp: string;
  attempts: number;
}

// ─── Controller ──────────────────────────────────────────────────────────────

export default class AuthController {
  /**
   * POST /api/auth/signup
   * Creates a new Organization + admin User. Both start disabled until super admin enables them.
   */
  static async signup(req: Request, res: Response, next: NextFunction) {
    try {
      const { userName, orgName, orgSlug, adminEmail, adminPassword } =
        req.body as {
          userName: string;
          orgName: string;
          orgSlug: string;
          adminEmail: string;
          adminPassword: string;
        };

      const [existingOrg, existingUser] = await Promise.all([
        Organization.findOne({ slug: orgSlug }),
        User.findOne({ email: adminEmail.toLowerCase() }),
      ]);

      if (existingOrg)
        createError("Organization slug already in use", 400, "ORG_SLUG_TAKEN");

      if (existingUser)
        createError("Admin email already in use", 400, "EMAIL_TAKEN");

      const passwordHash = await hashPassword(adminPassword);

      const org = await Organization.create({
        name: orgName,
        slug: orgSlug,
        isDisabled: true,
      });

      await User.create({
        name: userName,
        email: adminEmail,
        passwordHash,
        role: ROLES.ADMIN,
        orgId: org._id,
        department: null,
        isDisabled: true,
      });

      const payload: ResponsePayload = {
        success: true,
        message:
          "Organization and admin user created successfully. Your account is pending approval.",
        timestamp: new Date().toISOString(),
      };

      res.status(201).json(payload);
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/auth/login  (Step 1 of 2 — validate credentials, issue OTP via email)
   * Returns an otpSessionId. Access tokens are NOT issued here.
   */
  static async login(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { email, password } = req.body as {
        email: string;
        password: string;
      };

      const user = await User.findOne({ email });
      if (!user)
        throw createError("Invalid credentials", 401, "INVALID_CREDENTIALS");

      if (user.isDisabled) {
        throw createError(
          "Your account has been disabled. Contact your administrator.",
          403,
          "ACCOUNT_DISABLED",
        );
      }

      const match = await comparePassword(password, user.passwordHash);
      if (!match)
        throw createError("Invalid credentials", 401, "INVALID_CREDENTIALS");

      // Generate OTP + session and persist in Redis with configured TTL
      const otp = generateOtp();
      const sessionId = generateOtpSessionId();
      const record: OtpRecord = { userId: user._id.toString(), otp, attempts: 0 };

      await setJSON<OtpRecord>(`${OTP_PREFIX}${sessionId}`, record, config.otpExpiresIn);

      // Non-blocking email send
      const expiresInMinutes = Math.ceil(config.otpExpiresIn / 60);
      sendOtpEmail(user.email, user.name, otp, expiresInMinutes);

      const payload: ResponsePayload<{ otpSessionId: string }> = {
        success: true,
        message: `A 6-digit OTP has been sent to your email. It expires in ${expiresInMinutes} minute(s).`,
        timestamp: new Date().toISOString(),
        data: { otpSessionId: sessionId },
      };
      res.status(200).json(payload);
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/auth/verify-otp  (Step 2 of 2 — validate OTP, issue access + refresh tokens)
   */
  static async verifyOtp(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { otpSessionId, otp } = req.body as {
        otpSessionId: string;
        otp: string;
      };

      const redisKey = `${OTP_PREFIX}${otpSessionId}`;
      const record = await getJSON<OtpRecord>(redisKey);

      if (!record)
        throw createError(
          "OTP expired or invalid session. Please log in again.",
          401,
          "OTP_EXPIRED",
        );

      record.attempts += 1;

      if (record.attempts > OTP_MAX_ATTEMPTS) {
        await del(redisKey);
        throw createError(
          "Too many incorrect OTP attempts. Please log in again.",
          429,
          "OTP_MAX_ATTEMPTS",
        );
      }

      if (record.otp !== otp.trim()) {
        await setJSON<OtpRecord>(redisKey, record, config.otpExpiresIn);
        const remaining = OTP_MAX_ATTEMPTS - record.attempts;
        throw createError(
          `Invalid OTP. ${remaining} attempt(s) remaining.`,
          401,
          "INVALID_OTP",
        );
      }

      // OTP correct — consume session
      await del(redisKey);

      const user = await User.findById(record.userId);
      if (!user || user.isDisabled)
        throw createError("User not found or disabled", 401, "INVALID_SESSION");

      const accessToken = await issueTokenPair(user, res);

      const payload: ResponsePayload<{ token: string; user: IUserData }> = {
        success: true,
        message: "Logged in successfully",
        timestamp: new Date().toISOString(),
        data: {
          token: accessToken,
          user: await user.data(),
        },
      };
      res.status(200).json(payload);
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/auth/refresh
   */
  static async refresh(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const raw = (req.cookies as Record<string, string | undefined>)[
        REFRESH_TOKEN_COOKIE
      ];
      if (!raw)
        createError("No refresh token provided", 401, "NO_REFRESH_TOKEN");

      const userId = await verifyRefreshToken(raw);
      const user = await User.findById(userId);
      if (!user || user.isDisabled) {
        res.clearCookie(REFRESH_TOKEN_COOKIE);
        throw createError("User not found or disabled", 401, "INVALID_SESSION");
      }

      const accessToken = await issueTokenPair(user, res);
      res.status(200).json({ success: true, accessToken });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/auth/logout
   */
  static async logout(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const raw = (req.cookies as Record<string, string | undefined>)[
        REFRESH_TOKEN_COOKIE
      ];
      if (raw) {
        await revokeRefreshToken(raw);
      }
      res.clearCookie(REFRESH_TOKEN_COOKIE, { path: "/" });
      res
        .status(200)
        .json({ success: true, message: "Logged out successfully" });
    } catch (err) {
      next(err);
    }
  }
}

