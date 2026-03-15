import { Types } from "mongoose";
import { Bundle } from "../models/Bundle.model.js";
import { Ticket } from "../models/Ticket.model.js";
import { Department } from "../models/Department.model.js";
import { Organization } from "../models/Organization.model.js";
import { ExchangeRateSnapshot } from "../models/ExchangeRateSnapshot.model.js";
import { createError } from "../utils/error.js";
import {
  BUNDLE_STATUS,
  TICKET_STATUS,
  ROLES,
  CURRENCIES,
  Currency,
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
  tags?: string[];
}

export interface ApproveBundleInput {
  step?: "manager" | "finance";
  approved: boolean;
  comments?: string;
}

export interface ApproveBundleResult {
  bundle: IBundleData;
  approvedTicketCount: number;
  skippedTicketCount: number;
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

const APPROVABLE_BUNDLE_TICKET_STATUSES: string[] = [
  TICKET_STATUS.PENDING,
  TICKET_STATUS.AWAITING_FINANCE,
];

// ---------------------------------------------------------------------------
// Recalculate bundle total in org base currency.
// Uses per-ticket exchange rate snapshot (locked rates) when available,
// falls back to current org rates for unprocessed tickets.
// ---------------------------------------------------------------------------
const recalcBundleTotal = async (
  orgId: string,
  bundleId: Types.ObjectId,
): Promise<{ total: number; baseCurrency: Currency }> => {
  const org = await Organization.findById(orgId).select("baseCurrency currentRateSnapshotId");
  const baseCurrency = org?.baseCurrency ?? CURRENCIES[0];

  const tickets = await Ticket.find({
    bundleId,
    orgId: new Types.ObjectId(orgId),
  }).select("amount currency exchangeRateSnapshotId");

  if (tickets.length === 0) return { total: 0, baseCurrency };

  const snapshotIds = [
    ...new Set(
      tickets
        .map((t) => t.exchangeRateSnapshotId?.toString())
        .filter((id): id is string => !!id),
    ),
  ];

  const snapshots =
    snapshotIds.length > 0
      ? await ExchangeRateSnapshot.find({ _id: { $in: snapshotIds.map((id) => new Types.ObjectId(id)) } })
      : [];
  const snapshotMap = new Map(snapshots.map((s) => [s._id.toString(), s]));

  const currentRates = org ? await getOrgRates(org) : null;

  let total = 0;
  for (const t of tickets) {
    if (t.amount == null || !t.currency) continue;
    if (t.currency === baseCurrency) {
      total += t.amount;
      continue;
    }
    try {
      const snap = t.exchangeRateSnapshotId
        ? snapshotMap.get(t.exchangeRateSnapshotId.toString())
        : null;
      const rates: Record<string, number> | null = snap
        ? Object.fromEntries(snap.rates)
        : (currentRates?.rates ?? null);
      if (rates) {
        total += convertAmount(t.amount, t.currency, baseCurrency, rates);
      }
    } catch {
      // Skip tickets with missing rate
    }
  }

  return { total: parseFloat(total.toFixed(4)), baseCurrency };
};

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
    }).select("_id status bundleId");

    for (const t of tickets) {
      if (!ELIGIBLE_TICKET_STATUSES.includes(t.status)) {
        throw createError(
          `Ticket ${t._id.toString()} has status '${t.status}' and cannot be added to a bundle`,
          400,
          "INVALID_TICKET_STATUS",
        );
      }
      if (t.bundleId) {
        throw createError(
          `Ticket ${t._id.toString()} is already in another bundle`,
          400,
          "TICKET_IN_BUNDLE",
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
    ticketCount: 0,
    tags,
    totalAmountBase: null,
    baseCurrency: null,
    managerApproval: null,
    financeApproval: null,
  });

  if (validatedTicketIds.length > 0) {
    await Ticket.updateMany(
      { _id: { $in: validatedTicketIds } },
      { $set: { bundleId: bundle._id } },
    );
    bundle.ticketCount = validatedTicketIds.length;
    const { total, baseCurrency: bc } = await recalcBundleTotal(orgId, bundle._id);
    bundle.totalAmountBase = total;
    bundle.baseCurrency = bc;
    await bundle.save();
  }

  return bundle.toData();
};

