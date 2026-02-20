// Super Admin Controller
import { Request, Response, NextFunction } from "express";
import { createError } from "../utils/error.js";
import {
  ROLES,
  DEFAULT_PAGE,
  DEFAULT_LIMIT,
  MAX_LIMIT,
  CURRENCIES,
} from "../config/constants.js";
import { AuthRequest } from "../types/types.js";
import { Organization } from "../models/Organization.model.js";
import {
  ResponsePaginationPayload,
  ResponsePayload,
} from "../types/payloads.types.js";
import {
  IOrganization,
  IOrganizationData,
} from "../types/organization.types.js";
import { isValidObjectId, Types } from "mongoose";
import { logError } from "../utils/logger.js";
import { User } from "../models/User.model.js";
import { IUserData } from "../types/user.types.js";
import {
  sendSignupApprovedEmail,
  sendSignupRejectedEmail,
  sendWelcomeEmail,
} from "../services/email.service.js";
import { hashPassword } from "../services/auth.service.js";

export default class SuperAdminController {
  /**
   * GET /api/superadmin/organizations
   */
  static async listOrganizations(
    req: AuthRequest,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const {
        page: pageQ,
        limit: limitQ,
        search,
        isDisabled: isDisabledQ,
      } = req.query as Record<string, string | undefined>;
      const page = Math.max(1, parseInt(pageQ ?? "") || DEFAULT_PAGE);
      const limit = Math.min(
        MAX_LIMIT,
        Math.max(1, parseInt(limitQ ?? "") || DEFAULT_LIMIT),
      );
      const skip = (page - 1) * limit;

      const filter: Record<string, unknown> = {};
      if (search) {
        filter["$or"] = [
          { name: { $regex: search, $options: "i" } },
          { slug: { $regex: search, $options: "i" } },
        ];
      }
      if (isDisabledQ !== undefined) {
        filter["isDisabled"] = isDisabledQ === "true";
      }

      const [orgs, total] = await Promise.all([
        Organization.find(filter)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit),
        Organization.countDocuments(filter),
      ]);

      const payload: ResponsePaginationPayload<IOrganizationData> = {
        success: true,
        message: "Organizations retrieved successfully",
        timestamp: new Date().toISOString(),
        data: {
          data: orgs.map((org) => org.data()),
          pagination: {
            page,
            pageSize: orgs.length,
            totalItems: total,
            totalPages: Math.ceil(total / limit),
          },
        },
      };

