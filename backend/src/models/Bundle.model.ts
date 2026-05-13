import mongoose, { Schema } from "mongoose";
import { BUNDLE_STATUS, CURRENCIES } from "../config/constants.js";
import { IBundle, IBundleData, IBundleSummaryData } from "../types/bundle.types.js";

/**
 * ApprovalSchema is shared with Ticket.model — keep both in sync.
 * Defined locally here to avoid a circular import via Ticket.model.
 */
const UserSnapshotSchema = new Schema(
  {
    _id: { type: Schema.Types.ObjectId, required: true },
    name: { type: String, required: true },
    email: { type: String, required: true },
  },
  { _id: false },
);

const ApprovalSchema = new Schema(
  {
    required: { type: Boolean, default: false },
    approved: { type: Boolean, default: null },
    reviewedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    reviewerSnapshot: { type: UserSnapshotSchema, default: null },
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
    /** Denormalized submitter info — embedded at creation, propagated on rename. */
    submitter: {
      type: new Schema(
        {
          _id: { type: Schema.Types.ObjectId, required: true },
          name: { type: String, required: true },
          email: { type: String, required: true },
        },
        { _id: false },
      ),
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(BUNDLE_STATUS),
      default: BUNDLE_STATUS.DRAFT,
    },
    /**
     * Pre-computed total in the org's base currency.
     * Recalculated on every add/remove and at submission.
     */
    totalAmountBase: { type: Number, default: null },
    /** currency code of totalAmountBase (matches org baseCurrency at computation time) */
    baseCurrency: { type: String, enum: CURRENCIES, default: null },
    /** Denormalized ticket count — kept in sync on add/remove */
    ticketCount: { type: Number, default: 0 },
    tags: { type: [String], default: [] },
    managerApproval: { type: ApprovalSchema, default: null },
    financeApproval: { type: ApprovalSchema, default: null },
  },
  { timestamps: true },
);

BundleSchema.index({ orgId: 1, createdAt: -1 });
BundleSchema.index({ orgId: 1, status: 1, createdAt: -1 });
BundleSchema.index({ orgId: 1, "submitter._id": 1, createdAt: -1 });

BundleSchema.methods.toData = function (this: IBundle): IBundleData {
  const buildReviewer = (approval: typeof this.managerApproval) => {
    if (!approval?.reviewerSnapshot) return null;
    return {
      _id: approval.reviewerSnapshot._id.toString(),
      name: approval.reviewerSnapshot.name,
      email: approval.reviewerSnapshot.email,
      role: "user" as const,
      department: null,
    };
  };

  return {
    _id: this._id.toString(),
    orgId: this.orgId.toString(),
    title: this.title,
    description: this.description,
    submittedBy: {
      _id: this.submitter._id.toString(),
      name: this.submitter.name,
      email: this.submitter.email,
      role: "user" as const,
      department: null,
    },
    submittedByDepartment: null,
    status: this.status,
    ticketCount: this.ticketCount ?? 0,
    totalAmountBase: this.totalAmountBase,
    baseCurrency: this.baseCurrency,
    tags: this.tags,
    managerApproval: this.managerApproval
      ? {
          required: this.managerApproval.required,
          approved: this.managerApproval.approved,
          reviewedBy: buildReviewer(this.managerApproval),
          reviewedAt: this.managerApproval.reviewedAt,
          comments: this.managerApproval.comments,
        }
      : null,
    financeApproval: this.financeApproval
      ? {
          required: this.financeApproval.required,
          approved: this.financeApproval.approved,
          reviewedBy: buildReviewer(this.financeApproval),
          reviewedAt: this.financeApproval.reviewedAt,
          comments: this.financeApproval.comments,
        }
      : null,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

BundleSchema.methods.toSummaryData = function (this: IBundle): IBundleSummaryData {
  return {
    _id: this._id.toString(),
    title: this.title,
    description: this.description,
  };
};

export const Bundle = mongoose.model<IBundle>("Bundle", BundleSchema);
