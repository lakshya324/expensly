import { Document, Types } from "mongoose";

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
  };
  departments: IDeptAnalyticsData[];
  generatedAt: Date;
}
