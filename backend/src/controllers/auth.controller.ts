import { body } from 'express-validator';
import { Request, Response, NextFunction } from 'express';
import { CookieOptions } from 'express';
import { User, Organization } from '../models/index.js';
import type { IUser } from '../models/index.js';
import {
  hashPassword,
  comparePassword,
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  revokeRefreshToken,
} from '../services/auth.service.js';
import { config } from '../config/env.js';
import { ROLES, REFRESH_TOKEN_COOKIE } from '../config/constants.js';
import { createError } from '../middleware/errorHandler.js';

// Cookie options for the refresh token
const refreshCookieOptions: CookieOptions = {
  httpOnly: true,
  secure: config.nodeEnv === 'production',
  sameSite: config.nodeEnv === 'production' ? 'strict' : 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
  path: '/',
};

export interface UserResponseDto {
  id: IUser['_id'];
  name: string;
  email: string;
  role: string;
  orgId: IUser['_id'] | null;
  orgName: string | null;
  orgDepartments: unknown[];
  orgTotalBudget: number;
  department: string | null;
  managerId: IUser['_id'] | null;
  isDisabled: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const buildUserResponse = async (user: IUser): Promise<UserResponseDto> => {
  let orgName: string | null = null;
  let orgDepartments: unknown[] = [];
  let orgTotalBudget = 0;

  if (user.orgId) {
    const org = await Organization.findById(user.orgId).lean();
    if (org) {
      orgName = org.name;
      orgDepartments = org.departments ?? [];
      orgTotalBudget = org.totalBudget ?? 0;
    }
  }

  return {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    orgId: user.orgId ?? null,
    orgName,
    orgDepartments,
    orgTotalBudget,
    department: user.department ?? null,
    managerId: user.managerId ?? null,
    isDisabled: user.isDisabled,
  };
};

const issueTokens = async (user: IUser, res: Response): Promise<string> => {
  const accessToken = generateAccessToken({
    id: user._id,
    role: user.role,
    orgId: user.orgId,
  });
  const refreshToken = await generateRefreshToken(user._id);
  res.cookie(REFRESH_TOKEN_COOKIE, refreshToken, refreshCookieOptions);
  return accessToken;
};

// ─── Controller ──────────────────────────────────────────────────────────────

export class AuthController {
  /**
   * POST /api/auth/signup
   * Creates a new Organization + admin User in one transaction.
   */
  static async signup(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { name, adminEmail, adminPassword } = req.body as {
        name: string;
        adminEmail: string;
        adminPassword: string;
      };

      const existing = await User.findOne({ email: adminEmail.toLowerCase() });
      if (existing) {
        throw createError(409, 'An account with this email already exists', 'DUPLICATE_EMAIL');
      }

      const passwordHash = await hashPassword(adminPassword);

      const org = await Organization.create({
        name,
        totalBudget: 0,
        departments: [{ name: 'Finance', budget: 50000, spent: 0, currency: 'USD' }],
      });

      const user = await User.create({
        name: `${name} Admin`,
        email: adminEmail.toLowerCase(),
        passwordHash,
        role: ROLES.ADMIN,
        orgId: org._id,
        department: null,
      });

      const accessToken = await issueTokens(user, res);
      const userData = await buildUserResponse(user);

      res.status(201).json({ success: true, accessToken, user: userData });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/auth/login  (unified — resolves role from DB)
   */
  static async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, password } = req.body as { email: string; password: string };

      // Super admin — verify against env vars
      if (
        config.superAdminPassword &&
        email.toLowerCase() === config.superAdminEmail.toLowerCase()
      ) {
        if (password !== config.superAdminPassword) {
          throw createError(401, 'Invalid credentials', 'INVALID_CREDENTIALS');
        }

        let superAdmin = await User.findOne({ role: ROLES.SUPER_ADMIN });
        if (!superAdmin) {
          superAdmin = await User.create({
            name: 'Super Administrator',
            email: config.superAdminEmail.toLowerCase(),
            passwordHash: await hashPassword(config.superAdminPassword),
            role: ROLES.SUPER_ADMIN,
            orgId: null,
            department: null,
          });
        }

        const accessToken = await issueTokens(superAdmin, res);
        const userData = await buildUserResponse(superAdmin);
        res.status(200).json({ success: true, accessToken, user: userData });
        return;
      }

      // Regular users (admin or user)
      const user = await User.findOne({ email: email.toLowerCase() });
      if (!user) {
        throw createError(401, 'Invalid credentials', 'INVALID_CREDENTIALS');
      }

      if (user.isDisabled) {
        throw createError(
          403,
          'Your account has been disabled. Contact your administrator.',
          'ACCOUNT_DISABLED'
        );
      }

      const match = await comparePassword(password, user.passwordHash);
      if (!match) {
        throw createError(401, 'Invalid credentials', 'INVALID_CREDENTIALS');
      }

      const accessToken = await issueTokens(user, res);
      const userData = await buildUserResponse(user);
      res.status(200).json({ success: true, accessToken, user: userData });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/auth/superadmin — FE compatibility wrapper
   */
  static async loginSuperAdmin(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    return AuthController.login(req, res, next);
  }

  /**
   * POST /api/auth/refresh
   */
  static async refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const raw = (req.cookies as Record<string, string | undefined>)[REFRESH_TOKEN_COOKIE];
      if (!raw) {
        throw createError(401, 'No refresh token provided', 'NO_REFRESH_TOKEN');
      }

      const userId = await verifyRefreshToken(raw);
      const user = await User.findById(userId);
      if (!user || user.isDisabled) {
        res.clearCookie(REFRESH_TOKEN_COOKIE);
        throw createError(401, 'User not found or disabled', 'INVALID_SESSION');
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
  static async logout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const raw = (req.cookies as Record<string, string | undefined>)[REFRESH_TOKEN_COOKIE];
      if (raw) {
        await revokeRefreshToken(raw);
      }
      res.clearCookie(REFRESH_TOKEN_COOKIE, { path: '/' });
      res.status(200).json({ success: true, message: 'Logged out successfully' });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/auth/me
   */
  static async me(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = await User.findById(req.user!.id);
      if (!user) {
        throw createError(404, 'User not found', 'USER_NOT_FOUND');
      }
      const userData = await buildUserResponse(user);
      res.status(200).json({ success: true, user: userData });
    } catch (err) {
      next(err);
    }
  }
}

// ─── Validation Rules ─────────────────────────────────────────────────────────

export const signupValidation = [
  body('name').trim().notEmpty().withMessage('Organization name is required'),
  body('adminEmail').isEmail().withMessage('Valid admin email is required'),
  body('adminPassword').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
];

export const loginValidation = [
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').notEmpty().withMessage('Password is required'),
];
