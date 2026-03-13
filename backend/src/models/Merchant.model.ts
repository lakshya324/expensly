import mongoose, { Schema } from "mongoose";
import { IMerchant, IMerchantData } from "../types/merchant.types.js";
import { getReceiptUrl } from "../services/receipt.service.js";

const MerchantSchema = new Schema<IMerchant>(
  {
    orgId: { type: Schema.Types.ObjectId, ref: "Organization", required: true },
    /** Display name (case-preserving). Uniqueness is enforced case-insensitively via index collation. */
    name: { type: String, required: true, trim: true },
    /** Lowercase-normalised name for application-layer duplicate checks. */
    normalizedName: { type: String, required: true, lowercase: true },
    isActive: { type: Boolean, default: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    /** Reference to a Receipt document for the merchant logo (null = no logo) */
    logoId: { type: Schema.Types.ObjectId, ref: "Receipt", default: null },
  },
  { timestamps: true },
);

// Case-insensitive unique index per org: prevents "Starbucks" and "starbucks" coexisting.
MerchantSchema.index(
  { orgId: 1, name: 1 },
  { unique: true, collation: { locale: "en", strength: 2 } },
);
MerchantSchema.index({ orgId: 1, isActive: 1 });

MerchantSchema.methods.toData = async function (this: IMerchant): Promise<IMerchantData> {
  const logoUrl = this.logoId
    ? await getReceiptUrl(this.logoId.toString()).catch(() => null)
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
