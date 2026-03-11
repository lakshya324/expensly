import mongoose, { Schema } from "mongoose";
import { Types } from "mongoose";
import { BUNDLE_STATUS } from "../config/constants.js";
import { IBundle, IBundleData } from "../types/bundle.types.js";
import { User } from "./User.model.js";
import { Department } from "./Department.model.js";

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

// Helper: load a user as IUserMinimalData
async function loadMinimalUser(userId: Types.ObjectId | null) {
  if (!userId) return null;
  const u = await User.findById(userId).select("_id name email role department").lean();
  if (!u) return null;
  const dept = u.department
    ? await Department.findById(u.department)
    : null;
  return {
    _id: u._id.toString(),
    name: u.name,
    email: u.email,
    role: u.role,
    department: dept ? dept.toData() : null,
  };
}

BundleSchema.methods.toData = async function (this: IBundle): Promise<IBundleData> {
  const [submitter, managerReviewer, financeReviewer] = await Promise.all([
    loadMinimalUser(this.submittedBy),
    this.managerApproval?.reviewedBy
      ? loadMinimalUser(this.managerApproval.reviewedBy as Types.ObjectId)
      : Promise.resolve(null),
    this.financeApproval?.reviewedBy
      ? loadMinimalUser(this.financeApproval.reviewedBy as Types.ObjectId)
      : Promise.resolve(null),
  ]);

  const submittedByDepartment = submitter?.department ?? null;

  return {
    _id: this._id.toString(),
    orgId: this.orgId.toString(),
    title: this.title,
    description: this.description,
    submittedBy: submitter ?? {
      _id: this.submittedBy.toString(),
      name: "[unknown]",
      email: "",
      role: "user" as const,
      department: null,
    },
    submittedByDepartment,
    status: this.status,
    ticketIds: this.ticketIds.map((id) => id.toString()),
    ticketCount: this.ticketIds.length,
    totalAmountBase: this.totalAmountBase,
    tags: this.tags,
    managerApproval: this.managerApproval
      ? {
          required: this.managerApproval.required,
          approved: this.managerApproval.approved,
          reviewedBy: managerReviewer,
          reviewedAt: this.managerApproval.reviewedAt,
          comments: this.managerApproval.comments,
        }
      : null,
    financeApproval: this.financeApproval
      ? {
          required: this.financeApproval.required,
          approved: this.financeApproval.approved,
          reviewedBy: financeReviewer,
          reviewedAt: this.financeApproval.reviewedAt,
          comments: this.financeApproval.comments,
        }
      : null,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

export const Bundle = mongoose.model<IBundle>("Bundle", BundleSchema);
