import { Types } from "mongoose";
import { Bundle } from "../models/Bundle.model.js";
import { Ticket } from "../models/Ticket.model.js";
import { Department } from "../models/Department.model.js";
import { Organization } from "../models/Organization.model.js";
import { createError } from "../utils/error.js";
import {
  BUNDLE_STATUS,
  TICKET_STATUS,
  ROLES,
} from "../config/constants.js";
import { IBundleData } from "../types/bundle.types.js";
import { convertAmount, getOrgRates } from "./exchangeRates.service.js";

export interface CreateBundleInput {
  orgId: string;
  name: string;
  ticketIds?: string[];
  description?: string;
  tags?: string[];
  submittedBy: string;
}

export interface UpdateBundleInput {
  name?: string;
  description?: string;
  ticketIds?: string[];
  tags?: string[];
}

export interface ApproveBundleInput {
  step: "manager" | "finance";
  approved: boolean;
  comments?: string;
}

// ---------------------------------------------------------------------------
// Non-approvable ticket statuses
// ---------------------------------------------------------------------------
const ELIGIBLE_TICKET_STATUSES: string[] = [
  TICKET_STATUS.DRAFT,
  TICKET_STATUS.SCANNING,
  TICKET_STATUS.PENDING,
  TICKET_STATUS.AWAITING_FINANCE,
  TICKET_STATUS.REJECTED,
];

// ---------------------------------------------------------------------------
// Create bundle
// ---------------------------------------------------------------------------
export const createBundle = async (input: CreateBundleInput): Promise<IBundleData> => {
  const { orgId, name, ticketIds = [], description = "", tags = [], submittedBy } = input;

  // Validate that ticketIds belong to org and are eligible (not already approved)
  const validatedTicketIds: Types.ObjectId[] = [];
  if (ticketIds.length > 0) {
    const tickets = await Ticket.find({
      _id: { $in: ticketIds.map((id) => new Types.ObjectId(id)) },
      orgId: new Types.ObjectId(orgId),
    }).select("_id status");

    for (const t of tickets) {
      if (!ELIGIBLE_TICKET_STATUSES.includes(t.status)) {
        throw createError(
          `Ticket ${t._id.toString()} has status '${t.status}' and cannot be added to a bundle`,
          400,
          "INVALID_TICKET_STATUS",
        );
      }
      validatedTicketIds.push(t._id);
    }
  }

  const bundle = await Bundle.create({
    orgId: new Types.ObjectId(orgId),
    title: name,
    description,
    submittedBy: new Types.ObjectId(submittedBy),
    status: BUNDLE_STATUS.DRAFT,
    ticketIds: validatedTicketIds,
    tags,
    totalAmountBase: null,
    managerApproval: null,
    financeApproval: null,
  });

  return bundle.toData();
};

// ---------------------------------------------------------------------------
// List bundles (org-scoped; caller filters by role externally if needed)
// ---------------------------------------------------------------------------
export const listBundles = async (
  orgId: string,
  submittedBy?: string,
): Promise<IBundleData[]> => {
  const filter: Record<string, unknown> = { orgId: new Types.ObjectId(orgId) };
  if (submittedBy) filter["submittedBy"] = new Types.ObjectId(submittedBy);

  const bundles = await Bundle.find(filter).sort({ createdAt: -1 });
  return Promise.all(bundles.map((b) => b.toData()));
};

// ---------------------------------------------------------------------------
// Get single bundle
// ---------------------------------------------------------------------------
export const getBundle = async (orgId: string, bundleId: string): Promise<IBundleData> => {
  const bundle = await Bundle.findOne({
    _id: new Types.ObjectId(bundleId),
    orgId: new Types.ObjectId(orgId),
  });
  if (!bundle) throw createError("Bundle not found", 404, "NOT_FOUND");
  return bundle.toData();
};