      res.status(200).json(payload);
    } catch (err) {
      logError(err, { message: "Error listing organizations", code: "LIST_ORGS_ERROR" });
      next(err);
    }
  }

  /**
   * POST /api/superadmin/organizations
   */
  static async createOrganization(
    req: AuthRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { name, slug, baseCurrency, isDisabled } = req.body as {
        name: string;
        slug: string;
        baseCurrency?: string;
        isDisabled?: boolean;
      };

      if (!name?.trim())
        throw createError("Organization name is required", 400, "VALIDATION_ERROR");
      if (!slug?.trim())
        throw createError("Organization slug is required", 400, "VALIDATION_ERROR");

      const normalizedSlug = slug
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, "-")
        .replace(/-+/g, "-")
        .trim();

      const existing = await Organization.findOne({ slug: normalizedSlug });
      if (existing)
        throw createError("Organization slug already in use", 409, "ORG_SLUG_TAKEN");

      const org = await Organization.create({
        name: name.trim(),
        slug: normalizedSlug,
        baseCurrency: baseCurrency ?? "USD",
        isDisabled: isDisabled ?? false,
      });

      const payload: ResponsePayload<IOrganizationData> = {
        success: true,
        message: "Organization created successfully",
        timestamp: new Date().toISOString(),
        data: org.data(),
      };

      res.status(201).json(payload);
    } catch (err) {
      logError(err, { message: "Error creating organization", code: "CREATE_ORG_ERROR" });
      next(err);
    }
  }

  /**
   * PATCH /api/superadmin/organizations/:id
   */
  static async updateOrganization(
    req: AuthRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const orgId = req.params["id"];
      if (!orgId || !isValidObjectId(orgId))
        throw createError("Invalid organization ID", 400, "VALIDATION_ERROR");

      const org = await Organization.findById(orgId);
      if (!org) throw createError("Organization not found", 404, "NOT_FOUND");

      const { name, baseCurrency, activeCurrencies } = req.body as {
        name?: string;
        baseCurrency?: string;
        activeCurrencies?: string[];
      };

      if (name !== undefined) org.name = name.trim();
      if (baseCurrency !== undefined) {
        if (!CURRENCIES.includes(baseCurrency as any))
          throw createError("Invalid base currency", 400, "VALIDATION_ERROR");
        org.baseCurrency = baseCurrency as any;
      }
      if (activeCurrencies !== undefined) {
        org.activeCurrencies = activeCurrencies as any;
      }

      await org.save();

      const payload: ResponsePayload<IOrganizationData> = {
        success: true,
        message: "Organization updated successfully",
        timestamp: new Date().toISOString(),
        data: org.data(),
      };

      res.status(200).json(payload);
    } catch (err) {
      logError(err, { message: "Error updating organization", code: "UPDATE_ORG_ERROR" });
      next(err);
    }
  }

  /**
   * PATCH /api/superadmin/organizations/:id/disable
   */
  static async toggleOrgStatus(
    req: AuthRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const orgId = req.params["id"];
      const isDisabled = req.body["isDisabled"] === true || req.body["isDisabled"] === "true";

      if (!orgId || !isValidObjectId(orgId))
        throw createError("Invalid organization ID", 400, "VALIDATION_ERROR");

      const org = await Organization.findById(orgId);
      if (!org) throw createError("Organization not found", 404, "NOT_FOUND");

      org.isDisabled = isDisabled;
      await org.save();

      // Email org admin (non-blocking)
      try {
        const orgAdmin = await User.findOne({ orgId: org._id, role: ROLES.ADMIN }).select("email name");
        if (orgAdmin) {
          if (!isDisabled) {
            sendSignupApprovedEmail(orgAdmin.email, orgAdmin.name, org.name);
          } else {
            sendSignupRejectedEmail(orgAdmin.email, orgAdmin.name, org.name);
          }
        }
      } catch {
        // Non-fatal
      }

      const payload: ResponsePayload = {
        success: true,
        message: `Organization ${isDisabled ? "disabled" : "enabled"} successfully`,
        timestamp: new Date().toISOString(),
      };

      res.status(200).json(payload);
    } catch (err) {
      logError(err, { message: "Error toggling organization status", code: "TOGGLE_ORG_STATUS_ERROR" });
      next(err);
    }
  }

  /**
   * GET /api/superadmin/users
   */
  static async listAllUsers(
    req: AuthRequest,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const {
        page: pageQ,
        limit: limitQ,
        orgId,
        role,
        search,
      } = req.query as Record<string, string | undefined>;
      const page = Math.max(1, parseInt(pageQ ?? "") || DEFAULT_PAGE);
      const limit = Math.min(
        MAX_LIMIT,
        Math.max(1, parseInt(limitQ ?? "") || DEFAULT_LIMIT),
      );
      const skip = (page - 1) * limit;

      const filter: Record<string, unknown> = {
        role: { $ne: ROLES.SUPER_ADMIN },
      };
      if (orgId && isValidObjectId(orgId)) filter["orgId"] = new Types.ObjectId(orgId);
      if (role) filter["role"] = role;
      if (search) {
        filter["$or"] = [
          { name: { $regex: search, $options: "i" } },
          { email: { $regex: search, $options: "i" } },
        ];
      }

      const [users, total] = await Promise.all([
        User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
        User.countDocuments(filter),
      ]);

      const payload: ResponsePaginationPayload<IUserData> = {
        success: true,
        message: "Users retrieved successfully",
        timestamp: new Date().toISOString(),
        data: {
          data: await Promise.all(users.map((u) => u.data())),
          pagination: {
            page,
            pageSize: users.length,
            totalItems: total,
            totalPages: Math.ceil(total / limit),
          },
        },
      };

      res.status(200).json(payload);
    } catch (err) {
      logError(err, { message: "Error listing all users", code: "LIST_ALL_USERS_ERROR" });
      next(err);
    }
  }

  /**
   * POST /api/superadmin/users
   */
  static async createUser(
    req: AuthRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { name, email, password, role, orgId, isDisabled } = req.body as {
        name: string;
        email: string;
        password: string;
        role?: string;
        orgId?: string;
        isDisabled?: boolean;
      };

      if (!name?.trim())
        throw createError("Name is required", 400, "VALIDATION_ERROR");
      if (!email?.trim())
        throw createError("Email is required", 400, "VALIDATION_ERROR");
      if (!password?.trim())
        throw createError("Password is required", 400, "VALIDATION_ERROR");

      const assignedRole = (role as any) ?? ROLES.USER;
      if (![ROLES.ADMIN, ROLES.USER].includes(assignedRole))
        throw createError("Role must be 'admin' or 'user'", 400, "VALIDATION_ERROR");

      if (!orgId || !isValidObjectId(orgId))
        throw createError("A valid orgId is required", 400, "VALIDATION_ERROR");

      const [existingUser, org] = await Promise.all([
        User.findOne({ email: email.toLowerCase() }),
        Organization.findById(orgId),
      ]);
      if (existingUser)
        throw createError("Email already in use", 409, "EMAIL_TAKEN");
      if (!org)
        throw createError("Organization not found", 404, "ORG_NOT_FOUND");

      const passwordHash = await hashPassword(password);
      const user = await User.create({
        name: name.trim(),
        email: email.toLowerCase().trim(),
        passwordHash,
        role: assignedRole,
        orgId: new Types.ObjectId(orgId),
        isDisabled: isDisabled ?? false,
      });

      // Send welcome email (non-blocking)
      sendWelcomeEmail(user.email, user.name, org.name, password).catch(() => {});

      const payload: ResponsePayload<IUserData> = {
        success: true,
        message: "User created successfully",
        timestamp: new Date().toISOString(),
        data: await user.data(org),
      };

      res.status(201).json(payload);
    } catch (err) {
      logError(err, { message: "Error creating user", code: "CREATE_USER_ERROR" });
      next(err);
    }
  }

  /**
   * PATCH /api/superadmin/users/:id
   */
  static async updateUser(
    req: AuthRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const userId = req.params["id"];
      if (!userId || !isValidObjectId(userId))
        throw createError("Invalid user ID", 400, "VALIDATION_ERROR");

      const user = await User.findById(userId);
      if (!user) throw createError("User not found", 404, "NOT_FOUND");
      if (user.role === ROLES.SUPER_ADMIN)
        throw createError("Cannot edit super admin users", 403, "FORBIDDEN");

      const { name, role, orgId } = req.body as {
        name?: string;
        role?: string;
        orgId?: string;
      };

      if (name !== undefined) user.name = name.trim();
      if (role !== undefined) {
        if (![ROLES.ADMIN, ROLES.USER].includes(role as any))
          throw createError("Role must be 'admin' or 'user'", 400, "VALIDATION_ERROR");
        user.role = role as any;
      }
      if (orgId !== undefined) {
        if (!isValidObjectId(orgId))
          throw createError("Invalid orgId", 400, "VALIDATION_ERROR");
        const org = await Organization.findById(orgId);
        if (!org) throw createError("Organization not found", 404, "ORG_NOT_FOUND");
        user.orgId = new Types.ObjectId(orgId);
      }

      await user.save();

      const payload: ResponsePayload<IUserData> = {
        success: true,
        message: "User updated successfully",
        timestamp: new Date().toISOString(),
        data: await user.data(),
      };

      res.status(200).json(payload);
    } catch (err) {
      logError(err, { message: "Error updating user", code: "UPDATE_USER_ERROR" });
      next(err);
    }
  }

  /**
   * PATCH /api/superadmin/users/:id/disable
   */
  static async toggleUserStatus(
    req: AuthRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const userId = req.params["id"];
      const isDisabled = req.body["isDisabled"] === true || req.body["isDisabled"] === "true";

      if (!userId || !isValidObjectId(userId))
        throw createError("Invalid user ID", 400, "VALIDATION_ERROR");

      const user = await User.findById(userId);
      if (!user) throw createError("User not found", 404, "NOT_FOUND");
      if (user.role === ROLES.SUPER_ADMIN)
        throw createError("Cannot disable super admin users", 403, "FORBIDDEN");

      user.isDisabled = isDisabled;
      await user.save();

      const payload: ResponsePayload = {
        success: true,
        message: `User ${isDisabled ? "disabled" : "enabled"} successfully`,
        timestamp: new Date().toISOString(),
      };

      res.status(200).json(payload);
    } catch (err) {
      logError(err, { message: "Error toggling user status", code: "TOGGLE_USER_STATUS_ERROR" });
      next(err);
    }
  }
}
