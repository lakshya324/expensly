import mongoose, { Schema } from "mongoose";
import { PERMISSION_KEY } from "../config/constants.js";
import { IPolicy } from "../types/policy.types.js";

const PolicySchema = new Schema<IPolicy>(
  {
    orgId: { type: Schema.Types.ObjectId, ref: "Organization", required: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, default: null, trim: true, maxlength: 500 },
    isSystem: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    grants: {
      type: [{ type: String, enum: Object.values(PERMISSION_KEY) }],
      default: [],
    },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true },
);

PolicySchema.index({ orgId: 1, isActive: 1 });
PolicySchema.index({ orgId: 1, name: 1, isSystem: 1 }, { unique: true });

export const Policy = mongoose.model<IPolicy>("Policy", PolicySchema);
