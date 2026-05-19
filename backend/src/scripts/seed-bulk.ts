/**
 * Bulk seed script - loads the DB with ~1.2M+ realistic entries spread over the
 * past 12 months and writes login credentials to backend/seed-credentials.json.
 *
 * Usage:
 *   cd backend
 *   npx tsx src/scripts/seed-bulk.ts            # append to existing data
 *   npx tsx src/scripts/seed-bulk.ts --fresh     # drop seeded collections first
 * 
 *   npm run build && node dist/scripts/seed-bulk.js  # append to existing data
 *   npm run build && node dist/scripts/seed-bulk.js --fresh   # drop seeded collections first
 */

import "dotenv/config";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ─── Tunable constants ────────────────────────────────────────────────────────

const SEED_PASSWORD = "Seed@1234";
// const BATCH_SIZE = 2_000;        // documents per insertMany call
// const TICKETS_PER_ORG = 500_000; // 2 orgs → 1 000 000 tickets total
// const BUNDLES_PER_ORG = 1_000;
// const AUDIT_LOGS_PER_ORG = 100_000;
// const DISCUSSION_MSGS_PER_ORG = 25_000;

// Less batching - reduced totals so the overall generated dataset is much smaller
const BATCH_SIZE = 500;        // documents per insertMany call
const TICKETS_PER_ORG = 50_000; // 2 orgs → ~100,000 tickets total
const BUNDLES_PER_ORG = 200;
const AUDIT_LOGS_PER_ORG = 10_000;
const DISCUSSION_MSGS_PER_ORG = 2_500;

// ─── Static data pools ───────────────────────────────────────────────────────

const ORGS = [
  { name: "TechCorp Inc",      slug: "techcorp-inc",      short: "techcorp" },
  { name: "RetailGroup Ltd",   slug: "retailgroup-ltd",   short: "retailgroup" },
];

const DEPT_NAMES = [
  "Engineering", "Sales", "Marketing", "Operations",
  "Finance", "Human Resources", "Legal", "Product",
];

const CATEGORY_NAMES = [
  "Travel", "Accommodation", "Meals & Entertainment",
  "Software & Licenses", "Hardware & Equipment", "Office Supplies",
  "Marketing & Advertising", "Training & Education", "Consulting Services",
  "Utilities & Internet", "Team Events", "Subscriptions",
  "Healthcare & Wellness", "Transportation", "Miscellaneous",
];

const MERCHANT_NAMES = [
  "Amazon", "Uber", "Airbnb", "Marriott Hotels", "Delta Airlines",
  "Salesforce", "Microsoft", "Google Workspace", "Slack", "Zoom",
  "WeWork", "Starbucks", "FedEx", "DHL", "Adobe Creative Cloud",
  "LinkedIn Premium", "Shopify", "Notion", "Figma", "DocuSign",
];

const TICKET_TITLES = [
  "Business trip to New York", "Client dinner at The Capital",
  "AWS cloud subscription renewal", "Office supplies Q1",
  "Team lunch for project kickoff", "Conference registration fee",
  "Hotel stay for product summit", "Uber rides for client visit",
  "Salesforce license renewal", "Marketing campaign materials",
  "Training workshop registration", "Team building event expenses",
  "Laptop & accessories purchase", "Domain & hosting renewal",
  "Legal consultation fees", "Healthcare reimbursement",
  "International flight to London", "Co-working space monthly rental",
  "Sales conference expenses", "Quarterly SaaS subscription",
  "Office furniture purchase", "Trade show booth setup",
  "Employee onboarding kit", "Design tool subscription",
  "Wireless headset purchase", "Customer event catering",
  "Engineering books bundle", "Developer tools license",
  "HR software subscription", "Compliance training program",
];

const CURRENCIES = ["USD", "EUR", "GBP", "INR", "AUD", "CAD", "SGD"] as const;

// Fallback rates used when the live API is unreachable
const FALLBACK_RATES: Record<string, number> = {
  USD: 1,     EUR: 0.92,  GBP: 0.79,  INR: 83.15, JPY: 149.5,
  CAD: 1.36,  AUD: 1.52,  CHF: 0.89,  CNY: 7.24,  SGD: 1.35,
  AED: 3.67,  HKD: 7.83,  MXN: 17.15, BRL: 4.97,  KRW: 1325,
  SEK: 10.42, NOK: 10.55, DKK: 6.89,  NZD: 1.63,  ZAR: 18.63,
  THB: 35.1,  MYR: 4.72,  IDR: 15750, PHP: 56.3,  PKR: 278,
  BDT: 110,   EGP: 30.9,  SAR: 3.75,  QAR: 3.64,  TRY: 32.1,
};

