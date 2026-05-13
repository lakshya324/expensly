import { Request, Response, NextFunction } from "express";
import type { Role } from "../config/constants.js";
import { AuthRequest } from "../types/types.js";
import { createError } from "../utils/error.js";

/**
 * authorize(...roles) — middleware factory.
 * Must be used after authenticate.
 *
 * Usage: router.get('/route', authenticate, authorize('admin', 'super_admin'), handler)
 */
export const authorize = (...roles: Role[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) throw createError("User not authenticated", 401, "UNAUTHORIZED");

    if (!roles.includes(req.user.role))
      throw createError("Forbidden: insufficient permissions", 403, "FORBIDDEN");

    next();
  };
};
