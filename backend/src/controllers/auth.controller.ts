import { Request, Response, NextFunction } from "express";
import { CookieOptions } from "express";
import {
  hashPassword,
  comparePassword,
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  revokeRefreshToken,
} from "../services/auth.service.js";
import config from "../config/env.config.js";
import {
  ROLES,
  REFRESH_TOKEN_COOKIE,
  CURRENCIES,
} from "../config/constants.js";
import { createError } from "../utils/error.js";
import { time } from "node:console";
import { ResponsePayload } from "../types/payloads.types.js";
import { IUser, IUserData } from "../types/user.types.js";
import { AuthRequest } from "../types/types.js";
import { User } from "../models/User.model.js";
import { Organization } from "../models/Organization.model.js";

// Cookie options for the refresh token
const refreshCookieOptions: CookieOptions = {
  httpOnly: true,
  secure: config.nodeEnv === "production",
  sameSite: config.nodeEnv === "production" ? "strict" : "lax",
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in ms // TODO: get from env.config.js
  path: "/",
};

const issueTokens = async (user: IUser, res: Response): Promise<string> => {
  const accessToken = generateAccessToken(user._id);
  const refreshToken = await generateRefreshToken(user._id);
  res.cookie(REFRESH_TOKEN_COOKIE, refreshToken, refreshCookieOptions);
  return accessToken;
};

// ─── Controller ──────────────────────────────────────────────────────────────

export default class AuthController {
  /**
   * POST /api/auth/signup
   * Creates a new Organization + admin User in one transaction.
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
        totalBudget: 0,
        departments: [
          { name: "Finance", budget: 50000, spent: 0, currency: CURRENCIES[0] },
        ],
        isDisabled: true,
      });

      const user = await User.create({
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
          "Organization and admin user created successfully; please log in to continue.",
        timestamp: new Date().toISOString(),
      };

      res.status(201).json(payload);
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/auth/login  (unified — resolves role from DB)
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

      const user = await User.findOne({ email: email });
      if (!user) createError("Invalid credentials", 401, "INVALID_CREDENTIALS");

      if (user.isDisabled) {
        throw createError(
          "Your account has been disabled. Contact your administrator.",
          403,
          "ACCOUNT_DISABLED",
        );
      }

      const match = await comparePassword(password, user.passwordHash);
      if (!match) {
        throw createError("Invalid credentials", 401, "INVALID_CREDENTIALS");
      }

      const accessToken = await issueTokens(user, res);
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

      const accessToken = await issueTokens(user, res);
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
