import type { Currency } from './api.types';

export interface MonthlyTrendPoint {
  year: number;
  month: number;
  submittedCount: number;
  approvedAmount: number;
}

export interface CategoryBreakdownItem {
  categoryId: string | null;
  name: string;
  count: number;
  totalAmount: number;
}

export interface MerchantBreakdownItem {
  merchantId: string | null;
  name: string;
  count: number;
  totalAmount: number;
}

export interface ExpenseTypeBreakdownItem {
  type: string;
  count: number;
  totalAmount: number;
}

export interface DeptAnalytics {
  departmentId: string;
  name: string;
  totalTickets: number;
  totalApproved: number;
  totalRejected: number;
  totalPending: number;
  totalAwaitingFinance: number;
  totalAmountApproved: number;
  budgetUsagePercent: number;
  topTags: { tag: string; count: number }[];
  avgResolutionTimeMs: number;
}

export interface OrgAnalytics {
  totalTickets: number;
  totalApproved: number;
  totalRejected: number;
  totalPending: number;
  totalAwaitingFinance: number;
  totalAmountApproved: number;
  totalAmountPending: number;
  avgResolutionTimeMs: number;
  topTags: { tag: string; count: number }[];
  currencyBreakdown: { currency: Currency; total: number; originalTotal: number }[];
  totalFlagged?: number;
  flaggedRate?: number;
  monthlyTrend?: MonthlyTrendPoint[];
  categoryBreakdown?: CategoryBreakdownItem[];
  merchantBreakdown?: MerchantBreakdownItem[];
  expenseTypeBreakdown?: ExpenseTypeBreakdownItem[];
}

export interface IOrgAnalyticsData {
  _id: string;
  orgId: string;
  org: OrgAnalytics;
  departments: DeptAnalytics[];
  generatedAt: string;
}

export interface IExchangeRateSnapshot {
  _id: string;
  orgId: string;
  rates: Record<Currency, number>;
  baseCurrency: Currency;
  source: 'manual' | 'fetched';
  creator: { _id: string; name: string };
  createdAt: string;
}
