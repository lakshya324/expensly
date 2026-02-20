// Super Admin Controller
import { Request, Response, NextFunction } from "express";
import { createError } from "../utils/error.js";
import {
  ROLES,
  DEFAULT_PAGE,
  DEFAULT_LIMIT,
  MAX_LIMIT,
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
import { isValidObjectId } from "mongoose";
import { logError } from "../utils/logger.js";
import { User } from "../models/User.model.js";
import { IUserData } from "../types/user.types.js";
import {
  sendSignupApprovedEmail,
  sendSignupRejectedEmail,
} from "../services/email.service.js";

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
      const user = req.user!;
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
          .limit(limit)
          .lean(),
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
      logError(err, {
        message: "Error listing organizations",
        code: "LIST_ORGS_ERROR",
      });
      next(
        createError("Failed to retrieve organizations", 500, "LIST_ORGS_ERROR"),
      );
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
      const user = req.user!;
      const orgId = req.params["id"];
      const isDisabled = req.body["isDisabled"] === "true";

      if (!orgId)
        createError("Organization ID is required", 400, "VALIDATION_ERROR");
      if (!isValidObjectId(orgId))
        createError("Invalid organization ID", 400, "VALIDATION_ERROR");

      const org = await Organization.findById(orgId);
      if (!org) createError("Organization not found", 404, "NOT_FOUND");

      const body = req.body as Record<string, unknown>;
      org.isDisabled = isDisabled;
      await org.save();

      // Email org admin about status change (non-blocking)
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
        // Non-fatal notification
      }

      const payload: ResponsePayload = {
        success: true,
        message: `Organization ${isDisabled ? "disabled" : "enabled"} successfully`,
        timestamp: new Date().toISOString(),
      };

      res.status(200).json(payload);
    } catch (err) {
      logError(err, {
        message: "Error toggling organization status",
        code: "TOGGLE_ORG_STATUS_ERROR",
      });
      next(
        createError(
          "Failed to toggle organization status",
          500,
          "TOGGLE_ORG_STATUS_ERROR",
        ),
      );
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
      const user = req.user!;
      const {
        page: pageQ,
        limit: limitQ,
        orgId,
        role,
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
      if (orgId) filter["orgId"] = orgId;
      if (role) filter["role"] = role;

      const [users, total] = await Promise.all([
        User.find(filter)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        User.countDocuments(filter),
      ]);

      const payload: ResponsePaginationPayload<IUserData> = {
        success: true,
        message: "Users retrieved successfully",
        timestamp: new Date().toISOString(),
        data: {
          data: await Promise.all(users.map(async (u) => await u.data())),
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
      logError(err, {
        message: "Error listing all users",
        code: "LIST_ALL_USERS_ERROR",
      });
      next(
        createError(
          "Failed to retrieve all users",
          500,
          "LIST_ALL_USERS_ERROR",
        ),
      );
    }
  }
}
