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
  /** S3 key for the merchant logo image (null = no logo) */
  logoKey: string | null;
  createdAt: Date;
  updatedAt: Date;

  toData(): IMerchantData;
}

export interface IMerchantData {
  _id: string;
  orgId: string;
  name: string;
  normalizedName: string;
  isActive: boolean;
  createdBy: string;
  /** S3 key for the merchant logo image */
  logoKey: string | null;
  createdAt: Date;
  updatedAt: Date;
}