// ---------------------------------------------------------------------------
// List bundles (org-scoped; caller filters by role externally if needed)
// ---------------------------------------------------------------------------
export const listBundles = async (
  orgId: string,
  submittedBy?: string,
  page = 1,
  limit = 20,
  status?: string | string[],
): Promise<{ data: IBundleData[]; total: number }> => {
  const filter: Record<string, unknown> = { orgId: new Types.ObjectId(orgId) };
  if (submittedBy) filter["submittedBy"] = new Types.ObjectId(submittedBy);
  if (status) {
    const statuses = Array.isArray(status)
      ? status
      : status.split(",").map((s) => s.trim()).filter(Boolean);
    if (statuses.length === 1) {
      filter["status"] = statuses[0];
    } else if (statuses.length > 1) {
      filter["status"] = { $in: statuses };
    }
  }

  const skip = (page - 1) * limit;
  const [bundles, total] = await Promise.all([
    Bundle.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Bundle.countDocuments(filter),
  ]);
  const data = await Promise.all(bundles.map((b) => b.toData()));
  return { data, total };
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

  await bundle.save();
  return bundle.toData();
};

// ---------------------------------------------------------------------------
// Add tickets to bundle (DRAFT only, atomic per-ticket link)
// ---------------------------------------------------------------------------
export const addTicketsToBundle = async (
  orgId: string,
  bundleId: string,
  submittedBy: string,
  ticketIds: string[],
): Promise<IBundleData> => {
  const bundle = await Bundle.findOne({
    _id: new Types.ObjectId(bundleId),
    orgId: new Types.ObjectId(orgId),
  });
  if (!bundle) throw createError("Bundle not found", 404, "NOT_FOUND");
  if (bundle.status !== BUNDLE_STATUS.DRAFT)
    throw createError("Only DRAFT bundles can be modified", 400, "INVALID_STATE");
  if (bundle.submittedBy.toString() !== submittedBy)
    throw createError("You can only modify your own bundles", 403, "FORBIDDEN");

  const tickets = await Ticket.find({
    _id: { $in: ticketIds.map((id) => new Types.ObjectId(id)) },
    orgId: new Types.ObjectId(orgId),
  }).select("_id status bundleId");

  const toAdd: Types.ObjectId[] = [];
  for (const t of tickets) {
    if (!ELIGIBLE_TICKET_STATUSES.includes(t.status)) {
      throw createError(
        `Ticket ${t._id.toString()} has status '${t.status}' and cannot be added to a bundle`,
        400,
        "INVALID_TICKET_STATUS",
      );
    }
    if (t.bundleId) {
      if (t.bundleId.toString() === bundleId) continue; // already in this bundle
      throw createError(
        `Ticket ${t._id.toString()} is already in another bundle`,
        400,
        "TICKET_IN_BUNDLE",
      );
    }
    toAdd.push(t._id);
  }

  if (toAdd.length > 0) {
    await Ticket.updateMany(
      { _id: { $in: toAdd } },
      { $set: { bundleId: bundle._id } },
    );
    bundle.ticketCount = (bundle.ticketCount ?? 0) + toAdd.length;
    const { total, baseCurrency } = await recalcBundleTotal(orgId, bundle._id);
    bundle.totalAmountBase = total;
    bundle.baseCurrency = baseCurrency;
    await bundle.save();
  }

  return bundle.toData();
};

