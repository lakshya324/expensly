import { Response, NextFunction } from "express";
import { AuthRequest } from "../types/types.js";
import {
  createCategory,
  listCategories,
  updateCategory,
  deleteCategory,
} from "../services/category.service.js";
import { createError } from "../utils/error.js";
import { ResponsePayload } from "../types/payloads.types.js";
import { ICategoryData } from "../types/category.types.js";
import { AUDIT_ACTION, ENTITY_TYPE } from "../config/constants.js";
import { logAction } from "../services/auditLog.service.js";

export default class CategoryController {
  /** GET /api/admin/categories */
  static async list(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const org = req.organization!;
      const includeInactive =
        (req.query["includeInactive"] as string) === "true";

      const categories = await listCategories(
        org._id.toString(),
        includeInactive,
      );

      const payload: ResponsePayload<ICategoryData[]> = {
        success: true,
        message: "Categories retrieved successfully",
        timestamp: new Date().toISOString(),
        data: categories,
      };
      res.status(200).json(payload);
    } catch (err) {
      next(err);
    }
  }

  /** POST /api/admin/categories */
  static async create(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const org = req.organization!;
      const user = req.user!;
      const { name, description } = req.body as {
        name?: string;
        description?: string;
      };
      if (!name) throw createError("name is required", 400, "VALIDATION_ERROR");

      const category = await createCategory({
        orgId: org._id.toString(),
        name,
        description,
        createdBy: user._id.toString(),
      });

      logAction({
        orgId: org._id,
        entityType: ENTITY_TYPE.CATEGORY,
        entityId: category._id,
        action: AUDIT_ACTION.CREATED,
        performedBy: user._id,
        ip: req.ip ?? null,
      });

      const payload: ResponsePayload<ICategoryData> = {
        success: true,
        message: "Category created successfully",
        timestamp: new Date().toISOString(),
        data: category,
      };
      res.status(201).json(payload);
    } catch (err) {
      next(err);
    }
  }

  /** PATCH /api/admin/categories/:id */
  static async update(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const org = req.organization!;
      const user = req.user!;
      const categoryId = req.params["id"] as string;
      const { name, description, isActive } = req.body as {
        name?: string;
        description?: string;
        isActive?: boolean;
      };

      const category = await updateCategory(org._id.toString(), categoryId, {
        name,
        description,
        isActive,
      });

      logAction({
        orgId: org._id,
        entityType: ENTITY_TYPE.CATEGORY,
        entityId: categoryId,
        action: AUDIT_ACTION.UPDATED,
        performedBy: user._id,
        ip: req.ip ?? null,
        metadata: { name, description, isActive },
      });

      const payload: ResponsePayload<ICategoryData> = {
        success: true,
        message: "Category updated successfully",
        timestamp: new Date().toISOString(),
        data: category,
      };
      res.status(200).json(payload);
    } catch (err) {
      next(err);
    }
  }

  /** DELETE /api/admin/categories/:id */
  static async remove(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const org = req.organization!;
      const user = req.user!;
      const categoryId = req.params["id"] as string;

      await deleteCategory(org._id.toString(), categoryId);

      logAction({
        orgId: org._id,
        entityType: ENTITY_TYPE.CATEGORY,
        entityId: categoryId,
        action: AUDIT_ACTION.DELETED,
        performedBy: user._id,
        ip: req.ip ?? null,
      });

      const payload: ResponsePayload = {
        success: true,
        message: "Category deleted successfully",
        timestamp: new Date().toISOString(),
      };
      res.status(200).json(payload);
    } catch (err) {
      next(err);
    }
  }
}
