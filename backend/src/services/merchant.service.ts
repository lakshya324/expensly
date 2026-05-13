import { Types } from "mongoose";
import { Merchant } from "../models/Merchant.model.js";
import { createError } from "../utils/error.js";
import { IMerchantData } from "../types/merchant.types.js";
import { propagateMerchantRename } from "./propagation.service.js";
import { logError } from "../utils/logger.js";

export interface CreateMerchantInput {
  orgId: string;
  name: string;
  createdBy: string;
}

export interface UpdateMerchantInput {
  name?: string;
  isActive?: boolean;
}

/**
 * Create a new merchant for an organisation.
 * Names are normalised to lowercase for uniqueness checking; the original
 * casing is stored on `name` and the lowercase version on `normalizedName`.
 */
export const createMerchant = async (
  input: CreateMerchantInput,
): Promise<IMerchantData> => {
  const orgObjectId = new Types.ObjectId(input.orgId);

  const doc = await Merchant.create({
    orgId: orgObjectId,
    name: input.name.trim(),
    normalizedName: input.name.trim().toLowerCase(),
    createdBy: new Types.ObjectId(input.createdBy),
  });

  return await doc.toData();
};

/**
 * List all merchants for an organisation.
 */
export const listMerchants = async (
  orgId: string,
  includeInactive = false,
): Promise<IMerchantData[]> => {
  const filter: Record<string, unknown> = {
    orgId: new Types.ObjectId(orgId),
  };
  if (!includeInactive) filter["isActive"] = true;

  const docs = await Merchant.find(filter).sort({ name: 1 });
  return Promise.all(docs.map((d) => d.toData())); 
  // Note: we can optimize this later if needed by generating signed URLs in batch via the receipt service.
};

/**
 * Update a merchant's name or active status.
 * Throws 404 if not found in the given org.
 */
export const updateMerchant = async (
  orgId: string,
  merchantId: string,
  input: UpdateMerchantInput,
): Promise<IMerchantData> => {
  const update: Record<string, unknown> = {};
  if (input.name !== undefined) {
    update["name"] = input.name.trim();
    update["normalizedName"] = input.name.trim().toLowerCase();
  }
  if (input.isActive !== undefined) update["isActive"] = input.isActive;

  const doc = await Merchant.findOneAndUpdate(
    { _id: new Types.ObjectId(merchantId), orgId: new Types.ObjectId(orgId) },
    { $set: update },
    { new: true },
  );
  if (!doc) throw createError("Merchant not found", 404, "NOT_FOUND");

  if (input.name !== undefined) {
    propagateMerchantRename(doc._id.toString(), doc.name)
      .catch((err) => logError(err, { message: "propagateMerchantRename failed", code: "PROPAGATION_ERROR" }));
  }

  return await doc.toData();
};

/**
 * Delete a merchant (hard delete — use only when it has no associated tickets).
 */
export const deleteMerchant = async (
  orgId: string,
  merchantId: string,
): Promise<void> => {
  const result = await Merchant.deleteOne({
    _id: new Types.ObjectId(merchantId),
    orgId: new Types.ObjectId(orgId),
  });
  if (result.deletedCount === 0)
    throw createError("Merchant not found", 404, "NOT_FOUND");
};