async function fetchLiveRates(): Promise<Record<string, number>> {
  try {
    const res = await fetch("https://open.er-api.com/v6/latest/USD");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json() as { result?: string; rates?: Record<string, number> };
    if (json.result !== "success" || !json.rates) throw new Error("Unexpected payload");
    console.log("  ✓ Live exchange rates fetched from open.er-api.com");
    return json.rates;
  } catch (err) {
    console.warn(`  ⚠ Could not fetch live rates (${(err as Error).message}) - using fallback rates`);
    return FALLBACK_RATES;
  }
}
const EXPENSE_TYPES = ["regular", "per_diem", "mileage"] as const;
const TAGS_POOL = [
  "q1-2025", "q2-2025", "q3-2025", "q4-2025", "q1-2026",
  "travel", "remote", "client-facing", "internal", "recurring",
  "one-time", "high-value", "reimbursable", "pre-approved",
];

const REJECTION_COMMENTS = [
  "Budget exceeded for this quarter",
  "Insufficient business justification",
  "Missing original receipt",
  "Duplicate submission",
  "Not a valid business expense",
  "Policy violation - personal expense",
  "Incorrect category selected",
  "Over the approval threshold",
];

const DISCUSSION_MESSAGES = [
  "Can you provide the original receipt for this expense?",
  "This has been approved. Well within budget.",
  "Please clarify the business purpose for this expense.",
  "Rejected - missing documentation. Please resubmit with receipts.",
  "Thank you for the quick turnaround on this.",
  "This expense looks unusual. Can you provide more context?",
  "Approved! The receipt matches the amount perfectly.",
  "This will be reimbursed in the next payroll cycle.",
  "This exceeds Q2 budget. Please check with your manager.",
  "Looks good - forwarding to finance for final approval.",
  "Approved after verifying against the vendor invoice.",
  "Please split this into separate tickets for each line item.",
  "Receipt uploaded - thank you for adding that.",
  "Note: per-diem limit for NYC is $75/day per policy.",
  "Confirmed attendance at the conference - approved.",
];

