import { Types } from "mongoose";
import { Ticket } from "../models/Ticket.model.js";
import { User } from "../models/User.model.js";
import { Department } from "../models/Department.model.js";
import { Merchant } from "../models/Merchant.model.js";
import { Category } from "../models/Category.model.js";
import { Bundle } from "../models/Bundle.model.js";
import { ITicketSummaryData } from "../types/ticket.types.js";

/**
 * Fetches a paginated list of tickets matching the provided filter, along with their related user and department data. The function performs efficient batch queries to avoid N+1 issues when resolving references.
 * @param filter - A MongoDB filter object to select tickets.
 * @param page - The page number for pagination (1-based).
 * @param limit - The number of tickets to return per page.
 * @param orgCurrentRateSnapshotId - The current exchange rate snapshot ID for the organization, used to determine if rates have changed since ticket approval.
 * @returns An object containing the array of ticket data and the total count of matching tickets.
 * @throws Will throw an error if any of the database operations fail.
 *
 * @remarks
 * The function executes in three rounds of database queries:
 * 1. It first retrieves the requested page of tickets and the total count of matching tickets in parallel.
 * 2. It then collects all unique department and user IDs from the retrieved tickets and fetches the corresponding department and user documents in parallel.
 * 3. Finally, it identifies any additional department IDs referenced by the reviewer users that were not already fetched in round 2 and retrieves those departments if necessary.
 *
 * The returned ticket data includes resolved references to the submitting user, manager reviewer, finance reviewer, and their respective departments, as well as a flag indicating if exchange rates have changed since approval based on the provided snapshot ID.
 *
 * Example usage:
 * ```typescript
 * const { data: tickets, total } = await listTicketsPaginated(
 *  { orgId: someOrgId },
 *   1, // page
 *  10, // limit
 *  currentSnapshotId // orgCurrentRateSnapshotId
 * );
 * console.log(tickets, total);
 * ```
 */
