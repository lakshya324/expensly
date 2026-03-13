import { Document, Types } from "mongoose";

export interface ICategory extends Document {
  _id: Types.ObjectId;
  orgId: Types.ObjectId;
  /** Display name for the category (case-preserving) */
  name: string;
  /** Lowercase normalised name used for case-insensitive duplicate detection */
  normalizedName: string;
  description: string;
  isActive: boolean;
  isSystem: boolean;
  createdBy: Types.ObjectId;
  /** Reference to Receipt document for category icon (null = no icon) */
  iconId: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;

  toData(): Promise<ICategoryData>;
}

export interface ICategoryData {
  _id: string;
  orgId: string;
  name: string;
  normalizedName: string;
  description: string;
  isActive: boolean;
  isSystem: boolean;
  createdBy: string;
  /** Pre-signed S3 URL for the category icon */
  iconUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}
