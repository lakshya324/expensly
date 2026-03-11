import mongoose, { Schema } from "mongoose";
import { ICategory, ICategoryData } from "../types/category.types.js";

const CategorySchema = new Schema<ICategory>(
  {
    orgId: { type: Schema.Types.ObjectId, ref: "Organization", required: true },
    /** Display name (case-preserving). Uniqueness enforced case-insensitively. */
    name: { type: String, required: true, trim: true },
    /** Lowercase-normalised name for application-layer duplicate checks. */
    normalizedName: { type: String, required: true, lowercase: true },
    description: { type: String, trim: true, default: "" },
    isActive: { type: Boolean, default: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true },
);

// Case-insensitive unique index per org
CategorySchema.index(
  { orgId: 1, name: 1 },
  { unique: true, collation: { locale: "en", strength: 2 } },
);
CategorySchema.index({ orgId: 1, isActive: 1 });

CategorySchema.methods.toData = function (this: ICategory): ICategoryData {
  return {
    _id: this._id.toString(),
    orgId: this.orgId.toString(),
    name: this.name,
    normalizedName: this.normalizedName,
    description: this.description,
    isActive: this.isActive,
    createdBy: this.createdBy.toString(),
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

export const Category = mongoose.model<ICategory>("Category", CategorySchema);
