import { Response, NextFunction } from "express";
import { Types } from "mongoose";
import { AuthRequest } from "../types/types.js";
import { Department } from "../models/Department.model.js";
import { Policy } from "../models/Policy.model.js";
import { Ticket } from "../models/Ticket.model.js";
import { logInfo } from "../utils/logger.js";
import {
  BUDGET_RESET_PERIODS,
  DEFAULT_PAGE,
  DEFAULT_LIMIT,
  MAX_LIMIT,
  TICKET_STATUS,
  PERMISSION_KEY,
  PermissionKey,
} from "../config/constants.js";
import { createError } from "../utils/error.js";
import {
  ResponsePayload,
  ResponsePaginationPayload,
} from "../types/payloads.types.js";
import { IDepartmentData } from "../types/department.types.js";
import { emitDeptCreated, emitDeptUpdate } from "../websocket/handlers/dept.handler.js";
import { initNextResetDate } from "../services/budget.service.js";
import { propagateDepartmentRename } from "../services/propagation.service.js";
import { logError } from "../utils/logger.js";

export default class DepartmentController {
  /** GET /api/admin/departments */
  static async list(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const org = req.organization!;
      const {
        page: pageQ,
        limit: limitQ,
        active,
        search: searchQ,
      } = req.query as Record<string, string | undefined>;
      const page = Math.max(1, parseInt(pageQ ?? "") || DEFAULT_PAGE);
      const limit = Math.min(
        MAX_LIMIT,
        Math.max(1, parseInt(limitQ ?? "") || DEFAULT_LIMIT),
      );
      const skip = (page - 1) * limit;

      const filter: Record<string, unknown> = { orgId: org._id };
      if (active !== undefined) filter["isActive"] = active === "true";
      if (searchQ) filter["name"] = { $regex: searchQ, $options: "i" };

      const [depts, total] = await Promise.all([
        Department.find(filter).sort({ name: 1 }).skip(skip).limit(limit),
        Department.countDocuments(filter),
      ]);

      const payload: ResponsePaginationPayload<IDepartmentData> = {
        success: true,
        message: "Departments retrieved successfully",
        timestamp: new Date().toISOString(),
        data: {
          data: depts.map((d) => d.toData()),
          pagination: {
            page,
            pageSize: depts.length,
            totalItems: total,
            totalPages: Math.ceil(total / limit),
          },
        },
      };
      res.status(200).json(payload);
    } catch (err) {
      next(err);
    }
  }

  /** GET /api/admin/departments/:id */
  static async getOne(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const org = req.organization!;
      const dept = await Department.findOne({
        _id: req.params["id"],
        orgId: org._id,
      });
      if (!dept) throw createError("Department not found", 404, "NOT_FOUND");

      const payload: ResponsePayload<IDepartmentData> = {
        success: true,
        message: "Department retrieved successfully",
        timestamp: new Date().toISOString(),
        data: dept.toData(),
      };
      res.status(200).json(payload);
    } catch (err) {
      next(err);
    }
  }

  /** POST /api/admin/departments */
  static async create(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const org = req.organization!;
      const user = req.user!;
      const { name, budget, budgetResetPeriod, approvalThresholds, permissions, policyId } =
        req.body as {
          name: string;
          budget?: number | string;
          budgetResetPeriod?: string;
          approvalThresholds?: Record<string, number>;
          permissions?: Record<string, boolean>;
          policyId?: string | null;
        };

      const duplicate = await Department.findOne({
        orgId: org._id,
        name: { $regex: new RegExp(`^${name}$`, "i") },
      });
      if (duplicate)
        throw createError(
          `Department "${name}" already exists`,
          409,
          "DUPLICATE_DEPARTMENT",
        );

      const resetPeriod = Object.values(BUDGET_RESET_PERIODS).includes(
        budgetResetPeriod as any,
      )
        ? (budgetResetPeriod as any)
        : BUDGET_RESET_PERIODS.NONE;

      // const safePerms: Record<string, boolean> = {};
      // if (permissions && typeof permissions === "object") {
      //   const validKeys = Object.values(PERMISSION_KEY) as string[];
      //   for (const [key, value] of Object.entries(permissions)) {
      //     if (validKeys.includes(key) && typeof value === "boolean") {
      //       safePerms[key] = value;
      //     }
      //   }
      // }

      const policyDoc = policyId
        ? await Policy.findById(policyId).select("_id name").lean<{ _id: any; name: string }>()
        : null;

      const dept = await Department.create({
        orgId: org._id,
        name: name.trim(),
        budget: parseFloat(String(budget)) || 0,
        spent: 0,
        budgetResetPeriod: resetPeriod,
        nextResetDate: initNextResetDate(resetPeriod),
        approvalThresholds: new Map(
          Object.entries(approvalThresholds ?? {}),
        ),
        // ...(Object.keys(safePerms).length > 0 ? { permissions: safePerms } : {}),
        permissions: permissions && typeof permissions === "object" ? permissions : {},
        policyId: policyId ? new Types.ObjectId(policyId) : null,
        policySnapshot: policyDoc ? { _id: policyDoc._id, name: policyDoc.name } : null,
      });

      emitDeptCreated(org._id.toString(), dept.toData(), user._id.toString());

      const payload: ResponsePayload<IDepartmentData> = {
        success: true,
        message: "Department created successfully",
        timestamp: new Date().toISOString(),
        data: dept.toData(),
      };
      res.status(201).json(payload);
    } catch (err) {
      next(err);
    }
  }

  /** PUT /api/admin/departments/:id */
  static async update(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const org = req.organization!;
      const user = req.user!;
      const dept = await Department.findOne({
        _id: req.params["id"],
        orgId: org._id,
      });
      if (!dept) throw createError("Department not found", 404, "NOT_FOUND");

      const { name, budget, budgetResetPeriod, approvalThresholds } =
        req.body as {
          name?: string;
          budget?: number | string;
          budgetResetPeriod?: string;
          approvalThresholds?: Record<string, number>;
        };

      const prevName = dept.name;
      if (name !== undefined) dept.name = name.trim();
      if (budget !== undefined) dept.budget = parseFloat(String(budget));
      if (budgetResetPeriod !== undefined) {
        const validPeriod = Object.values(BUDGET_RESET_PERIODS).includes(
          budgetResetPeriod as any,
        );
        if (!validPeriod)
          throw createError("Invalid budgetResetPeriod", 400, "VALIDATION_ERROR");
        dept.budgetResetPeriod = budgetResetPeriod as any;
        dept.nextResetDate = initNextResetDate(budgetResetPeriod as any);
      }
      if (approvalThresholds !== undefined) {
        dept.approvalThresholds = new Map(Object.entries(approvalThresholds));
      }

      await dept.save();

      if (name !== undefined && dept.name !== prevName) {
        propagateDepartmentRename(dept._id.toString(), dept.name)
          .catch((err) => logError(err, { message: "propagateDepartmentRename failed", code: "PROPAGATION_ERROR" }));
      }

      emitDeptUpdate(org._id.toString(), dept.toData(), user._id.toString());

      const payload: ResponsePayload<IDepartmentData> = {
        success: true,
        message: "Department updated successfully",
        timestamp: new Date().toISOString(),
        data: dept.toData(),
      };
      res.status(200).json(payload);
    } catch (err) {
      next(err);
    }
  }

  /** PATCH /api/admin/departments/:id/permissions */
  static async updatePermissions(
    req: AuthRequest,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const org = req.organization!;
      const user = req.user!;
      const dept = await Department.findOne({
        _id: req.params["id"],
        orgId: org._id,
      });
      if (!dept) throw createError("Department not found", 404, "NOT_FOUND");

      const { permissions, policyId } = req.body as {
        permissions?: Record<string, boolean>;
        policyId?: string | null;
      };

      logInfo(`Updating permissions for dept ${dept._id.toString()}`);

      if (permissions && typeof permissions === "object") {
        const validKeys = Object.values(PERMISSION_KEY) as string[];
        for (const [key, value] of Object.entries(permissions)) {
          if (validKeys.includes(key) && typeof value === "boolean") {
            (dept.permissions as Record<string, boolean>)[key] = value;
          }
        }
        dept.markModified("permissions");
      }

      if (policyId !== undefined) {
        dept.policyId = policyId ? new Types.ObjectId(policyId) : null;
        if (policyId) {
          const policyDoc = await Policy.findById(policyId).select("_id name").lean<{ _id: any; name: string }>();
          dept.policySnapshot = policyDoc ? { _id: policyDoc._id, name: policyDoc.name } : null;
        } else {
          dept.policySnapshot = null;
        }
      }

      await dept.save();

      emitDeptUpdate(org._id.toString(), dept.toData(), user._id.toString());

      const payload: ResponsePayload<IDepartmentData> = {
        success: true,
        message: "Department permissions updated",
        timestamp: new Date().toISOString(),
        data: dept.toData(),
      };
      res.status(200).json(payload);
    } catch (err) {
      next(err);
    }
  }

  /** DELETE /api/admin/departments/:id  (soft delete) */
  static async deactivate(
    req: AuthRequest,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const org = req.organization!;
      const dept = await Department.findOne({
        _id: req.params["id"],
        orgId: org._id,
      });
      if (!dept) throw createError("Department not found", 404, "NOT_FOUND");

      const activeTickets = await Ticket.countDocuments({
        department: dept._id,
        status: {
          $in: [TICKET_STATUS.PENDING, TICKET_STATUS.AWAITING_FINANCE],
        },
      });
      if (activeTickets > 0)
        throw createError(
          `Cannot deactivate: ${activeTickets} active ticket(s) still in this department`,
          409,
          "DEPT_HAS_ACTIVE_TICKETS",
        );

      dept.isActive = false;
      await dept.save();

      const payload: ResponsePayload<{ isActive: boolean }> = {
        success: true,
        message: "Department deactivated",
        timestamp: new Date().toISOString(),
        data: { isActive: false },
      };
      res.status(200).json(payload);
    } catch (err) {
      next(err);
    }
  }

  /** POST /api/admin/departments/:id/reset-budget */
  static async resetBudget(
    req: AuthRequest,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const org = req.organization!;
      const dept = await Department.findOne({
        _id: req.params["id"],
        orgId: org._id,
      });
      if (!dept) throw createError("Department not found", 404, "NOT_FOUND");

      dept.spent = 0;
      await dept.save();

      const payload: ResponsePayload<IDepartmentData> = {
        success: true,
        message: "Department budget reset successfully",
        timestamp: new Date().toISOString(),
        data: dept.toData(),
      };
      res.status(200).json(payload);
    } catch (err) {
      next(err);
    }
  }

  /** GET /api/admin/departments/:id/tags  (admin view) */
  /** GET /api/users/departments/:id/tags  (user view — same response) */
  static async getTags(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const org = req.organization!;
      const dept = await Department.findOne({
        _id: req.params["id"],
        orgId: org._id,
        isActive: true,
      }).select("tags");
      if (!dept) throw createError("Department not found", 404, "NOT_FOUND");

      const payload: ResponsePayload<string[]> = {
        success: true,
        message: "Tags retrieved successfully",
        timestamp: new Date().toISOString(),
        data: dept.tags,
      };
      res.status(200).json(payload);
    } catch (err) {
      next(err);
    }
  }

  /** DELETE /api/admin/departments/:id/tags/:tag */
  static async removeTag(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const org = req.organization!;
      const { id, tag } = req.params as { id: string; tag: string };

      const dept = await Department.findOneAndUpdate(
        { _id: id, orgId: org._id },
        { $pull: { tags: decodeURIComponent(tag) } },
        { new: true },
      );
      if (!dept) throw createError("Department not found", 404, "NOT_FOUND");

      const payload: ResponsePayload<string[]> = {
        success: true,
        message: "Tag removed",
        timestamp: new Date().toISOString(),
        data: dept.tags,
      };
      res.status(200).json(payload);
    } catch (err) {
      next(err);
    }
  }

  /** GET /api/users/departments — active depts in org (for dropdowns) */
  static async listForUser(
    req: AuthRequest,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const org = req.organization!;
      const depts = await Department.find({
        orgId: org._id,
        isActive: true,
      })
        .select("_id name budget spent approvalThresholds")
        .sort({ name: 1 });

      const payload: ResponsePayload<IDepartmentData[]> = {
        success: true,
        message: "Departments retrieved successfully",
        timestamp: new Date().toISOString(),
        data: depts.map((d) => d.toData()),
      };
      res.status(200).json(payload);
    } catch (err) {
      next(err);
    }
  }
}
