// Super Admin Controller
import { Request, Response, NextFunction } from 'express';
import { User, Organization } from '../models/index.js';
import { createError } from '../middleware/errorHandler.js';
import { ROLES, DEFAULT_PAGE, DEFAULT_LIMIT, MAX_LIMIT } from '../config/constants.js';

const buildPagination = (page: number, limit: number, total: number) => ({
  page,
  limit,
  total,
  pages: Math.ceil(total / limit),
});

export class SuperAdminController {
  /**
   * GET /api/superadmin/organizations
   */
  static async listOrganizations(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { page: pageQ, limit: limitQ, search, isDisabled: isDisabledQ } = req.query as Record<
        string,
        string | undefined
      >;
      const page = Math.max(1, parseInt(pageQ ?? '') || DEFAULT_PAGE);
      const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(limitQ ?? '') || DEFAULT_LIMIT));
      const skip = (page - 1) * limit;

      const filter: Record<string, unknown> = {};
      if (search) {
        filter['$or'] = [
          { name: { $regex: search, $options: 'i' } },
          { slug: { $regex: search, $options: 'i' } },
        ];
      }
      if (isDisabledQ !== undefined) {
        filter['isDisabled'] = isDisabledQ === 'true';
      }

      const [orgs, total] = await Promise.all([
        Organization.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
        Organization.countDocuments(filter),
      ]);

      res.status(200).json({ success: true, data: orgs, pagination: buildPagination(page, limit, total) });
    } catch (err) {
      next(err);
    }
  }

  /**
   * PATCH /api/superadmin/organizations/:id/disable
   */
  static async toggleOrgStatus(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const org = await Organization.findById(req.params['id']);
      if (!org) throw createError(404, 'Organization not found', 'NOT_FOUND');

      const body = req.body as Record<string, unknown>;
      org.isDisabled =
        body['isDisabled'] !== undefined ? Boolean(body['isDisabled']) : !org.isDisabled;
      await org.save();

      res.status(200).json({
        success: true,
        message: `Organization ${org.isDisabled ? 'disabled' : 'enabled'} successfully`,
        isDisabled: org.isDisabled,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/superadmin/users
   */
  static async listAllUsers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { page: pageQ, limit: limitQ, orgId, role } = req.query as Record<
        string,
        string | undefined
      >;
      const page = Math.max(1, parseInt(pageQ ?? '') || DEFAULT_PAGE);
      const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(limitQ ?? '') || DEFAULT_LIMIT));
      const skip = (page - 1) * limit;

      const filter: Record<string, unknown> = { role: { $ne: ROLES.SUPER_ADMIN } };
      if (orgId) filter['orgId'] = orgId;
      if (role) filter['role'] = role;

      const [users, total] = await Promise.all([
        User.find(filter)
          .select('-passwordHash')
          .populate('orgId', 'name slug')
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        User.countDocuments(filter),
      ]);

      res.status(200).json({ success: true, data: users, pagination: buildPagination(page, limit, total) });
    } catch (err) {
      next(err);
    }
  }
}
