/**
 * Analytics Service
 *
 * Computes and stores pre-computed analytics snapshots at org + dept level.
 * Call refreshOrgAnalytics() after ticket approvals/rejections or from the cron job.
 *
 * Implementation note:
 * All computation is done inside MongoDB using aggregation pipelines ($facet,
 * $lookup, $getField) - no approved tickets are loaded into Node.js memory.
 *
 * Pipelines used:
 *
 * 1. Overview pipeline
 * $facet over ALL tickets: counts (incl. flagged), resolution times, tags, expense type counts
 *
 * 2. Amounts pipeline
 * approved tickets only → $lookup exchange snapshot → $addFields convertedAmount → $facet for org total, currency breakdown, dept amounts, expense type amounts
 *
 * 3. Monthly trend pipelines (last 12 months)
 * 3a: submission counts grouped by year/month
 * 3b: approved amounts grouped by financeApproval.reviewedAt year/month
 *
 * 4. Category breakdown — approved only, $lookup categories, group by category, top 10
 *
 * 5. Merchant breakdown — approved only, $lookup merchants, group by merchant, top 10
 */
import { Types } from "mongoose";
import { Ticket } from "../models/Ticket.model.js";
import { Department } from "../models/Department.model.js";
import { OrgAnalytics } from "../models/OrgAnalytics.model.js";
import { CURRENCIES, TICKET_STATUS } from "../config/constants.js";
import {
  IExpenseTypeBreakdownItem,
  IMonthlyTrendPoint,
  IOrgAnalyticsData,
} from "../types/analytics.types.js";
import { logInfo } from "../utils/logger.js";
import { getJSON, setJSON, del } from "./cache.service.js";
import { IOrganization } from "../types/organization.types.js";

// Cache keys
const ANALYTICS_CACHE_TTL = 3600; // 1 hour
export const analyticsCacheKey = (orgId: string) => `cache:analytics:${orgId}`;

// ---------------------------------------------------------------------------
// Invalidate cached analytics for an org
// ---------------------------------------------------------------------------
export async function invalidateAnalyticsCache(
  orgId: Types.ObjectId | string,
): Promise<void> {
  await del(analyticsCacheKey(orgId.toString()));
}

