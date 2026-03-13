import { Document, Types } from "mongoose";

export interface IMerchant extends Document {
  _id: Types.ObjectId;
  orgId: Types.ObjectId;
  /** Display name for the merchant (case-preserving) */
  name: string;
  /** Lowercase normalised name used for case-insensitive duplicate detection */
  normalizedName: string;
  isActive: boolean;
  createdBy: Types.ObjectId;
  /** Reference to Receipt document for merchant logo (null = no logo) */
  logoId: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;

  toData(): Promise<IMerchantData>;
}

export interface IMerchantData {
  _id: string;
  orgId: string;
  name: string;
  normalizedName: string;
  isActive: boolean;
  createdBy: string;
  /** Pre-signed S3 URL for the merchant logo */
  logoUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}
