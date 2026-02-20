import mongoose, { Schema } from "mongoose";
import { IDeptAnalytics, IOrgAnalytics } from "../types/analytics.types.js";

const TopTagSchema = new Schema(
  { tag: String, count: Number },
  { _id: false },
);

const DeptAnalyticsSchema = new Schema<IDeptAnalytics>(
  {
    departmentId: { type: Schema.Types.ObjectId, required: true },
    name: { type: String, required: true },
    totalTickets: { type: Number, default: 0 },
    totalApproved: { type: Number, default: 0 },
    totalRejected: { type: Number, default: 0 },
    totalPending: { type: Number, default: 0 },
    totalAwaitingFinance: { type: Number, default: 0 },
    totalAmountApproved: { type: Number, default: 0 },
    budgetUsagePercent: { type: Number, default: 0 },
    topTags: { type: [TopTagSchema], default: [] },
    avgResolutionTimeMs: { type: Number, default: 0 },
  },
  { _id: false },
);

const OrgAnalyticsSchema = new Schema<IOrgAnalytics>(
  {
    orgId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      unique: true,
    },
    org: {
      totalTickets: { type: Number, default: 0 },
      totalApproved: { type: Number, default: 0 },
      totalRejected: { type: Number, default: 0 },
      totalPending: { type: Number, default: 0 },
      totalAwaitingFinance: { type: Number, default: 0 },
      totalAmountApproved: { type: Number, default: 0 },
      totalAmountPending: { type: Number, default: 0 },
      avgResolutionTimeMs: { type: Number, default: 0 },
      topTags: { type: [TopTagSchema], default: [] },
      currencyBreakdown: {
        type: [{ currency: String, total: Number }],
        default: [],
        _id: false,
      } as any,
    },
    departments: { type: [DeptAnalyticsSchema], default: [] },
    generatedAt: { type: Date, default: Date.now },
  },
  { timestamps: false },
);

// OrgAnalyticsSchema.index({ orgId: 1 });

export const OrgAnalytics = mongoose.model<IOrgAnalytics>(
  "OrgAnalytics",
  OrgAnalyticsSchema,
);
