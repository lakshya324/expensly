import mongoose, { Schema } from "mongoose";
import {
  TICKET_STATUS,
  CURRENCIES,
  EXPENSE_TYPE,
  OCR_STATUS,
  AI_VALIDATION_STATUS,
} from "../config/constants.js";
import { IApproval, ITicket } from "../types/ticket.types.js";
import { EntitySnapshotSchema, UserSnapshotSchema } from "./common.model.js";

const ApprovalSchema = new Schema<IApproval>(
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

const TicketSchema = new Schema<ITicket>(
  {
    /** Nullable in draft / scanning state; required before promotion to pending */
    title: { type: String, trim: true, default: null },
    submittedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    submitterManagerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
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
    receiptIds: {
      type: [{ type: Schema.Types.ObjectId, ref: "Receipt" }],
      default: [],
    },
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
    /** OCR extraction result - populated asynchronously after upload */
    ocrData: {
      type: new Schema(
        {
          status: {
            type: String,
            enum: Object.values(OCR_STATUS),
            required: true,
          },
          rawText: { type: String, default: null },
          confidence: { type: Number, default: null },
          processedAt: { type: String, default: null },
          failureReason: { type: String, default: null },
        },
        { _id: false },
      ),
      default: null,
    },
    /** AI validation summary - advisory only, never auto-approves */
    aiValidation: {
      type: new Schema(
        {
          status: {
            type: String,
            enum: Object.values(AI_VALIDATION_STATUS),
            required: true,
          },
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
          failureReason: { type: String, default: null },
        },
        { _id: false },
      ),
      default: null,
    },
    // ─── Denormalized display snapshots ───────────────────────────────────
    /** Submitter display info - embedded at creation, propagated on rename. */
    submitterSnapshot: { type: UserSnapshotSchema, default: null },
    /** Department display info - embedded at creation, propagated on rename. */
    departmentSnapshot: { type: EntitySnapshotSchema, default: null },
    /** Merchant display info - embedded when linked, propagated on rename. */
    merchantSnapshot: { type: EntitySnapshotSchema, default: null },
    /** Category display info - embedded when linked, propagated on rename. */
    categorySnapshot: { type: EntitySnapshotSchema, default: null },
    /** Bundle display info - embedded when grouped, propagated on title change. */
    bundleSnapshot: { type: EntitySnapshotSchema, default: null },
  },
  { timestamps: true },
);

TicketSchema.index({ orgId: 1, createdAt: -1 }); // all ticket list & CSV export queries
TicketSchema.index({ orgId: 1, status: 1, createdAt: -1 }); // status-filtered lists + analytics approved query
TicketSchema.index({ orgId: 1, department: 1, createdAt: -1 }); // dept-filtered lists & CSV exports
TicketSchema.index({ submittedBy: 1, createdAt: -1 }); // user-scope $or branch (most common regular user path)
TicketSchema.index({ submitterManagerId: 1, createdAt: -1 }); // manager-scope $or branch
TicketSchema.index({ "managerApproval.reviewedBy": 1 }); // restricted user $or branch (finance/manager role)
TicketSchema.index({ bundleId: 1 }); // bundle membership lookup
TicketSchema.index({ orgId: 1, category: 1 }); // category-filtered analytics
TicketSchema.index({ orgId: 1, merchant: 1 }); // merchant-filtered analytics
// Snapshot-path indexes for admin search and propagation targeting
TicketSchema.index({ "submitterSnapshot._id": 1, createdAt: -1 });
TicketSchema.index({ "departmentSnapshot._id": 1, createdAt: -1 });
TicketSchema.index({ "merchantSnapshot._id": 1 });
TicketSchema.index({ "categorySnapshot._id": 1 });

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
    if (!this.title?.trim())
      this.invalidate("title", "Title is required for submitted tickets");
    if (this.amount == null)
      this.invalidate("amount", "Amount is required for submitted tickets");
    if (!this.currency)
      this.invalidate("currency", "Currency is required for submitted tickets");
    if (!this.department)
      this.invalidate(
        "department",
        "Department is required for submitted tickets",
      );
  }
});

export const Ticket = mongoose.model<ITicket>("Ticket", TicketSchema);
