/**
 * Analytics Service
 *
 * Computes and stores pre-computed analytics snapshots at org + dept level.
 * Call refreshOrgAnalytics() after ticket approvals/rejections or from the cron job.
 */
import { Types } from "mongoose";
import { Ticket } from "../models/Ticket.model.js";
import { Department } from "../models/Department.model.js";
import { OrgAnalytics } from "../models/OrgAnalytics.model.js";
import { TICKET_STATUS } from "../config/constants.js";
import { IOrgAnalyticsData } from "../types/analytics.types.js";
import { logError, logInfo } from "../utils/logger.js";

// ---------------------------------------------------------------------------
// Refresh analytics snapshot for a given org
// ---------------------------------------------------------------------------
export async function refreshOrgAnalytics(
  orgId: Types.ObjectId | string,
): Promise<IOrgAnalyticsData> {
  const oid = new Types.ObjectId(orgId.toString());

  // 1. Aggregate org-level stats
  const orgStats = await Ticket.aggregate([
    { $match: { orgId: oid } },
    {
      $group: {
        _id: null,
        totalTickets: { $sum: 1 },
        totalApproved: {
          $sum: { $cond: [{ $eq: ["$status", TICKET_STATUS.APPROVED] }, 1, 0] },
        },
        totalRejected: {
          $sum: { $cond: [{ $eq: ["$status", TICKET_STATUS.REJECTED] }, 1, 0] },
        },
        totalPending: {
          $sum: { $cond: [{ $eq: ["$status", TICKET_STATUS.PENDING] }, 1, 0] },
        },
        totalAwaitingFinance: {
          $sum: { $cond: [{ $eq: ["$status", TICKET_STATUS.AWAITING_FINANCE] }, 1, 0] },
        },
        totalAmountApproved: {
          $sum: {
            $cond: [
              { $eq: ["$status", TICKET_STATUS.APPROVED] },
              { $ifNull: ["$convertedAmount", "$amount"] },
              0,
            ],
          },
        },
        totalAmountPending: {
          $sum: {
            $cond: [
              { $in: ["$status", [TICKET_STATUS.PENDING, TICKET_STATUS.AWAITING_FINANCE]] },
              "$amount",
              0,
            ],
          },
        },
      },
    },
  ]);

  // 2. Avg resolution time for approved tickets (createdAt → financeApproval.reviewedAt)
  const resolutionAgg = await Ticket.aggregate([
    {
      $match: {
        orgId: oid,
        status: TICKET_STATUS.APPROVED,
        "financeApproval.reviewedAt": { $ne: null },
      },
    },
    {
      $project: {
        resolutionMs: {
          $subtract: ["$financeApproval.reviewedAt", "$createdAt"],
        },
      },
    },
    { $group: { _id: null, avg: { $avg: "$resolutionMs" } } },
  ]);

  // 3. Top tags at org level
  const topTagsAgg = await Ticket.aggregate([
    { $match: { orgId: oid } },
    { $unwind: "$tags" },
    { $group: { _id: "$tags", count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 10 },
    { $project: { tag: "$_id", count: 1, _id: 0 } },
  ]);

  // 4. Currency breakdown (approved tickets only, using convertedAmount if available)
  const currencyAgg = await Ticket.aggregate([
    { $match: { orgId: oid, status: TICKET_STATUS.APPROVED } },
    {
      $group: {
        _id: "$currency",
        total: { $sum: "$amount" },
      },
    },
    { $project: { currency: "$_id", total: 1, _id: 0 } },
  ]);

  // 5. Dept-level stats
  const depts = await Department.find({ orgId: oid, isActive: true });

  const deptStatsAgg = await Ticket.aggregate([
    { $match: { orgId: oid } },
    {
      $group: {
        _id: "$department",
        totalTickets: { $sum: 1 },
        totalApproved: {
          $sum: { $cond: [{ $eq: ["$status", TICKET_STATUS.APPROVED] }, 1, 0] },
        },
        totalRejected: {
          $sum: { $cond: [{ $eq: ["$status", TICKET_STATUS.REJECTED] }, 1, 0] },
        },
        totalPending: {
          $sum: { $cond: [{ $eq: ["$status", TICKET_STATUS.PENDING] }, 1, 0] },
        },
        totalAwaitingFinance: {
          $sum: {
            $cond: [
              { $eq: ["$status", TICKET_STATUS.AWAITING_FINANCE] },
              1,
              0,
            ],
          },
        },
        totalAmountApproved: {
          $sum: {
            $cond: [
              { $eq: ["$status", TICKET_STATUS.APPROVED] },
              { $ifNull: ["$convertedAmount", "$amount"] },
              0,
            ],
          },
        },
      },
    },
  ]);

  // Dept resolution times
  const deptResAgg = await Ticket.aggregate([
    {
      $match: {
        orgId: oid,
        status: TICKET_STATUS.APPROVED,
        "financeApproval.reviewedAt": { $ne: null },
      },
    },
    {
      $group: {
        _id: "$department",
        avgResolutionMs: {
          $avg: { $subtract: ["$financeApproval.reviewedAt", "$createdAt"] },
        },
      },
    },
  ]);

  // Dept top tags
  const deptTagsAgg = await Ticket.aggregate([
    { $match: { orgId: oid } },
    { $unwind: "$tags" },
    {
      $group: {
        _id: { dept: "$department", tag: "$tags" },
        count: { $sum: 1 },
      },
    },
    { $sort: { count: -1 } },
    {
      $group: {
        _id: "$_id.dept",
        tags: { $push: { tag: "$_id.tag", count: "$count" } },
      },
    },
  ]);

  // Build dept analytics array
  const deptStatsMap = new Map(deptStatsAgg.map((d) => [d._id?.toString(), d]));
  const deptResMap = new Map(deptResAgg.map((d) => [d._id?.toString(), d.avgResolutionMs]));
  const deptTagsMap = new Map(
    deptTagsAgg.map((d) => [d._id?.toString(), (d.tags as any[]).slice(0, 10)]),
  );

  const departments = depts.map((dept) => {
    const dId = dept._id.toString();
    const stats = deptStatsMap.get(dId) ?? {};
    const budgetUsagePercent =
      dept.budget > 0
        ? parseFloat(((dept.spent / dept.budget) * 100).toFixed(2))
        : 0;

    return {
      departmentId: dept._id,
      name: dept.name,
      totalTickets: stats.totalTickets ?? 0,
      totalApproved: stats.totalApproved ?? 0,
      totalRejected: stats.totalRejected ?? 0,
      totalPending: stats.totalPending ?? 0,
      totalAwaitingFinance: stats.totalAwaitingFinance ?? 0,
      totalAmountApproved: stats.totalAmountApproved ?? 0,
      budgetUsagePercent,
      topTags: deptTagsMap.get(dId) ?? [],
      avgResolutionTimeMs: deptResMap.get(dId) ?? 0,
    };
  });

  const orgStatData = orgStats[0] ?? {};

  const doc = await OrgAnalytics.findOneAndUpdate(
    { orgId: oid },
    {
      $set: {
        orgId: oid,
        org: {
          totalTickets: orgStatData.totalTickets ?? 0,
          totalApproved: orgStatData.totalApproved ?? 0,
          totalRejected: orgStatData.totalRejected ?? 0,
          totalPending: orgStatData.totalPending ?? 0,
          totalAwaitingFinance: orgStatData.totalAwaitingFinance ?? 0,
          totalAmountApproved: orgStatData.totalAmountApproved ?? 0,
          totalAmountPending: orgStatData.totalAmountPending ?? 0,
          avgResolutionTimeMs: resolutionAgg[0]?.avg ?? 0,
          topTags: topTagsAgg,
          currencyBreakdown: currencyAgg,
        },
        departments,
        generatedAt: new Date(),
      },
    },
    { upsert: true, new: true },
  );

  logInfo(`Analytics refreshed for org ${orgId}`);

  return {
    orgId: oid.toString(),
    org: doc!.org as any,
    departments: doc!.departments.map((d) => ({
      ...d,
      departmentId: d.departmentId.toString(),
    })) as any,
    generatedAt: doc!.generatedAt,
  };
}

// ---------------------------------------------------------------------------
// Get current analytics snapshot (read-only, no refresh)
// ---------------------------------------------------------------------------
export async function getOrgAnalytics(
  orgId: Types.ObjectId | string,
): Promise<IOrgAnalyticsData | null> {
  const doc = await OrgAnalytics.findOne({ orgId });
  if (!doc) return null;

  return {
    orgId: doc.orgId.toString(),
    org: doc.org as any,
    departments: doc.departments.map((d) => ({
      ...d,
      departmentId: d.departmentId.toString(),
    })) as any,
    generatedAt: doc.generatedAt,
  };
}
