import { Response, NextFunction } from "express";
import { AuthRequest } from "../types/types.js";
import {
  createMerchant,
  listMerchants,
  updateMerchant,
  deleteMerchant,
} from "../services/merchant.service.js";
import { createError } from "../utils/error.js";
import { ResponsePayload } from "../types/payloads.types.js";
import { IMerchantData } from "../types/merchant.types.js";
import { AUDIT_ACTION, ENTITY_TYPE } from "../config/constants.js";
import { logAction } from "../services/auditLog.service.js";

export default class MerchantController {
  /** GET /api/admin/merchants */
  static async list(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const org = req.organization!;
      const includeInactive =
        (req.query["includeInactive"] as string) === "true";

      const merchants = await listMerchants(org._id.toString(), includeInactive);

      const payload: ResponsePayload<IMerchantData[]> = {
        success: true,
        message: "Merchants retrieved successfully",
        timestamp: new Date().toISOString(),
        data: merchants,
      };
      res.status(200).json(payload);
    } catch (err) {
      next(err);
    }
  }

  /** POST /api/admin/merchants */
  static async create(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const org = req.organization!;
      const user = req.user!;
      const { name } = req.body as { name?: string };
      if (!name) throw createError("name is required", 400, "VALIDATION_ERROR");

      const merchant = await createMerchant({
        orgId: org._id.toString(),
        name,
        createdBy: user._id.toString(),
      });

      logAction({
        orgId: org._id,
        entityType: ENTITY_TYPE.MERCHANT,
        entityId: merchant._id,
        action: AUDIT_ACTION.CREATED,
        performedBy: user._id,
        ip: req.ip ?? null,
      });

      const payload: ResponsePayload<IMerchantData> = {
        success: true,
        message: "Merchant created successfully",
        timestamp: new Date().toISOString(),
        data: merchant,
      };
      res.status(201).json(payload);
    } catch (err) {
      next(err);
    }
  }

  /** PATCH /api/admin/merchants/:id */
  static async update(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const org = req.organization!;
      const user = req.user!;
      const merchantId = req.params["id"] as string;
      const { name, isActive } = req.body as {
        name?: string;
        isActive?: boolean;
      };

      const merchant = await updateMerchant(org._id.toString(), merchantId, {
        name,
        isActive,
      });

      logAction({
        orgId: org._id,
        entityType: ENTITY_TYPE.MERCHANT,
        entityId: merchantId,
        action: AUDIT_ACTION.UPDATED,
        performedBy: user._id,
        ip: req.ip ?? null,
        metadata: { name, isActive },
      });

      const payload: ResponsePayload<IMerchantData> = {
        success: true,
        message: "Merchant updated successfully",
        timestamp: new Date().toISOString(),
        data: merchant,
      };
      res.status(200).json(payload);
    } catch (err) {
      next(err);
    }
  }

  /** DELETE /api/admin/merchants/:id */
  static async remove(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const org = req.organization!;
      const user = req.user!;
      const merchantId = req.params["id"] as string;

      await deleteMerchant(org._id.toString(), merchantId);

      logAction({
        orgId: org._id,
        entityType: ENTITY_TYPE.MERCHANT,
        entityId: merchantId,
        action: AUDIT_ACTION.DELETED,
        performedBy: user._id,
        ip: req.ip ?? null,
      });

      const payload: ResponsePayload = {
        success: true,
        message: "Merchant deleted successfully",
        timestamp: new Date().toISOString(),
      };
      res.status(200).json(payload);
    } catch (err) {
      next(err);
    }
  }
}