// Status weights (must add to 100)
const STATUS_WEIGHTS = [
  { status: "approved",         weight: 40 },
  { status: "pending",          weight: 22 },
  { status: "awaiting_finance", weight: 18 },
  { status: "rejected",         weight: 12 },
  { status: "draft",            weight:  8 },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function rand<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randAmount(): number {
  // Realistic expense amounts: 60 % under $500, 30 % $500–$3000, 10 % $3000–$15000
  const r = Math.random();
  if (r < 0.6) return Math.round(randInt(10, 500) * 100) / 100;
  if (r < 0.9) return Math.round(randInt(500, 3_000) * 100) / 100;
  return Math.round(randInt(3_000, 15_000) * 100) / 100;
}

const NOW = Date.now();
const ONE_YEAR_AGO = NOW - 365 * 24 * 60 * 60 * 1_000;

function randomPastDate(): Date {
  return new Date(ONE_YEAR_AGO + Math.random() * (NOW - ONE_YEAR_AGO));
}

function addHours(date: Date, hours: number): Date {
  return new Date(date.getTime() + hours * 3_600_000);
}

function pickStatus(): string {
  const r = randInt(1, 100);
  let acc = 0;
  for (const { status, weight } of STATUS_WEIGHTS) {
    acc += weight;
    if (r <= acc) return status;
  }
  return "pending";
}

function pickTags(): string[] {
  const count = randInt(0, 3);
  const tags = new Set<string>();
  for (let i = 0; i < count; i++) tags.add(rand(TAGS_POOL));
  return [...tags];
}

async function insertInBatches(
  col: mongoose.mongo.Collection,
  docs: object[],
  label: string,
  batchSize = BATCH_SIZE,
): Promise<void> {
  let inserted = 0;
  for (let i = 0; i < docs.length; i += batchSize) {
    const slice = docs.slice(i, i + batchSize);
    await col.insertMany(slice, { ordered: false });
    inserted += slice.length;
    process.stdout.write(`\r  ${label}: ${inserted.toLocaleString()} / ${docs.length.toLocaleString()}`);
  }
  process.stdout.write("\n");
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const fresh = process.argv.includes("--fresh");

  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) throw new Error("MONGODB_URI is not set in .env");

  console.log("Connecting to MongoDB…");
  await mongoose.connect(mongoUri);
  console.log("Connected.\n");

  const db = mongoose.connection.db!;

  const col = {
    orgs:     db.collection("organizations"),
    depts:    db.collection("departments"),
    cats:     db.collection("categories"),
    merchants: db.collection("merchants"),
    users:    db.collection("users"),
    tickets:  db.collection("tickets"),
    bundles:  db.collection("bundles"),
    auditlogs: db.collection("auditlogs"),
    messages: db.collection("discussionmessages"),
    rates:    db.collection("exchangeratesnapshots"),
  };

  if (fresh) {
    console.log("--fresh: dropping seeded collections…");
    for (const c of Object.values(col)) {
      await c.deleteMany({});
    }
    console.log("Collections cleared.\n");
  }

  console.log("Fetching live exchange rates…");
  const liveRates = await fetchLiveRates();

  console.log("Pre-hashing seed password (bcrypt 12)…");
  const passwordHash = await bcrypt.hash(SEED_PASSWORD, 12);
  console.log("Done.\n");

  const startTime = Date.now();
  const credentials: Record<string, unknown> = {
    password: SEED_PASSWORD,
    note: "All seeded users share the same password",
    organizations: [],
  };

  for (const orgDef of ORGS) {
    console.log(`═══════════════════════════════════════`);
    console.log(`  Org: ${orgDef.name}`);
    console.log(`═══════════════════════════════════════`);

    // ── Organization ──────────────────────────────────────────────────────────
    const orgId = new mongoose.Types.ObjectId();
    // Pre-generate first admin _id so categories/merchants can reference it as createdBy
    const firstAdminId = new mongoose.Types.ObjectId();
    await col.orgs.insertOne({
      _id: orgId,
      name: orgDef.name,
      slug: orgDef.slug,
      isDisabled: false,
      baseCurrency: "USD",
      activeCurrencies: ["USD", "EUR", "GBP", "INR"],
      currentRateSnapshotId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    console.log(`  ✓ Organization (${orgId})`);

    // ── Exchange Rate Snapshot ─────────────────────────────────────────────────
    const rateSnapshotId = new mongoose.Types.ObjectId();
    await col.rates.insertOne({
      _id: rateSnapshotId,
      orgId,
      rates: liveRates,
      baseCurrency: "USD",
      source: "manual",
      creator: { _id: orgId, name: "System (seeded)" },
      createdAt: new Date(),
    });
    await col.orgs.updateOne({ _id: orgId }, { $set: { currentRateSnapshotId: rateSnapshotId } });
    console.log(`  ✓ Exchange rate snapshot (${rateSnapshotId})`);

    // ── Departments ───────────────────────────────────────────────────────────
    const depts = DEPT_NAMES.map(name => ({
      _id: new mongoose.Types.ObjectId(),
      orgId,
      name,
      budget: randInt(50_000, 500_000),
      spent:  randInt(10_000,  49_000),
      approvalThresholds: {},
      permissions: {
        view_all_tickets: null,
        approve_finance: null,
        export_reports: null,
        view_analytics: null,
      },
      policyId: null,
      tags: [],
      budgetResetPeriod: "monthly",
      nextResetDate: null,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));
    await col.depts.insertMany(depts);
    console.log(`  ✓ ${depts.length} departments`);

    // ── Categories ────────────────────────────────────────────────────────────
    const categories = CATEGORY_NAMES.map(name => ({
      _id: new mongoose.Types.ObjectId(),
      orgId,
      name,
      normalizedName: name.toLowerCase(),
      description: `Expenses related to ${name.toLowerCase()}`,
      isActive: true,
      isSystem: false,
      createdBy: firstAdminId,
      iconId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));
    await col.cats.insertMany(categories);
    console.log(`  ✓ ${categories.length} categories`);

    // ── Merchants ─────────────────────────────────────────────────────────────
    const merchants = MERCHANT_NAMES.map(name => ({
      _id: new mongoose.Types.ObjectId(),
      orgId,
      name,
      normalizedName: name.toLowerCase(),
      isActive: true,
      createdBy: firstAdminId,
      logo: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));
    await col.merchants.insertMany(merchants);
    console.log(`  ✓ ${merchants.length} merchants`);

    // ── Users ─────────────────────────────────────────────────────────────────
    // Layout: 3 admins + 3 finance-admins + 1 manager per dept + 8 users per dept
    const short = orgDef.short;
    const adminUsers: any[] = [];
    const financeUsers: any[] = [];
    const managerUsers: any[] = [];
    const regularUsers: any[] = [];

    for (let i = 1; i <= 3; i++) {
      adminUsers.push({
        _id: i === 1 ? firstAdminId : new mongoose.Types.ObjectId(),
        name: `Admin ${i}`,
        email: `admin${i}@${short}.dev`,
        passwordHash,
        role: "admin",
        orgId,
        department: null,
        managerId: null,
        departmentSnapshot: null,
        managerSnapshot: null,
        policySnapshot: null,
        permissions: {
          view_all_tickets: true,
          approve_finance: null,
          export_reports: true,
          view_analytics: true,
        },
        policyId: null,
        isDisabled: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    for (let i = 1; i <= 3; i++) {
      financeUsers.push({
        _id: new mongoose.Types.ObjectId(),
        name: `Finance Admin ${i}`,
        email: `finance${i}@${short}.dev`,
        passwordHash,
        role: "admin",
        orgId,
        department: null,
        managerId: null,
        departmentSnapshot: null,
        managerSnapshot: null,
        policySnapshot: null,
        permissions: {
          view_all_tickets: true,
          approve_finance: true,
          export_reports: true,
          view_analytics: true,
        },
        policyId: null,
        isDisabled: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    for (const dept of depts) {
      const deptKey = dept.name.toLowerCase().replace(/\s+/g, "");
      const mgr = {
        _id: new mongoose.Types.ObjectId(),
        name: `${dept.name} Manager`,
        email: `mgr.${deptKey}@${short}.dev`,
        passwordHash,
        role: "user",
        orgId,
        department: dept._id,
        managerId: null,
        departmentSnapshot: { _id: dept._id, name: dept.name },
        managerSnapshot: null,
        policySnapshot: null,
        permissions: {
          view_all_tickets: null,
          approve_finance: null,
          export_reports: null,
          view_analytics: null,
        },
        policyId: null,
        isDisabled: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      managerUsers.push(mgr);

      for (let j = 1; j <= 8; j++) {
        regularUsers.push({
          _id: new mongoose.Types.ObjectId(),
          name: `${dept.name} User ${j}`,
          email: `user${j}.${deptKey}@${short}.dev`,
          passwordHash,
          role: "user",
          orgId,
          department: dept._id,
          managerId: mgr._id,
          departmentSnapshot: { _id: dept._id, name: dept.name },
          managerSnapshot: { _id: mgr._id, name: mgr.name },
          policySnapshot: null,
          permissions: {
            view_all_tickets: null,
            approve_finance: null,
            export_reports: null,
            view_analytics: null,
          },
          policyId: null,
          isDisabled: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }
    }

    const allUsers = [...adminUsers, ...financeUsers, ...managerUsers, ...regularUsers];
    await col.users.insertMany(allUsers);
    console.log(`  ✓ ${allUsers.length} users (3 admin, 3 finance-admin, ${managerUsers.length} managers, ${regularUsers.length} staff)`);

    // Build lookup maps for ticket generation
    const deptById = new Map(depts.map(d => [d._id.toString(), d]));
    const mgrByDept = new Map(managerUsers.map(m => [m.department.toString(), m]));

    // ── Tickets ───────────────────────────────────────────────────────────────
    console.log(`  Generating ${TICKETS_PER_ORG.toLocaleString()} tickets in batches of ${BATCH_SIZE.toLocaleString()}…`);

    function buildTicket(): Record<string, unknown> {
      const submitter   = rand(regularUsers);
      const dept        = deptById.get(submitter.department.toString())!;
      const mgr         = mgrByDept.get(submitter.department.toString());
      const finAdmin    = rand(financeUsers);
      const category    = rand(categories);
      const merchant    = rand(merchants);
      const currency    = rand(CURRENCIES);
      const amount      = randAmount();
      const status      = pickStatus();
      const createdAt   = randomPastDate();

      // Reviewer fallback when the submitter has no manager (unlikely but safe)
      const reviewerUser = mgr ?? adminUsers[0];

      const baseApproval = {
        required: true,
        approved: null,
        reviewedBy: null,
        reviewerSnapshot: null,
        reviewedAt: null,
        comments: null,
      };

      let managerApproval: Record<string, unknown> | null = null;
      let financeApproval: Record<string, unknown> | null = null;
      let updatedAt = createdAt;

      if (status === "pending") {
        managerApproval = { ...baseApproval };
        financeApproval = { ...baseApproval };

      } else if (status === "awaiting_finance") {
        const reviewedAt = addHours(createdAt, randInt(2, 72));
        managerApproval = {
          required: true,
          approved: true,
          reviewedBy: reviewerUser._id,
          reviewerSnapshot: { _id: reviewerUser._id, name: reviewerUser.name, email: reviewerUser.email },
          reviewedAt,
          comments: null,
        };
        financeApproval = { ...baseApproval };
        updatedAt = reviewedAt;

      } else if (status === "approved") {
        const mgAt = addHours(createdAt, randInt(2, 48));
        const fnAt = addHours(mgAt, randInt(1, 72));
        managerApproval = {
          required: true,
          approved: true,
          reviewedBy: reviewerUser._id,
          reviewerSnapshot: { _id: reviewerUser._id, name: reviewerUser.name, email: reviewerUser.email },
          reviewedAt: mgAt,
          comments: null,
        };
        financeApproval = {
          required: true,
          approved: true,
          reviewedBy: finAdmin._id,
          reviewerSnapshot: { _id: finAdmin._id, name: finAdmin.name, email: finAdmin.email },
          reviewedAt: fnAt,
          comments: null,
        };
        updatedAt = fnAt;

      } else if (status === "rejected") {
        const rejectAtManager = Math.random() < 0.55;
        const mgAt = addHours(createdAt, randInt(2, 48));
        if (rejectAtManager) {
          managerApproval = {
            required: true,
            approved: false,
            reviewedBy: reviewerUser._id,
            reviewerSnapshot: { _id: reviewerUser._id, name: reviewerUser.name, email: reviewerUser.email },
            reviewedAt: mgAt,
            comments: rand(REJECTION_COMMENTS),
          };
          financeApproval = { ...baseApproval };
        } else {
          const fnAt = addHours(mgAt, randInt(1, 72));
          managerApproval = {
            required: true,
            approved: true,
            reviewedBy: reviewerUser._id,
            reviewerSnapshot: { _id: reviewerUser._id, name: reviewerUser.name, email: reviewerUser.email },
            reviewedAt: mgAt,
            comments: null,
          };
          financeApproval = {
            required: true,
            approved: false,
            reviewedBy: finAdmin._id,
            reviewerSnapshot: { _id: finAdmin._id, name: finAdmin.name, email: finAdmin.email },
            reviewedAt: fnAt,
            comments: rand(REJECTION_COMMENTS),
          };
          updatedAt = fnAt;
        }
      }
      // draft: both approvals null (default)

      return {
        _id: new mongoose.Types.ObjectId(),
        title: rand(TICKET_TITLES),
        submittedBy: submitter._id,
        submitterManagerId: submitter.managerId,
        orgId,
        amount,
        currency,
        department: dept._id,
        description: `Business expense - ${rand(TICKET_TITLES).toLowerCase()}`,
        tags: pickTags(),
        receiptIds: [],
        status,
        flagged: Math.random() < 0.05,
        managerApproval,
        financeApproval,
        exchangeRateSnapshotId: status === "approved" ? rateSnapshotId : null,
        merchant: merchant._id,
        category: category._id,
        bundleId: null,
        expenseType: rand(EXPENSE_TYPES),
        ocrData: null,
        aiValidation: null,
        // Denormalized snapshots
        submitterSnapshot:  { _id: submitter._id,  name: submitter.name,  email: submitter.email },
        departmentSnapshot: { _id: dept._id,        name: dept.name },
        merchantSnapshot:   { _id: merchant._id,    name: merchant.name },
        categorySnapshot:   { _id: category._id,    name: category.name },
        bundleSnapshot: null,
        createdAt,
        updatedAt,
      };
    }

    let ticketInserted = 0;
    let ticketBatch: Record<string, unknown>[] = [];

    for (let i = 0; i < TICKETS_PER_ORG; i++) {
      ticketBatch.push(buildTicket());
      if (ticketBatch.length >= BATCH_SIZE) {
        await col.tickets.insertMany(ticketBatch, { ordered: false });
        ticketInserted += ticketBatch.length;
        ticketBatch = [];
        process.stdout.write(
          `\r  Tickets: ${ticketInserted.toLocaleString()} / ${TICKETS_PER_ORG.toLocaleString()}`,
        );
      }
    }
    if (ticketBatch.length > 0) {
      await col.tickets.insertMany(ticketBatch, { ordered: false });
      ticketInserted += ticketBatch.length;
    }
    console.log(`\r  ✓ ${ticketInserted.toLocaleString()} tickets inserted            `);

    // ── Bundles ───────────────────────────────────────────────────────────────
    console.log(`  Creating ${BUNDLES_PER_ORG} bundles…`);

    // Pull a pool of approved tickets to group into bundles
    const approvedPool = await col.tickets
      .find(
        { orgId, status: "approved" },
        { projection: { _id: 1, amount: 1, submittedBy: 1, submitterSnapshot: 1, department: 1 } },
      )
      .limit(BUNDLES_PER_ORG * 15)
      .toArray();

    // Fisher-Yates shuffle
    for (let i = approvedPool.length - 1; i > 0; i--) {
      const j = randInt(0, i);
      [approvedPool[i], approvedPool[j]] = [approvedPool[j], approvedPool[i]];
    }

    const BUNDLE_PREFIXES = ["Q1", "Q2", "Q3", "Q4"];
    const BUNDLE_TOPICS = ["Travel", "Client", "Marketing", "Engineering", "Operations", "HR", "Sales", "Product"];

    const bundleDocs: Record<string, unknown>[] = [];
    const ticketBundleUpdates: { filter: object; update: object }[] = [];

    let poolIdx = 0;
    for (let b = 0; b < BUNDLES_PER_ORG && poolIdx < approvedPool.length; b++) {
      const size = randInt(3, 15);
      const slice = approvedPool.slice(poolIdx, poolIdx + size);
      poolIdx += size;
      if (slice.length === 0) break;

      const bundleId   = new mongoose.Types.ObjectId();
      const bundleTitle = `${rand(BUNDLE_PREFIXES)} ${rand(BUNDLE_TOPICS)} Expenses Bundle`;
      const createdAt  = randomPastDate();

      const submitterSnap = (slice[0] as any).submitterSnapshot ?? {
        _id: (slice[0] as any).submittedBy,
        name: "Unknown User",
        email: "unknown@dev.com",
      };

      const finAdmin  = rand(financeUsers);
      const mgrForBundle = mgrByDept.get((slice[0] as any).department?.toString() ?? "") ?? managerUsers[0];
      const mgAt = addHours(createdAt, randInt(4, 48));
      const fnAt = addHours(mgAt, randInt(2, 72));
      const totalAmount = slice.reduce((s: number, t: any) => s + (t.amount ?? 0), 0);

      const bundleStatus = Math.random() < 0.6 ? "approved" : Math.random() < 0.5 ? "submitted" : "rejected";

      let managerApproval: Record<string, unknown> | null = null;
      let financeApproval: Record<string, unknown> | null = null;
      let bundleUpdatedAt = createdAt;

      if (bundleStatus === "submitted") {
        managerApproval = {
          required: true, approved: null,
          reviewedBy: null, reviewerSnapshot: null, reviewedAt: null, comments: null,
        };
        financeApproval = {
          required: true, approved: null,
          reviewedBy: null, reviewerSnapshot: null, reviewedAt: null, comments: null,
        };
      } else if (bundleStatus === "approved") {
        managerApproval = {
          required: true, approved: true,
          reviewedBy: mgrForBundle._id,
          reviewerSnapshot: { _id: mgrForBundle._id, name: mgrForBundle.name, email: mgrForBundle.email },
          reviewedAt: mgAt, comments: null,
        };
        financeApproval = {
          required: true, approved: true,
          reviewedBy: finAdmin._id,
          reviewerSnapshot: { _id: finAdmin._id, name: finAdmin.name, email: finAdmin.email },
          reviewedAt: fnAt, comments: null,
        };
        bundleUpdatedAt = fnAt;
      } else {
        managerApproval = {
          required: true, approved: false,
          reviewedBy: mgrForBundle._id,
          reviewerSnapshot: { _id: mgrForBundle._id, name: mgrForBundle.name, email: mgrForBundle.email },
          reviewedAt: mgAt,
          comments: rand(REJECTION_COMMENTS),
        };
        financeApproval = {
          required: true, approved: null,
          reviewedBy: null, reviewerSnapshot: null, reviewedAt: null, comments: null,
        };
        bundleUpdatedAt = mgAt;
      }

      bundleDocs.push({
        _id: bundleId,
        orgId,
        title: bundleTitle,
        description: `Bundled expense report - ${bundleTitle.toLowerCase()}`,
        submitter: {
          _id: submitterSnap._id,
          name: submitterSnap.name,
          email: submitterSnap.email,
        },
        status: bundleStatus,
        totalAmountBase: Math.round(totalAmount * 100) / 100,
        baseCurrency: "USD",
        ticketCount: slice.length,
        tags: pickTags(),
        managerApproval,
        financeApproval,
        createdAt,
        updatedAt: bundleUpdatedAt,
      });

      for (const t of slice) {
        ticketBundleUpdates.push({
          filter: { _id: (t as any)._id },
          update: { $set: { bundleId, bundleSnapshot: { _id: bundleId, name: bundleTitle } } },
        });
      }
    }

    if (bundleDocs.length > 0) {
      await col.bundles.insertMany(bundleDocs);
      console.log(`  ✓ ${bundleDocs.length} bundles created`);
    }

    if (ticketBundleUpdates.length > 0) {
      const bulkOps = ticketBundleUpdates.map(({ filter, update }) => ({
        updateOne: { filter, update },
      }));
      for (let i = 0; i < bulkOps.length; i += 1_000) {
        await col.tickets.bulkWrite(bulkOps.slice(i, i + 1_000), { ordered: false });
      }
      console.log(`  ✓ ${ticketBundleUpdates.length} tickets linked to bundles`);
    }

    // ── Audit Logs ────────────────────────────────────────────────────────────
    console.log(`  Generating ${AUDIT_LOGS_PER_ORG.toLocaleString()} audit logs…`);

    // Sample some real ticket IDs for realistic references
    const sampleTicketIds = await col.tickets
      .find({ orgId }, { projection: { _id: 1 } })
      .limit(10_000)
      .toArray()
      .then(docs => docs.map(d => (d as any)._id));

    const performerPool = [
      ...adminUsers,
      ...financeUsers,
      ...managerUsers.slice(0, 4),
      ...regularUsers.slice(0, 8),
    ];

    const AUDIT_ACTIONS   = ["created", "updated", "status_changed", "approved", "rejected", "flagged", "commented", "bundle_added"];
    const AUDIT_ENTITIES  = ["ticket", "ticket", "ticket", "ticket", "bundle", "user", "department"];

    const auditDocs: Record<string, unknown>[] = [];
    for (let i = 0; i < AUDIT_LOGS_PER_ORG; i++) {
      const performer   = rand(performerPool);
      const entityType  = rand(AUDIT_ENTITIES);
      const entityId    = sampleTicketIds.length > 0 ? rand(sampleTicketIds) : new mongoose.Types.ObjectId();
      const createdAt   = randomPastDate();

      auditDocs.push({
        _id: new mongoose.Types.ObjectId(),
        orgId,
        entityType,
        entityId,
        action: rand(AUDIT_ACTIONS),
        performer: { _id: performer._id, name: performer.name },
        ip: `10.${randInt(0, 255)}.${randInt(0, 255)}.${randInt(1, 254)}`,
        metadata: {},
        createdAt,
      });
    }
    await insertInBatches(col.auditlogs, auditDocs, "Audit logs");

    // ── Discussion Messages ───────────────────────────────────────────────────
    console.log(`  Generating ${DISCUSSION_MSGS_PER_ORG.toLocaleString()} discussion messages…`);

    const msgDocs: Record<string, unknown>[] = [];
    for (let i = 0; i < DISCUSSION_MSGS_PER_ORG; i++) {
      const author   = rand([...adminUsers, ...financeUsers, ...regularUsers.slice(0, 20)]);
      const dept     = author.department
        ? (depts.find(d => d._id.equals(author.department)) ?? null)
        : null;
      const createdAt = randomPastDate();

      msgDocs.push({
        _id: new mongoose.Types.ObjectId(),
        ticketId: sampleTicketIds.length > 0 ? rand(sampleTicketIds) : new mongoose.Types.ObjectId(),
        orgId,
        author: { _id: author._id, name: author.name, email: author.email, role: author.role },
        authorDeptSnapshot: dept ? { _id: dept._id, name: dept.name } : null,
        text: rand(DISCUSSION_MESSAGES),
        editedAt: null,
        deletedAt: null,
        createdAt,
        updatedAt: createdAt,
      });
    }
    await insertInBatches(col.messages, msgDocs, "Discussion messages");

    // ── Credentials record ────────────────────────────────────────────────────
    (credentials.organizations as any[]).push({
      id:   orgId.toString(),
      name: orgDef.name,
      admins: adminUsers.map(u => ({
        name: u.name, email: u.email, role: "admin",
        permissions: "view_all_tickets, export_reports, view_analytics",
      })),
      financeAdmins: financeUsers.map(u => ({
        name: u.name, email: u.email, role: "admin",
        permissions: "view_all_tickets, approve_finance, export_reports, view_analytics",
      })),
      sampleManagers: managerUsers.slice(0, 4).map(u => ({
        name: u.name,
        email: u.email,
        role: "user",
        department: deptById.get(u.department.toString())?.name ?? "-",
      })),
      sampleUsers: regularUsers.slice(0, 6).map(u => ({
        name: u.name,
        email: u.email,
        role: "user",
        department: deptById.get(u.department.toString())?.name ?? "-",
      })),
    });

    const elapsed = ((Date.now() - startTime) / 1_000).toFixed(1);
    console.log(`  Org "${orgDef.name}" done (${elapsed}s elapsed)\n`);
  }

  // ── Write credentials JSON ────────────────────────────────────────────────
  const credsPath = join(__dirname, "..", "..", "seed-credentials.json");
  writeFileSync(credsPath, JSON.stringify(credentials, null, 2));

  const totalSecs = ((Date.now() - startTime) / 1_000).toFixed(1);
  console.log("═══════════════════════════════════════");
  console.log(`  ✅  Seeding complete in ${totalSecs}s`);
  console.log(`  📋  Credentials → backend/seed-credentials.json`);
  console.log("═══════════════════════════════════════");

  await mongoose.disconnect();
}

main().catch(err => {
  console.error("\n❌  Seed failed:", err);
  process.exit(1);
});


// Bulk Seed Script - seed-bulk.ts
// What it creates (per org × 2 orgs)
// Collection	Count
// Organizations	2
// Departments	8 per org
// Categories	15 per org
// Merchants	20 per org
// Users	102 per org (3 admin + 3 finance-admin + 8 managers + 64 staff)
// Tickets	500,000 per org → 1,000,000 total
// Bundles	1,000 per org
// Audit Logs	100,000 per org
// Discussion Messages	25,000 per org
// Grand Total	~1.25M+ entries
// Ticket status distribution (realistic, over last 12 months)
// 40% approved (full manager + finance approval chain with timestamps)
// 22% pending (awaiting manager review)
// 18% awaiting_finance (manager approved, finance pending)
// 12% rejected (at manager or finance level, with reason comments)
// 8% draft
// All snapshots, reviewer data, and timestamps are populated correctly.

// How to run

// cd backend

// # First time (or clean slate):
// npx tsx src/scripts/seed-bulk.ts --fresh

// # Append to existing data:
// npx tsx src/scripts/seed-bulk.ts
// Estimated time: ~3–6 minutes for 1M tickets depending on MongoDB latency.

// Credentials → backend/seed-credentials.json
// After the script finishes, the file looks like this:


// {
//   "password": "Seed@1234",
//   "note": "All seeded users share the same password",
//   "organizations": [
//     {
//       "name": "TechCorp Inc",
//       "admins": [
//         { "email": "admin1@techcorp.dev", "role": "admin" },
//         ...
//       ],
//       "financeAdmins": [
//         { "email": "finance1@techcorp.dev", "permissions": "approve_finance: true" },
//         ...
//       ],
//       "sampleManagers": [
//         { "email": "mgr.engineering@techcorp.dev", "department": "Engineering" },
//         ...
//       ],
//       "sampleUsers": [
//         { "email": "user1.engineering@techcorp.dev", "department": "Engineering" },
//         ...
//       ]
//     },
//     { "name": "RetailGroup Ltd", ... }
//   ]
// }
// Every user's password is Seed@1234. The super admin credentials come from your .env (SUPER_ADMIN_EMAIL / SUPER_ADMIN_PASSWORD) and are not touched by the script.