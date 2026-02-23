/**
 * Analytics Service
 *
 * Computes and stores pre-computed analytics snapshots at org + dept level.
 * Call refreshOrgAnalytics() after ticket approvals/rejections or from the cron job.
 */
import { Types } from "mongoose";
import { Ticket } from "../models/Ticket.model.js";
import { Department } from "../models/Department.model.js";
import { Organization } from "../models/Organization.model.js";
import { ExchangeRateSnapshot } from "../models/ExchangeRateSnapshot.model.js";
import { OrgAnalytics } from "../models/OrgAnalytics.model.js";
import { TICKET_STATUS } from "../config/constants.js";
import { IOrgAnalyticsData } from "../types/analytics.types.js";
import { logError, logInfo } from "../utils/logger.js";
import { getJSON, setJSON, del } from "./cache.service.js";
import { convertAmount } from "./exchangeRates.service.js";
import { IOrganization } from "../types/organization.types.js";

// Cache keys
const ANALYTICS_CACHE_TTL = 3600; // 1 hour
export const analyticsCacheKey = (orgId: string) => `cache:analytics:${orgId}`;

// ---------------------------------------------------------------------------
// Invalidate cached analytics for an org
// ---------------------------------------------------------------------------
export async function invalidateAnalyticsCache(orgId: Types.ObjectId | string): Promise<void> {
  await del(analyticsCacheKey(orgId.toString()));
}

// ---------------------------------------------------------------------------
// Refresh analytics snapshot for a given org
// ---------------------------------------------------------------------------
export async function refreshOrgAnalytics(
  org: IOrganization,
): Promise<IOrgAnalyticsData> {
  const oid = org._id;

  // 0. Load org base currency (needed for correct conversion)
  const orgBaseCurrency: string = org.baseCurrency || "USD"; // default to USD if not set

  // 1. Aggregate org-level stats (counts + pending amount — no cross-currency conversion needed here)
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

  // 1b. Re-derive totalAmountApproved + dept spent using locked snapshots.
  //     This ensures amounts are always expressed in the *current* org baseCurrency,
  //     even if baseCurrency changed after a ticket was approved.
  const approvedTickets = await Ticket.find(
    { orgId: oid, status: TICKET_STATUS.APPROVED },
    { amount: 1, currency: 1, exchangeRateSnapshotId: 1, department: 1 },
  ).lean();

  // Batch-load all unique locked snapshots
  const uniqueSnapshotIds = [
    ...new Set(
      approvedTickets
        .filter((t) => t.exchangeRateSnapshotId)
        .map((t) => t.exchangeRateSnapshotId!.toString()),
    ),
  ];
  const snapshotDocs = uniqueSnapshotIds.length > 0
    ? await ExchangeRateSnapshot.find(
        { _id: { $in: uniqueSnapshotIds.map((id) => new Types.ObjectId(id)) } },
        { rates: 1, baseCurrency: 1 },
      ).lean()
    : [];
  const snapshotMap = new Map(
    snapshotDocs.map((s) => [
      s._id.toString(),
      {
        rates: s.rates instanceof Map
          ? Object.fromEntries(s.rates as Map<string, number>)
          : (s.rates as unknown as Record<string, number>),
        baseCurrency: s.baseCurrency as string,
      },
    ]),
  );

  // Re-convert each approved ticket → current org baseCurrency using its locked snapshot
  let orgTotalAmountApproved = 0;
  const deptConvertedSpentMap = new Map<string, number>();

  for (const ticket of approvedTickets) {
    let amount: number;
    const snapshotId = ticket.exchangeRateSnapshotId?.toString();
    const snapshot = snapshotId ? snapshotMap.get(snapshotId) : null;

    if (snapshot && (ticket.currency as string) !== orgBaseCurrency) {
      try {
        amount = convertAmount(ticket.amount, ticket.currency as string, orgBaseCurrency, snapshot.rates);
      } catch {
        amount = ticket.amount; // fallback: missing rate in snapshot
      }
    } else {
      amount = ticket.amount; // already in base currency or no snapshot
    }

    orgTotalAmountApproved += amount;
    if (ticket.department) {
      const dId = ticket.department.toString();
      deptConvertedSpentMap.set(dId, (deptConvertedSpentMap.get(dId) ?? 0) + amount);
    }
  }

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

  // Persist corrected spent values (re-converted to current org baseCurrency via locked snapshots)
  await Promise.all(
    depts.map((dept) => {
      const correctSpent = deptConvertedSpentMap.get(dept._id.toString()) ?? 0;
      return Department.findByIdAndUpdate(dept._id, { $set: { spent: correctSpent } });
    }),
  );

  const departments = depts.map((dept) => {
    const dId = dept._id.toString();
    const stats = deptStatsMap.get(dId) ?? {};
    const correctSpent = deptConvertedSpentMap.get(dId) ?? 0;
    const budgetUsagePercent =
      dept.budget > 0
        ? parseFloat(((correctSpent / dept.budget) * 100).toFixed(2))
        : 0;

    return {
      departmentId: dept._id,
      name: dept.name,
      totalTickets: stats.totalTickets ?? 0,
      totalApproved: stats.totalApproved ?? 0,
      totalRejected: stats.totalRejected ?? 0,
      totalPending: stats.totalPending ?? 0,
      totalAwaitingFinance: stats.totalAwaitingFinance ?? 0,
      totalAmountApproved: correctSpent,
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
          totalAmountApproved: orgTotalAmountApproved,
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

  logInfo(`Analytics refreshed for org ${oid.toString()}`);

  const result: IOrgAnalyticsData = {
    orgId: oid.toString(),
    org: doc!.org as any,
    departments: doc!.departments.map((d) => ({
      ...(d as any).toObject(),
      departmentId: d.departmentId.toString(),
    })) as any,
    generatedAt: doc!.generatedAt,
  };

  // Write-through cache
  await setJSON(analyticsCacheKey(oid.toString()), result, ANALYTICS_CACHE_TTL);

  return result;
}

// ---------------------------------------------------------------------------
// Get current analytics snapshot (read-only, no refresh)
// ---------------------------------------------------------------------------
export async function getOrgAnalytics(
  orgId: Types.ObjectId | string,
): Promise<IOrgAnalyticsData | null> {
  const cacheKey = analyticsCacheKey(orgId.toString());

  // Try cache first
  const cached = await getJSON<IOrgAnalyticsData>(cacheKey);
  if (cached) return cached;

  const doc = await OrgAnalytics.findOne({ orgId });
  if (!doc) return null;

  const result: IOrgAnalyticsData = {
    orgId: doc.orgId.toString(),
    org: doc.org as any,
    departments: doc.departments.map((d) => ({
      ...(d as any).toObject(),
      departmentId: d.departmentId.toString(),
    })) as any,
    generatedAt: doc.generatedAt,
  };

  // Populate cache
  await setJSON(cacheKey, result, ANALYTICS_CACHE_TTL);

  return result;
}