// ---------------------------------------------------------------------------
// Update bundle (DRAFT only)
// ---------------------------------------------------------------------------
export const updateBundle = async (
  orgId: string,
  bundleId: string,
  submittedBy: string,
  input: UpdateBundleInput,
): Promise<IBundleData> => {
  const bundle = await Bundle.findOne({
    _id: new Types.ObjectId(bundleId),
    orgId: new Types.ObjectId(orgId),
  });
  if (!bundle) throw createError("Bundle not found", 404, "NOT_FOUND");
  if (bundle.status !== BUNDLE_STATUS.DRAFT)
    throw createError("Only DRAFT bundles can be edited", 400, "INVALID_STATE");
  if (bundle.submittedBy.toString() !== submittedBy)
    throw createError("You can only edit your own bundles", 403, "FORBIDDEN");

  if (input.name !== undefined) bundle.title = input.name;
  if (input.description !== undefined) bundle.description = input.description;
  if (input.tags !== undefined) bundle.tags = input.tags;

  if (input.ticketIds !== undefined) {
    const tickets = await Ticket.find({
      _id: { $in: input.ticketIds.map((id) => new Types.ObjectId(id)) },
      orgId: new Types.ObjectId(orgId),
    }).select("_id status");

    for (const t of tickets) {
      if (!ELIGIBLE_TICKET_STATUSES.includes(t.status)) {
        throw createError(
          `Ticket ${t._id.toString()} has status '${t.status}' and cannot be added to a bundle`,
          400,
          "INVALID_TICKET_STATUS",
        );
      }
    }
    bundle.ticketIds = tickets.map((t) => t._id);
  }

  await bundle.save();
  return bundle.toData();
};

// ---------------------------------------------------------------------------
// Submit bundle for approval
// ---------------------------------------------------------------------------
export const submitBundle = async (
  orgId: string,
  bundleId: string,
  submittedBy: string,
): Promise<IBundleData> => {
  const bundle = await Bundle.findOne({
    _id: new Types.ObjectId(bundleId),
    orgId: new Types.ObjectId(orgId),
  });
  if (!bundle) throw createError("Bundle not found", 404, "NOT_FOUND");
  if (bundle.status !== BUNDLE_STATUS.DRAFT)
    throw createError("Only DRAFT bundles can be submitted", 400, "INVALID_STATE");
  if (bundle.submittedBy.toString() !== submittedBy)
    throw createError("You can only submit your own bundles", 403, "FORBIDDEN");
  if (bundle.ticketIds.length === 0)
    throw createError("A bundle must contain at least one ticket before submitting", 400, "EMPTY_BUNDLE");

  // Compute total in org base currency
  const org = await Organization.findById(orgId);
  const rates = org ? await getOrgRates(org) : null;
  const baseCurrency: string = (org?.baseCurrency as string | undefined) ?? "USD";

  const tickets = await Ticket.find({
    _id: { $in: bundle.ticketIds },
    orgId: new Types.ObjectId(orgId),
  }).select("amount currency");

  let total = 0;
  for (const t of tickets) {
    if (t.amount != null && t.currency) {
      total += rates
        ? convertAmount(t.amount, t.currency, baseCurrency, rates.rates)
        : t.currency === baseCurrency
          ? t.amount
          : 0;
    }
  }

  bundle.status = BUNDLE_STATUS.SUBMITTED;
  bundle.totalAmountBase = total;
  bundle.financeApproval = {
    required: true,
    approved: null,
    reviewedBy: null,
    reviewedAt: null,
    comments: null,
  };
  await bundle.save();

  return bundle.toData();
};

