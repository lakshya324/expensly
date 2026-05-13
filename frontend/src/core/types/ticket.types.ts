import type { Currency, ExpenseType, TicketStatus, BudgetResetPeriod } from './api.types';

export interface DepartmentPermissions {
  view_all_tickets: boolean;
  approve_finance: boolean;
  export_reports: boolean;
  view_analytics: boolean;
}

export interface IDepartmentData {
  _id: string;
  orgId: string;
  name: string;
  budget: number;
  spent: number;
  approvalThresholds: Record<Currency, number>;
  permissions: DepartmentPermissions;
  policyId: string | null;
  policySnapshot: { _id: string; name: string } | null;
  tags: string[];
  budgetResetPeriod: BudgetResetPeriod;
  nextResetDate: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ApprovalStep {
  required: boolean;
  approved: boolean | null;
  reviewedBy: { _id: string; name: string } | null;
  reviewedAt: string | null;
  comments: string | null;
}

/** Matches the backend IOcrData shape (flat primitives, all nullable until OCR completes). */
export interface OcrData {
  status: 'processing' | 'completed' | 'failed';
  rawText: string | null;
  confidence: number | null;
  processedAt: string | null;
}

export interface AiValidationCheck {
  label: string;
  passed: boolean;
  confidence: number | null;
  detail: string | null;
}

export interface AiValidation {
  status: 'passed' | 'flagged' | 'error' | 'pending' | 'in_progress';
  checks: AiValidationCheck[];
  summary: string | null;
  validatedAt: string | null;
  suggestedTitle: string | null;
  suggestedAmount: number | null;
  suggestedCurrency: string | null;
  suggestedDate: string | null;
  suggestedMerchantName: string | null;
  suggestedCategoryName: string | null;
  suggestedDescription: string | null;
  unmatchedMerchantSuggestionText: string | null;
  unmatchedCategorySuggestionText: string | null;
}

export interface IReceiptRef {
  _id: string;
  url: string;
}

export interface ITicketData {
  _id: string;
  title: string | null;
  submittedBy: { _id: string; name: string; email: string };
  submitterManagerId: string | null;
  orgId: string;
  amount: number | null;
  currency: Currency | null;
  department: { _id: string; name: string } | null;
  description: string;
  tags: string[];
  receipts: IReceiptRef[];
  status: TicketStatus;
  flagged: boolean;
  merchant: { _id: string; name: string; logoUrl?: string | null } | null;
  category: { _id: string; name: string; iconUrl?: string | null } | null;
  bundle: { _id: string; title: string; description: string } | null;
  expenseType: ExpenseType;
  ocrData: OcrData | null;
  aiValidation: AiValidation | null;
  managerApproval: ApprovalStep | null;
  financeApproval: ApprovalStep | null;
  exchangeRateSnapshotId: string | null;
  convertedAmount: number | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Lighter shape returned by paginated list endpoints.
 * merchant/category carry only _id + name (no S3 URLs).
 * receipts carry only _id (no presigned URLs).
 */
export type ITicketSummaryData = Omit<ITicketData, 'receipts' | 'merchant' | 'category'> & {
  receipts: { _id: string }[];
  merchant: { _id: string; name: string } | null;
  category: { _id: string; name: string } | null;
};

export interface IDiscussionMessageData {
  _id: string;
  ticketId: string;
  orgId: string;
  author: { _id: string; name: string; email: string; role: string; department: { _id: string; name: string } | null };
  text: string;
  editedAt: string | null;
  deleted: boolean;
  createdAt: string;
  updatedAt: string;
}

// ─── Merchant ─────────────────────────────────────────────────────────────────
export interface IMerchantData {
  _id: string;
  orgId: string;
  name: string;
  normalizedName: string;
  isActive: boolean;
  createdBy: string;
  logoUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

// ─── Category ────────────────────────────────────────────────────────────────
export interface ICategoryData {
  _id: string;
  orgId: string;
  name: string;
  normalizedName: string;
  description: string;
  isActive: boolean;
  isSystem: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Policy ───────────────────────────────────────────────────────────────────
export type PermissionKey = 'view_all_tickets' | 'approve_finance' | 'export_reports' | 'view_analytics';

export interface IPolicyData {
  _id: string;
  orgId: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  isActive: boolean;
  grants: PermissionKey[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Audit Log ────────────────────────────────────────────────────────────────
export type AuditAction =
  | 'created' | 'updated' | 'status_changed' | 'deleted' | 'flagged' | 'unflagged'
  | 'approved' | 'rejected' | 'commented' | 'bundle_added' | 'bundle_removed'
  | 'user_created' | 'user_updated' | 'user_disabled' | 'user_enabled' | 'permissions_updated';

export type EntityType = 'ticket' | 'user' | 'department' | 'bundle' | 'merchant' | 'category';

export interface IAuditLogData {
  _id: string;
  orgId: string;
  entityType: EntityType;
  entityId: string;
  action: AuditAction;
  performer: { _id: string; name: string };
  ip: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

// ─── Bundle ───────────────────────────────────────────────────────────────────
export type BundleStatus = 'draft' | 'submitted' | 'approved' | 'rejected';

export interface IBundleData {
  _id: string;
  orgId: string;
  title: string;
  description: string;
  submittedBy: { _id: string; name: string; email: string };
  submittedByDepartment: { _id: string; name: string } | null;
  status: BundleStatus;
  ticketCount: number;
  totalAmountBase: number | null;
  baseCurrency: string | null;
  tags: string[];
  managerApproval: {
    approved: boolean | null;
    reviewedBy: { _id: string; name: string } | null;
    reviewedAt: string | null;
    comments: string | null;
  } | null;
  financeApproval: {
    approved: boolean | null;
    reviewedBy: { _id: string; name: string } | null;
    reviewedAt: string | null;
    comments: string | null;
  } | null;
  createdAt: string;
  updatedAt: string;
}
