import { Types } from "mongoose";
import { Category } from "../models/Category.model.js";
import { createError } from "../utils/error.js";
import { ICategoryData } from "../types/category.types.js";

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
    createdBy: d.createdBy.toString(),
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
  if (input.description !== undefined) {
    update["description"] = input.description.trim();
  }
  if (input.isActive !== undefined) {
    update["isActive"] = input.isActive;
  }

  const doc = await Category.findOneAndUpdate(
    { _id: new Types.ObjectId(categoryId), orgId: new Types.ObjectId(orgId) },
    { $set: update },
    { new: true },
  );
  if (!doc) throw createError("Category not found", 404, "NOT_FOUND");

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
