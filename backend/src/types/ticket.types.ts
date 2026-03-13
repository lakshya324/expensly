import { Document, Types } from "mongoose";
import { Currency, ExpenseType, TicketStatus } from "../config/constants.js";
import { IUserData, IUserMinimalData } from "./user.types.js";
import { IDepartmentData } from "./department.types.js";
import { IOrganization } from "./organization.types.js";
import { IOcrData } from "./ocr.types.js";
import { IAiValidationResult } from "./aiValidation.types.js";
import { IMerchantData } from "./merchant.types.js";
import { ICategoryData } from "./category.types.js";
import { IBundleData, IBundleSummaryData } from "./bundle.types.js";
import { IReceiptRef } from "./receipt.types.js";

export interface IApproval {
  required?: boolean;
  approved: boolean | null;
  reviewedBy: Types.ObjectId | null;
  reviewedAt: Date | null;
  comments: string | null;
}

export interface ITicket extends Document {
  _id: Types.ObjectId;
  /** Nullable in draft/scanning state — required before submission to pending */
  title: string | null;
  submittedBy: Types.ObjectId;
  /** Manager ID of the submitter at creation time (for efficient filtering) */
  submitterManagerId: Types.ObjectId | null;
  orgId: Types.ObjectId;
  /** Nullable in draft/scanning state */
  amount: number | null;
  /** Nullable in draft/scanning state */
  currency: Currency | null;
  /** Nullable in draft/scanning state */
  department: Types.ObjectId | null;
  description: string;
  tags: string[];
  /** Replaces the old single receiptKey field — supports multi-receipt uploads */
  receiptIds: Types.ObjectId[];
  status: TicketStatus;
  flagged: boolean;
  managerApproval: IApproval | null;
  financeApproval: IApproval | null;
  /** Rate snapshot ID at the time of final approval */
  exchangeRateSnapshotId: Types.ObjectId | null;
  // ─── New extensibility fields (all optional / nullable) ──────────────────
  /** Reference to a structured Merchant document */
  merchant: Types.ObjectId | null;
  /** Reference to a structured Category document */
  category: Types.ObjectId | null;
  /** Reference to an expense Bundle this ticket belongs to */
  bundleId: Types.ObjectId | null;
  /** Type of expense (regular | per_diem | mileage) */
  expenseType: ExpenseType;
  /** AI-extracted receipt data populated after OCR processing */
  ocrData: IOcrData | null;
  /** AI validation summary; populated after async validation run */
  aiValidation: IAiValidationResult | null;
  createdAt: Date;
  updatedAt: Date;

  //! Methods
  data: (this: ITicket, org: IOrganization) => Promise<ITicketData>;
}

export interface IApprovalData {
  required?: boolean;
  approved: boolean | null;
  reviewedBy: IUserMinimalData | null;
  reviewedAt: Date | null;
  comments: string | null;
}

/** Full ticket shape — returned by single-ticket endpoints, websocket events, and OCR/AI workers. */
export interface ITicketData {
  _id: string;
  title: string | null;
  submittedBy: IUserMinimalData;
  submitterManagerId: string | null;
  orgId: string;
  amount: number | null;
  currency: Currency | null;
  department: IDepartmentData | null;
  description: string;
  tags: string[];
  /** Receipt references with pre-signed S3 URLs */
  receipts: IReceiptRef[];
  status: TicketStatus;
  flagged: boolean;
  managerApproval: IApprovalData | null;
  financeApproval: IApprovalData | null;
  exchangeRateSnapshotId: string | null;
  ratesChangedSinceApproval: boolean;
  // ─── Relation fields ───────────────────────────────────────────────────────
  merchant: IMerchantData | null;
  category: ICategoryData | null;
  /** Nested bundle summary — use bundle._id to navigate to the bundle */
  bundle: IBundleSummaryData | null;
  expenseType: ExpenseType;
  ocrData: IOcrData | null;
  aiValidation: IAiValidationResult | null;
  createdAt: Date;
}

/**
 * Lightweight ticket shape for paginated list responses.
 * Merchant and category are name-only summaries (no S3 URL resolution).
 * Receipts contain IDs only (no pre-signed URLs — use the dedicated receipt endpoint).
 */
export type ITicketSummaryData = Omit<ITicketData, "receipts" | "merchant" | "category"> & {
  /** Receipt IDs only — no pre-signed URLs in list context */
  receipts: { _id: string }[];
  merchant: { _id: string; name: string } | null;
  category: { _id: string; name: string } | null;
};
