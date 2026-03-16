import mongoose, { Schema } from "mongoose";
import { TICKET_STATUS, CURRENCIES, EXPENSE_TYPE, OCR_STATUS, AI_VALIDATION_STATUS } from "../config/constants.js";
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
import { getReceiptRefsById } from "../services/receipt.service.js";
import { IReceiptRef } from "../types/receipt.types.js";

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
    /** Nullable in draft / scanning state; required before promotion to pending */
    title: { type: String, trim: true, default: null },
    submittedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    submitterManagerId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    orgId: { type: Schema.Types.ObjectId, ref: "Organization", required: true },
    /** Nullable in draft / scanning state */
    amount: { type: Number, min: 0, default: null },
    /** Nullable in draft / scanning state */
    currency: { type: String, enum: CURRENCIES, default: null },
    /** Nullable in draft / scanning state */
    department: {
      type: Schema.Types.ObjectId,
      ref: "Department",
      default: null,
    },
    description: { type: String, trim: true, default: "" },
    tags: { type: [String], default: [] },
    /** References to Receipt documents for attached files */
    receiptIds: { type: [{ type: Schema.Types.ObjectId, ref: "Receipt" }], default: [] },
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
    // ─── Extensibility fields ──────────────────────────────────────────────
    /** Structured merchant reference (null = unlinked / free-form) */
    merchant: { type: Schema.Types.ObjectId, ref: "Merchant", default: null },
    /** Structured category reference (null = unlinked / free-form) */
    category: { type: Schema.Types.ObjectId, ref: "Category", default: null },
    /** Bundle this ticket has been grouped into */
    bundleId: { type: Schema.Types.ObjectId, ref: "Bundle", default: null },
    /** Differentiates regular expense / per-diem / mileage claims */
    expenseType: {
      type: String,
      enum: Object.values(EXPENSE_TYPE),
      default: EXPENSE_TYPE.REGULAR,
    },
    /** OCR extraction result — populated asynchronously after upload */
    ocrData: {
      type: new Schema(
        {
          status: { type: String, enum: Object.values(OCR_STATUS), required: true },
          rawText: { type: String, default: null },
          confidence: { type: Number, default: null },
          processedAt: { type: String, default: null },
        },
        { _id: false },
      ),
      default: null,
    },
    /** AI validation summary — advisory only, never auto-approves */
    aiValidation: {
      type: new Schema(
        {
          status: { type: String, enum: Object.values(AI_VALIDATION_STATUS), required: true },
          checks: {
            type: [
              new Schema(
                {
                  label: { type: String, required: true },
                  passed: { type: Boolean, required: true },
                  confidence: { type: Number, default: null },
                  detail: { type: String, default: null },
                },
                { _id: false },
              ),
            ],
            default: [],
          },
          summary: { type: String, default: null },
          validatedAt: { type: String, default: null },
          // ─── AI-extracted fields (scanning → draft) ───────────────────
          suggestedTitle: { type: String, default: null },
          suggestedAmount: { type: Number, default: null },
          suggestedCurrency: { type: String, default: null },
          suggestedDate: { type: String, default: null },
          suggestedMerchantName: { type: String, default: null },
          suggestedCategoryName: { type: String, default: null },
          suggestedDescription: { type: String, default: null },
          unmatchedMerchantSuggestionText: { type: String, default: null },
          unmatchedCategorySuggestionText: { type: String, default: null },
        },
        { _id: false },
      ),
      default: null,
    },
  },
  { timestamps: true },
);

// TicketSchema.index({ orgId: 1 });
// TicketSchema.index({ submitterManagerId: 1 });
// TicketSchema.index({ orgId: 1, status: 1 }); // kept for aggregation $match (no sort needed there)
// TicketSchema.index({ orgId: 1, department: 1 }); // kept for aggregation $match (no sort needed there)
TicketSchema.index({ orgId: 1, createdAt: -1 }); // all ticket list & CSV export queries
TicketSchema.index({ orgId: 1, status: 1, createdAt: -1 }); // status-filtered lists + analytics approved query
TicketSchema.index({ orgId: 1, department: 1, createdAt: -1 }); // dept-filtered lists & CSV exports
TicketSchema.index({ submittedBy: 1, createdAt: -1 }); // user-scope $or branch (most common regular user path)
TicketSchema.index({ submitterManagerId: 1, createdAt: -1 }); // manager-scope $or branch
TicketSchema.index({ "managerApproval.reviewedBy": 1 }); // restricted user $or branch (finance/manager role)

