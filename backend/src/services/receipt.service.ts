import { Receipt } from "../models/Receipt.model.js";
import { getReceiptSignedUrl, deleteFile } from "./s3.service.js";
import { Types } from "mongoose";
import { logError } from "../utils/logger.js";
import { IReceiptRef } from "../types/receipt.types.js";

/**
 * Generate a pre-signed URL for a single Receipt by its ID.
 */
export const getReceiptUrl = async (
  receiptId: string,
): Promise<string> => {
  const receipt = await Receipt.findById(receiptId);
  if (!receipt) throw new Error(`Receipt not found: ${receiptId}`);
  return getReceiptSignedUrl(receipt.s3Key);
};

/**
 * Batch-resolve multiple Receipt IDs into pre-signed URLs (parallel).
 */
export const getReceiptUrls = async (
  ids: (string | Types.ObjectId)[],
): Promise<string[]> => {
  if (ids.length === 0) return [];
  const receipts = await Receipt.find({ _id: { $in: ids } });
  const receiptMap = new Map(
    receipts.map((r) => [r._id.toString(), r.s3Key]),
  );
  // Preserve order, generate signed URLs in parallel
  return Promise.all(
    ids.map(async (id) => {
      const key = receiptMap.get(id.toString());
      if (!key) return "";
      return getReceiptSignedUrl(key);
    }),
  );
};

/**
 * Batch-resolve multiple Receipt IDs into { id, url } ref objects (parallel).
 * Preserves input order; missing receipts get an empty url.
 */
export const getReceiptRefsById = async (
  ids: (string | Types.ObjectId)[],
): Promise<Array<IReceiptRef>> => {
  if (ids.length === 0) return [];
  const receipts = await Receipt.find({ _id: { $in: ids } });
  const receiptMap = new Map(receipts.map((r) => [r._id.toString(), r.s3Key]));
  return Promise.all(
    ids.map(async (id) => {
      const idStr = id.toString();
      const key = receiptMap.get(idStr);
      return { _id: idStr, url: key ? await getReceiptSignedUrl(key) : "" };
    }),
  );
};

/**
 * Resolve a single Receipt ID to its S3 key (for OCR / internal processing).
 */
export const getReceiptS3Key = async (
  receiptId: string,
): Promise<string> => {
  const receipt = await Receipt.findById(receiptId);
  if (!receipt) throw new Error(`Receipt not found: ${receiptId}`);
  return receipt.s3Key;
};

/**
 * Delete a Receipt document and its underlying S3 object.
 */
export const deleteReceiptAndFile = async (
  receiptId: string,
): Promise<void> => {
  try {
  const receipt = await Receipt.findById(receiptId);
  if (!receipt) return;
  await deleteFile(receipt.s3Key);
  await receipt.deleteOne();
  } catch (err) {
    logError(err,{
      message: `Failed to delete receipt or file for receiptId: ${receiptId}`,
      code: "DELETE_RECEIPT_ERROR",
    });
  }
};

/**
 * Delete multiple Receipts + their S3 objects in parallel.
 */
export const deleteReceiptsAndFiles = async (
  ids: (string | Types.ObjectId)[],
): Promise<void> => {
  if (ids.length === 0) return;
  const receipts = await Receipt.find({ _id: { $in: ids } });
  await Promise.all(
    receipts.map(async (r) => {
      await deleteFile(r.s3Key).catch(() => {});
      await r.deleteOne();
    }),
  );
};