// ---------------------------------------------------------------------------
// Remove a single ticket from bundle (DRAFT only)
// ---------------------------------------------------------------------------
export const removeTicketFromBundle = async (
  orgId: string,
  bundleId: string,
  submittedBy: string,
  ticketId: string,
): Promise<IBundleData> => {
  const bundle = await Bundle.findOne({
    _id: new Types.ObjectId(bundleId),
    orgId: new Types.ObjectId(orgId),
  });
  if (!bundle) throw createError("Bundle not found", 404, "NOT_FOUND");
  if (bundle.status !== BUNDLE_STATUS.DRAFT)
    throw createError("Only DRAFT bundles can be modified", 400, "INVALID_STATE");
  if (bundle.submittedBy.toString() !== submittedBy)
    throw createError("You can only modify your own bundles", 403, "FORBIDDEN");

  const ticket = await Ticket.findOne({
    _id: new Types.ObjectId(ticketId),
    bundleId: bundle._id,
    orgId: new Types.ObjectId(orgId),
  });
  if (!ticket) throw createError("Ticket not found in this bundle", 404, "NOT_FOUND");

  await Ticket.updateOne({ _id: ticket._id }, { $set: { bundleId: null } });

  const newCount = Math.max(0, (bundle.ticketCount ?? 0) - 1);
  bundle.ticketCount = newCount;
  if (newCount === 0) {
    bundle.totalAmountBase = null;
    bundle.baseCurrency = null;
  } else {
    const { total, baseCurrency } = await recalcBundleTotal(orgId, bundle._id);
    bundle.totalAmountBase = total;
    bundle.baseCurrency = baseCurrency;
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
  if ((bundle.ticketCount ?? 0) === 0)
    throw createError("A bundle must contain at least one ticket before submitting", 400, "EMPTY_BUNDLE");

  const { total, baseCurrency } = await recalcBundleTotal(orgId, bundle._id);
  bundle.status = BUNDLE_STATUS.SUBMITTED;
  bundle.totalAmountBase = total;
  bundle.baseCurrency = baseCurrency;
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
  reviewerHasApproveFinance: boolean,
  input: ApproveBundleInput,
): Promise<ApproveBundleResult> => {
  const canApprove = reviewerRole === ROLES.ADMIN || reviewerHasApproveFinance;

  const bundle = await Bundle.findOne({
    _id: new Types.ObjectId(bundleId),
    orgId: new Types.ObjectId(orgId),
  });
  if (!bundle) throw createError("Bundle not found", 404, "NOT_FOUND");
  if (bundle.status !== BUNDLE_STATUS.SUBMITTED)
    throw createError("This bundle is not pending approval", 400, "INVALID_STATE");

  const { approved, comments } = input;
  const step = input.step ?? "finance";
  let approvedTicketCount = 0;
  let skippedTicketCount = 0;

  if (step === "manager") {
    if (!canApprove)
      throw createError("You do not have permission to perform manager-level approval", 403, "FORBIDDEN");
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
    if (!canApprove)
      throw createError("You do not have permission to perform finance approval", 403, "FORBIDDEN");
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
      // Finance approved → cascade to only eligible constituent tickets
      bundle.status = BUNDLE_STATUS.APPROVED;

      const org = await Organization.findById(orgId);
      const currentSnapshotId = org?.currentRateSnapshotId ?? null;
      const rates = org ? await getOrgRates(org) : null;
      const baseCurrency: string = (org?.baseCurrency as string | undefined) ?? "USD";

      const tickets = await Ticket.find({
        bundleId: new Types.ObjectId(bundleId),
        orgId: new Types.ObjectId(orgId),
      }).select("_id status amount currency department exchangeRateSnapshotId");

      // Group tickets by department for spent bookkeeping
      const deptSpent = new Map<string, { currency: string; amount: number }[]>();

      for (const t of tickets) {
        if (!APPROVABLE_BUNDLE_TICKET_STATUSES.includes(t.status)) {
          skippedTicketCount += 1;
          continue;
        }
        // Lock the exchange rate snapshot at approval time
        if (currentSnapshotId) {
          t.exchangeRateSnapshotId = currentSnapshotId as Types.ObjectId;
        }
        t.status = TICKET_STATUS.APPROVED;
        await t.save();
        approvedTicketCount += 1;

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
  return {
    bundle: await bundle.toData(),
    approvedTicketCount,
    skippedTicketCount,
  };
};

// ---------------------------------------------------------------------------
// Get paginated tickets belonging to a bundle
// ---------------------------------------------------------------------------
export const getBundleTickets = async (
  orgId: string,
  bundleId: string,
  page = 1,
  limit = 20,
): Promise<{ tickets: Types.ObjectId[]; total: number }> => {
  const exists = await Bundle.exists({
    _id: new Types.ObjectId(bundleId),
    orgId: new Types.ObjectId(orgId),
  });
  if (!exists) throw createError("Bundle not found", 404, "NOT_FOUND");

  const skip = (page - 1) * limit;
  const [ticketDocs, total] = await Promise.all([
    Ticket.find({ bundleId: new Types.ObjectId(bundleId), orgId: new Types.ObjectId(orgId) })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select("_id"),
    Ticket.countDocuments({ bundleId: new Types.ObjectId(bundleId), orgId: new Types.ObjectId(orgId) }),
  ]);
  return { tickets: ticketDocs.map((t) => t._id), total };
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

  // Clear bundleId from all tickets in this bundle
  await Ticket.updateMany(
    { bundleId: bundle._id, orgId: new Types.ObjectId(orgId) },
    { $set: { bundleId: null } },
  );

  await bundle.deleteOne();
};
