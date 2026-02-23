import type { Currency, TicketStatus, BudgetResetPeriod } from './api.types';

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

export interface ITicketData {
  _id: string;
  title: string;
  submittedBy: { _id: string; name: string; email: string };
  submitterManagerId: string | null;
  orgId: string;
  amount: number;
  currency: Currency;
  department: { _id: string; name: string } | null;
  description: string;
  tags: string[];
  receiptKey: string | null;
  status: TicketStatus;
  flagged: boolean;
  managerApproval: ApprovalStep | null;
  financeApproval: ApprovalStep | null;
  exchangeRateSnapshotId: string | null;
  convertedAmount: number | null;
  createdAt: string;
  updatedAt: string;
}