// Enforce required fields when a ticket enters the approval flow.
// draft/scanning tickets are allowed to have null title/amount/currency/department.
const APPROVAL_STATUSES: string[] = [
  TICKET_STATUS.PENDING,
  TICKET_STATUS.AWAITING_FINANCE,
  TICKET_STATUS.APPROVED,
  TICKET_STATUS.REJECTED,
];
TicketSchema.pre("save", function () {
  if (APPROVAL_STATUSES.includes(this.status)) {
    if (!this.title?.trim()) this.invalidate("title", "Title is required for submitted tickets");
    if (this.amount == null) this.invalidate("amount", "Amount is required for submitted tickets");
    if (!this.currency) this.invalidate("currency", "Currency is required for submitted tickets");
    if (!this.department) this.invalidate("department", "Department is required for submitted tickets");
  }
});
// ─── Extensibility indexes ─────────────────────────────────────────────────
TicketSchema.index({ bundleId: 1 }); // bundle membership lookup
TicketSchema.index({ orgId: 1, category: 1 }); // category-filtered analytics
TicketSchema.index({ orgId: 1, merchant: 1 }); // merchant-filtered analytics

TicketSchema.methods.data = async function (
  this: ITicket,
  org: IOrganization,
): Promise<ITicketData> {
  const fetchUsers = [this.submittedBy];
  if (this.managerApproval?.reviewedBy)
    fetchUsers.push(this.managerApproval.reviewedBy);
  if (this.financeApproval?.reviewedBy)
    fetchUsers.push(this.financeApproval.reviewedBy);

  // Fetch ticket dept and all involved users in parallel — independent queries.
  const [dept, users] = await Promise.all([
    this.department ? Department.findById(this.department) : Promise.resolve(null),
    User.find({ _id: { $in: fetchUsers } }).select("_id name email role department"),
  ]);

  const submittedBy = users.find((u) => u._id.equals(this.submittedBy));
  if (!submittedBy)
    createError("Submitted by user not found", 500, "DATA_ERROR");

  const managerReviewer = this.managerApproval?.reviewedBy
    ? users.find((u) => u._id.equals(this.managerApproval!.reviewedBy!))
    : null;
  const financeReviewer = this.financeApproval?.reviewedBy
    ? users.find((u) => u._id.equals(this.financeApproval!.reviewedBy!))
    : null;

  // Collect all unique reviewer department IDs and fetch them in one query
  // instead of up to 3 individual Department.findById calls.
  const reviewerDeptIds = [
    managerReviewer?.department,
    financeReviewer?.department,
    submittedBy?.department,
  ].filter(Boolean) as mongoose.Types.ObjectId[];

  const uniqueReviewerDeptIds = [
    ...new Map(reviewerDeptIds.map((id) => [id.toString(), id])).values(),
  ];

  const reviewerDepts =
    uniqueReviewerDeptIds.length > 0
      ? await Department.find({ _id: { $in: uniqueReviewerDeptIds } })
      : [];
  const reviewerDeptMap = new Map(
    reviewerDepts.map((d) => [d._id.toString(), d]),
  );

  const resolveDept = (deptId: mongoose.Types.ObjectId | null | undefined) => {
    if (!deptId) return null;
    const d = reviewerDeptMap.get(deptId.toString());
    return d ? d.toData() : null;
  };

  const managerReviewerDept = resolveDept(
    managerReviewer?.department as mongoose.Types.ObjectId | null | undefined,
  );
  const financeReviewerDept = resolveDept(
    financeReviewer?.department as mongoose.Types.ObjectId | null | undefined,
  );
  const submittedByDept = resolveDept(
    submittedBy?.department as mongoose.Types.ObjectId | null | undefined,
  );

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

  // Resolve optional merchant, category, bundle, and receipt references — fully parallel.
  // Dynamic imports are chained without intermediate awaits so all four branches
  // start concurrently (including the S3 presign calls inside toData()).
  const [merchant, category, bundleDoc, receipts] = await Promise.all([
    this.merchant
      ? import("./Merchant.model.js").then(({ Merchant }) =>
          Merchant.findById(this.merchant).then((d) => (d ? d.toData() : null)),
        )
      : Promise.resolve(null),
    this.category
      ? import("./Category.model.js").then(({ Category }) =>
          Category.findById(this.category).then((d) => (d ? d.toData() : null)),
        )
      : Promise.resolve(null),
    this.bundleId
      ? import("./Bundle.model.js").then(({ Bundle }) =>
          Bundle.findById(this.bundleId).select("title description"),
        )
      : Promise.resolve(null),
    this.receiptIds.length > 0
      ? getReceiptRefsById(this.receiptIds)
      : Promise.resolve([] as IReceiptRef[]),
  ]);

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
    receipts,
    status: this.status,
    flagged: this.flagged,
    managerApproval,
    financeApproval,
    exchangeRateSnapshotId: this.exchangeRateSnapshotId
      ? this.exchangeRateSnapshotId.toString()
      : null,
    ratesChangedSinceApproval,
    merchant: merchant ?? null,
    category: category ?? null,
    bundle: bundleDoc ? bundleDoc.toSummaryData() : null,
    expenseType: this.expenseType,
    ocrData: this.ocrData ?? null,
    aiValidation: this.aiValidation ?? null,
    createdAt: this.createdAt,
  };
};

export const Ticket = mongoose.model<ITicket>("Ticket", TicketSchema);