// ---------------------------------------------------------------------------
// Refresh analytics snapshot for a given org
// ---------------------------------------------------------------------------
export async function refreshOrgAnalytics(
  org: IOrganization,
): Promise<IOrgAnalyticsData> {
  const oid = org._id;
  const orgBaseCurrency: string = org.baseCurrency || CURRENCIES[0];

  //! Pipeline 1: Overview (counts, resolution times, tags)
  // Runs a single $facet over ALL tickets (no currency conversion needed here)
  const [overview] = await Ticket.aggregate([
    { $match: { orgId: oid } },
    {
      $facet: {
        // Org-level ticket counts + pending amount
        orgStats: [
          {
            $group: {
              _id: null,
              totalTickets: { $sum: 1 },
              totalApproved: {
                $sum: {
                  $cond: [{ $eq: ["$status", TICKET_STATUS.APPROVED] }, 1, 0],
                },
              },
              totalRejected: {
                $sum: {
                  $cond: [{ $eq: ["$status", TICKET_STATUS.REJECTED] }, 1, 0],
                },
              },
              totalPending: {
                $sum: {
                  $cond: [{ $eq: ["$status", TICKET_STATUS.PENDING] }, 1, 0],
                },
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
              totalAmountPending: {
                $sum: {
                  $cond: [
                    {
                      $in: [
                        "$status",
                        [TICKET_STATUS.PENDING, TICKET_STATUS.AWAITING_FINANCE],
                      ],
                    },
                    "$amount",
                    0,
                  ],
                },
              },
              totalFlagged: {
                $sum: { $cond: [{ $eq: ["$flagged", true] }, 1, 0] },
              },
            },
          },
        ],

        // Org-level avg resolution time
        orgResolutionTime: [
          {
            $match: {
              status: TICKET_STATUS.APPROVED,
              "financeApproval.reviewedAt": { $ne: null },
            },
          },
          {
            $group: {
              _id: null,
              avg: {
                $avg: {
                  $subtract: ["$financeApproval.reviewedAt", "$createdAt"],
                },
              },
            },
          },
        ],

        // Org-level top tags
        topTags: [
          { $unwind: "$tags" },
          { $group: { _id: "$tags", count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 10 },
          { $project: { _id: 0, tag: "$_id", count: 1 } },
        ],

        // Dept-level ticket counts (no amounts - those come from pipeline 2)
        deptCounts: [
          {
            $group: {
              _id: "$department",
              totalTickets: { $sum: 1 },
              totalApproved: {
                $sum: {
                  $cond: [{ $eq: ["$status", TICKET_STATUS.APPROVED] }, 1, 0],
                },
              },
              totalRejected: {
                $sum: {
                  $cond: [{ $eq: ["$status", TICKET_STATUS.REJECTED] }, 1, 0],
                },
              },
              totalPending: {
                $sum: {
                  $cond: [{ $eq: ["$status", TICKET_STATUS.PENDING] }, 1, 0],
                },
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
            },
          },
        ],

        // Dept-level avg resolution time
        deptResolutionTimes: [
          {
            $match: {
              status: TICKET_STATUS.APPROVED,
              "financeApproval.reviewedAt": { $ne: null },
            },
          },
          {
            $group: {
              _id: "$department",
              avgResolutionMs: {
                $avg: {
                  $subtract: ["$financeApproval.reviewedAt", "$createdAt"],
                },
              },
            },
          },
        ],

        // Dept-level top tags
        deptTopTags: [
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
        ],

        // Org-level expense type counts
        expenseTypeCounts: [
          {
            $group: {
              _id: { $ifNull: ["$expenseType", "regular"] },
              count: { $sum: 1 },
            },
          },
        ],
      },
    },
  ]);

  //! Pipeline 2: Approved amounts with inline currency conversion
  // Scope to approved tickets only, then $lookup the locked exchange rate
  // snapshot and compute convertedAmount inside MongoDB using $getField on
  // the rates Map no documents leave the database for amount calculation.
  const [amounts] = await Ticket.aggregate([
    { $match: { orgId: oid, status: TICKET_STATUS.APPROVED } },

    // Join with the locked snapshot for each ticket
    {
      $lookup: {
        from: "exchangeratesnapshots",
        let: { snapId: "$exchangeRateSnapshotId" },
        pipeline: [
          { $match: { $expr: { $eq: ["$_id", "$$snapId"] } } },
          { $project: { _id: 0, rates: 1 } },
        ],
        as: "snapshot",
      },
    },

    // Compute convertedAmount in org baseCurrency using the locked snapshot rates.
    // Formula: amount * (rates[orgBaseCurrency] / rates[ticket.currency])
    // Falls back to raw amount when currencies match or snapshot is unavailable.
    {
      $addFields: {
        convertedAmount: {
          $cond: {
            if: { $eq: ["$currency", orgBaseCurrency] },
            then: "$amount",
            else: {
              $cond: {
                if: { $gt: [{ $size: "$snapshot" }, 0] },
                then: {
                  $let: {
                    vars: { rates: { $arrayElemAt: ["$snapshot.rates", 0] } },
                    in: {
                      $divide: [
                        {
                          $multiply: [
                            "$amount",
                            {
                              $ifNull: [
                                // orgBaseCurrency is a JS string resolved at query-build time
                                {
                                  $getField: {
                                    field: orgBaseCurrency,
                                    input: "$$rates",
                                  },
                                },
                                1,
                              ],
                            },
                          ],
                        },
                        {
                          $ifNull: [
                            // ticket.currency is a document field - prefix with $
                            {
                              $getField: {
                                field: "$currency",
                                input: "$$rates",
                              },
                            },
                            1,
                          ],
                        },
                      ],
                    },
                  },
                },
                else: "$amount",
              },
            },
          },
        },
      },
    },

    // Compute org total, per-currency breakdown, and per-dept totals in one shot
    {
      $facet: {
        orgAmounts: [
          {
            $group: {
              _id: null,
              totalAmountApproved: { $sum: "$convertedAmount" },
            },
          },
        ],

        currencyBreakdown: [
          {
            $group: {
              _id: "$currency",
              convertedTotal: { $sum: "$convertedAmount" },
              originalTotal: { $sum: "$amount" },
            },
          },
          {
            $project: {
              _id: 0,
              currency: "$_id",
              total: { $round: ["$convertedTotal", 2] },
              originalTotal: { $round: ["$originalTotal", 2] },
            },
          },
        ],

        deptAmounts: [
          {
            $group: {
              _id: "$department",
              totalAmountApproved: { $sum: "$convertedAmount" },
            },
          },
        ],

        expenseTypeAmounts: [
          {
            $group: {
              _id: { $ifNull: ["$expenseType", "regular"] },
              totalAmount: { $sum: "$convertedAmount" },
            },
          },
        ],
      },
    },
  ]);

  //! Pipelines 3-5: Monthly trend, category breakdown, merchant breakdown
  // Run all three in parallel — all are independent of Pipeline 1 & 2 results.

  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
  twelveMonthsAgo.setDate(1);
  twelveMonthsAgo.setHours(0, 0, 0, 0);

  // Reusable currency conversion expression (same logic as Pipeline 2)
  const conversionExpr: Record<string, any> = {
    $cond: {
      if: { $eq: ["$currency", orgBaseCurrency] },
      then: "$amount",
      else: {
        $cond: {
          if: { $gt: [{ $size: "$snapshot" }, 0] },
          then: {
            $let: {
              vars: { rates: { $arrayElemAt: ["$snapshot.rates", 0] } },
              in: {
                $divide: [
                  {
                    $multiply: [
                      "$amount",
                      { $ifNull: [{ $getField: { field: orgBaseCurrency, input: "$$rates" } }, 1] },
                    ],
                  },
                  { $ifNull: [{ $getField: { field: "$currency", input: "$$rates" } }, 1] },
                ],
              },
            },
          },
          else: "$amount",
        },
      },
    },
  };

  // Reusable exchange rate lookup stage
  const exchangeLookupStage = {
    $lookup: {
      from: "exchangeratesnapshots",
      let: { snapId: "$exchangeRateSnapshotId" },
      pipeline: [
        { $match: { $expr: { $eq: ["$_id", "$$snapId"] } } },
        { $project: { _id: 0, rates: 1 } },
      ],
      as: "snapshot",
    },
  };

  const [trendSubmitted, trendApproved, categoryData, merchantData] = await Promise.all([
    // 3a: Submission counts per month (last 12 months)
    Ticket.aggregate([
      { $match: { orgId: oid, createdAt: { $gte: twelveMonthsAgo } } },
      {
        $group: {
          _id: { year: { $year: "$createdAt" }, month: { $month: "$createdAt" } },
          submittedCount: { $sum: 1 },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } },
    ]),

    // 3b: Approved amounts per month (by financeApproval.reviewedAt, last 12 months)
    Ticket.aggregate([
      {
        $match: {
          orgId: oid,
          status: TICKET_STATUS.APPROVED,
          "financeApproval.reviewedAt": { $gte: twelveMonthsAgo, $ne: null },
        },
      },
      exchangeLookupStage,
      { $addFields: { convertedAmount: conversionExpr } },
      {
        $group: {
          _id: {
            year: { $year: "$financeApproval.reviewedAt" },
            month: { $month: "$financeApproval.reviewedAt" },
          },
          approvedAmount: { $sum: "$convertedAmount" },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } },
    ]),

    // Pipeline 4: Category breakdown (approved, top 10 by converted amount)
    // Uses embedded categorySnapshot — no $lookup needed.
    Ticket.aggregate([
      { $match: { orgId: oid, status: TICKET_STATUS.APPROVED } },
      exchangeLookupStage,
      { $addFields: { convertedAmount: conversionExpr } },
      {
        $group: {
          _id: "$categorySnapshot._id",
          name: { $first: { $ifNull: ["$categorySnapshot.name", "Uncategorized"] } },
          count: { $sum: 1 },
          totalAmount: { $sum: "$convertedAmount" },
        },
      },
      { $sort: { totalAmount: -1 } },
      { $limit: 10 },
      {
        $project: {
          _id: 0,
          categoryId: { $cond: [{ $eq: ["$_id", null] }, null, { $toString: "$_id" }] },
          name: 1,
          count: 1,
          totalAmount: { $round: ["$totalAmount", 2] },
        },
      },
    ]),

    // Pipeline 5: Merchant breakdown (approved, top 10 by converted amount)
    // Uses embedded merchantSnapshot — no $lookup needed.
    Ticket.aggregate([
      { $match: { orgId: oid, status: TICKET_STATUS.APPROVED } },
      exchangeLookupStage,
      { $addFields: { convertedAmount: conversionExpr } },
      {
        $group: {
          _id: "$merchantSnapshot._id",
          name: { $first: { $ifNull: ["$merchantSnapshot.name", "Unknown Merchant"] } },
          count: { $sum: 1 },
          totalAmount: { $sum: "$convertedAmount" },
        },
      },
      { $sort: { totalAmount: -1 } },
      { $limit: 10 },
      {
        $project: {
          _id: 0,
          merchantId: { $cond: [{ $eq: ["$_id", null] }, null, { $toString: "$_id" }] },
          name: 1,
          count: 1,
          totalAmount: { $round: ["$totalAmount", 2] },
        },
      },
    ]),
  ]);

  //! Assemble results
  const orgStat = overview?.orgStats?.[0] ?? {};
  const orgAmountStat = amounts?.orgAmounts?.[0] ?? {};

  // Flagged metrics
  const totalFlagged: number = orgStat.totalFlagged ?? 0;
  const totalTicketsCount: number = orgStat.totalTickets ?? 0;
  const flaggedRate = totalTicketsCount > 0
    ? parseFloat(((totalFlagged / totalTicketsCount) * 100).toFixed(2))
    : 0;

  // Monthly trend — zero-fill all 12 months (oldest → newest)
  const submittedMap = new Map<string, number>(
    trendSubmitted.map((p: any) => [`${p._id.year}-${p._id.month}`, p.submittedCount as number]),
  );
  const approvedAmountMap = new Map<string, number>(
    trendApproved.map((p: any) => [`${p._id.year}-${p._id.month}`, p.approvedAmount as number]),
  );
  const now = new Date();
  const monthlyTrend: IMonthlyTrendPoint[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const year = d.getFullYear();
    const month = d.getMonth() + 1;
    const key = `${year}-${month}`;
    monthlyTrend.push({
      year,
      month,
      submittedCount: submittedMap.get(key) ?? 0,
      approvedAmount: parseFloat(((approvedAmountMap.get(key) ?? 0)).toFixed(2)),
    });
  }

  // Expense type breakdown — merge counts (Pipeline 1) with amounts (Pipeline 2)
  const expenseTypeCountMap = new Map<string, number>(
    (overview?.expenseTypeCounts ?? []).map((e: any) => [e._id as string, e.count as number]),
  );
  const expenseTypeAmountMap = new Map<string, number>(
    (amounts?.expenseTypeAmounts ?? []).map((e: any) => [e._id as string, e.totalAmount as number]),
  );
  const allExpenseTypes = new Set([...expenseTypeCountMap.keys(), ...expenseTypeAmountMap.keys()]);
  const expenseTypeBreakdown: IExpenseTypeBreakdownItem[] = Array.from(allExpenseTypes).map((type) => ({
    type,
    count: expenseTypeCountMap.get(type) ?? 0,
    totalAmount: parseFloat((expenseTypeAmountMap.get(type) ?? 0).toFixed(2)),
  }));

  const deptCountMap = new Map<string, any>(
    (overview?.deptCounts ?? []).map((d: any) => [d._id?.toString(), d]),
  );
  const deptResMap = new Map<string, number>(
    (overview?.deptResolutionTimes ?? []).map((d: any) => [
      d._id?.toString(),
      d.avgResolutionMs,
    ]),
  );
  const deptTagsMap = new Map<string, any[]>(
    (overview?.deptTopTags ?? []).map((d: any) => [
      d._id?.toString(),
      (d.tags as any[]).slice(0, 10),
    ]),
  );
  const deptAmountsMap = new Map<string, number>(
    (amounts?.deptAmounts ?? []).map((d: any) => [
      d._id?.toString(),
      d.totalAmountApproved,
    ]),
  );

  // Load active depts to cross-reference budget and persist corrected spent values
  const depts = await Department.find({ orgId: oid, isActive: true }).lean();

  // Update each dept's spent field in a single bulkWrite...
  if (depts.length > 0) {
    await Department.bulkWrite(
      depts.map((dept) => ({
        updateOne: {
          filter: { _id: dept._id },
          update: { $set: { spent: deptAmountsMap.get(dept._id.toString()) ?? 0 } },
        },
      })),
    );
  }

  const departments = depts.map((dept) => {
    const dId = dept._id.toString();
    const counts = deptCountMap.get(dId) ?? {};
    const correctSpent = deptAmountsMap.get(dId) ?? 0;
    const budgetUsagePercent =
      dept.budget > 0
        ? parseFloat(((correctSpent / dept.budget) * 100).toFixed(2))
        : 0;

    return {
      departmentId: dept._id,
      name: dept.name,
      totalTickets: counts.totalTickets ?? 0,
      totalApproved: counts.totalApproved ?? 0,
      totalRejected: counts.totalRejected ?? 0,
      totalPending: counts.totalPending ?? 0,
      totalAwaitingFinance: counts.totalAwaitingFinance ?? 0,
      totalAmountApproved: correctSpent,
      budgetUsagePercent,
      topTags: deptTagsMap.get(dId) ?? [],
      avgResolutionTimeMs: deptResMap.get(dId) ?? 0,
    };
  });

  // Persist snapshot
  const doc = await OrgAnalytics.findOneAndUpdate(
    { orgId: oid },
    {
      $set: {
        orgId: oid,
        org: {
          totalTickets: orgStat.totalTickets ?? 0,
          totalApproved: orgStat.totalApproved ?? 0,
          totalRejected: orgStat.totalRejected ?? 0,
          totalPending: orgStat.totalPending ?? 0,
          totalAwaitingFinance: orgStat.totalAwaitingFinance ?? 0,
          totalAmountApproved: parseFloat(
            (orgAmountStat.totalAmountApproved ?? 0).toFixed(2),
          ),
          totalAmountPending: orgStat.totalAmountPending ?? 0,
          avgResolutionTimeMs: overview?.orgResolutionTime?.[0]?.avg ?? 0,
          topTags: overview?.topTags ?? [],
          currencyBreakdown: amounts?.currencyBreakdown ?? [],
          totalFlagged,
          flaggedRate,
          monthlyTrend,
          categoryBreakdown: categoryData,
          merchantBreakdown: merchantData,
          expenseTypeBreakdown,
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
