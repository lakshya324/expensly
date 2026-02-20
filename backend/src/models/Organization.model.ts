import mongoose, { Schema } from "mongoose";
import {
  CURRENCIES,
  DEFAULT_ACTIVE_CURRENCIES,
  DEFAULT_BASE_CURRENCY,
} from "../config/constants.js";
import { IOrganization, IOrganizationData } from "../types/organization.types.js";

const OrganizationSchema = new Schema<IOrganization>(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, unique: true, lowercase: true, trim: true },
    isDisabled: { type: Boolean, default: false },
    baseCurrency: {
      type: String,
      enum: CURRENCIES,
      default: DEFAULT_BASE_CURRENCY,
    },
    activeCurrencies: {
      type: [String],
      default: DEFAULT_ACTIVE_CURRENCIES,
    },
    currentRateSnapshotId: {
      type: Schema.Types.ObjectId,
      ref: "ExchangeRateSnapshot",
      default: null,
    },
  },
  { timestamps: true },
);

// Auto-generate slug from name
OrganizationSchema.pre("save", function () {
  if (this.isModified("name") || this.isNew) {
    this.slug = this.name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .trim();
  }
});

OrganizationSchema.methods.data = function (
  this: IOrganization,
): IOrganizationData {
  return {
    _id: this._id.toString(),
    name: this.name,
    slug: this.slug,
    isDisabled: this.isDisabled,
    baseCurrency: this.baseCurrency,
    activeCurrencies: this.activeCurrencies,
    currentRateSnapshotId: this.currentRateSnapshotId
      ? this.currentRateSnapshotId.toString()
      : null,
  };
};

export const Organization = mongoose.model<IOrganization>(
  "Organization",
  OrganizationSchema,
);
