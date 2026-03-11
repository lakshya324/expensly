import { Response, NextFunction } from "express";
import { AuthRequest } from "../types/types.js";
import {
  createBundle,
  listBundles,
  getBundle,
  updateBundle,
  submitBundle,
  deleteBundle,
  approveBundleStatus,
} from "../services/bundle.service.js";
import { ResponsePayload } from "../types/payloads.types.js";
import { IBundleData } from "../types/bundle.types.js";
import { logAction } from "../services/auditLog.service.js";
import { AUDIT_ACTION, ENTITY_TYPE, ROLES } from "../config/constants.js";

export default class BundleController {
  /** GET /api/users/expenses/bundles */
  static async list(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const org = req.organization!;
      const user = req.user!;
      // Admins see all org bundles; regular users see only their own
      const submittedByFilter =
        user.role === ROLES.ADMIN ? undefined : user._id.toString();
      const data = await listBundles(org._id.toString(), submittedByFilter);
      const payload: ResponsePayload<IBundleData[]> = {
        success: true,
        message: "Bundles retrieved successfully",
        timestamp: new Date().toISOString(),
        data,
      };
      res.status(200).json(payload);
    } catch (err) {
      next(err);
    }
  }

  /** GET /api/users/expenses/bundles/:id */
  static async getOne(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const org = req.organization!;
      const bundleId = req.params["id"] as string;
      const data = await getBundle(org._id.toString(), bundleId);
      const payload: ResponsePayload<IBundleData> = {
        success: true,
        message: "Bundle retrieved successfully",
        timestamp: new Date().toISOString(),
        data,
      };
      res.status(200).json(payload);
    } catch (err) {
      next(err);
    }
  }

  /** POST /api/users/expenses/bundles */
  static async create(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const org = req.organization!;
      const user = req.user!;
      const { name, ticketIds, description, tags } = req.body as {
        name?: string;
        ticketIds?: string[];
        description?: string;
        tags?: string[];
      };
      const data = await createBundle({
        orgId: org._id.toString(),
        name: name ?? "",
        ticketIds,
        description,
        tags,
        submittedBy: user._id.toString(),
      });
      logAction({
        orgId: org._id.toString(),
        performedBy: user._id.toString(),
        action: AUDIT_ACTION.CREATED,
        entityType: ENTITY_TYPE.BUNDLE,
        entityId: data._id,
      }).catch(() => {});
      const payload: ResponsePayload<IBundleData> = {
        success: true,
        message: "Bundle created successfully",
        timestamp: new Date().toISOString(),
        data,
      };
      res.status(201).json(payload);
    } catch (err) {
      next(err);
    }
  }

  /** PATCH /api/users/expenses/bundles/:id */
  static async update(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const org = req.organization!;
      const user = req.user!;
      const bundleId = req.params["id"] as string;
      const { name, ticketIds, description, tags } = req.body as {
        name?: string;
        ticketIds?: string[];
        description?: string;
        tags?: string[];
      };
      const data = await updateBundle(org._id.toString(), bundleId, user._id.toString(), {
        name,
        ticketIds,
        description,
        tags,
      });
      logAction({
        orgId: org._id.toString(),
        performedBy: user._id.toString(),
        action: AUDIT_ACTION.UPDATED,
        entityType: ENTITY_TYPE.BUNDLE,
        entityId: bundleId,
      }).catch(() => {});
      const payload: ResponsePayload<IBundleData> = {
        success: true,
        message: "Bundle updated successfully",
        timestamp: new Date().toISOString(),
        data,
      };
      res.status(200).json(payload);
    } catch (err) {
      next(err);
    }
  }

  /** POST /api/users/expenses/bundles/:id/submit */
  static async submit(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const org = req.organization!;
      const user = req.user!;
      const bundleId = req.params["id"] as string;
      const data = await submitBundle(org._id.toString(), bundleId, user._id.toString());
      logAction({
        orgId: org._id.toString(),
        performedBy: user._id.toString(),
        action: AUDIT_ACTION.STATUS_CHANGED,
        entityType: ENTITY_TYPE.BUNDLE,
        entityId: bundleId,
        metadata: { status: "submitted" },
      }).catch(() => {});
      const payload: ResponsePayload<IBundleData> = {
        success: true,
        message: "Bundle submitted for approval",
        timestamp: new Date().toISOString(),
        data,
      };
      res.status(200).json(payload);
    } catch (err) {
      next(err);
    }
  }

  /** PATCH /api/users/expenses/bundles/:id/status */
  static async updateStatus(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const org = req.organization!;
      const user = req.user!;
      const bundleId = req.params["id"] as string;
      const { step, approved, comments } = req.body as {
        step?: "manager" | "finance";
        approved?: boolean;
        comments?: string;
      };
      const data = await approveBundleStatus(
        org._id.toString(),
        bundleId,
        user._id.toString(),
        user.role,
        { step: step!, approved: approved!, comments },
      );
      logAction({
        orgId: org._id.toString(),
        performedBy: user._id.toString(),
        action: approved ? AUDIT_ACTION.APPROVED : AUDIT_ACTION.REJECTED,
        entityType: ENTITY_TYPE.BUNDLE,
        entityId: bundleId,
        metadata: { step, comments: comments ?? null },
      }).catch(() => {});
      const payload: ResponsePayload<IBundleData> = {
        success: true,
        message: approved ? "Bundle approved" : "Bundle rejected",
        timestamp: new Date().toISOString(),
        data,
      };
      res.status(200).json(payload);
    } catch (err) {
      next(err);
    }
  }

  /** DELETE /api/users/expenses/bundles/:id */
  static async remove(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const org = req.organization!;
      const user = req.user!;
      const bundleId = req.params["id"] as string;
      await deleteBundle(org._id.toString(), bundleId, user._id.toString(), user.role);
      logAction({
        orgId: org._id.toString(),
        performedBy: user._id.toString(),
        action: AUDIT_ACTION.DELETED,
        entityType: ENTITY_TYPE.BUNDLE,
        entityId: bundleId,
      }).catch(() => {});
      const payload: ResponsePayload = {
        success: true,
        message: "Bundle deleted successfully",
        timestamp: new Date().toISOString(),
      };
      res.status(200).json(payload);
    } catch (err) {
      next(err);
    }
  }
}
