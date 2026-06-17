import { Response, NextFunction } from "express";
import { AuthRequest } from "../types/types.js";
import { getReceiptUrl, deleteReceiptAndFile } from "../services/receipt.service.js";
import { createError } from "../utils/error.js";
import { ResponsePayload } from "../types/payloads.types.js";
import { IReceiptData } from "../types/receipt.types.js";
import { RECEIPT_USE_CASE, ReceiptUseCase } from "../config/constants.js";
import { Receipt } from "../models/Receipt.model.js";

export default class ReceiptController {
  /**
   * POST /api/users/receipts
   * Upload a file via multer-s3 and create a Receipt document.
   * Query param: ?useCase=ReceiptUseCase (optional, defaults to "receipt")
   */
  static async upload(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const user = req.user!;
      const org = req.organization!;
      const file = req.file as Express.MulterS3.File | undefined;
      const useCaseParam = req.query["useCase"] as ReceiptUseCase | undefined || RECEIPT_USE_CASE.RECEIPT;

      if (!file) throw createError("File is required", 400, "NO_FILE");

      const receiptData = await Receipt.create({
        orgId: org._id,
        s3Key: file.key,
        mimetype: file.mimetype,
        originalName: file.originalname,
        size: file.size,
        useCase: useCaseParam,
        uploadedBy: user._id,
      });

      const payload: ResponsePayload<IReceiptData> = {
        success: true,
        message: "File uploaded successfully",
        data: receiptData.toData(),
        timestamp: new Date().toISOString(),
      };
      res.status(201).json(payload);
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/users/receipts/:id/url
   * Returns a pre-signed URL for the Receipt.
   */
  static async getUrl(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const receiptId = req.params["id"] as string;
      const url = await getReceiptUrl(receiptId);

      const payload: ResponsePayload<string> = {
        success: true,
        message: "Receipt URL generated",
        data: url,
        timestamp: new Date().toISOString(),
      };
      res.status(200).json(payload);
    } catch (err) {
      next(err);
    }
  }

  /**
   * DELETE /api/users/receipts/:id
   * Deletes the Receipt document and underlying S3 object.
   */
  static async remove(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const receiptId = req.params["id"] as string;
      await deleteReceiptAndFile(receiptId);

      const payload: ResponsePayload = {
        success: true,
        message: "Receipt deleted successfully",
        timestamp: new Date().toISOString(),
      };
      res.status(200).json(payload);
    } catch (err) {
      next(err);
    }
  }
}
