import { Ticket } from "../models/Ticket.model.js";
import { ITicketSummaryData } from "../types/ticket.types.js";

/**
 * Fetches a paginated list of tickets matching the provided filter.
 *
 * After denormalization, all display data (submitter name, department name,
 * merchant, category, bundle, reviewer names) is embedded directly in each
 * ticket document — no secondary queries are needed. The function performs
 * exactly one round-trip: a parallel fetch + count.
 */
export async function listTicketsPaginated(
  filter: Record<string, unknown>,
  page: number,
  limit: number,
  _orgId: string,
  orgCurrentRateSnapshotId: string | null,
): Promise<{ data: ITicketSummaryData[]; total: number }> {
  const skip = (page - 1) * limit;

  const [tickets, total] = await Promise.all([
    Ticket.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Ticket.countDocuments(filter),
  ]);

  if (tickets.length === 0) return { data: [], total };

  const buildApproval = (approval: (typeof tickets)[number]["managerApproval"]) => {
    if (!approval) return null;
    return {
      required: approval.required,
      approved: approval.approved,
      reviewedBy: approval.reviewerSnapshot
        ? {
            _id: approval.reviewerSnapshot._id.toString(),
            name: approval.reviewerSnapshot.name,
            email: approval.reviewerSnapshot.email,
            role: "user" as const,
            department: null,
          }
        : null,
      reviewedAt: approval.reviewedAt,
      comments: approval.comments,
    };
  };

  const data: ITicketSummaryData[] = tickets.map((t) => {
    const ratesChangedSinceApproval =
      t.exchangeRateSnapshotId != null &&
      orgCurrentRateSnapshotId != null &&
      t.exchangeRateSnapshotId.toString() !== orgCurrentRateSnapshotId;

    return {
      _id: t._id.toString(),
      title: t.title,
      submittedBy: t.submitterSnapshot
        ? {
            _id: t.submitterSnapshot._id.toString(),
            name: t.submitterSnapshot.name,
            email: t.submitterSnapshot.email,
            role: "user" as const,
            department: null,
          }
        : { _id: t.submittedBy.toString(), name: "[unknown]", email: "", role: "user" as const, department: null },
      submitterManagerId: t.submitterManagerId ? t.submitterManagerId.toString() : null,
      orgId: t.orgId.toString(),
      amount: t.amount,
      currency: t.currency,
      department: t.departmentSnapshot
        ? { _id: t.departmentSnapshot._id.toString(), name: t.departmentSnapshot.name }
        : null,
      description: t.description,
      tags: t.tags,
      receipts: t.receiptIds.map((id) => ({ _id: id.toString() })),
      status: t.status,
      flagged: t.flagged,
      managerApproval: buildApproval(t.managerApproval),
      financeApproval: buildApproval(t.financeApproval),
      exchangeRateSnapshotId: t.exchangeRateSnapshotId
        ? t.exchangeRateSnapshotId.toString()
        : null,
      ratesChangedSinceApproval,
      merchant: t.merchantSnapshot
        ? { _id: t.merchantSnapshot._id.toString(), name: t.merchantSnapshot.name }
        : null,
      category: t.categorySnapshot
        ? { _id: t.categorySnapshot._id.toString(), name: t.categorySnapshot.name }
        : null,
      bundle: t.bundleSnapshot
        ? { _id: t.bundleSnapshot._id.toString(), title: t.bundleSnapshot.name, description: "" }
        : null,
      expenseType: t.expenseType,
      ocrData: t.ocrData ?? null,
      aiValidation: t.aiValidation ?? null,
      createdAt: t.createdAt,
    };
  });

  return { data, total };
}
