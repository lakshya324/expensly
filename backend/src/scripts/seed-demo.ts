/**
 * Demo seed script — creates a small, curated dataset for live product demos.
 *
 * Covers every feature: all ticket statuses, bundles (approved/submitted/draft),
 * discussion threads, flagged tickets, audit trail, multi-currency, analytics.
 *
 * Usage:
 *   cd backend
 *   npx tsx src/scripts/seed-demo.ts
 *   npm run build && node dist/scripts/seed-demo.js
 *
 * Idempotent — drops the "expensly-demo" org before re-seeding.
 * Credentials → backend/seed-demo-credentials.json
 * Password for all demo users: Demo@1234
 */

import "dotenv/config";
import mongoose, { Types } from "mongoose";
import bcrypt from "bcryptjs";
import { writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { Organization } from "../models/Organization.model.js";
import { refreshOrgAnalytics } from "../services/analytics.service.js";
import getRedisClient from "../config/redis.config.js";

const DEMO_PASSWORD = "Demo@1234";
const DEMO_SLUG = "expensly-demo";

// ─── Time helpers ─────────────────────────────────────────────────────────────

const NOW = Date.now();

function weeksAgo(n: number): Date {
  return new Date(NOW - n * 7 * 24 * 3600 * 1000);
}

function daysAgo(n: number): Date {
  return new Date(NOW - n * 24 * 3600 * 1000);
}

function hoursLater(base: Date, h: number): Date {
  return new Date(base.getTime() + h * 3600 * 1000);
}

// ─── Live exchange rates ──────────────────────────────────────────────────────

const ACTIVE_CURRENCIES = ["USD", "EUR", "INR"] as const;

const FALLBACK_RATES: Record<string, number> = { USD: 1, EUR: 0.92, INR: 83.50 };

async function fetchDemoRates(): Promise<Record<string, number>> {
  try {
    const res = await fetch("https://open.er-api.com/v6/latest/USD");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json() as { result?: string; rates?: Record<string, number> };
    if (json.result !== "success" || !json.rates) throw new Error("Unexpected payload");
    const filtered = Object.fromEntries(
      ACTIVE_CURRENCIES.map(c => [c, json.rates![c] ?? FALLBACK_RATES[c]]),
    );
    console.log(`✓ Live rates fetched: ${JSON.stringify(filtered)}`);
    return filtered;
  } catch (err) {
    console.warn(`⚠ Live rates unavailable (${(err as Error).message}) — using fallback`);
    return { ...FALLBACK_RATES };
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function main() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) throw new Error("MONGODB_URI is not set in .env");

  console.log("Connecting to MongoDB…");
  await mongoose.connect(mongoUri);
  console.log("Connected.\n");

  const db = mongoose.connection.db!;

  const col = {
    orgs:      db.collection("organizations"),
    depts:     db.collection("departments"),
    cats:      db.collection("categories"),
    merchants: db.collection("merchants"),
    policies:  db.collection("policies"),
    users:     db.collection("users"),
    tickets:   db.collection("tickets"),
    bundles:   db.collection("bundles"),
    auditlogs: db.collection("auditlogs"),
    messages:  db.collection("discussionmessages"),
    rates:     db.collection("exchangeratesnapshots"),
    analytics: db.collection("organalytics"),
  };

  // ── Drop existing demo org ────────────────────────────────────────────────
  const existingOrg = await col.orgs.findOne({ slug: DEMO_SLUG });
  if (existingOrg) {
    const oid = existingOrg._id;
    console.log(`Dropping existing demo org (${oid})…`);
    await Promise.all([
      col.orgs.deleteOne({ _id: oid }),
      col.depts.deleteMany({ orgId: oid }),
      col.cats.deleteMany({ orgId: oid }),
      col.merchants.deleteMany({ orgId: oid }),
      col.users.deleteMany({ orgId: oid }),
      col.tickets.deleteMany({ orgId: oid }),
      col.bundles.deleteMany({ orgId: oid }),
      col.auditlogs.deleteMany({ orgId: oid }),
      col.messages.deleteMany({ orgId: oid }),
      col.rates.deleteMany({ orgId: oid }),
      col.analytics.deleteMany({ orgId: oid }),
      col.policies.deleteMany({ orgId: oid }),
    ]);
    console.log("Done.\n");
  }

  console.log("Hashing demo password (bcrypt 12)…");
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);
  console.log("Done.\n");

  console.log("Fetching live exchange rates…");
  const liveRates = await fetchDemoRates();

  const startTime = Date.now();

  // ── Organization ──────────────────────────────────────────────────────────
  const orgId = new Types.ObjectId();
  await col.orgs.insertOne({
    _id: orgId,
    name: "Expensly Demo",
    slug: DEMO_SLUG,
    isDisabled: false,
    baseCurrency: "USD",
    activeCurrencies: ["USD", "EUR", "INR"],
    currentRateSnapshotId: null,
    createdAt: weeksAgo(16),
    updatedAt: weeksAgo(16),
  });
  console.log(`✓ Organization: Expensly Demo (${orgId})`);

  // ── Exchange Rate Snapshot ─────────────────────────────────────────────────
  const rateSnapshotId = new Types.ObjectId();
  await col.rates.insertOne({
    _id: rateSnapshotId,
    orgId,
    rates: liveRates,
    baseCurrency: "USD",
    source: "manual",
    creator: { _id: orgId, name: "System (seeded)" },
    createdAt: weeksAgo(14),
  });
  await col.orgs.updateOne(
    { _id: orgId },
    { $set: { currentRateSnapshotId: rateSnapshotId, updatedAt: weeksAgo(14) } },
  );
  console.log(`✓ Exchange rate snapshot`);

  // ── Departments ───────────────────────────────────────────────────────────
  const engId     = new Types.ObjectId();
  const salesId   = new Types.ObjectId();
  const mktId     = new Types.ObjectId();
  const finDepId  = new Types.ObjectId(); // Finance department

  const departments = [
    { _id: engId,    name: "Engineering", budget: 50000 },
    { _id: salesId,  name: "Sales",       budget: 30000 },
    { _id: mktId,    name: "Marketing",   budget: 20000 },
    { _id: finDepId, name: "Finance",     budget: 10000 },
  ].map(d => ({
    ...d,
    orgId,
    spent: 0,
    approvalThresholds: {},
    permissions: { view_all_tickets: false, approve_finance: false, export_reports: false, view_analytics: false },
    policyId: null,
    policySnapshot: null,
    tags: [],
    budgetResetPeriod: "monthly",
    nextResetDate: null,
    isActive: true,
    createdAt: weeksAgo(16),
    updatedAt: weeksAgo(16),
  }));
  await col.depts.insertMany(departments);
  console.log(`✓ 4 departments`);

  // ── User IDs pre-declared so categories/merchants can reference adminId ──
  const adminId   = new Types.ObjectId();
  const financeId = new Types.ObjectId();
  const alexId    = new Types.ObjectId();
  const jamieId   = new Types.ObjectId();
  const caseyId   = new Types.ObjectId();
  const priyaId   = new Types.ObjectId();
  const tomId     = new Types.ObjectId();
  const emmaId    = new Types.ObjectId();
  const carlosId  = new Types.ObjectId();
  const lisaId    = new Types.ObjectId();

  // ── Categories ────────────────────────────────────────────────────────────
  const CATEGORY_DEFS = [
    "Travel", "Accommodation", "Software & Subscriptions",
    "Office Supplies", "Food & Beverages", "Equipment",
    "Entertainment", "Training & Education",
  ];

  const catIds: Record<string, Types.ObjectId> = {};
  const categories = CATEGORY_DEFS.map(name => {
    const id = new Types.ObjectId();
    catIds[name] = id;
    return {
      _id: id, orgId, name,
      normalizedName: name.toLowerCase(),
      description: `Expenses related to ${name.toLowerCase()}`,
      isActive: true, isSystem: false, createdBy: adminId, iconId: null,
      createdAt: weeksAgo(16), updatedAt: weeksAgo(16),
    };
  });
  await col.cats.insertMany(categories);
  console.log(`✓ 8 categories`);

  // ── Merchants ─────────────────────────────────────────────────────────────
  const MERCHANT_DEFS = [
    "Amazon", "Uber", "Airbnb", "Zoom", "Salesforce",
    "Google Cloud", "Apple", "WeWork", "Delta Airlines", "Udemy",
  ];

  const mIds: Record<string, Types.ObjectId> = {};
  const merchants = MERCHANT_DEFS.map(name => {
    const id = new Types.ObjectId();
    mIds[name] = id;
    return {
      _id: id, orgId, name,
      normalizedName: name.toLowerCase(),
      isActive: true, createdBy: adminId, logo: null,
      createdAt: weeksAgo(16), updatedAt: weeksAgo(16),
    };
  });
  await col.merchants.insertMany(merchants);
  console.log(`✓ 10 merchants`);

  // ── Policies ──────────────────────────────────────────────────────────────
  // Three policies to demonstrate dept-level propagation and user-level override.

  const policyStandardId  = new Types.ObjectId(); // Engineering + Marketing depts
  const policySalesId     = new Types.ObjectId(); // Sales dept
  const policyFinanceId   = new Types.ObjectId(); // Priya (individual user override)

  const STANDARD_GRANTS  = ["view_analytics"];
  const SALES_GRANTS     = ["view_analytics", "export_reports"];
  const FINANCE_GRANTS   = ["approve_finance", "view_all_tickets", "view_analytics", "export_reports"];

  await col.policies.insertMany([
    {
      _id: policyStandardId, orgId,
      name: "Standard Employee Policy",
      description: "Grants analytics access to all department members. Applied to Engineering and Marketing.",
      isSystem: false, isActive: true,
      grants: STANDARD_GRANTS,
      createdBy: adminId,
      createdAt: weeksAgo(14), updatedAt: weeksAgo(14),
    },
    {
      _id: policySalesId, orgId,
      name: "Sales Operations Policy",
      description: "Grants analytics and report export access for the Sales team to reconcile expenses.",
      isSystem: false, isActive: true,
      grants: SALES_GRANTS,
      createdBy: adminId,
      createdAt: weeksAgo(14), updatedAt: weeksAgo(14),
    },
    {
      _id: policyFinanceId, orgId,
      name: "Finance Approver Policy",
      description: "Full finance approval rights. Assigned to designated backup approvers.",
      isSystem: true, isActive: true,
      grants: FINANCE_GRANTS,
      createdBy: adminId,
      createdAt: weeksAgo(14), updatedAt: weeksAgo(14),
    },
  ]);
  console.log(`✓ 3 policies`);

  // Attach policies to departments (set both policyId + policySnapshot for UI badge)
  await Promise.all([
    col.depts.updateOne({ _id: engId },    { $set: { policyId: policyStandardId, policySnapshot: { _id: policyStandardId, name: "Standard Employee Policy"  }, updatedAt: weeksAgo(14) } }),
    col.depts.updateOne({ _id: salesId },  { $set: { policyId: policySalesId,    policySnapshot: { _id: policySalesId,    name: "Sales Operations Policy"   }, updatedAt: weeksAgo(14) } }),
    col.depts.updateOne({ _id: mktId },    { $set: { policyId: policyStandardId, policySnapshot: { _id: policyStandardId, name: "Standard Employee Policy"  }, updatedAt: weeksAgo(14) } }),
    col.depts.updateOne({ _id: finDepId }, { $set: { policyId: policyFinanceId,  policySnapshot: { _id: policyFinanceId,  name: "Finance Approver Policy"   }, updatedAt: weeksAgo(14) } }),
  ]);
  console.log(`✓ Department policies assigned (Eng+Mkt → Standard, Sales → Sales Ops, Finance → Finance Approver)`);

  // ── Users ─────────────────────────────────────────────────────────────────

  // Name/email map used for snapshot construction throughout the script
  const userInfo: Record<string, { name: string; email: string; role: string }> = {
    [adminId.toString()]:   { name: "Admin User",      email: "admin@demo.expensly.dev",         role: "admin" },
    [financeId.toString()]: { name: "Finance Officer",  email: "finance@demo.expensly.dev",       role: "user"  },
    [alexId.toString()]:    { name: "Alex Morgan",      email: "alex.morgan@demo.expensly.dev",   role: "user" },
    [jamieId.toString()]:   { name: "Jamie Taylor",     email: "jamie.taylor@demo.expensly.dev",  role: "user" },
    [caseyId.toString()]:   { name: "Casey Lee",        email: "casey.lee@demo.expensly.dev",     role: "user" },
    [priyaId.toString()]:   { name: "Priya Sharma",     email: "priya.sharma@demo.expensly.dev",  role: "user" },
    [tomId.toString()]:     { name: "Tom Wilson",       email: "tom.wilson@demo.expensly.dev",    role: "user" },
    [emmaId.toString()]:    { name: "Emma Davis",       email: "emma.davis@demo.expensly.dev",    role: "user" },
    [carlosId.toString()]:  { name: "Carlos Garcia",    email: "carlos.garcia@demo.expensly.dev", role: "user" },
    [lisaId.toString()]:    { name: "Lisa Zhang",       email: "lisa.zhang@demo.expensly.dev",    role: "user" },
  };

  const userSnap = (id: Types.ObjectId) => {
    const u = userInfo[id.toString()];
    return { _id: id, name: u.name, email: u.email };
  };

  const deptSnapFor = (deptId: Types.ObjectId | null): { _id: Types.ObjectId; name: string } | null => {
    if (!deptId) return null;
    if (deptId.equals(engId))    return { _id: engId,    name: "Engineering" };
    if (deptId.equals(salesId))  return { _id: salesId,  name: "Sales" };
    if (deptId.equals(mktId))    return { _id: mktId,    name: "Marketing" };
    if (deptId.equals(finDepId)) return { _id: finDepId, name: "Finance" };
    return null;
  };

  const mgrSnapFor = (mgrId: Types.ObjectId | null): { _id: Types.ObjectId; name: string; email: string } | null => {
    if (!mgrId) return null;
    return userSnap(mgrId);
  };

  const usersRaw: Array<{
    _id: Types.ObjectId;
    name: string; email: string;
    role: string;
    department: Types.ObjectId | null;
    managerId: Types.ObjectId | null;
    permissions: Record<string, boolean | null>;
  }> = [
    { _id: adminId,   name: "Admin User",     email: "admin@demo.expensly.dev",         role: "admin", department: null,      managerId: null,    permissions: { view_all_tickets: true,  approve_finance: true,  export_reports: true,  view_analytics: true  } },
    { _id: financeId, name: "Finance Officer", email: "finance@demo.expensly.dev",      role: "user",  department: finDepId, managerId: null,    permissions: { view_all_tickets: true,  approve_finance: true,  export_reports: true,  view_analytics: true  } },
    { _id: alexId,    name: "Alex Morgan",     email: "alex.morgan@demo.expensly.dev",   role: "user",  department: engId,   managerId: null,    permissions: { view_all_tickets: true,  approve_finance: null,  export_reports: null,  view_analytics: null  } },
    { _id: jamieId,   name: "Jamie Taylor",    email: "jamie.taylor@demo.expensly.dev",  role: "user",  department: salesId, managerId: null,    permissions: { view_all_tickets: true,  approve_finance: null,  export_reports: null,  view_analytics: null  } },
    { _id: caseyId,   name: "Casey Lee",       email: "casey.lee@demo.expensly.dev",     role: "user",  department: mktId,   managerId: null,    permissions: { view_all_tickets: true,  approve_finance: null,  export_reports: null,  view_analytics: null  } },
    { _id: priyaId,   name: "Priya Sharma",    email: "priya.sharma@demo.expensly.dev",  role: "user",  department: engId,   managerId: alexId,  permissions: { view_all_tickets: null,  approve_finance: null,  export_reports: null,  view_analytics: null  } },
    { _id: tomId,     name: "Tom Wilson",      email: "tom.wilson@demo.expensly.dev",    role: "user",  department: engId,   managerId: alexId,  permissions: { view_all_tickets: null,  approve_finance: null,  export_reports: null,  view_analytics: null  } },
    { _id: emmaId,    name: "Emma Davis",      email: "emma.davis@demo.expensly.dev",    role: "user",  department: salesId, managerId: jamieId, permissions: { view_all_tickets: null,  approve_finance: null,  export_reports: null,  view_analytics: null  } },
    { _id: carlosId,  name: "Carlos Garcia",   email: "carlos.garcia@demo.expensly.dev", role: "user",  department: salesId, managerId: jamieId, permissions: { view_all_tickets: null,  approve_finance: null,  export_reports: null,  view_analytics: null  } },
    { _id: lisaId,    name: "Lisa Zhang",      email: "lisa.zhang@demo.expensly.dev",    role: "user",  department: mktId,   managerId: caseyId, permissions: { view_all_tickets: null,  approve_finance: null,  export_reports: null,  view_analytics: null  } },
  ];

  const users = usersRaw.map(u => {
    // Priya gets the Finance Approver policy individually (backup finance approver persona).
    // This overrides the Engineering dept's Standard policy for her specifically.
    const isPriva = u._id.equals(priyaId);
    return {
      ...u,
      orgId,
      passwordHash,
      departmentSnapshot: deptSnapFor(u.department),
      managerSnapshot: mgrSnapFor(u.managerId),
      policyId:       isPriva ? policyFinanceId : null,
      policySnapshot: isPriva ? { _id: policyFinanceId, name: "Finance Approver Policy", grants: FINANCE_GRANTS } : null,
      isDisabled: false,
      createdAt: weeksAgo(16),
      updatedAt: weeksAgo(16),
    };
  });
  await col.users.insertMany(users);
  console.log(`✓ 10 users`);

  // ── Approval helpers ──────────────────────────────────────────────────────

  const pendingApproval = {
    required: true, approved: null,
    reviewedBy: null, reviewerSnapshot: null, reviewedAt: null, comments: null,
  };

  const approvedBy = (reviewerId: Types.ObjectId, at: Date, comments: string | null = null) => ({
    required: true, approved: true,
    reviewedBy: reviewerId, reviewerSnapshot: userSnap(reviewerId), reviewedAt: at, comments,
  });

  const rejectedBy = (reviewerId: Types.ObjectId, at: Date, comments: string) => ({
    required: true, approved: false,
    reviewedBy: reviewerId, reviewerSnapshot: userSnap(reviewerId), reviewedAt: at, comments,
  });

  // ── AI validation helpers ─────────────────────────────────────────────────

  const nullSuggestions = {
    suggestedTitle: null, suggestedAmount: null, suggestedCurrency: null,
    suggestedDate: null, suggestedMerchantName: null, suggestedCategoryName: null,
    suggestedDescription: null, unmatchedMerchantSuggestionText: null, unmatchedCategorySuggestionText: null,
  };

  // Default for non-draft tickets: 3 standard checks all passing
  const aiPassed = (base: Date) => ({
    status: "passed",
    checks: [
      { label: "Amount reasonableness", passed: true,  confidence: 0.91, detail: null },
      { label: "Category match",        passed: true,  confidence: 0.94, detail: null },
      { label: "Merchant verification", passed: true,  confidence: 0.88, detail: null },
    ],
    summary: "All checks passed. Expense appears legitimate and policy-compliant.",
    validatedAt: hoursLater(base, 2).toISOString(),
    ...nullSuggestions,
  });

  type AiCheck = { label: string; passed: boolean; confidence: number; detail: string | null };

  const aiFlagged = (base: Date, checks: AiCheck[], summary: string) => ({
    status: "flagged",
    checks,
    summary,
    validatedAt: hoursLater(base, 1).toISOString(),
    ...nullSuggestions,
  });

  // ── Bundle IDs pre-declared so tickets can reference them ─────────────────
  const bundle1Id   = new Types.ObjectId();
  const bundle2Id   = new Types.ObjectId();
  const bundle3Id   = new Types.ObjectId();
  const bundle1Name = "Priya's Q1 Conference & Travel";
  const bundle2Name = "Tom's Equipment Bundle";
  const bundle3Name = "Emma's Sales Q1 Draft";

  // ── Ticket builder ────────────────────────────────────────────────────────

  type ApprovalObj = {
    required: boolean; approved: boolean | null;
    reviewedBy: Types.ObjectId | null; reviewerSnapshot: { _id: Types.ObjectId; name: string; email: string } | null;
    reviewedAt: Date | null; comments: string | null;
  };

  type TicketParams = {
    title: string;
    submittedBy: Types.ObjectId;
    submitterManagerId: Types.ObjectId | null;
    dept: Types.ObjectId; deptName: string;
    amount: number; currency: string;
    merchant: Types.ObjectId | null; merchantName: string | null;
    category: Types.ObjectId; categoryName: string;
    status: string;
    flagged?: boolean;
    managerApproval: ApprovalObj | null;
    financeApproval: ApprovalObj | null;
    expenseType?: string;
    tags?: string[];
    description?: string;
    createdAt: Date; updatedAt: Date;
    bundleId?: Types.ObjectId | null;
    bundleName?: string | null;
    aiValidation?: ReturnType<typeof aiPassed> | ReturnType<typeof aiFlagged> | null;
  };

  const buildTicket = (id: Types.ObjectId, p: TicketParams) => ({
    _id: id,
    title: p.title,
    submittedBy: p.submittedBy,
    submitterManagerId: p.submitterManagerId,
    orgId,
    amount: p.amount,
    currency: p.currency,
    department: p.dept,
    description: p.description ?? `Business expense — ${p.title.toLowerCase()}`,
    tags: p.tags ?? [],
    receiptIds: [],
    status: p.status,
    flagged: p.flagged ?? false,
    managerApproval: p.managerApproval,
    financeApproval: p.financeApproval,
    exchangeRateSnapshotId: p.status === "approved" ? rateSnapshotId : null,
    merchant: p.merchant,
    category: p.category,
    bundleId: p.bundleId ?? null,
    expenseType: p.expenseType ?? "regular",
    ocrData: null,
    // draft → null; explicit override wins; all other statuses default to aiPassed
    aiValidation: p.aiValidation !== undefined
      ? p.aiValidation
      : (p.status === "draft" ? null : aiPassed(p.createdAt)),
    submitterSnapshot:  userSnap(p.submittedBy),
    departmentSnapshot: { _id: p.dept, name: p.deptName },
    merchantSnapshot:   p.merchant ? { _id: p.merchant, name: p.merchantName } : null,
    categorySnapshot:   { _id: p.category, name: p.categoryName },
    bundleSnapshot:     p.bundleId ? { _id: p.bundleId, name: p.bundleName } : null,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  });

  // ── Ticket IDs ────────────────────────────────────────────────────────────
  const [
    t1,  t2,  t3,               // draft:            tom, lisa, emma
    t4,  t5,  t6,  t7,  t8,    // pending:           priya, carlos(flag), tom(flag), emma, lisa
    t9,  t10, t11, t12,         // awaiting_finance:  priya, tom, emma, carlos
    t13, t14,                   // approved (bundle1): priya × 2
    t15, t16,                   // approved:          tom × 2  (t16 in bundle2)
    t17,                        // approved:          alex
    t18, t19,                   // approved:          emma
    t20, t21,                   // approved:          carlos
    t22,                        // approved:          jamie
    t23,                        // approved:          lisa
    t24,                        // approved:          casey
    t25, t26, t27,              // rejected:          tom, carlos, lisa
  ] = Array.from({ length: 30 }, () => new Types.ObjectId());

  const ticketDocs = [

    // ── Draft (3) ──────────────────────────────────────────────────────────
    buildTicket(t1, {
      title: "Flight to SF Engineering Conference",
      submittedBy: tomId, submitterManagerId: alexId,
      dept: engId, deptName: "Engineering",
      amount: 450, currency: "USD",
      merchant: mIds["Delta Airlines"], merchantName: "Delta Airlines",
      category: catIds["Travel"], categoryName: "Travel",
      status: "draft", managerApproval: null, financeApproval: null,
      tags: ["conference", "travel"],
      createdAt: daysAgo(3), updatedAt: daysAgo(3),
    }),
    buildTicket(t2, {
      title: "Q2 Campaign Print Materials",
      submittedBy: lisaId, submitterManagerId: caseyId,
      dept: mktId, deptName: "Marketing",
      amount: 320, currency: "USD",
      merchant: mIds["Amazon"], merchantName: "Amazon",
      category: catIds["Office Supplies"], categoryName: "Office Supplies",
      status: "draft", managerApproval: null, financeApproval: null,
      tags: ["marketing", "q2"],
      createdAt: daysAgo(2), updatedAt: daysAgo(2),
    }),
    buildTicket(t3, {
      title: "Salesforce CRM License Renewal",
      submittedBy: emmaId, submitterManagerId: jamieId,
      dept: salesId, deptName: "Sales",
      amount: 250, currency: "EUR",
      merchant: mIds["Salesforce"], merchantName: "Salesforce",
      category: catIds["Software & Subscriptions"], categoryName: "Software & Subscriptions",
      status: "draft", managerApproval: null, financeApproval: null,
      bundleId: bundle3Id, bundleName: bundle3Name,
      tags: ["software", "recurring"],
      createdAt: daysAgo(4), updatedAt: daysAgo(4),
    }),

    // ── Pending — awaiting manager approval (5) ────────────────────────────
    buildTicket(t4, {
      title: "AWS Summit Hotel — 3 Nights",
      submittedBy: priyaId, submitterManagerId: alexId,
      dept: engId, deptName: "Engineering",
      amount: 380, currency: "USD",
      merchant: mIds["Airbnb"], merchantName: "Airbnb",
      category: catIds["Accommodation"], categoryName: "Accommodation",
      status: "pending",
      managerApproval: pendingApproval, financeApproval: pendingApproval,
      tags: ["conference"],
      createdAt: daysAgo(5), updatedAt: daysAgo(5),
    }),
    buildTicket(t5, {
      title: "Client Business Lunch (8 Attendees)",
      submittedBy: carlosId, submitterManagerId: jamieId,
      dept: salesId, deptName: "Sales",
      amount: 95, currency: "USD",
      merchant: null, merchantName: null,
      category: catIds["Food & Beverages"], categoryName: "Food & Beverages",
      status: "pending", flagged: true,
      managerApproval: pendingApproval, financeApproval: pendingApproval,
      description: "Business lunch with key clients from Acme Corp. 8 attendees. Itemized receipt attached.",
      tags: ["client-facing"],
      createdAt: daysAgo(6), updatedAt: daysAgo(1),
      aiValidation: aiFlagged(daysAgo(6), [
        { label: "Amount reasonableness", passed: true,  confidence: 0.89, detail: "$11.88 per person is within the meal policy limit" },
        { label: "Category match",        passed: true,  confidence: 0.95, detail: null },
        { label: "Receipt attached",      passed: false, confidence: 0.97, detail: "No receipt uploaded for this expense — required for group meals" },
        { label: "Group meal disclosure", passed: false, confidence: 0.83, detail: "Attendee names and business purpose not provided" },
      ], "Flagged: Group meal expense is missing receipt and attendee list. Upload itemized receipt to proceed."),
    }),
    buildTicket(t6, {
      title: `MacBook Pro 16" — Engineering Workstation`,
      submittedBy: tomId, submitterManagerId: alexId,
      dept: engId, deptName: "Engineering",
      amount: 2499, currency: "USD",
      merchant: mIds["Apple"], merchantName: "Apple",
      category: catIds["Equipment"], categoryName: "Equipment",
      status: "pending", flagged: true,
      managerApproval: pendingApproval, financeApproval: pendingApproval,
      description: "Replacement workstation — current machine is 4 years old, CTO pre-approved via email.",
      tags: ["equipment", "pre-approved"],
      createdAt: daysAgo(7), updatedAt: daysAgo(2),
      aiValidation: aiFlagged(daysAgo(7), [
        { label: "Amount reasonableness", passed: false, confidence: 0.97, detail: "Amount $2,499 exceeds the standard equipment budget threshold of $1,500 per item" },
        { label: "Pre-approval required", passed: false, confidence: 0.95, detail: "Equipment purchases over $1,000 require documented pre-approval before purchase" },
        { label: "Category match",        passed: true,  confidence: 0.98, detail: null },
        { label: "Merchant verification", passed: true,  confidence: 0.99, detail: "Apple is a verified merchant in the system" },
      ], "Flagged: High-value equipment purchase exceeds policy limit. Pre-approval documentation must be attached before manager review."),
    }),
    buildTicket(t7, {
      title: "Sales Conference Uber Rides",
      submittedBy: emmaId, submitterManagerId: jamieId,
      dept: salesId, deptName: "Sales",
      amount: 180, currency: "USD",
      merchant: mIds["Uber"], merchantName: "Uber",
      category: catIds["Travel"], categoryName: "Travel",
      status: "pending",
      managerApproval: pendingApproval, financeApproval: pendingApproval,
      bundleId: bundle3Id, bundleName: bundle3Name,
      expenseType: "mileage",
      tags: ["conference", "travel"],
      createdAt: daysAgo(4), updatedAt: daysAgo(4),
    }),
    buildTicket(t8, {
      title: "LinkedIn Ads — Q2 Campaign",
      submittedBy: lisaId, submitterManagerId: caseyId,
      dept: mktId, deptName: "Marketing",
      amount: 500, currency: "EUR",
      merchant: null, merchantName: null,
      category: catIds["Software & Subscriptions"], categoryName: "Software & Subscriptions",
      status: "pending",
      managerApproval: pendingApproval, financeApproval: pendingApproval,
      tags: ["marketing", "q2"],
      createdAt: daysAgo(3), updatedAt: daysAgo(3),
    }),

    // ── Awaiting Finance — manager approved (4) ────────────────────────────
    buildTicket(t9, {
      title: "React Advanced Conference 2024",
      submittedBy: priyaId, submitterManagerId: alexId,
      dept: engId, deptName: "Engineering",
      amount: 299, currency: "USD",
      merchant: mIds["Udemy"], merchantName: "Udemy",
      category: catIds["Training & Education"], categoryName: "Training & Education",
      status: "awaiting_finance",
      managerApproval: approvedBy(alexId, daysAgo(10)),
      financeApproval: pendingApproval,
      tags: ["training", "conference"],
      createdAt: daysAgo(14), updatedAt: daysAgo(10),
    }),
    buildTicket(t10, {
      title: "Ergonomic Office Chair — WFH Setup",
      submittedBy: tomId, submitterManagerId: alexId,
      dept: engId, deptName: "Engineering",
      amount: 349, currency: "USD",
      merchant: mIds["Amazon"], merchantName: "Amazon",
      category: catIds["Office Supplies"], categoryName: "Office Supplies",
      status: "awaiting_finance",
      managerApproval: approvedBy(alexId, daysAgo(9)),
      financeApproval: pendingApproval,
      bundleId: bundle2Id, bundleName: bundle2Name,
      tags: ["wfh", "equipment"],
      createdAt: daysAgo(12), updatedAt: daysAgo(9),
    }),
    buildTicket(t11, {
      title: "Salesforce Annual Subscription",
      submittedBy: emmaId, submitterManagerId: jamieId,
      dept: salesId, deptName: "Sales",
      amount: 1200, currency: "USD",
      merchant: mIds["Salesforce"], merchantName: "Salesforce",
      category: catIds["Software & Subscriptions"], categoryName: "Software & Subscriptions",
      status: "awaiting_finance",
      managerApproval: approvedBy(jamieId, daysAgo(8)),
      financeApproval: pendingApproval,
      tags: ["software", "recurring", "pre-approved"],
      createdAt: daysAgo(11), updatedAt: daysAgo(8),
    }),
    buildTicket(t12, {
      title: "Client Dinner — Acme Corp Partnership",
      submittedBy: carlosId, submitterManagerId: jamieId,
      dept: salesId, deptName: "Sales",
      amount: 450, currency: "USD",
      merchant: mIds["WeWork"], merchantName: "WeWork",
      category: catIds["Entertainment"], categoryName: "Entertainment",
      status: "awaiting_finance",
      managerApproval: approvedBy(jamieId, daysAgo(7)),
      financeApproval: pendingApproval,
      tags: ["client-facing", "entertainment"],
      createdAt: daysAgo(10), updatedAt: daysAgo(7),
    }),

    // ── Approved (12) — spread across last 12 weeks for chart data ──────────
    buildTicket(t13, {
      title: "Google Cloud Platform Credits",
      submittedBy: priyaId, submitterManagerId: alexId,
      dept: engId, deptName: "Engineering",
      amount: 500, currency: "USD",
      merchant: mIds["Google Cloud"], merchantName: "Google Cloud",
      category: catIds["Software & Subscriptions"], categoryName: "Software & Subscriptions",
      status: "approved",
      managerApproval: approvedBy(alexId,    hoursLater(weeksAgo(10), 12)),
      financeApproval: approvedBy(financeId, hoursLater(weeksAgo(10), 36)),
      bundleId: bundle1Id, bundleName: bundle1Name,
      tags: ["cloud", "recurring"],
      createdAt: weeksAgo(10), updatedAt: hoursLater(weeksAgo(10), 36),
    }),
    buildTicket(t14, {
      title: "Flight — NYC Client Visit",
      submittedBy: priyaId, submitterManagerId: alexId,
      dept: engId, deptName: "Engineering",
      amount: 320, currency: "USD",
      merchant: mIds["Delta Airlines"], merchantName: "Delta Airlines",
      category: catIds["Travel"], categoryName: "Travel",
      status: "approved",
      managerApproval: approvedBy(alexId,    hoursLater(weeksAgo(7), 8)),
      financeApproval: approvedBy(financeId, hoursLater(weeksAgo(7), 24)),
      bundleId: bundle1Id, bundleName: bundle1Name,
      tags: ["travel", "client-facing"],
      createdAt: weeksAgo(7), updatedAt: hoursLater(weeksAgo(7), 24),
    }),
    buildTicket(t15, {
      title: "NodeConf EU 2024 — Conference Ticket",
      submittedBy: tomId, submitterManagerId: alexId,
      dept: engId, deptName: "Engineering",
      amount: 799, currency: "USD",
      merchant: mIds["Udemy"], merchantName: "Udemy",
      category: catIds["Training & Education"], categoryName: "Training & Education",
      status: "approved",
      managerApproval: approvedBy(alexId,    hoursLater(weeksAgo(9), 10)),
      financeApproval: approvedBy(financeId, hoursLater(weeksAgo(9), 30)),
      tags: ["conference", "training"],
      createdAt: weeksAgo(9), updatedAt: hoursLater(weeksAgo(9), 30),
    }),
    buildTicket(t16, {
      title: "Mechanical Keyboard + Ultrawide Monitor",
      submittedBy: tomId, submitterManagerId: alexId,
      dept: engId, deptName: "Engineering",
      amount: 280, currency: "USD",
      merchant: mIds["Amazon"], merchantName: "Amazon",
      category: catIds["Equipment"], categoryName: "Equipment",
      status: "approved",
      managerApproval: approvedBy(alexId,    hoursLater(weeksAgo(6), 6)),
      financeApproval: approvedBy(financeId, hoursLater(weeksAgo(6), 18)),
      bundleId: bundle2Id, bundleName: bundle2Name,
      tags: ["equipment", "wfh"],
      createdAt: weeksAgo(6), updatedAt: hoursLater(weeksAgo(6), 18),
    }),
    buildTicket(t17, {
      title: "Engineering Team Lunch — Sprint Retro",
      submittedBy: alexId, submitterManagerId: null,
      dept: engId, deptName: "Engineering",
      amount: 245, currency: "USD",
      merchant: null, merchantName: null,
      category: catIds["Food & Beverages"], categoryName: "Food & Beverages",
      status: "approved",
      managerApproval: approvedBy(adminId,   hoursLater(weeksAgo(5), 4)),
      financeApproval: approvedBy(financeId, hoursLater(weeksAgo(5), 12)),
      tags: ["team-event"],
      createdAt: weeksAgo(5), updatedAt: hoursLater(weeksAgo(5), 12),
    }),
    buildTicket(t18, {
      title: "Sales Summit Hotel — 4 Nights",
      submittedBy: emmaId, submitterManagerId: jamieId,
      dept: salesId, deptName: "Sales",
      amount: 680, currency: "USD",
      merchant: mIds["Airbnb"], merchantName: "Airbnb",
      category: catIds["Accommodation"], categoryName: "Accommodation",
      status: "approved",
      managerApproval: approvedBy(jamieId,   hoursLater(weeksAgo(11), 8)),
      financeApproval: approvedBy(financeId, hoursLater(weeksAgo(11), 24)),
      tags: ["conference", "travel"],
      createdAt: weeksAgo(11), updatedAt: hoursLater(weeksAgo(11), 24),
    }),
    buildTicket(t19, {
      title: "Outbound Sales Mastery Course",
      submittedBy: emmaId, submitterManagerId: jamieId,
      dept: salesId, deptName: "Sales",
      amount: 199, currency: "USD",
      merchant: mIds["Udemy"], merchantName: "Udemy",
      category: catIds["Training & Education"], categoryName: "Training & Education",
      status: "approved",
      managerApproval: approvedBy(jamieId,   hoursLater(weeksAgo(7), 6)),
      financeApproval: approvedBy(financeId, hoursLater(weeksAgo(7), 20)),
      tags: ["training"],
      createdAt: weeksAgo(7), updatedAt: hoursLater(weeksAgo(7), 20),
    }),
    buildTicket(t20, {
      title: "Q1 Client Entertainment Dinner",
      submittedBy: carlosId, submitterManagerId: jamieId,
      dept: salesId, deptName: "Sales",
      amount: 320, currency: "USD",
      merchant: null, merchantName: null,
      category: catIds["Entertainment"], categoryName: "Entertainment",
      status: "approved",
      managerApproval: approvedBy(jamieId,   hoursLater(weeksAgo(6), 10)),
      financeApproval: approvedBy(financeId, hoursLater(weeksAgo(6), 28)),
      tags: ["client-facing", "entertainment"],
      createdAt: weeksAgo(6), updatedAt: hoursLater(weeksAgo(6), 28),
    }),
    buildTicket(t21, {
      title: "SaaStr Annual Trade Show Booth",
      submittedBy: carlosId, submitterManagerId: jamieId,
      dept: salesId, deptName: "Sales",
      amount: 2500, currency: "USD",
      merchant: null, merchantName: null,
      category: catIds["Entertainment"], categoryName: "Entertainment",
      status: "approved",
      managerApproval: approvedBy(jamieId,   hoursLater(weeksAgo(10), 16)),
      financeApproval: approvedBy(financeId, hoursLater(weeksAgo(10), 48)),
      tags: ["trade-show", "marketing"],
      createdAt: weeksAgo(10), updatedAt: hoursLater(weeksAgo(10), 48),
    }),
    buildTicket(t22, {
      title: "Q1 Sales Kickoff — Flight",
      submittedBy: jamieId, submitterManagerId: null,
      dept: salesId, deptName: "Sales",
      amount: 450, currency: "USD",
      merchant: mIds["Delta Airlines"], merchantName: "Delta Airlines",
      category: catIds["Travel"], categoryName: "Travel",
      status: "approved",
      managerApproval: approvedBy(adminId,   hoursLater(weeksAgo(11), 8)),
      financeApproval: approvedBy(financeId, hoursLater(weeksAgo(11), 20)),
      tags: ["travel", "conference"],
      createdAt: weeksAgo(11), updatedAt: hoursLater(weeksAgo(11), 20),
    }),
    buildTicket(t23, {
      title: "Adobe Creative Cloud — Annual License",
      submittedBy: lisaId, submitterManagerId: caseyId,
      dept: mktId, deptName: "Marketing",
      amount: 599, currency: "USD",
      merchant: null, merchantName: null,
      category: catIds["Software & Subscriptions"], categoryName: "Software & Subscriptions",
      status: "approved",
      managerApproval: approvedBy(caseyId,   hoursLater(weeksAgo(8), 6)),
      financeApproval: approvedBy(financeId, hoursLater(weeksAgo(8), 18)),
      tags: ["software", "recurring"],
      createdAt: weeksAgo(8), updatedAt: hoursLater(weeksAgo(8), 18),
    }),
    buildTicket(t24, {
      title: "Marketing Summit India — Flight & Hotel",
      submittedBy: caseyId, submitterManagerId: null,
      dept: mktId, deptName: "Marketing",
      amount: 74500, currency: "INR",
      merchant: mIds["Airbnb"], merchantName: "Airbnb",
      category: catIds["Accommodation"], categoryName: "Accommodation",
      status: "approved",
      managerApproval: approvedBy(adminId,   hoursLater(weeksAgo(7), 10)),
      financeApproval: approvedBy(financeId, hoursLater(weeksAgo(7), 30)),
      tags: ["travel", "conference"],
      createdAt: weeksAgo(7), updatedAt: hoursLater(weeksAgo(7), 30),
    }),

    // ── Rejected (3) ───────────────────────────────────────────────────────
    buildTicket(t25, {
      title: "Gaming Chair for Home Office",
      submittedBy: tomId, submitterManagerId: alexId,
      dept: engId, deptName: "Engineering",
      amount: 799, currency: "USD",
      merchant: mIds["Amazon"], merchantName: "Amazon",
      category: catIds["Office Supplies"], categoryName: "Office Supplies",
      status: "rejected",
      managerApproval: rejectedBy(alexId, daysAgo(20), "Personal item — gaming chairs are not eligible business expenses."),
      financeApproval: pendingApproval,
      tags: ["equipment"],
      createdAt: daysAgo(22), updatedAt: daysAgo(20),
      aiValidation: aiFlagged(daysAgo(22), [
        { label: "Amount reasonableness", passed: true,  confidence: 0.84, detail: null },
        { label: "Category match",        passed: false, confidence: 0.79, detail: "Gaming chairs are typically personal items; business justification required for Office Supplies categorisation" },
        { label: "Merchant verification", passed: true,  confidence: 0.91, detail: null },
      ], "Flagged: Gaming chair may not qualify as a business expense. Provide justification or recategorise."),
    }),
    buildTicket(t26, {
      title: "Las Vegas Networking Trip",
      submittedBy: carlosId, submitterManagerId: jamieId,
      dept: salesId, deptName: "Sales",
      amount: 1800, currency: "USD",
      merchant: null, merchantName: null,
      category: catIds["Entertainment"], categoryName: "Entertainment",
      status: "rejected",
      managerApproval: rejectedBy(jamieId, daysAgo(18), "Las Vegas trips are not on the approved expense list. Please refer to the Travel & Entertainment Policy."),
      financeApproval: pendingApproval,
      tags: ["travel", "entertainment"],
      createdAt: daysAgo(21), updatedAt: daysAgo(18),
      aiValidation: aiFlagged(daysAgo(21), [
        { label: "Amount reasonableness", passed: false, confidence: 0.93, detail: "Amount $1,800 exceeds the $500 per-event entertainment policy limit" },
        { label: "Business purpose",      passed: false, confidence: 0.81, detail: "Las Vegas is not listed as an approved business travel destination; unclear conference or client engagement" },
        { label: "Category match",        passed: true,  confidence: 0.87, detail: null },
      ], "Flagged: High entertainment expense with no verifiable business purpose. Manager review required."),
    }),
    buildTicket(t27, {
      title: "Personal MacBook Air M3",
      submittedBy: lisaId, submitterManagerId: caseyId,
      dept: mktId, deptName: "Marketing",
      amount: 1599, currency: "USD",
      merchant: mIds["Apple"], merchantName: "Apple",
      category: catIds["Equipment"], categoryName: "Equipment",
      status: "rejected",
      managerApproval: approvedBy(caseyId,  daysAgo(15)),
      financeApproval: rejectedBy(financeId, daysAgo(13), "Equipment over $1,000 requires pre-approval from the finance team before purchase."),
      tags: ["equipment"],
      createdAt: daysAgo(17), updatedAt: daysAgo(13),
      aiValidation: aiFlagged(daysAgo(17), [
        { label: "Pre-approval required", passed: false, confidence: 0.96, detail: "Equipment purchases over $1,000 require a pre-approval reference number in the description" },
        { label: "Category match",        passed: true,  confidence: 0.98, detail: null },
        { label: "Merchant verification", passed: true,  confidence: 0.99, detail: "Apple is a verified merchant in the system" },
      ], "Flagged: No pre-approval reference found. Finance team approval required for equipment over $1,000."),
    }),
  ];

  await col.tickets.insertMany(ticketDocs);
  console.log(`✓ 30 tickets`);

  // ── Bundles ───────────────────────────────────────────────────────────────
  // Each bundle contains only the creator's own tickets.

  const bundle1Amount = 500 + 320; // t13 + t14 (USD)
  const bundle2Amount = 349 + 280; // t10 + t16 (USD)
  const bundle3Amount = Math.round((250 / (liveRates["EUR"] ?? 0.92) + 180) * 100) / 100; // t3 EUR→USD + t7 USD

  const bundles = [
    {
      _id: bundle1Id, orgId,
      title: bundle1Name,
      description: "Q1 approved expenses — GCP credits and client travel",
      submitter: userSnap(priyaId),
      status: "approved",
      totalAmountBase: bundle1Amount,
      baseCurrency: "USD",
      ticketCount: 2,
      tags: ["q1", "travel"],
      managerApproval: approvedBy(alexId,    hoursLater(weeksAgo(9), 12)),
      financeApproval: approvedBy(financeId, hoursLater(weeksAgo(9), 36)),
      createdAt: weeksAgo(10),
      updatedAt: hoursLater(weeksAgo(9), 36),
    },
    {
      _id: bundle2Id, orgId,
      title: bundle2Name,
      description: "Engineering equipment and workspace expenses",
      submitter: userSnap(tomId),
      status: "submitted",
      totalAmountBase: bundle2Amount,
      baseCurrency: "USD",
      ticketCount: 2,
      tags: ["equipment", "wfh"],
      managerApproval: approvedBy(alexId, daysAgo(8)),
      financeApproval: pendingApproval,
      createdAt: daysAgo(12),
      updatedAt: daysAgo(8),
    },
    {
      _id: bundle3Id, orgId,
      title: bundle3Name,
      description: "Draft bundle — Emma's Q1 sales expenses pending submission",
      submitter: userSnap(emmaId),
      status: "draft",
      totalAmountBase: bundle3Amount,
      baseCurrency: "USD",
      ticketCount: 2,
      tags: ["sales", "q1"],
      managerApproval: null,
      financeApproval: null,
      createdAt: daysAgo(5),
      updatedAt: daysAgo(5),
    },
  ];
  await col.bundles.insertMany(bundles);
  console.log(`✓ 3 bundles`);

  // ── Discussion Messages ───────────────────────────────────────────────────
  // Three threads: t5 (Carlos flagged lunch), t6 (Tom MacBook), t26 (Carlos Vegas rejection)

  const deptSnapForUser = (uid: Types.ObjectId): { _id: Types.ObjectId; name: string } | null => {
    if (uid.equals(priyaId) || uid.equals(tomId)   || uid.equals(alexId))  return { _id: engId,    name: "Engineering" };
    if (uid.equals(emmaId)  || uid.equals(carlosId) || uid.equals(jamieId)) return { _id: salesId,  name: "Sales" };
    if (uid.equals(lisaId)  || uid.equals(caseyId))                         return { _id: mktId,    name: "Marketing" };
    if (uid.equals(financeId))                                               return { _id: finDepId, name: "Finance" };
    return null;
  };

  const buildMsg = (ticketId: Types.ObjectId, authorId: Types.ObjectId, text: string, createdAt: Date) => {
    const u = userInfo[authorId.toString()];
    return {
      _id: new Types.ObjectId(),
      ticketId, orgId,
      author: { _id: authorId, name: u.name, email: u.email, role: u.role },
      authorDeptSnapshot: deptSnapForUser(authorId),
      text,
      editedAt: null, deletedAt: null,
      createdAt, updatedAt: createdAt,
    };
  };

  const messageDocs = [
    // t5: Carlos flagged client lunch
    buildMsg(t5, adminId,   "This amount seems high for a client lunch. Please provide an itemized receipt.",                                    daysAgo(5)),
    buildMsg(t5, carlosId,  "Hi! I've attached the itemized receipt — there were 8 clients present from Acme Corp.",                            hoursLater(daysAgo(5), 3)),
    buildMsg(t5, adminId,   "Receipt verified. Unflagging and forwarding to your manager for approval.",                                         hoursLater(daysAgo(5), 5)),

    // t6: Tom MacBook flagged
    buildMsg(t6, alexId,  "Tom, this exceeds the standard equipment budget. Can you confirm you have prior CTO approval?",                       daysAgo(6)),
    buildMsg(t6, tomId,   "Hi Alex — yes, I have email confirmation from David (CTO) approving this as a replacement workstation.",             hoursLater(daysAgo(6), 2)),
    buildMsg(t6, alexId,  "Confirmed. Will review the CTO email and proceed with approval pending finance sign-off.",                            hoursLater(daysAgo(6), 4)),

    // t26: Carlos Vegas rejected
    buildMsg(t26, jamieId,  "Carlos, can you clarify the business purpose for this trip?",                                                       daysAgo(20)),
    buildMsg(t26, carlosId, "This was for a networking event — I met several potential clients at the venue.",                                   hoursLater(daysAgo(20), 4)),
    buildMsg(t26, jamieId,  "Networking trips to Las Vegas are not on the approved expense list. Rejecting — please refer to the T&E Policy.",  hoursLater(daysAgo(20), 8)),
  ];
  await col.messages.insertMany(messageDocs);
  console.log(`✓ 9 discussion messages (3 threads)`);

  // ── Audit Logs ────────────────────────────────────────────────────────────
  const auditDocs: object[] = [];

  const audit = (
    entityType: string,
    entityId: Types.ObjectId,
    action: string,
    performer: Types.ObjectId,
    createdAt: Date,
    metadata: Record<string, unknown> = {},
  ) => {
    const u = userInfo[performer.toString()];
    auditDocs.push({
      _id: new Types.ObjectId(),
      orgId, entityType, entityId, action,
      performer: { _id: performer, name: u.name },
      ip: "127.0.0.1",
      metadata, createdAt,
    });
  };

  // User creation events
  for (const u of usersRaw) {
    audit("user", u._id, "user_created", adminId, weeksAgo(16), { email: u.email, role: u.role });
  }

  // Ticket created + status transition events
  for (const t of ticketDocs) {
    const tid  = t._id as Types.ObjectId;
    const sub  = t.submittedBy as Types.ObjectId;
    const cat  = t.createdAt as Date;
    const stat = t.status as string;

    audit("ticket", tid, "created", sub, cat);

    if (stat === "draft") continue;

    // All non-draft tickets were submitted (pending)
    audit("ticket", tid, "status_changed", sub, cat, { newStatus: "pending" });

    const mgA = t.managerApproval as Record<string, unknown> | null;
    if (mgA?.reviewedBy) {
      const mgAction = mgA.approved ? "status_changed" : "rejected";
      const newStatus = mgA.approved ? "awaiting_finance" : "rejected";
      audit("ticket", tid, mgAction, mgA.reviewedBy as Types.ObjectId, mgA.reviewedAt as Date, { newStatus });
    }

    const fnA = t.financeApproval as Record<string, unknown> | null;
    if (fnA?.reviewedBy) {
      const fnAction = fnA.approved ? "status_changed" : "rejected";
      const newStatus = fnA.approved ? "approved" : "rejected";
      audit("ticket", tid, fnAction, fnA.reviewedBy as Types.ObjectId, fnA.reviewedAt as Date, { newStatus });
    }
  }

  // Flagged events
  audit("ticket", t5, "flagged", adminId, hoursLater(daysAgo(6), 1));
  audit("ticket", t5, "unflagged", adminId, hoursLater(daysAgo(5), 5));
  audit("ticket", t6, "flagged", adminId, hoursLater(daysAgo(7), 2));

  // Discussion message events
  for (const m of messageDocs) {
    audit("ticket", m.ticketId, "commented", m.author._id as Types.ObjectId, m.createdAt as Date);
  }

  // Bundle events
  audit("bundle", bundle1Id, "created",  priyaId,   weeksAgo(10));
  audit("bundle", bundle1Id, "approved", alexId,    hoursLater(weeksAgo(9), 12));
  audit("bundle", bundle1Id, "approved", financeId, hoursLater(weeksAgo(9), 36));
  audit("bundle", bundle2Id, "created",  tomId,     daysAgo(12));
  audit("bundle", bundle2Id, "approved", alexId,    daysAgo(8));
  audit("bundle", bundle3Id, "created",  emmaId,    daysAgo(5));

  await col.auditlogs.insertMany(auditDocs);
  console.log(`✓ ${auditDocs.length} audit log entries`);

  // ── Update Department.spent ───────────────────────────────────────────────
  // Exchange rates: amount / rateVsUSD gives the USD equivalent
  const toUSD = (amount: number, currency: string) =>
    amount / (liveRates[currency] ?? 1);

  const spentByDept: Record<string, number> = {};
  for (const t of ticketDocs) {
    if (t.status !== "approved") continue;
    const key = (t.department as Types.ObjectId).toString();
    spentByDept[key] = (spentByDept[key] ?? 0) + toUSD(t.amount as number, t.currency as string);
  }
  for (const [deptId, spent] of Object.entries(spentByDept)) {
    await col.depts.updateOne(
      { _id: new Types.ObjectId(deptId) },
      { $set: { spent: Math.round(spent * 100) / 100, updatedAt: new Date() } },
    );
  }
  console.log(`✓ Department spent totals updated`);

  // ── Analytics refresh ─────────────────────────────────────────────────────
  console.log("\nRefreshing org analytics…");
  try {
    const org = await Organization.findById(orgId);
    if (org) {
      await refreshOrgAnalytics(org);
      console.log("✓ Analytics snapshot computed");
    }
  } catch (err) {
    console.warn(`⚠ Analytics refresh skipped (${(err as Error).message}) — the hourly cron will handle it`);
  }

  // ── Write credentials ─────────────────────────────────────────────────────
  const credentials = {
    password: DEMO_PASSWORD,
    note: "All demo users share this password",
    organization: { id: orgId.toString(), name: "Expensly Demo", slug: DEMO_SLUG },
    users: [
      { role: "admin",   email: "admin@demo.expensly.dev",         name: "Admin User",      note: "Full permissions incl. finance approval" },
      { role: "user",    email: "finance@demo.expensly.dev",       name: "Finance Officer", department: "Finance", note: "Finance dept user with explicit approve_finance + all finance permissions" },
      { role: "manager", email: "alex.morgan@demo.expensly.dev",   name: "Alex Morgan",    department: "Engineering", note: "Engineering manager — approves team tickets" },
      { role: "manager", email: "jamie.taylor@demo.expensly.dev",  name: "Jamie Taylor",   department: "Sales",       note: "Sales manager" },
      { role: "manager", email: "casey.lee@demo.expensly.dev",     name: "Casey Lee",      department: "Marketing",   note: "Marketing manager" },
      { role: "user",    email: "priya.sharma@demo.expensly.dev",  name: "Priya Sharma",   department: "Engineering", note: "Has approved bundle + awaiting_finance ticket" },
      { role: "user",    email: "tom.wilson@demo.expensly.dev",    name: "Tom Wilson",     department: "Engineering", note: "Has 2 flagged pending tickets + rejected ticket" },
      { role: "user",    email: "emma.davis@demo.expensly.dev",    name: "Emma Davis",     department: "Sales",       note: "Has draft bundle with 2 tickets" },
      { role: "user",    email: "carlos.garcia@demo.expensly.dev", name: "Carlos Garcia",  department: "Sales",       note: "Has flagged ticket with 3-message discussion thread" },
      { role: "user",    email: "lisa.zhang@demo.expensly.dev",    name: "Lisa Zhang",     department: "Marketing",   note: "Has ticket rejected at finance level" },
    ],
  };

  const credsPath = join(__dirname, "..", "..", "seed-demo-credentials.json");
  writeFileSync(credsPath, JSON.stringify(credentials, null, 2));

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`
═══════════════════════════════════════════════════
  ✅  Demo seed complete in ${elapsed}s
  📋  Credentials → backend/seed-demo-credentials.json
═══════════════════════════════════════════════════

  Key demo accounts (password: ${DEMO_PASSWORD}):
  ┌──────────────────────────────────────────────┐
  │  Admin:    admin@demo.expensly.dev           │
  │  Finance:  finance@demo.expensly.dev (user)  │
  │  Manager:  alex.morgan@demo.expensly.dev     │
  │  User:     priya.sharma@demo.expensly.dev    │
  └──────────────────────────────────────────────┘

  What's seeded:
  • 1 org · 4 departments · 8 categories · 10 merchants
  • 10 users (1 admin · 1 finance user · 3 managers · 5 staff)
  • 30 tickets across all statuses:
      draft(3) pending(5) awaiting_finance(4)
      approved(12, spread over 12 wks) rejected(3)
  • 3 bundles: approved / submitted / draft
  • 2 flagged tickets with 3-message discussion threads
  • ${auditDocs.length} audit log entries
  • Analytics snapshot ready for dashboard
`);

  // Disconnect Redis (opened by refreshOrgAnalytics → cache.service) and Mongoose
  try { await getRedisClient().quit(); } catch { /* Redis wasn't used — no-op */ }
  await mongoose.disconnect();
}

main().catch(err => {
  console.error("\n❌  Demo seed failed:", err);
  process.exit(1);
});
