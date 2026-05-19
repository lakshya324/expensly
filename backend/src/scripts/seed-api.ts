/**
 * API-based seed script - creates a complete org dataset by calling backend REST APIs.
 * No direct DB access except reading login OTPs from Redis (necessary since OTP is sent
 * via email and cannot be intercepted programmatically otherwise).
 *
 * What it creates (one run):
 *   1 organization · 1 admin
 *   15 categories · 20 merchants · 1 policy
 *   5 departments · 5 managers (1/dept) · 50 users (10/dept)
 *   100,000 tickets with realistic status distribution
 *   20 bundles (from approved tickets)
 *
 * Usage:
 *   cd backend
 *   DISABLE_RATE_LIMIT=true npx tsx src/scripts/seed-api.ts --super-email you@example.com --super-pass YourPassword
 *
 *   # Or set env vars (CLI args take precedence):
 *   DISABLE_RATE_LIMIT=true SUPER_ADMIN_EMAIL=you@example.com SUPER_ADMIN_PASSWORD=YourPassword npx tsx src/scripts/seed-api.ts
 *
 * Environment:
 *   DISABLE_RATE_LIMIT - set to "true" to bypass rate limiting (required for bulk seeding)
 *   SUPER_ADMIN_EMAIL / SUPER_ADMIN_PASSWORD - super admin credentials (required if not via CLI)
 *   REDIS_URL          - defaults to redis://localhost:6379
 *   SEED_API_URL       - defaults to http://localhost:3000/api
 */

import "dotenv/config";
import { Redis } from "ioredis";
import { writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ── Tunable ───────────────────────────────────────────────────────────────────
const API_BASE    = process.env["SEED_API_URL"] ?? "http://localhost:3000/api";
const SEED_PASS   = "Seed@1234";
const CONCURRENCY = 150;     // parallel API calls for bulk ticket creation/approvals
// const TICKETS     = 1_000;
const TICKETS = 100;
const BUNDLES     = 5;

// ── Static pools ──────────────────────────────────────────────────────────────
const ORG_NAME   = "DevSeed Corp";
const ORG_SLUG   = "devseed-corp";
const ADMIN_EMAIL = "admin@devseed.dev";
const ADMIN_NAME  = "Seed Admin";

const DEPT_NAMES = [
  "Engineering", "Sales", "Marketing", "Operations", "Finance",
] as const;

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
  "Business trip to New York",       "Client dinner at The Capital",
  "AWS cloud subscription renewal",  "Office supplies Q1",
  "Team lunch for project kickoff",  "Conference registration fee",
  "Hotel stay for product summit",   "Uber rides for client visit",
  "Salesforce license renewal",      "Marketing campaign materials",
  "Training workshop registration",  "Team building event expenses",
  "Laptop & accessories purchase",   "Domain & hosting renewal",
  "Legal consultation fees",         "Healthcare reimbursement",
  "International flight to London",  "Co-working space monthly rental",
  "Sales conference expenses",       "Quarterly SaaS subscription",
];

const CURRENCIES     = ["USD", "EUR", "GBP", "INR", "AUD", "CAD", "SGD"] as const;
const EXPENSE_TYPES  = ["regular", "per_diem", "mileage"] as const;
const TAGS_POOL      = [
  "q1-2025", "q2-2025", "q3-2025", "q4-2025", "q1-2026",
  "travel", "remote", "client-facing", "internal", "recurring", "reimbursable",
];
const REJECTION_COMMENTS = [
  "Budget exceeded for this quarter",
  "Insufficient business justification",
  "Missing original receipt",
  "Duplicate submission",
  "Policy violation - personal expense",
];
const BUNDLE_PREFIXES = ["Q1", "Q2", "Q3", "Q4"] as const;
const BUNDLE_TOPICS   = ["Travel", "Client", "Marketing", "Engineering", "Operations"] as const;

