import { Document, Types } from "mongoose";

export interface IMonthlyTrendPoint {
  year: number;
  month: number; // 1-12
  submittedCount: number;
  approvedAmount: number;
}

export interface ICategoryBreakdownItem {
  categoryId: string | null;
  name: string;
  count: number;
  totalAmount: number;
}

export interface IMerchantBreakdownItem {
  merchantId: string | null;
  name: string;
  count: number;
  totalAmount: number;
}

export interface IExpenseTypeBreakdownItem {
  type: string;
  count: number;
  totalAmount: number;
}

export interface IDeptAnalytics {
  departmentId: Types.ObjectId;
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

export interface IOrgAnalytics extends Document {
  _id: Types.ObjectId;
  orgId: Types.ObjectId;
  org: {
    totalTickets: number;
    totalApproved: number;
    totalRejected: number;
    totalPending: number;
    totalAwaitingFinance: number;
    totalAmountApproved: number;
    totalAmountPending: number;
    avgResolutionTimeMs: number;
    topTags: { tag: string; count: number }[];
    currencyBreakdown: { currency: string; total: number; originalTotal: number }[];
    totalFlagged: number;
    flaggedRate: number;
    monthlyTrend: IMonthlyTrendPoint[];
    categoryBreakdown: ICategoryBreakdownItem[];
    merchantBreakdown: IMerchantBreakdownItem[];
    expenseTypeBreakdown: IExpenseTypeBreakdownItem[];
  };
  departments: IDeptAnalytics[];
  generatedAt: Date;
}

export interface IDeptAnalyticsData {
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

export interface IOrgAnalyticsData {
  orgId: string;
  org: {
    totalTickets: number;
    totalApproved: number;
    totalRejected: number;
    totalPending: number;
    totalAwaitingFinance: number;
    totalAmountApproved: number;
    totalAmountPending: number;
    avgResolutionTimeMs: number;
    topTags: { tag: string; count: number }[];
    currencyBreakdown: { currency: string; total: number; originalTotal: number }[];
    totalFlagged: number;
    flaggedRate: number;
    monthlyTrend: IMonthlyTrendPoint[];
    categoryBreakdown: ICategoryBreakdownItem[];
    merchantBreakdown: IMerchantBreakdownItem[];
    expenseTypeBreakdown: IExpenseTypeBreakdownItem[];
  };
  departments: IDeptAnalyticsData[];
  generatedAt: Date;
}
