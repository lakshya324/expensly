import mongoose, { Schema } from "mongoose";
import { ICategory, ICategoryData } from "../types/category.types.js";
import { getReceiptUrl } from "../services/receipt.service.js";

const CategorySchema = new Schema<ICategory>(
  {
    orgId: { type: Schema.Types.ObjectId, ref: "Organization", required: true },
    /** Display name (case-preserving). Uniqueness enforced case-insensitively. */
    name: { type: String, required: true, trim: true },
    /** Lowercase-normalised name for application-layer duplicate checks. */
    normalizedName: { type: String, required: true, lowercase: true },
    description: { type: String, trim: true, default: "" },
    isActive: { type: Boolean, default: true },
    isSystem: { type: Boolean, default: false },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    /** Reference to a Receipt document for the category icon (null = no icon) */
    iconId: { type: Schema.Types.ObjectId, ref: "Receipt", default: null },
  },
  { timestamps: true },
);

// Case-insensitive unique index per org
CategorySchema.index(
  { orgId: 1, name: 1 },
  { unique: true, collation: { locale: "en", strength: 2 } },
);
CategorySchema.index({ orgId: 1, isActive: 1 });

CategorySchema.methods.toData = async function (this: ICategory): Promise<ICategoryData> {
  const iconUrl = this.iconId
    ? await getReceiptUrl(this.iconId.toString()).catch(() => null)
    : null;
  return {
    _id: this._id.toString(),
    orgId: this.orgId.toString(),
    name: this.name,
    normalizedName: this.normalizedName,
    description: this.description,
    isActive: this.isActive,
    isSystem: this.isSystem,
    createdBy: this.createdBy.toString(),
    iconUrl,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

export const Category = mongoose.model<ICategory>("Category", CategorySchema);
