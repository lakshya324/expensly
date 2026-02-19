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
import { Organization } from "./Organization.model.js";
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
    orgId: { type: Schema.Types.ObjectId, ref: "Organization", required: true },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, enum: CURRENCIES, required: true },
    department: { type: Schema.Types.ObjectId, required: true },
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
  },
  { timestamps: true },
);

TicketSchema.index({ orgId: 1 });
TicketSchema.index({ submittedBy: 1 });
TicketSchema.index({ orgId: 1, status: 1 });
TicketSchema.index({ orgId: 1, department: 1 });
TicketSchema.index({ createdAt: -1 });

TicketSchema.methods.data = async function (
  this: ITicket,
  org: IOrganization,
): Promise<ITicketData> {
  const department = org.departmentData();
  const ticketDept = department.find(
    (d) => d._id.toString() === this.department.toString(),
  );
  if (!ticketDept)
    createError(
      "Ticket department not found in organization",
      500,
      "DATA_ERROR",
    );

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

  const managerReviewer = this.managerApproval?.reviewedBy
    ? users.find((u) => u._id.equals(this.managerApproval!.reviewedBy!))
    : null;
  const financeReviewer = this.financeApproval?.reviewedBy
    ? users.find((u) => u._id.equals(this.financeApproval!.reviewedBy!))
    : null;

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
              department:
                department.find(
                  (d) =>
                    d._id.toString() === managerReviewer.department?.toString(),
                ) || null,
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
              department:
                department.find(
                  (d) =>
                    d._id.toString() === financeReviewer.department?.toString(),
                ) || null,
            }
          : null,
        reviewedAt: this.financeApproval.reviewedAt,
        comments: this.financeApproval.comments,
      }
    : null;

  return {
    _id: this._id.toString(),
    title: this.title,
    submittedBy: {
      _id: submittedBy._id.toString(),
      name: submittedBy.name,
      email: submittedBy.email,
      role: submittedBy.role,
      department: submittedBy.department
        ? department.find(
            (d) => d._id.toString() === submittedBy.department?.toString(),
          ) || null
        : null,
    },
    orgId: this.orgId.toString(),
    amount: this.amount,
    currency: this.currency,
    department: ticketDept,
    description: this.description,
    tags: this.tags,
    receiptKey: this.receiptKey,
    status: this.status,
    flagged: this.flagged,
    managerApproval,
    financeApproval,
    createdAt: this.createdAt,
  };
};

export const Ticket = mongoose.model<ITicket>("Ticket", TicketSchema);