// Status distribution (must sum to 100)
const STATUS_DIST: { status: string; pct: number }[] = [
  { status: "approved",         pct: 40 },
  { status: "pending",          pct: 22 },
  { status: "awaiting_finance", pct: 18 },
  { status: "rejected",         pct: 12 },
  { status: "draft",            pct:  8 },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function rand<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randAmount(): number {
  const r = Math.random();
  if (r < 0.6) return Math.round(randInt(10, 500) * 100) / 100;
  if (r < 0.9) return Math.round(randInt(500, 3_000) * 100) / 100;
  return Math.round(randInt(3_000, 15_000) * 100) / 100;
}

const NOW         = Date.now();
const ONE_YR_AGO  = NOW - 365 * 24 * 60 * 60_000;
const randomDate  = () => new Date(ONE_YR_AGO + Math.random() * (NOW - ONE_YR_AGO)).toISOString();

function pickTags(): string[] {
  const n = randInt(0, 3);
  const s = new Set<string>();
  for (let i = 0; i < n; i++) s.add(rand(TAGS_POOL));
  return [...s];
}

function sleep(ms: number) {
  return new Promise<void>(r => setTimeout(r, ms));
}

// ── Stats tracker ─────────────────────────────────────────────────────────────

interface PhaseStat { label: string; count: number; ms: number }
const stats: PhaseStat[] = [];

async function track<T>(label: string, fn: () => Promise<{ data: T; count: number }>): Promise<T> {
  const t = Date.now();
  process.stdout.write(`  → ${label}…`);
  const { data, count } = await fn();
  const ms = Date.now() - t;
  const countStr = count > 0 ? ` ${count.toLocaleString()}` : "";
  process.stdout.write(`${countStr} ✓  ${(ms / 1_000).toFixed(1)}s\n`);
  stats.push({ label, count, ms });
  return data;
}

// ── API client ────────────────────────────────────────────────────────────────

type Method = "GET" | "POST" | "PATCH" | "DELETE";

async function api(method: Method, path: string, body?: unknown, token?: string): Promise<any> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = token;

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${method} ${path} → HTTP ${res.status}: ${text.slice(0, 200)}`);
  }

  return res.json();
}

// ── OTP-based login ───────────────────────────────────────────────────────────

async function login(
  email: string,
  password: string,
  redis: Redis,
): Promise<{ token: string; userId: string }> {
  const step1 = await api("POST", "/auth/login", { email, password });
  const userId: string = step1.data.userId;

  // OTP is written to Redis immediately after the login call; poll briefly if needed
  let otp: string | undefined;
  for (let i = 0; i < 15; i++) {
    const raw = await redis.get(`otp:${userId}`);
    if (raw) {
      try { otp = (JSON.parse(raw) as { otp: string }).otp; }
      catch { otp = raw; }
      break;
    }
    await sleep(150);
  }
  if (!otp) throw new Error(`OTP not found in Redis for ${email} (userId: ${userId})`);

  const step2 = await api("POST", "/auth/verify-otp", { userId, otp });
  return { token: step2.data.accessToken as string, userId };
}

// ── Concurrent batch runner ───────────────────────────────────────────────────

async function runBatched<T>(
  tasks: Array<() => Promise<T>>,
  concurrency: number,
  label: string,
): Promise<T[]> {
  const results: T[] = [];
  const total = tasks.length;
  let done = 0;

  for (let i = 0; i < total; i += concurrency) {
    const settled = await Promise.allSettled(
      tasks.slice(i, i + concurrency).map(t => t()),
    );
    for (const r of settled) {
      if (r.status === "fulfilled") results.push(r.value);
    }
    done = Math.min(i + concurrency, total);
    process.stdout.write(`\r    ${label}: ${done.toLocaleString()} / ${total.toLocaleString()}`);
  }
  process.stdout.write(`\r    ${label}: ${results.length.toLocaleString()} / ${total.toLocaleString()} ✓\n`);
  return results;
}

// ── Main ──────────────────────────────────────────────────────────────────────

function parseArgs(): { superEmail?: string; superPass?: string } {
  const argv = process.argv.slice(2);
  const get  = (flag: string) => {
    const i = argv.indexOf(flag);
    return i !== -1 ? argv[i + 1] : undefined;
  };
  return {
    superEmail: get("--super-email"),
    superPass:  get("--super-pass"),
  };
}

async function main() {
  const args       = parseArgs();
  const superEmail = args.superEmail ?? process.env["SUPER_ADMIN_EMAIL"];
  const superPass  = args.superPass  ?? process.env["SUPER_ADMIN_PASSWORD"];

  if (!superEmail || !superPass) {
    console.error(
      "❌  Super admin credentials required.\n" +
      "    Pass via CLI:  --super-email <email> --super-pass <password>\n" +
      "    Or via .env:   SUPER_ADMIN_EMAIL / SUPER_ADMIN_PASSWORD",
    );
    process.exit(1);
  }

  const redis = new Redis(process.env["REDIS_URL"] ?? "redis://localhost:6379");
  const totalStart = Date.now();

  if (process.env["NODE_ENV"] !== "development") {
    console.warn(
      "⚠️   DISABLE RATE LIMIT is not set - the auth rate limiter (100 req/15 min) may\n" +
      "    block logins before all seeded users are created. Set NODE_ENV=development on\n" +
      "    the backend server (or restart it with that env var) before running this script.\n",
    );
  }

  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log(`  API Seed  ›  ${ORG_NAME}`);
  console.log(`  Endpoint  ›  ${API_BASE}`);
  console.log(`  Tickets   ›  ${TICKETS.toLocaleString()} (${STATUS_DIST.map(s => `${s.pct}% ${s.status}`).join(", ")})`);
  console.log("═══════════════════════════════════════════════════════════════\n");

  // ┌─────────────────────────────────────────────────────────────────────────┐
  // │  Phase 1 - Super admin login                                            │
  // └─────────────────────────────────────────────────────────────────────────┘
  console.log("Phase 1 - Auth");
  const { token: superToken } = await track("Super admin login", async () => {
    const r = await login(superEmail, superPass, redis);
    return { data: r, count: 0 };
  });

  // ┌─────────────────────────────────────────────────────────────────────────┐
  // │  Phase 2 - Organization                                                 │
  // └─────────────────────────────────────────────────────────────────────────┘
  console.log("\nPhase 2 - Organization");
  const orgId = await track("Create organization", async () => {
    const r = await api("POST", "/superadmin/organizations", {
      name: ORG_NAME,
      slug: ORG_SLUG,
      baseCurrency: "USD",
    }, superToken);
    return { data: r.data._id as string, count: 0 };
  });

  // ┌─────────────────────────────────────────────────────────────────────────┐
  // │  Phase 3 - Admin user                                                   │
  // └─────────────────────────────────────────────────────────────────────────┘
  console.log("\nPhase 3 - Admin");
  await track("Create admin via super admin", async () => {
    await api("POST", "/superadmin/users", {
      name: ADMIN_NAME,
      email: ADMIN_EMAIL,
      password: SEED_PASS,
      role: "admin",
      orgId,
    }, superToken);
    return { data: null, count: 0 };
  });

  const { token: adminToken } = await track("Admin login", async () => {
    const r = await login(ADMIN_EMAIL, SEED_PASS, redis);
    return { data: r, count: 0 };
  });

  // ┌─────────────────────────────────────────────────────────────────────────┐
  // │  Phase 4 - Catalogue (categories, merchants, policy)                    │
  // └─────────────────────────────────────────────────────────────────────────┘
  console.log("\nPhase 4 - Catalogue");

  const categoryIds = await track("Create categories", async () => {
    // Org creation fires seedSystemCategories non-blocking - fetch to avoid duplicates
    const existing = await api("GET", "/admin/categories", undefined, adminToken);
    const existingMap = new Map<string, string>(
      (existing.data as any[]).map((c: any) => [c.name.toLowerCase(), c._id as string]),
    );
    const ids: string[] = [];
    let created = 0;
    for (const name of CATEGORY_NAMES) {
      const existingId = existingMap.get(name.toLowerCase());
      if (existingId) {
        ids.push(existingId);
      } else {
        const r = await api("POST", "/admin/categories", {
          name,
          description: `Expenses related to ${name.toLowerCase()}`,
        }, adminToken);
        ids.push(r.data._id as string);
        created++;
      }
    }
    return { data: ids, count: created };
  });

  const merchantIds = await track("Create merchants", async () => {
    // Defensive: fetch existing merchants to avoid any potential duplicates
    const existing = await api("GET", "/admin/merchants", undefined, adminToken);
    const existingMap = new Map<string, string>(
      (existing.data as any[]).map((m: any) => [m.name.toLowerCase(), m._id as string]),
    );
    const ids: string[] = [];
    let created = 0;
    for (const name of MERCHANT_NAMES) {
      const existingId = existingMap.get(name.toLowerCase());
      if (existingId) {
        ids.push(existingId);
      } else {
        const r = await api("POST", "/admin/merchants", { name }, adminToken);
        ids.push(r.data._id as string);
        created++;
      }
    }
    return { data: ids, count: created };
  });

  const policyId = await track("Create finance policy", async () => {
    const r = await api("POST", "/admin/policies", {
      name: "Finance Approvers",
      description: "Grants view, approve-finance, export, and analytics rights",
      grants: ["view_all_tickets", "approve_finance", "export_reports", "view_analytics"],
    }, adminToken);
    return { data: r.data._id as string, count: 0 };
  });

  void policyId; // available if needed for dept/user assignment later

  // ┌─────────────────────────────────────────────────────────────────────────┐
  // │  Phase 5 - Departments                                                  │
  // └─────────────────────────────────────────────────────────────────────────┘
  console.log("\nPhase 5 - Departments");

  const depts = await track("Create departments", async () => {
    const list: { id: string; name: string }[] = [];
    for (const name of DEPT_NAMES) {
      const r = await api("POST", "/admin/departments", {
        name,
        budget: randInt(50_000, 500_000),
        budgetResetPeriod: "monthly",
        approvalThresholds: { USD: randInt(500, 5_000) },
      }, adminToken);
      list.push({ id: r.data._id as string, name });
    }
    return { data: list, count: list.length };
  });

  // ┌─────────────────────────────────────────────────────────────────────────┐
  // │  Phase 6 - Managers                                                     │
  // └─────────────────────────────────────────────────────────────────────────┘
  console.log("\nPhase 6 - Managers");

  interface Manager { id: string; deptId: string; token: string; email: string }

  const managers = await track("Create & login managers (5)", async () => {
    const list: Manager[] = [];
    for (const dept of depts) {
      const key   = dept.name.toLowerCase().replace(/\s+/g, "");
      const email = `mgr.${key}@devseed.dev`;
      const r     = await api("POST", "/admin/users", {
        name:       `${dept.name} Manager`,
        email,
        password:   SEED_PASS,
        department: dept.id,
      }, adminToken);
      const mgrId: string = r.data._id;

      await sleep(200); // breathing room between OTP logins
      const { token } = await login(email, SEED_PASS, redis);
      list.push({ id: mgrId, deptId: dept.id, token, email });
    }
    return { data: list, count: list.length };
  });

  const mgrByDept = new Map(managers.map(m => [m.deptId, m]));

  // ┌─────────────────────────────────────────────────────────────────────────┐
  // │  Phase 7 - Regular users                                                │
  // └─────────────────────────────────────────────────────────────────────────┘
  console.log("\nPhase 7 - Regular users");

  interface UserInfo { id: string; deptId: string; managerId: string; token: string }

  const users = await track("Create & login users (50)", async () => {
    const list: UserInfo[] = [];
    for (const dept of depts) {
      const key = dept.name.toLowerCase().replace(/\s+/g, "");
      const mgr = mgrByDept.get(dept.id)!;
      for (let j = 1; j <= 10; j++) {
        const email = `user${j}.${key}@devseed.dev`;
        const r = await api("POST", "/admin/users", {
          name:       `${dept.name} User ${j}`,
          email,
          password:   SEED_PASS,
          department: dept.id,
          managerId:  mgr.id,
        }, adminToken);
        const userId: string = r.data._id;

        await sleep(150);
        const { token } = await login(email, SEED_PASS, redis);
        list.push({ id: userId, deptId: dept.id, managerId: mgr.id, token });
      }
    }
    return { data: list, count: list.length };
  });

  // ┌─────────────────────────────────────────────────────────────────────────┐
  // │  Phase 8 - Tickets (100k)                                               │
  // └─────────────────────────────────────────────────────────────────────────┘
  console.log("\nPhase 8 - Tickets");

  // Build a shuffled list of target statuses
  const targetStatuses: string[] = [];
  for (const { status, pct } of STATUS_DIST) {
    const n = Math.round(TICKETS * pct / 100);
    for (let i = 0; i < n; i++) targetStatuses.push(status);
  }
  for (let i = targetStatuses.length - 1; i > 0; i--) {
    const j = randInt(0, i);
    [targetStatuses[i], targetStatuses[j]] = [targetStatuses[j], targetStatuses[i]];
  }

  // Queues for post-creation approval actions
  const toApprove:      string[]                               = [];
  const toReject:       string[]                               = [];
  const toAwaitFinance: { ticketId: string; deptId: string }[] = [];
  const toBundlePool:   string[]                               = []; // pending tickets for bundles

  const ticketStart = Date.now();
  process.stdout.write(`  → Creating ${TICKETS.toLocaleString()} tickets…\n`);

  const ticketTasks = targetStatuses.map((targetStatus, idx) => async () => {
    const user   = users[idx % users.length];
    const isDraft = targetStatus === "draft";

    const r = await api("POST", "/users/expenses", {
      statusIntent: isDraft ? "draft" : "pending",
      title:        rand(TICKET_TITLES),
      amount:       randAmount(),
      currency:     rand(CURRENCIES),
      department:   user.deptId,
      description:  `Business expense - ${rand(TICKET_TITLES).toLowerCase()}`,
      merchant:     rand(merchantIds),
      category:     rand(categoryIds),
      tags:         pickTags(),
      expenseType:  rand(EXPENSE_TYPES),
      timestamp:    randomDate(),
    }, user.token);

    const ticketId: string = r.data._id;
    if (targetStatus === "approved")         toApprove.push(ticketId);
    else if (targetStatus === "rejected")    toReject.push(ticketId);
    else if (targetStatus === "awaiting_finance")
      toAwaitFinance.push({ ticketId, deptId: user.deptId });
    else if (targetStatus === "pending" && toBundlePool.length < 300)
      toBundlePool.push(ticketId);

    return ticketId;
  });

  await runBatched(ticketTasks, CONCURRENCY, "tickets");
  stats.push({ label: "Create tickets", count: TICKETS, ms: Date.now() - ticketStart });

  // ┌─────────────────────────────────────────────────────────────────────────┐
  // │  Phase 9 - Approvals                                                    │
  // └─────────────────────────────────────────────────────────────────────────┘
  console.log("\nPhase 9 - Approvals");

  const approvalStart = Date.now();

  // Admin directly approves (admin role bypasses manager step automatically)
  process.stdout.write(`  → Admin approving ${toApprove.length.toLocaleString()} tickets…\n`);
  await runBatched(
    toApprove.map(id => () =>
      api("PATCH", `/users/expenses/${id}/status`, { status: "approved" }, adminToken).catch(() => null),
    ),
    CONCURRENCY,
    "approved",
  );

  // Admin rejects
  process.stdout.write(`  → Admin rejecting ${toReject.length.toLocaleString()} tickets…\n`);
  await runBatched(
    toReject.map(id => () =>
      api("PATCH", `/users/expenses/${id}/status`, {
        status:   "rejected",
        comments: rand(REJECTION_COMMENTS),
      }, adminToken).catch(() => null),
    ),
    CONCURRENCY,
    "rejected",
  );

  // Manager moves to awaiting_finance
  process.stdout.write(`  → Managers moving ${toAwaitFinance.length.toLocaleString()} tickets to awaiting_finance…\n`);
  await runBatched(
    toAwaitFinance.map(({ ticketId, deptId }) => () => {
      const mgr = mgrByDept.get(deptId);
      if (!mgr) return Promise.resolve(null);
      return api("PATCH", `/users/expenses/${ticketId}/status`, {
        status: "awaiting_finance",
      }, mgr.token).catch(() => null);
    }),
    CONCURRENCY,
    "awaiting_finance",
  );

  stats.push({
    label: "Approvals (approve + reject + awaiting_finance)",
    count: toApprove.length + toReject.length + toAwaitFinance.length,
    ms:    Date.now() - approvalStart,
  });

  // ┌─────────────────────────────────────────────────────────────────────────┐
  // │  Phase 10 - Bundles                                                     │
  // └─────────────────────────────────────────────────────────────────────────┘
  console.log("\nPhase 10 - Bundles");

  await track(`Create, submit & approve ${BUNDLES} bundles`, async () => {
    const bundlePool = [...toBundlePool]; // pending tickets - eligible to be bundled
    let created = 0;

    for (let b = 0; b < BUNDLES && bundlePool.length >= 5; b++) {
      const size  = randInt(5, 15);
      const slice = bundlePool.splice(0, size);
      const user  = users[b % users.length];
      const title = `${rand(BUNDLE_PREFIXES)} ${rand(BUNDLE_TOPICS)} Expenses Bundle`;

      try {
        // Create
        const bRes = await api("POST", "/users/bundles", {
          name:        title,
          description: "Bundled expense report for finance review",
          tags:        pickTags(),
        }, user.token);
        const bundleId: string = bRes.data._id;

        // Add tickets
        await api("POST", `/users/bundles/${bundleId}/tickets`, { ticketIds: slice }, user.token);

        // Submit
        await api("POST", `/users/bundles/${bundleId}/submit`, {}, user.token);

        // Admin approves both steps
        await api("PATCH", `/users/bundles/${bundleId}/status`, {
          step: "manager", action: "approve",
        }, adminToken);
        await api("PATCH", `/users/bundles/${bundleId}/status`, {
          step: "finance", action: "approve",
        }, adminToken);

        created++;
      } catch {
        // Non-fatal - continue with next bundle
      }
    }

    return { data: created, count: created };
  });

  // ┌─────────────────────────────────────────────────────────────────────────┐
  // │  Credentials file                                                       │
  // └─────────────────────────────────────────────────────────────────────────┘
  const credsPath = join(__dirname, "..", "..", "seed-api-credentials.json");
  writeFileSync(credsPath, JSON.stringify({
    note:       "All seeded users share the same password",
    password:   SEED_PASS,
    superAdmin: { email: superEmail },
    organization: {
      id:   orgId,
      name: ORG_NAME,
      admin: { email: ADMIN_EMAIL, name: ADMIN_NAME, role: "admin" },
      managers: managers.map(m => ({
        email:      m.email,
        department: depts.find(d => d.id === m.deptId)?.name,
      })),
      sampleUsers: users.slice(0, 10).map((u, i) => ({
        email:      `user${(i % 10) + 1}.${depts.find(d => d.id === u.deptId)?.name.toLowerCase().replace(/\s+/g, "")}@devseed.dev`,
        department: depts.find(d => d.id === u.deptId)?.name,
      })),
    },
  }, null, 2));

  // ┌─────────────────────────────────────────────────────────────────────────┐
  // │  Summary                                                                │
  // └─────────────────────────────────────────────────────────────────────────┘
  const totalMs = Date.now() - totalStart;

  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log("  ✅  Seeding complete");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("\n  Phase breakdown:");

  const colW = Math.max(...stats.map(s => s.label.length)) + 2;
  for (const s of stats) {
    const label = s.label.padEnd(colW, ".");
    const count = s.count > 0 ? s.count.toLocaleString().padStart(10) : "          ";
    const time  = `${(s.ms / 1_000).toFixed(2)}s`.padStart(8);
    console.log(`    ${label}  ${count}  ${time}`);
  }

  console.log(`\n  Total: ${(totalMs / 1_000).toFixed(1)}s  (${(totalMs / 60_000).toFixed(1)} min)`);
  console.log(`  Credentials saved → seed-api-credentials.json`);
  console.log("═══════════════════════════════════════════════════════════════\n");

  await redis.disconnect();
}

main().catch(err => {
  console.error(`\n❌  Seed failed: ${(err as Error).message ?? err}`);
  process.exit(1);
});
