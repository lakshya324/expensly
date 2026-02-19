// Admin Controller
import { body } from 'express-validator';
import { Request, Response, NextFunction } from 'express';
import { User, Organization } from '../models/index.js';
import { hashPassword } from '../services/auth.service.js';
import { createError } from '../middleware/errorHandler.js';
import { getIO } from '../websocket/wsServer.js';
import { ROLES, DEFAULT_PAGE, DEFAULT_LIMIT, MAX_LIMIT } from '../config/constants.js';

const buildPagination = (page: number, limit: number, total: number) => ({
  page,
  limit,
  total,
  pages: Math.ceil(total / limit),
});

export class AdminController {
  // ─── Users ───────────────────────────────────────────────────────────────

  static async listUsers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { orgId } = req.user!;
      const { page: pageQ, limit: limitQ, department: deptQ } = req.query as Record<string, string | undefined>;
      const page = Math.max(1, parseInt(pageQ ?? '') || DEFAULT_PAGE);
      const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(limitQ ?? '') || DEFAULT_LIMIT));
      const skip = (page - 1) * limit;

      const filter: Record<string, unknown> = { orgId, role: { $ne: ROLES.SUPER_ADMIN } };
      if (deptQ) filter['department'] = deptQ;

      const [users, total] = await Promise.all([
        User.find(filter)
          .select('-passwordHash')
          .populate('managerId', 'name email')
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

  static async createUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { orgId } = req.user!;
      const { name, email, password, department, managerId } = req.body as {
        name: string;
        email: string;
        password: string;
        department: string;
        managerId?: string;
      };

      const org = await Organization.findById(orgId);
      if (!org) throw createError(404, 'Organization not found', 'ORG_NOT_FOUND');
      const deptExists = org.departments.some((d) => d.name === department);
      if (!deptExists)
        throw createError(400, `Department "${department}" not found`, 'INVALID_DEPARTMENT');

      const existing = await User.findOne({ email: email.toLowerCase() });
      if (existing) throw createError(409, 'Email already exists', 'DUPLICATE_EMAIL');

      const passwordHash = await hashPassword(password);

      const user = await User.create({
        name,
        email: email.toLowerCase(),
        passwordHash,
        role: ROLES.USER,
        orgId,
        department,
        managerId: managerId ?? null,
      });

      getIO().to(orgId!).emit('user_update', {
        type: 'user_update',
        userId: user._id.toString(),
        timestamp: new Date().toISOString(),
      });

      const { passwordHash: _, ...safeUser } = user.toObject();
      res.status(201).json({ success: true, user: safeUser });
    } catch (err) {
      next(err);
    }
  }

  static async editUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { orgId } = req.user!;
      const userId = req.params['id']!;

      const user = await User.findOne({ _id: userId, orgId });
      if (!user) throw createError(404, 'User not found', 'NOT_FOUND');

      const { name, department, managerId } = req.body as {
        name?: string;
        department?: string;
        managerId?: string | null;
      };

      if (name !== undefined) user.name = name;
      if (department !== undefined) {
        const org = await Organization.findById(orgId);
        const deptExists = org?.departments.some((d) => d.name === department);
        if (!deptExists)
          throw createError(400, `Department "${department}" not found`, 'INVALID_DEPARTMENT');
        user.department = department;
      }
      if (managerId !== undefined) user.managerId = managerId as unknown as typeof user.managerId;

      await user.save();

      getIO().to(orgId!).emit('user_update', {
        type: 'user_update',
        userId: user._id.toString(),
        timestamp: new Date().toISOString(),
      });

      res.status(200).json({ success: true, message: 'User updated successfully' });
    } catch (err) {
      next(err);
    }
  }

  static async toggleUserStatus(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { orgId } = req.user!;
      const userId = req.params['id']!;

      const user = await User.findOne({ _id: userId, orgId });
      if (!user) throw createError(404, 'User not found', 'NOT_FOUND');

      const body = req.body as Record<string, unknown>;
      user.isDisabled =
        body['isDisabled'] !== undefined ? Boolean(body['isDisabled']) : !user.isDisabled;
      await user.save();

      const io = getIO();
      const payload = {
        type: 'user_disable',
        userId: user._id.toString(),
        isDisabled: user.isDisabled,
        timestamp: new Date().toISOString(),
      };

      io.to(orgId!).emit('user_disable', payload);
      io.to(user._id.toString()).emit('user_disable', payload);

      res.status(200).json({
        success: true,
        message: `User ${user.isDisabled ? 'disabled' : 'enabled'} successfully`,
        isDisabled: user.isDisabled,
      });
    } catch (err) {
      next(err);
    }
  }

  // ─── Departments ─────────────────────────────────────────────────────────

  static async listDepartments(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const org = await Organization.findById(req.user!.orgId).lean();
      if (!org) throw createError(404, 'Organization not found', 'ORG_NOT_FOUND');
      res
        .status(200)
        .json({ success: true, departments: org.departments, totalBudget: org.totalBudget });
    } catch (err) {
      next(err);
    }
  }

  static async addDepartment(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { orgId } = req.user!;
      const { name, budget, currency } = req.body as {
        name: string;
        budget?: number | string;
        currency?: string;
      };

      const org = await Organization.findById(orgId);
      if (!org) throw createError(404, 'Organization not found', 'ORG_NOT_FOUND');

      const duplicate = org.departments.some(
        (d) => d.name.toLowerCase() === name.toLowerCase()
      );
      if (duplicate)
        throw createError(409, `Department "${name}" already exists`, 'DUPLICATE_DEPARTMENT');

      org.departments.push({
        name,
        budget: parseFloat(String(budget)) || 0,
        spent: 0,
        currency: (currency ?? 'USD') as 'USD' | 'INR',
      } as Parameters<typeof org.departments.push>[0]);
      org.totalBudget = org.departments.reduce((sum, d) => sum + (d.budget ?? 0), 0);
      await org.save();

      res
        .status(201)
        .json({ success: true, departments: org.departments, totalBudget: org.totalBudget });
    } catch (err) {
      next(err);
    }
  }

  static async editDepartment(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { orgId } = req.user!;
      const org = await Organization.findById(orgId);
      if (!org) throw createError(404, 'Organization not found', 'ORG_NOT_FOUND');

      const dept = org.departments.id(req.params['id'] as string);
      if (!dept) throw createError(404, 'Department not found', 'NOT_FOUND');

      const { name, budget, currency } = req.body as {
        name?: string;
        budget?: number | string;
        currency?: string;
      };
      if (name !== undefined) dept.name = name;
      if (budget !== undefined) dept.budget = parseFloat(String(budget));
      if (currency !== undefined) dept.currency = currency as 'USD' | 'INR';

      org.totalBudget = org.departments.reduce((sum, d) => sum + (d.budget ?? 0), 0);
      await org.save();

      res
        .status(200)
        .json({ success: true, departments: org.departments, totalBudget: org.totalBudget });
    } catch (err) {
      next(err);
    }
  }

  static async resetDepartmentSpent(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { orgId } = req.user!;
      const org = await Organization.findById(orgId);
      if (!org) throw createError(404, 'Organization not found', 'ORG_NOT_FOUND');

      const dept = org.departments.id(req.params['id'] as string);
      if (!dept) throw createError(404, 'Department not found', 'NOT_FOUND');

      dept.spent = 0;
      await org.save();

      res.status(200).json({ success: true, departments: org.departments });
    } catch (err) {
      next(err);
    }
  }
}

// ─── Validation ───────────────────────────────────────────────────────────────

export const createUserValidation = [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('department').trim().notEmpty().withMessage('Department is required'),
];

export const addDepartmentValidation = [
  body('name').trim().notEmpty().withMessage('Department name is required'),
  body('budget').isFloat({ min: 0 }).withMessage('Budget must be a non-negative number'),
];
