import type { Currency } from './api.types';

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
  currencyBreakdown: { currency: Currency; total: number }[];
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
  createdBy: { _id: string; name: string } | null;
  createdAt: string;
}
