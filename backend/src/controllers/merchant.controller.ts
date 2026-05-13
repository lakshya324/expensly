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
import {
  AUDIT_ACTION,
  ENTITY_TYPE,
  RECEIPT_USE_CASE,
} from "../config/constants.js";
import { logAction } from "../services/auditLog.service.js";
import { Merchant } from "../models/Merchant.model.js";
import { Receipt } from "../models/Receipt.model.js";
import { deleteReceiptAndFile } from "../services/receipt.service.js";

export default class MerchantController {
  /** GET /api/admin/merchants */
  static async list(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const org = req.organization!;
      const includeInactive =
        (req.query["includeInactive"] as string) === "true";

      const merchants = await listMerchants(
        org._id.toString(),
        includeInactive,
      );

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
        performerName: user.name,
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
        performerName: user.name,
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
        performerName: user.name,
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

  /** PATCH /api/admin/merchants/:id/logo */
  static async uploadLogo(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const org = req.organization!;
      const user = req.user!;
      const merchantId = req.params["id"] as string;

      const s3File = req.file as Express.MulterS3.File | undefined;
      if (!s3File) throw createError("Logo file is required", 400, "NO_FILE");

      const merchant = await Merchant.findOne({
        _id: merchantId,
        orgId: org._id,
      });
      if (!merchant) throw createError("Merchant not found", 404, "NOT_FOUND");

      // Remove old logo Receipt if present
      if (merchant.logo) {
        await deleteReceiptAndFile(merchant.logo.id.toString());
      }

      // Create new Receipt document for the logo
      const receiptData = await Receipt.create({
        orgId: org._id,
        s3Key: s3File.key,
        mimetype: s3File.mimetype,
        originalName: s3File.originalname,
        size: s3File.size,
        useCase: RECEIPT_USE_CASE.MERCHANT_LOGO,
        uploadedBy: user._id,
      });

      merchant.logo = { id: receiptData._id, s3Key: s3File.key };
      await merchant.save();

      logAction({
        orgId: org._id,
        entityType: ENTITY_TYPE.MERCHANT,
        entityId: merchantId,
        action: AUDIT_ACTION.UPDATED,
        performedBy: user._id,
        performerName: user.name,
        ip: req.ip ?? null,
        metadata: { field: "logo" },
      }).catch(() => {});

      const payload: ResponsePayload<IMerchantData> = {
        success: true,
        message: "Merchant logo uploaded successfully",
        data: await merchant.toData(),
        timestamp: new Date().toISOString(),
      };
      res.status(200).json(payload);
    } catch (err) {
      next(err);
    }
  }
}
