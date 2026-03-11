import mongoose, { Schema } from "mongoose";
import { IMerchant, IMerchantData } from "../types/merchant.types.js";

const MerchantSchema = new Schema<IMerchant>(
  {
    orgId: { type: Schema.Types.ObjectId, ref: "Organization", required: true },
    /** Display name (case-preserving). Uniqueness is enforced case-insensitively via index collation. */
    name: { type: String, required: true, trim: true },
    /** Lowercase-normalised name for application-layer duplicate checks. */
    normalizedName: { type: String, required: true, lowercase: true },
    isActive: { type: Boolean, default: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true },
);

// Case-insensitive unique index per org: prevents "Starbucks" and "starbucks" coexisting.
MerchantSchema.index(
  { orgId: 1, name: 1 },
  { unique: true, collation: { locale: "en", strength: 2 } },
);
MerchantSchema.index({ orgId: 1, isActive: 1 });

MerchantSchema.methods.toData = function (this: IMerchant): IMerchantData {
  return {
    _id: this._id.toString(),
    orgId: this.orgId.toString(),
    name: this.name,
    normalizedName: this.normalizedName,
    isActive: this.isActive,
    createdBy: this.createdBy.toString(),
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

export const Merchant = mongoose.model<IMerchant>("Merchant", MerchantSchema);
