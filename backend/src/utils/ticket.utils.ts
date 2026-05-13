import { getReceiptRefsById } from "../services/receipt.service.js";
import { Department } from "../models/Department.model.js";
import { ITicket, ITicketData, IApprovalData } from "../types/ticket.types.js";
import { IOrganization } from "../types/organization.types.js";

/**
 * Build the full ITicketData payload from a ticket document.
 *
 * All display fields (submitter name, department name, merchant name, category name,
 * reviewer names, bundle title) are read from embedded snapshots — no secondary
 * queries for those. Only fetches what genuinely requires fresh resolution:
 *   - Receipts (pre-signed S3 URLs expire)
 *   - Department (full data for the detail view)
 *   - Merchant / Category (full data including logo/icon presigned URLs for detail view)
 *
 * Shared by ticket.controller.ts and the AI queue worker so they resolve the same shape.
 */
export async function buildTicketData(ticket: ITicket, org: IOrganization): Promise<ITicketData> {
  const ratesChangedSinceApproval =
    ticket.exchangeRateSnapshotId != null &&
    org.currentRateSnapshotId != null &&
    ticket.exchangeRateSnapshotId.toString() !== org.currentRateSnapshotId.toString();

  const buildApproval = (approval: ITicket["managerApproval"]): IApprovalData | null => {
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

  const [deptDoc, merchantData, categoryData, receipts] = await Promise.all([
    ticket.department
      ? Department.findById(ticket.department)
      : Promise.resolve(null),
    ticket.merchant
      ? import("../models/Merchant.model.js").then(({ Merchant }) =>
          Merchant.findOne({ _id: ticket.merchant, orgId: ticket.orgId }).then((m) =>
            m ? m.toData() : null,
          ),
        )
      : Promise.resolve(null),
    ticket.category
      ? import("../models/Category.model.js").then(({ Category }) =>
          Category.findOne({ _id: ticket.category, orgId: ticket.orgId }).then((c) =>
            c ? c.toData() : null,
          ),
        )
      : Promise.resolve(null),
    ticket.receiptIds.length > 0
      ? getReceiptRefsById(ticket.receiptIds)
      : Promise.resolve([]),
  ]);

  return {
    _id: ticket._id.toString(),
    title: ticket.title,
    submittedBy: ticket.submitterSnapshot
      ? {
          _id: ticket.submitterSnapshot._id.toString(),
          name: ticket.submitterSnapshot.name,
          email: ticket.submitterSnapshot.email,
          role: "user" as const,
          department: null,
        }
      : { _id: ticket.submittedBy.toString(), name: "[unknown]", email: "", role: "user" as const, department: null },
    submitterManagerId: ticket.submitterManagerId ? ticket.submitterManagerId.toString() : null,
    orgId: ticket.orgId.toString(),
    amount: ticket.amount,
    currency: ticket.currency,
    department: deptDoc ? deptDoc.toData() : null,
    description: ticket.description,
    tags: ticket.tags,
    receipts,
    status: ticket.status,
    flagged: ticket.flagged,
    managerApproval: buildApproval(ticket.managerApproval),
    financeApproval: buildApproval(ticket.financeApproval),
    exchangeRateSnapshotId: ticket.exchangeRateSnapshotId
      ? ticket.exchangeRateSnapshotId.toString()
      : null,
    ratesChangedSinceApproval,
    merchant: merchantData ?? null,
    category: categoryData ?? null,
    bundle: ticket.bundleSnapshot
      ? { _id: ticket.bundleSnapshot._id.toString(), title: ticket.bundleSnapshot.name, description: "" }
      : null,
    expenseType: ticket.expenseType,
    ocrData: ticket.ocrData ?? null,
    aiValidation: ticket.aiValidation ?? null,
    createdAt: ticket.createdAt,
  };
}
