import mongoose, { Schema } from "mongoose";
import { IPolicy } from "../types/policy.types.js";

/**
 * Policy — stub schema.
 *
 * The `rules` field is intentionally left as a freeform Mixed array until
 * the Custom Policies feature is fully designed. Do not add validation here
 * prematurely.
 *
 * Planned rule shape (not enforced yet):
 *   { field: string; operator: string; value: unknown; action: "warn" | "block" }
 */
const PolicySchema = new Schema<IPolicy>(
  {
    orgId: { type: Schema.Types.ObjectId, ref: "Organization", required: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    isActive: { type: Boolean, default: true },
    /**
     * Open-ended rule definitions — shape will be formalised when the feature
     * is implemented. Stored as Mixed to avoid premature constraint coupling.
     */
    rules: { type: [{}], default: [] },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  {
    timestamps: true,
  },
);

PolicySchema.index({ orgId: 1, isActive: 1 });

export const Policy = mongoose.model<IPolicy>("Policy", PolicySchema);
