import { Request, Response, NextFunction } from "express";
import { verifyAccessToken } from "../services/auth.service.js";
import { AuthRequest } from "../types/types.js";
import { createError } from "../utils/error.js";
import { isValidObjectId } from "mongoose";
import { ROLES } from "../config/constants.js";
import { logError } from "../utils/logger.js";
import { Organization } from "../models/Organization.model.js";
import { User } from "../models/User.model.js";

/**
 * Authentication Middleware - Verifies JWT access token and loads user/org into req context
 * Returns 401 if token is missing/invalid or if user/org is disabled/not found.
 *
 * Usage:
 *   router.get('/protected', authenticate, handler)
 */
export async function authenticate(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { id } = verifyAccessToken(req.get("Authorization"));

    if (!id || !isValidObjectId(id))
      createError("Invalid token payload", 401, "TOKEN_INVALID");

    const user = await User.findById(id);
    if (!user) createError("User not found", 401, "TOKEN_INVALID");
    if (user.isDisabled) createError("User is disabled", 401, "USER_DISABLED");

    // if user is super admin then only put org in req context

    if (user.role !== ROLES.SUPER_ADMIN) {
      if (!user.orgId)
        createError(
          "User does not belong to any organization",
          401,
          "ORG_NOT_FOUND",
        );

      const org = await Organization.findById(user.orgId);
      if (!org) createError("Organization not found", 401, "ORG_NOT_FOUND");
      if (org.isDisabled)
        createError("Organization is disabled", 401, "ORG_DISABLED");

      req.organization = org;
    }

    req.user = user;
    next();
  } catch (err) {
    // logError(err, { message: "Authentication error", code: "AUTH_ERROR" });
    createError("Invalid or missing token", 401, "UNAUTHORIZED");
  }
}