// ---------------------------------------------------------------------------
// Approve / reject bundle (manager or finance step)
// ---------------------------------------------------------------------------
export const approveBundleStatus = async (
  orgId: string,
  bundleId: string,
  reviewerId: string,
  reviewerRole: string,
  input: ApproveBundleInput,
): Promise<IBundleData> => {
  const bundle = await Bundle.findOne({
    _id: new Types.ObjectId(bundleId),
    orgId: new Types.ObjectId(orgId),
  });
  if (!bundle) throw createError("Bundle not found", 404, "NOT_FOUND");
  if (bundle.status !== BUNDLE_STATUS.SUBMITTED)
    throw createError("This bundle is not pending approval", 400, "INVALID_STATE");

  const { step, approved, comments } = input;

  if (step === "manager") {
    if (reviewerRole !== ROLES.ADMIN)
      throw createError("Only admins can perform manager-level approval", 403, "FORBIDDEN");
    bundle.managerApproval = {
      required: true,
      approved,
      reviewedBy: new Types.ObjectId(reviewerId),
      reviewedAt: new Date(),
      comments: comments ?? null,
    };
    // Rejection at manager step terminates the bundle
    if (!approved) bundle.status = BUNDLE_STATUS.REJECTED;
  } else {
    // finance step
    if (reviewerRole !== ROLES.ADMIN)
      throw createError("Only admins can perform finance approval", 403, "FORBIDDEN");
    bundle.financeApproval = {
      required: true,
      approved,
      reviewedBy: new Types.ObjectId(reviewerId),
      reviewedAt: new Date(),
      comments: comments ?? null,
    };

    if (!approved) {
      bundle.status = BUNDLE_STATUS.REJECTED;
    } else {
      // Finance approved → cascade to all constituent tickets
      bundle.status = BUNDLE_STATUS.APPROVED;

      const tickets = await Ticket.find({
        _id: { $in: bundle.ticketIds },
        orgId: new Types.ObjectId(orgId),
      }).select("_id status amount currency department");

      // Group tickets by department for spent bookkeeping
      const deptSpent = new Map<string, { currency: string; amount: number }[]>();
      const org = await Organization.findById(orgId);
      const rates = org ? await getOrgRates(org) : null;
      const baseCurrency: string = (org?.baseCurrency as string | undefined) ?? "USD";

      for (const t of tickets) {
        if (t.status === TICKET_STATUS.APPROVED) continue; // already approved
        t.status = TICKET_STATUS.APPROVED;
        await t.save();

        if (t.department && t.amount != null && t.currency) {
          const deptId = t.department.toString();
          if (!deptSpent.has(deptId)) deptSpent.set(deptId, []);
          deptSpent.get(deptId)!.push({ currency: t.currency, amount: t.amount });
        }
      }

      // Increment dept.spent for each department
      for (const [deptId, entries] of deptSpent) {
        const dept = await Department.findOne({
          _id: new Types.ObjectId(deptId),
          orgId: new Types.ObjectId(orgId),
        });
        if (!dept) continue;
        for (const entry of entries) {
          const converted = rates
            ? convertAmount(entry.amount, entry.currency, baseCurrency, rates.rates)
            : entry.currency === baseCurrency
              ? entry.amount
              : 0;
          dept.spent = (dept.spent ?? 0) + converted;
        }
        await dept.save();
      }
    }
  }

  await bundle.save();
  return bundle.toData();
};

// ---------------------------------------------------------------------------
// Delete bundle (DRAFT only, owner only)
// ---------------------------------------------------------------------------
export const deleteBundle = async (
  orgId: string,
  bundleId: string,
  submittedBy: string,
  callerRole: string,
): Promise<void> => {
  const bundle = await Bundle.findOne({
    _id: new Types.ObjectId(bundleId),
    orgId: new Types.ObjectId(orgId),
  });
  if (!bundle) throw createError("Bundle not found", 404, "NOT_FOUND");
  if (bundle.status !== BUNDLE_STATUS.DRAFT && callerRole !== ROLES.ADMIN)
    throw createError("Only DRAFT bundles can be deleted", 400, "INVALID_STATE");
  if (bundle.submittedBy.toString() !== submittedBy && callerRole !== ROLES.ADMIN)
    throw createError("You can only delete your own bundles", 403, "FORBIDDEN");

  await bundle.deleteOne();
};
