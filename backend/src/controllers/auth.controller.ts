import { Request, Response, NextFunction } from "express";
import {
  hashPassword,
  comparePassword,
  issueTokenPair,
  verifyRefreshToken,
  revokeRefreshToken,
  revokeAllUserTokens,
  generateOtp,
} from "../services/auth.service.js";
import { getJSON, setJSON, del, getTTL } from "../services/cache.service.js";
import {
  sendOtpEmail,
  sendPasswordResetOtpEmail,
} from "../services/email.service.js";
import config from "../config/env.config.js";
import { ROLES, REFRESH_TOKEN_COOKIE } from "../config/constants.js";
import { createError } from "../utils/error.js";
import { ResponsePayload } from "../types/payloads.types.js";
import { IUserData } from "../types/user.types.js";
import { User } from "../models/User.model.js";
import { Organization } from "../models/Organization.model.js";

// Redis OTP key prefixes (keyed by userId — no random session)
const LOGIN_OTP_PREFIX = "otp:";
const RESET_OTP_PREFIX = "pwd:";
const OTP_MAX_ATTEMPTS = 5;

interface OtpRecord {
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

      // Generate OTP + persist in Redis keyed by userId
      // Prevent duplicate OTPs: if one already exists, return userId + TTL so the
      // client can redirect straight to the OTP page without sending a new email.
      const userId = user._id.toString();
      const loginOtpKey = `${LOGIN_OTP_PREFIX}${userId}`;
      const existing = await getJSON<OtpRecord>(loginOtpKey);
      if (existing) {
        const ttlSeconds = await getTTL(loginOtpKey);
        const payload: ResponsePayload<{ userId: string; otpAlreadySent: true; ttlSeconds: number }> = {
          success: true,
          message: "An OTP was already sent to your email. Please check your inbox.",
          timestamp: new Date().toISOString(),
          data: { userId, otpAlreadySent: true, ttlSeconds: ttlSeconds > 0 ? ttlSeconds : 0 },
        };
        res.status(200).json(payload);
        return;
      }

      const otp = generateOtp();
      const record: OtpRecord = { otp, attempts: 0 };

      await setJSON<OtpRecord>(loginOtpKey, record, config.otpExpiresIn);

      // Non-blocking email send
      const expiresInMinutes = Math.ceil(config.otpExpiresIn / 60);
      sendOtpEmail(user.email, user.name, otp, expiresInMinutes);

