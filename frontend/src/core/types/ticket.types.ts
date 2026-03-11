import type { Currency, ExpenseType, TicketStatus, BudgetResetPeriod } from './api.types';

export interface DepartmentPermissions {
  canViewAllTickets: boolean;
  canApprove: boolean;
}

export interface IDepartmentData {
  _id: string;
  orgId: string;
  name: string;
  budget: number;
  spent: number;
  approvalThresholds: Record<Currency, number>;
  permissions: DepartmentPermissions;
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

export interface OcrField {
  value: string | number | null;
  confidence: number;
}

export interface OcrData {
  vendor: OcrField;
  date: OcrField;
  total: OcrField;
  currency: OcrField;
  rawText: string;
  confidence: number;
}

export interface AiValidationCheck {
  field: string;
  status: 'ok' | 'warning' | 'error';
  message: string;
  confidence: number;
}

export interface AiValidation {
  overallStatus: 'ok' | 'warning' | 'error';
  checks: AiValidationCheck[];
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
  receiptKey: string | null;
  receiptKeys: string[];
  status: TicketStatus;
  flagged: boolean;
  merchant: { _id: string; name: string; logoUrl?: string | null } | null;
  category: { _id: string; name: string; color?: string | null } | null;
  bundleId: string | null;
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

export interface IDiscussionMessageData {
  _id: string;
  ticketId: string;
  orgId: string;
  author: { _id: string; name: string; email: string; role: string };
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
  logoKey: string | null;
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
  performedBy: { _id: string; name: string; email: string } | string;
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
  ticketIds: string[];
  ticketCount: number;
  totalAmountBase: number | null;
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
