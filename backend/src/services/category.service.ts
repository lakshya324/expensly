import { Types } from "mongoose";
import { Category } from "../models/Category.model.js";
import { createError } from "../utils/error.js";
import { ICategoryData } from "../types/category.types.js";
import { propagateCategoryRename } from "./propagation.service.js";
import { logError } from "../utils/logger.js";

export interface CreateCategoryInput {
  orgId: string;
  name: string;
  description?: string;
  createdBy: string;
}

export interface UpdateCategoryInput {
  name?: string;
  description?: string;
  isActive?: boolean;
}

/**
 * Create a new expense category for an organisation.
 */
export const createCategory = async (
  input: CreateCategoryInput,
): Promise<ICategoryData> => {
  const doc = await Category.create({
    orgId: new Types.ObjectId(input.orgId),
    name: input.name.trim(),
    normalizedName: input.name.trim().toLowerCase(),
    description: input.description?.trim() ?? "",
    createdBy: new Types.ObjectId(input.createdBy),
  });

  return doc.toData();
};

/**
 * List all categories for an organisation.
 */
export const listCategories = async (
  orgId: string,
  includeInactive = false,
): Promise<ICategoryData[]> => {
  const filter: Record<string, unknown> = {
    orgId: new Types.ObjectId(orgId),
  };
  if (!includeInactive) filter["isActive"] = true;

  const docs = await Category.find(filter).sort({ name: 1 }).lean();
  return docs.map((d) => ({
    _id: d._id.toString(),
    orgId: d.orgId.toString(),
    name: d.name,
    normalizedName: d.normalizedName,
    description: d.description ?? "",
    isActive: d.isActive,
    isSystem: d.isSystem ?? false,
    createdBy: d.createdBy.toString(),
    iconUrl: null, // Todo: implement category icons upload and retrieval
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
  }));
};

/**
 * Update a category's name, description, or active status.
 */
export const updateCategory = async (
  orgId: string,
  categoryId: string,
  input: UpdateCategoryInput,
): Promise<ICategoryData> => {
  const update: Record<string, unknown> = {};
  if (input.name !== undefined) {
    update["name"] = input.name.trim();
    update["normalizedName"] = input.name.trim().toLowerCase();
  }
  if (input.description !== undefined) update["description"] = input.description.trim();
  if (input.isActive !== undefined) update["isActive"] = input.isActive;

  const doc = await Category.findOneAndUpdate(
    { _id: new Types.ObjectId(categoryId), orgId: new Types.ObjectId(orgId) },
    { $set: update },
    { returnDocument: "after" },
  );
  if (!doc) throw createError("Category not found", 404, "NOT_FOUND");

  if (input.name !== undefined) {
    propagateCategoryRename(doc._id.toString(), doc.name)
      .catch((err) => logError(err, { message: "propagateCategoryRename failed", code: "PROPAGATION_ERROR" }));
  }

  return doc.toData();
};

/**
 * Delete a category (hard delete — use only when it has no associated tickets).
 */
export const deleteCategory = async (
  orgId: string,
  categoryId: string,
): Promise<void> => {
  const result = await Category.deleteOne({
    _id: new Types.ObjectId(categoryId),
    orgId: new Types.ObjectId(orgId),
  });
  if (result.deletedCount === 0)
    throw createError("Category not found", 404, "NOT_FOUND");
};

interface SystemCategoryDef {
  name: string;
  description: string;
}

const SYSTEM_CATEGORY_DEFS: SystemCategoryDef[] = [
  { name: "Travel", description: "Flights, trains, taxis, and other travel costs." },
  { name: "Accommodation", description: "Hotel stays and lodging expenses." },
  { name: "Food & Beverages", description: "Meals, dining, and refreshments." },
  { name: "Office Supplies", description: "Stationery, equipment, and office materials." },
  { name: "Entertainment", description: "Client entertainment and team events." },
];

/**
 * Idempotently seeds the system (sample) categories for a given org.
 * Safe to call multiple times — uses upsert on (orgId, name, isSystem).
 */
export const seedSystemCategories = async (
  orgId: string,
  createdBy: string,
): Promise<void> => {
  const orgObjectId = new Types.ObjectId(orgId);
  const createdByObjectId = new Types.ObjectId(createdBy);

  await Promise.all(
    SYSTEM_CATEGORY_DEFS.map((def) =>
      Category.updateOne(
        { orgId: orgObjectId, name: def.name, isSystem: true },
        {
          $setOnInsert: {
            orgId: orgObjectId,
            name: def.name,
            normalizedName: def.name.toLowerCase(),
            description: def.description,
            isSystem: true,
            isActive: true,
            createdBy: createdByObjectId,
          },
        },
        { upsert: true },
      ),
    ),
  );
};