export async function listTicketsPaginated(
  filter: Record<string, unknown>,
  page: number,
  limit: number,
  orgCurrentRateSnapshotId: string | null,
): Promise<{ data: ITicketSummaryData[]; total: number }> {
  // !listTicketsPaginated
  // Fetches one page of tickets matching `filter` and resolves all referenced
  // departments and users via two parallel batch queries (no N+1 per ticket).
  //
  // Round 1 (parallel):
  //   • Ticket.find — the page of ticket documents
  //   • Ticket.countDocuments — total for pagination metadata
  //
  // Round 2 (parallel, after inspecting the page):
  //   • Department.find — all dept IDs referenced directly by the tickets
  //   • User.find — all user IDs referenced (submitter, reviewers)
  //
  // Round 3 (conditional, sequential — only when reviewer dept IDs are not
  // already covered by Round 2):
  //   • Department.find — remaining dept IDs from reviewer user records
  //
  // orgCurrentRateSnapshotId: the org's active snapshot at request time, used to
  //   populate the `ratesChangedSinceApproval` flag per ticket. Pass null when
  //   the org has no snapshot yet.

  const skip = (page - 1) * limit;

  //! Round 1: page + count in parallel
  const [tickets, total] = await Promise.all([
    Ticket.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Ticket.countDocuments(filter),
  ]);

  if (tickets.length === 0) return { data: [], total };

  // Collect unique dept and user IDs referenced on this page
  const ticketDeptIds = [
    ...new Set(
      tickets.filter((t) => t.department).map((t) => t.department!.toString()),
    ),
  ];
  const involvedUserIds = [
    ...new Set(
      tickets.flatMap((t) => {
        const ids = [t.submittedBy.toString()];
        if (t.managerApproval?.reviewedBy)
          ids.push(t.managerApproval.reviewedBy.toString());
        if (t.financeApproval?.reviewedBy)
          ids.push(t.financeApproval.reviewedBy.toString());
        return ids;
      }),
    ),
  ];

  //! Round 2: ticket depts + all involved users in parallel
  const [ticketDepts, involvedUsers] = await Promise.all([
    ticketDeptIds.length > 0
      ? Department.find({ _id: { $in: ticketDeptIds } })
      : Promise.resolve([]),
    involvedUserIds.length > 0
      ? User.find({ _id: { $in: involvedUserIds } }).select(
          "_id name email role department",
        )
      : Promise.resolve([]),
  ]);

  // Round 3: reviewer depts not already fetched in Round 2
  const reviewerDeptIds = [
    ...new Set(
      involvedUsers
        .filter(
          (u) =>
            u.department && !ticketDeptIds.includes(u.department.toString()),
        )
        .map((u) => u.department!.toString()),
    ),
  ];
  const reviewerDepts =
    reviewerDeptIds.length > 0
      ? await Department.find({ _id: { $in: reviewerDeptIds } })
      : [];

  // Build lookup maps
  const deptMap = new Map(
    [...ticketDepts, ...reviewerDepts].map((d) => [d._id.toString(), d]),
  );
  const userMap = new Map(involvedUsers.map((u) => [u._id.toString(), u]));

  //! Round 4: batch-fetch merchant, category, and bundle summaries for this page
  const merchantIds = [
    ...new Set(tickets.filter((t) => t.merchant).map((t) => t.merchant!.toString())),
  ];
  const categoryIds = [
    ...new Set(tickets.filter((t) => t.category).map((t) => t.category!.toString())),
  ];
  const bundleIds = [
    ...new Set(tickets.filter((t) => t.bundleId).map((t) => t.bundleId!.toString())),
  ];
  const [merchantDocs, categoryDocs, bundleDocs] = await Promise.all([
    merchantIds.length > 0
      ? Merchant.find({ _id: { $in: merchantIds } }).select("_id name")
      : Promise.resolve([]),
    categoryIds.length > 0
      ? Category.find({ _id: { $in: categoryIds } }).select("_id name")
      : Promise.resolve([]),
    bundleIds.length > 0
      ? Bundle.find({ _id: { $in: bundleIds } }).select("_id title description")
      : Promise.resolve([]),
  ]);
  const merchantMap = new Map(merchantDocs.map((m) => [m._id.toString(), m.name]));
  const categoryMap = new Map(categoryDocs.map((c) => [c._id.toString(), c.name]));
  const bundleMap = new Map(
    bundleDocs.map((b) => [b._id.toString(), { _id: b._id.toString(), title: b.title, description: b.description }]),
  );

  // Resolve a user reference to its minimal shape (with dept)
  const toUserMinimal = (userId: Types.ObjectId | null | undefined) => {
    if (!userId) return null;
    const u = userMap.get(userId.toString());
    if (!u) return null;
    const dept = u.department
      ? (deptMap.get(u.department.toString()) ?? null)
      : null;
    return {
      _id: u._id.toString(),
      name: u.name,
      email: u.email,
      role: u.role,
      department: dept ? dept.toData() : null,
    };
  };

  const data: ITicketSummaryData[] = tickets.map((t) => {
    const ticketDept = t.department
      ? (deptMap.get(t.department.toString()) ?? null)
      : null;
    const ratesChangedSinceApproval =
      t.exchangeRateSnapshotId != null &&
      orgCurrentRateSnapshotId != null &&
      t.exchangeRateSnapshotId.toString() !== orgCurrentRateSnapshotId;
    const merchantId = t.merchant?.toString();
    const categoryId = t.category?.toString();
    const bundleId = t.bundleId?.toString();
    return {
      _id: t._id.toString(),
      title: t.title,
      submittedBy: toUserMinimal(t.submittedBy)!,
      submitterManagerId: t.submitterManagerId
        ? t.submitterManagerId.toString()
        : null,
      orgId: t.orgId.toString(),
      amount: t.amount,
      currency: t.currency,
      department: ticketDept ? ticketDept.toData() : null,
      description: t.description,
      tags: t.tags,
      receipts: t.receiptIds.map((id) => ({ _id: id.toString() })),
      status: t.status,
      flagged: t.flagged,
      managerApproval: t.managerApproval
        ? {
            required: t.managerApproval.required,
            approved: t.managerApproval.approved,
            reviewedBy: toUserMinimal(t.managerApproval.reviewedBy),
            reviewedAt: t.managerApproval.reviewedAt,
            comments: t.managerApproval.comments,
          }
        : null,
      financeApproval: t.financeApproval
        ? {
            required: t.financeApproval.required,
            approved: t.financeApproval.approved,
            reviewedBy: toUserMinimal(t.financeApproval.reviewedBy),
            reviewedAt: t.financeApproval.reviewedAt,
            comments: t.financeApproval.comments,
          }
        : null,
      exchangeRateSnapshotId: t.exchangeRateSnapshotId
        ? t.exchangeRateSnapshotId.toString()
        : null,
      ratesChangedSinceApproval,
      merchant: merchantId && merchantMap.has(merchantId)
        ? { _id: merchantId, name: merchantMap.get(merchantId)! }
        : null,
      category: categoryId && categoryMap.has(categoryId)
        ? { _id: categoryId, name: categoryMap.get(categoryId)! }
        : null,
      bundle: bundleId ? (bundleMap.get(bundleId) ?? null) : null,
      expenseType: t.expenseType,
      ocrData: t.ocrData ?? null,
      aiValidation: t.aiValidation ?? null,
      createdAt: t.createdAt,
    };
  });

  return { data, total };
}
