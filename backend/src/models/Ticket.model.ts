import mongoose, { Schema } from "mongoose";
import { TICKET_STATUS, CURRENCIES } from "../config/constants.js";
import {
  IApproval,
  IApprovalData,
  ITicket,
  ITicketData,
} from "../types/ticket.types.js";
import { User } from "./User.model.js";
import { IOrganization } from "../types/organization.types.js";
import { Department } from "./Department.model.js";
import { createError } from "../utils/error.js";

const ApprovalSchema = new Schema<IApproval>(
  {
    required: { type: Boolean, default: false },
    approved: { type: Boolean, default: null },
    reviewedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    reviewedAt: { type: Date, default: null },
    comments: { type: String, trim: true, default: null },
  },
  { _id: false },
);

const TicketSchema = new Schema<ITicket>(
  {
    title: { type: String, required: true, trim: true },
    submittedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    submitterManagerId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    orgId: { type: Schema.Types.ObjectId, ref: "Organization", required: true },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, enum: CURRENCIES, required: true },
    department: {
      type: Schema.Types.ObjectId,
      ref: "Department",
      required: true,
    },
    description: { type: String, trim: true, default: "" },
    tags: { type: [String], default: [] },
    receiptKey: { type: String, default: null },
    status: {
      type: String,
      enum: Object.values(TICKET_STATUS),
      default: TICKET_STATUS.PENDING,
    },
    flagged: { type: Boolean, default: false },
    managerApproval: { type: ApprovalSchema, default: null },
    financeApproval: { type: ApprovalSchema, default: null },
    exchangeRateSnapshotId: {
      type: Schema.Types.ObjectId,
      ref: "ExchangeRateSnapshot",
      default: null,
    },
    convertedAmount: { type: Number, default: null },
  },
  { timestamps: true },
);

TicketSchema.index({ orgId: 1 });
TicketSchema.index({ submittedBy: 1 });
TicketSchema.index({ submitterManagerId: 1 });
TicketSchema.index({ orgId: 1, status: 1 });
TicketSchema.index({ orgId: 1, department: 1 });
TicketSchema.index({ createdAt: -1 });

TicketSchema.methods.data = async function (
  this: ITicket,
  org: IOrganization,
): Promise<ITicketData> {
  // Load department from its own collection
  const dept = this.department
    ? await Department.findById(this.department)
    : null;

  const fetchUsers = [this.submittedBy];
  if (this.managerApproval?.reviewedBy)
    fetchUsers.push(this.managerApproval.reviewedBy);
  if (this.financeApproval?.reviewedBy)
    fetchUsers.push(this.financeApproval.reviewedBy);

  const users = await User.find({ _id: { $in: fetchUsers } }).select(
    "_id name email role department",
  );

  const submittedBy = users.find((u) => u._id.equals(this.submittedBy));
  if (!submittedBy)
    createError("Submitted by user not found", 500, "DATA_ERROR");

  // Resolve reviewer dept data
  const resolveReviewerDept = async (deptId: mongoose.Types.ObjectId | null | undefined) => {
    if (!deptId) return null;
    const d = await Department.findById(deptId);
    return d ? d.toData() : null;
  };

  const managerReviewer = this.managerApproval?.reviewedBy
    ? users.find((u) => u._id.equals(this.managerApproval!.reviewedBy!))
    : null;
  const financeReviewer = this.financeApproval?.reviewedBy
    ? users.find((u) => u._id.equals(this.financeApproval!.reviewedBy!))
    : null;

  const [managerReviewerDept, financeReviewerDept, submittedByDept] =
    await Promise.all([
      resolveReviewerDept(managerReviewer?.department as mongoose.Types.ObjectId | null | undefined),
      resolveReviewerDept(financeReviewer?.department as mongoose.Types.ObjectId | null | undefined),
      resolveReviewerDept(submittedBy?.department as mongoose.Types.ObjectId | null | undefined),
    ]);

  const managerApproval: IApprovalData | null = this.managerApproval
    ? {
        required: this.managerApproval.required,
        approved: this.managerApproval.approved,
        reviewedBy: managerReviewer
          ? {
              _id: managerReviewer._id.toString(),
              name: managerReviewer.name,
              email: managerReviewer.email,
              role: managerReviewer.role,
              department: managerReviewerDept,
            }
          : null,
        reviewedAt: this.managerApproval.reviewedAt,
        comments: this.managerApproval.comments,
      }
    : null;

  const financeApproval: IApprovalData | null = this.financeApproval
    ? {
        required: this.financeApproval.required,
        approved: this.financeApproval.approved,
        reviewedBy: financeReviewer
          ? {
              _id: financeReviewer._id.toString(),
              name: financeReviewer.name,
              email: financeReviewer.email,
              role: financeReviewer.role,
              department: financeReviewerDept,
            }
          : null,
        reviewedAt: this.financeApproval.reviewedAt,
        comments: this.financeApproval.comments,
      }
    : null;

  // Determine if rates changed since approval
  const ratesChangedSinceApproval =
    this.exchangeRateSnapshotId != null &&
    org.currentRateSnapshotId != null &&
    this.exchangeRateSnapshotId.toString() !==
      org.currentRateSnapshotId.toString();

  return {
    _id: this._id.toString(),
    title: this.title,
    submittedBy: {
      _id: submittedBy._id.toString(),
      name: submittedBy.name,
      email: submittedBy.email,
      role: submittedBy.role,
      department: submittedByDept,
    },
    submitterManagerId: this.submitterManagerId ? this.submitterManagerId.toString() : null,
    orgId: this.orgId.toString(),
    amount: this.amount,
    currency: this.currency,
    department: dept ? dept.toData() : null,
    description: this.description,
    tags: this.tags,
    receiptKey: this.receiptKey,
    status: this.status,
    flagged: this.flagged,
    managerApproval,
    financeApproval,
    exchangeRateSnapshotId: this.exchangeRateSnapshotId
      ? this.exchangeRateSnapshotId.toString()
      : null,
    convertedAmount: this.convertedAmount,
    ratesChangedSinceApproval,
    createdAt: this.createdAt,
  };
};

export const Ticket = mongoose.model<ITicket>("Ticket", TicketSchema);