      const payload: ResponsePayload<{ userId: string; otpAlreadySent: false; ttlSeconds: number }> = {
        success: true,
        message: `A 6-digit OTP has been sent to your email. It expires in ${expiresInMinutes} minute(s).`,
        timestamp: new Date().toISOString(),
        data: { userId, otpAlreadySent: false, ttlSeconds: config.otpExpiresIn },
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
      const { userId, otp } = req.body as {
        userId: string;
        otp: string;
      };

      const loginOtpKey = `${LOGIN_OTP_PREFIX}${userId}`;
      const record = await getJSON<OtpRecord>(loginOtpKey);

      if (!record)
        throw createError(
          "OTP expired or not found. Please log in again.",
          401,
          "OTP_EXPIRED",
        );

      record.attempts += 1;

      if (record.attempts > OTP_MAX_ATTEMPTS) {
        await del(loginOtpKey);
        throw createError(
          "Too many incorrect OTP attempts. Please log in again.",
          429,
          "OTP_MAX_ATTEMPTS",
        );
      }

      if (record.otp !== otp.trim()) {
        await setJSON<OtpRecord>(loginOtpKey, record, config.otpExpiresIn);
        const remaining = OTP_MAX_ATTEMPTS - record.attempts;
        throw createError(
          `Invalid OTP. ${remaining} attempt(s) remaining.`,
          401,
          "INVALID_OTP",
        );
      }

      // OTP correct — consume
      await del(loginOtpKey);

      const user = await User.findById(userId);
      if (!user || user.isDisabled)
        throw createError("User not found or disabled", 401, "INVALID_SESSION");

      const accessToken = await issueTokenPair(user, res);

      const payload: ResponsePayload<{ accessToken: string; user: IUserData }> =
        {
          success: true,
          message: "Logged in successfully",
          timestamp: new Date().toISOString(),
          data: {
            accessToken,
            user: await user.data(),
          },
        };
      res.status(200).json(payload);
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/auth/resend-otp
   * Deletes existing otp:{userId} (if any) and sends a fresh OTP.
   */
  static async resendOtp(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { userId } = req.body as { userId: string };

      const user = await User.findById(userId);
      if (!user)
        throw createError("User not found", 404, "USER_NOT_FOUND");
      if (user.isDisabled)
        throw createError(
          "Your account has been disabled.",
          403,
          "ACCOUNT_DISABLED",
        );

      // Only resend if the previous OTP has already expired
      const loginOtpKey = `${LOGIN_OTP_PREFIX}${userId}`;
      const existing = await getJSON<OtpRecord>(loginOtpKey);
      if (existing) {
        throw createError(
          "An OTP was already sent to your email. Please wait for it to expire before requesting a new one.",
          429,
          "OTP_ALREADY_SENT",
        );
      }

      const otp = generateOtp();
      const record: OtpRecord = { otp, attempts: 0 };
      await setJSON<OtpRecord>(loginOtpKey, record, config.otpExpiresIn);

      const expiresInMinutes = Math.ceil(config.otpExpiresIn / 60);
      sendOtpEmail(user.email, user.name, otp, expiresInMinutes);

      const payload: ResponsePayload = {
        success: true,
        message: `A new OTP has been sent to your email. It expires in ${expiresInMinutes} minute(s).`,
        timestamp: new Date().toISOString(),
      };
      res.status(200).json(payload);
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/auth/forgot-password
   * Sends a password-reset OTP to the user's email.
   */
  static async forgotPassword(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { email } = req.body as { email: string };

      const user = await User.findOne({ email: email.toLowerCase() });

      // Always respond the same to avoid user enumeration
      const genericMsg =
        "If an account exists for that email, you will receive a password-reset OTP shortly.";

      if (!user || user.isDisabled) {
        res.status(200).json({
          success: true,
          message: genericMsg,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const userId = user._id.toString();
      const resetKey = `${RESET_OTP_PREFIX}${userId}`;

      // Prevent duplicate: if a reset OTP is already pending, reject
      const existing = await getJSON<OtpRecord>(resetKey);
      if (existing) {
        res.status(200).json({
          success: true,
          message: genericMsg,
          timestamp: new Date().toISOString(),
          data: { userId },
        });
        return;
      }

      const otp = generateOtp();
      const record: OtpRecord = { otp, attempts: 0 };
      await setJSON<OtpRecord>(resetKey, record, config.otpExpiresIn);

      const expiresInMinutes = Math.ceil(config.otpExpiresIn / 60);
      sendPasswordResetOtpEmail(user.email, user.name, otp, expiresInMinutes);

      const payload: ResponsePayload<{ userId: string }> = {
        success: true,
        message: genericMsg,
        timestamp: new Date().toISOString(),
        data: { userId },
      };
      res.status(200).json(payload);
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/auth/reset-password
   * Verifies the reset OTP and updates the user's password.
   */
  static async resetPassword(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { userId, otp, newPassword } = req.body as {
        userId: string;
        otp: string;
        newPassword: string;
      };

      const resetKey = `${RESET_OTP_PREFIX}${userId}`;
      const record = await getJSON<OtpRecord>(resetKey);

      if (!record)
        throw createError(
          "Password reset OTP expired or not found. Please request a new one.",
          401,
          "OTP_EXPIRED",
        );

      record.attempts += 1;

      if (record.attempts > OTP_MAX_ATTEMPTS) {
        await del(resetKey);
        throw createError(
          "Too many incorrect OTP attempts. Please request a new password reset.",
          429,
          "OTP_MAX_ATTEMPTS",
        );
      }

      if (record.otp !== otp.trim()) {
        await setJSON<OtpRecord>(resetKey, record, config.otpExpiresIn);
        const remaining = OTP_MAX_ATTEMPTS - record.attempts;
        throw createError(
          `Invalid OTP. ${remaining} attempt(s) remaining.`,
          401,
          "INVALID_OTP",
        );
      }

      // OTP correct — consume and update password
      await del(resetKey);

      const user = await User.findById(userId);
      if (!user || user.isDisabled)
        throw createError("User not found or disabled", 400, "INVALID_REQUEST");

      user.passwordHash = await hashPassword(newPassword);
      await user.save();

      // Revoke all existing sessions for security
      await revokeAllUserTokens(user._id);
      res.clearCookie(REFRESH_TOKEN_COOKIE, { path: "/" });

      const payload: ResponsePayload = {
        success: true,
        message: "Password reset successfully. Please log in with your new password.",
        timestamp: new Date().toISOString(),
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

      const payload: ResponsePayload<{ accessToken: string; user: IUserData }> = {
        success: true,
        message: "Token refreshed successfully",
        timestamp: new Date().toISOString(),
        data: { accessToken, user: await user.data() },
      };

      res.status(200).json(payload);
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
      
      const payload: ResponsePayload = {
        success: true,
        message: "Logged out successfully",
        timestamp: new Date().toISOString(),
      };

      res.status(200).json(payload);
    } catch (err) {
      next(err);
    }
  }
}
