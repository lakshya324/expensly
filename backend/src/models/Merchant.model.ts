import mongoose, { Schema } from "mongoose";
import { IMerchant, IMerchantData } from "../types/merchant.types.js";
import { getReceiptSignedUrl } from "../services/s3.service.js";

const LogoSchema = new Schema(
  {
    id: { type: Schema.Types.ObjectId, ref: "Receipt", required: true },
    s3Key: { type: String, required: true },
  },
  { _id: false },
);

const MerchantSchema = new Schema<IMerchant>(
  {
    orgId: { type: Schema.Types.ObjectId, ref: "Organization", required: true },
    /** Display name (case-preserving). Uniqueness is enforced case-insensitively via index collation. */
    name: { type: String, required: true, trim: true },
    /** Lowercase-normalised name for application-layer duplicate checks. */
    normalizedName: { type: String, required: true, lowercase: true },
    isActive: { type: Boolean, default: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    /** Embedded logo - id for deletion, s3Key for presigned URL generation (null = no logo) */
    logo: { type: LogoSchema, default: null },
  },
  { timestamps: true },
);

// Case-insensitive unique index per org: prevents "Starbucks" and "starbucks" coexisting.
MerchantSchema.index(
  { orgId: 1, name: 1 },
  { unique: true, collation: { locale: "en", strength: 2 } },
);
MerchantSchema.index({ orgId: 1, isActive: 1 });

MerchantSchema.methods.toData = async function (
  this: IMerchant,
): Promise<IMerchantData> {
  const logoUrl = this.logo
    ? await getReceiptSignedUrl(this.logo.s3Key).catch(() => null)
    : null;
  return {
    _id: this._id.toString(),
    orgId: this.orgId.toString(),
    name: this.name,
    normalizedName: this.normalizedName,
    isActive: this.isActive,
    createdBy: this.createdBy.toString(),
    logoUrl,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

export const Merchant = mongoose.model<IMerchant>("Merchant", MerchantSchema);
