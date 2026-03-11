import mongoose, { Schema } from "mongoose";
import { BUNDLE_STATUS } from "../config/constants.js";
import { IBundle } from "../types/bundle.types.js";

/**
 * ApprovalSchema is shared with Ticket.model — keep both in sync.
 * Defined locally here to avoid a circular import via Ticket.model.
 */
const ApprovalSchema = new Schema(
  {
    required: { type: Boolean, default: false },
    approved: { type: Boolean, default: null },
    reviewedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    reviewedAt: { type: Date, default: null },
    comments: { type: String, trim: true, default: null },
  },
  { _id: false },
);

const BundleSchema = new Schema<IBundle>(
  {
    orgId: { type: Schema.Types.ObjectId, ref: "Organization", required: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: "" },
    submittedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    status: {
      type: String,
      enum: Object.values(BUNDLE_STATUS),
      default: BUNDLE_STATUS.DRAFT,
    },
    /** Ticket IDs grouped into this bundle */
    ticketIds: [{ type: Schema.Types.ObjectId, ref: "Ticket" }],
    /**
     * Pre-computed total in the org's base currency.
     * Set when the bundle is submitted; null while in DRAFT status.
     */
    totalAmountBase: { type: Number, default: null },
    tags: { type: [String], default: [] },
    managerApproval: { type: ApprovalSchema, default: null },
    financeApproval: { type: ApprovalSchema, default: null },
  },
  { timestamps: true },
);

BundleSchema.index({ orgId: 1, submittedBy: 1 });
BundleSchema.index({ orgId: 1, status: 1 });
BundleSchema.index({ orgId: 1, createdAt: -1 });

export const Bundle = mongoose.model<IBundle>("Bundle", BundleSchema);
