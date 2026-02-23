# Data Models

Complete reference for all MongoDB collections — field definitions, constraints, relationships, and key business logic tied to the data layer.

---

## Table of Contents

1. [Organization](#organization)
2. [User](#user)
3. [Department](#department)
4. [Ticket (Expense)](#ticket-expense)
5. [ExchangeRateSnapshot](#exchangeratesnapshot)
6. [OrgAnalytics](#organalytics)
7. [RefreshToken](#refreshtoken)
8. [Report](#report)
9. [Relationships Diagram](#relationships-diagram)
10. [Budget Lifecycle](#budget-lifecycle)
11. [Approval State Machine](#approval-state-machine)

---

## Organization

**Collection:** `organizations`

| Field | Type | Constraints | Description |
|---|---|---|---|
| `_id` | ObjectId | Primary key | Auto-generated |
| `name` | String | Required, trimmed | Display name of the organization |
| `slug` | String | Required, unique, lowercase | URL-safe identifier |
| `isDisabled` | Boolean | Default `false` | Super admin can disable entire org |
| `baseCurrency` | String (enum) | Default `USD` | All analytics converted to this currency |
| `activeCurrencies` | [String] | Default `[USD, EUR, GBP, INR]` | Currencies available for expense submission |
| `currentRateSnapshotId` | ObjectId → ExchangeRateSnapshot | Nullable | Points to the currently active rate snapshot |
| `createdAt` | Date | Auto | Mongoose timestamp |
| `updatedAt` | Date | Auto | Mongoose timestamp |

**Notes:**
- `slug` is used as the S3 path prefix: `expensly/<slug>/...`
- When an org is disabled, all authentication for its users is blocked at the `authenticate` middleware.
- A new org and its admin are both created in a disabled state on signup, pending super admin approval.

---

## User

**Collection:** `users`

| Field | Type | Constraints | Description |
|---|---|---|---|
| `_id` | ObjectId | Primary key | |
| `name` | String | Required | Full display name |
| `email` | String | Required, unique, lowercase | Login credential |
| `passwordHash` | String | Required | bcrypt hash (rounds 12) |
| `role` | Enum | `user \| admin \| super_admin` | Access control role |
| `orgId` | ObjectId → Organization | Null for `super_admin` | Tenant scope |
| `department` | ObjectId → Department | Optional | Assigned department |
| `managerId` | ObjectId → User | Optional | Direct manager for approval chain |
| `permissions.canViewAllTickets` | Boolean \| null | Default `null` | `null` = fall back to dept default |
| `permissions.canApprove` | Boolean \| null | Default `null` | `null` = fall back to dept default |
| `isDisabled` | Boolean | Default `false` | Admin or super admin can disable |
| `createdAt` | Date | Auto | |
| `updatedAt` | Date | Auto | |

**Permission Resolution (most specific wins):**
```
canApprove =
  user.permissions.canApprove !== null
    ? user.permissions.canApprove
    : department.permissions.canApprove
```

---

## Department

**Collection:** `departments`

| Field | Type | Constraints | Description |
|---|---|---|---|
| `_id` | ObjectId | Primary key | |
| `orgId` | ObjectId → Organization | Required, indexed | Tenant scope |
| `name` | String | Required, unique per org | Department display name |
| `budget` | Number | Default `0`, min `0` | Total budget in org's `baseCurrency` |
| `spent` | Number | Default `0`, min `0` | Running total of approved expenses (base currency) |
| `approvalThresholds` | Map\<currencyCode, Number\> | Optional | If `amount >= threshold[currency]`, manager approval is required. If key absent, manager approval always required (when manager exists). |
| `permissions.canViewAllTickets` | Boolean | Default `false` | Dept-wide default — overridable per user |
| `permissions.canApprove` | Boolean | Default `false` | Dept-wide default — overridable per user |
| `tags` | [String] | Default `[]` | Available tags for ticket submission |
| `budgetResetPeriod` | Enum | `none \| monthly \| quarterly \| yearly` | Automatic `spent` reset cadence |
| `nextResetDate` | Date | Nullable | Computed on save; used by cron |
| `isActive` | Boolean | Default `true` | Soft delete flag |
| `createdAt` | Date | Auto | |
| `updatedAt` | Date | Auto | |

---

## Ticket (Expense)

**Collection:** `tickets`

| Field | Type | Constraints | Description |
|---|---|---|---|
| `_id` | ObjectId | Primary key | |
| `orgId` | ObjectId → Organization | Required, indexed | Tenant scope |
| `title` | String | Required, max 100 | Short description of the expense |
| `description` | String | Optional, max 500 | Detailed notes |
| `submittedBy` | ObjectId → User | Required | Employee who submitted |
| `submitterManagerId` | ObjectId → User | Snapshot | Manager at time of submission (not live — captured so changes to managerId don't affect in-flight tickets) |
| `department` | ObjectId → Department | Required | Department to charge against |
| `amount` | Number | Required, min `0` | Expense amount in `currency` |
| `currency` | String (enum) | Required | ISO 4217 code from org's active currencies |
| `tags` | [String] | Default `[]` | User-selected tags |
| `receiptKey` | String | Optional | S3 object key for receipt file |
| `status` | Enum | `pending \| awaiting_finance \| approved \| rejected` | Current approval state |
| `flagged` | Boolean | Default `false` | Manually flagged for review |
| `managerApproval` | ApprovalSchema | Nullable | Present when manager approval is required |
| `financeApproval` | ApprovalSchema | Required | Always present |
| `exchangeRateSnapshotId` | ObjectId → ExchangeRateSnapshot | Set on approval | Locked rates for analytics consistency |
| `createdAt` | Date | Auto | Submission timestamp |
| `updatedAt` | Date | Auto | |

### Embedded ApprovalSchema

| Field | Type | Description |
|---|---|---|
| `required` | Boolean | Whether this approval step is part of the chain |
| `approved` | Boolean \| null | `null` = pending, `true` = approved, `false` = rejected |
| `reviewedBy` | ObjectId → User | Who reviewed |
| `reviewedAt` | Date | When reviewed |
| `comments` | String | Optional reviewer notes |

---

## ExchangeRateSnapshot

**Collection:** `exchangeratesnapshots`

| Field | Type | Constraints | Description |
|---|---|---|---|
| `_id` | ObjectId | Primary key | |
| `orgId` | ObjectId → Organization | Required, indexed | Tenant scope |
| `baseCurrency` | String | Required | The pivot currency for all rates |
| `rates` | Map\<String, Number\> | Required | `{ EUR: 0.92, INR: 83.5, ... }` — all relative to `baseCurrency = 1.0` |
| `source` | Enum | `manual \| fetched` | How the rates were set |
| `createdBy` | ObjectId → User | Required | Admin who triggered fetch or manual entry |
| `createdAt` | Date | Auto | |

**Notes:**
- A new snapshot is created on every update (manual or fetch) — old ones are preserved for historical ticket conversion.
- `rates` always includes `baseCurrency: 1.0` implicitly.
- When `convertAmount(amount, from, to, rates)`:
  - Convert `from → baseCurrency`: `amount / rates[from]`
  - Convert `baseCurrency → to`: multiply by `rates[to]`
  - Cross conversion: `(amount / rates[from]) * rates[to]`

---

## OrgAnalytics

**Collection:** `organalytics`

One document per organization (upserted on every analytics refresh).

| Field | Type | Description |
|---|---|---|
| `orgId` | ObjectId | Unique per org (upsert key) |
| `totalTickets` | Number | All tickets ever submitted |
| `totalApproved` | Number | |
| `totalRejected` | Number | |
| `totalPending` | Number | |
| `totalAwaitingFinance` | Number | |
| `totalAmountApproved` | Number | Sum of approved amounts in `baseCurrency` |
| `totalAmountPending` | Number | Sum of pending amounts in `baseCurrency` |
| `avgResolutionTimeMs` | Number | Mean time from `pending` to `approved\|rejected` |
| `topTags` | [{ tag, count }] | Top 10 most-used tags across all tickets |
| `currencyBreakdown` | [{ currency, total, count }] | Per-currency approved amounts |
| `departments` | [DepartmentAnalytics] | Per-department sub-documents |
| `lastUpdated` | Date | Timestamp of last refresh |

### Embedded DepartmentAnalytics

| Field | Type | Description |
|---|---|---|
| `departmentId` | ObjectId | |
| `name` | String | Department name (denormalized) |
| `budget` | Number | Current budget |
| `spent` | Number | Current running total |
| `budgetUsagePercent` | Number | `(spent / budget) * 100` |
| `ticketCount` | Number | Total tickets for this dept |
| `approvedAmount` | Number | Total approved in base currency |
| `avgResolutionTimeMs` | Number | |
| `topTags` | [{ tag, count }] | |

---

## RefreshToken

**Collection:** `refreshtokens`

| Field | Type | Constraints | Description |
|---|---|---|---|
| `_id` | ObjectId | Primary key | |
| `tokenHash` | String | Unique, indexed | SHA-256 hash of the opaque refresh token |
| `userId` | ObjectId → User | Required, indexed | Owner |
| `expiresAt` | Date | Required | MongoDB TTL index — document auto-deleted after expiry |
| `createdAt` | Date | Auto | |

**Security notes:**
- The raw token is delivered to the client via HttpOnly cookie.
- Only the SHA-256 hash is persisted; the server can never reconstruct the raw token.
- On refresh, the incoming token is hashed and looked up; if found and not expired, a new token pair is issued and the old hash is deleted (token rotation).

---

## Report

**Collection:** `reports`

| Field | Type | Constraints | Description |
|---|---|---|---|
| `_id` | ObjectId | Primary key | |
| `orgId` | ObjectId → Organization | Required, indexed | |
| `generatedBy` | ObjectId → User | Required | Who generated the report |
| `s3Key` | String | Required | S3 object key for CSV file |
| `filename` | String | Required | Human-readable file name |
| `ticketCount` | Number | Required | Number of rows in the CSV |
| `filters` | Object | Optional | Serialized filter state (`status`, `department`, `from`, `to`) |
| `createdAt` | Date | Auto | |

**Capping:** Each user may have at most 5 saved reports. When a 6th is generated, the oldest report document is deleted and its S3 object is removed.

---

## Relationships Diagram

```
Organization ──────────────────────────────────────────────────────────────────
    │                                                                    │
    ├── User[] (orgId)           ├── Department[] (orgId)                │
    │       │                   │         │                              │
    │       │ managerId ────────┘         │ dept budget/spend           │
    │       │                             │                              │
    ├── Ticket[] (orgId)                  │                              │
    │       │ department ─────────────────┘                             │
    │       │ submittedBy / submitterManagerId ── User                  │
    │       │ exchangeRateSnapshotId ─────────────────────────────── ExchangeRateSnapshot[] (orgId)
    │       │ managerApproval.reviewedBy / financeApproval.reviewedBy ── User
    │                                                                    │
    ├── OrgAnalytics (1:1 orgId)                                        │
    ├── Report[] (orgId / generatedBy ── User)                          │
    └── (currentRateSnapshotId) ───────────────────────────────────────┘
```

---

## Budget Lifecycle

```
Department created
  └── budget = N, spent = 0, nextResetDate = calculateNextResetDate(period)

Ticket approved
  └── department.spent += convertAmount(ticket.amount, ticket.currency, baseCurrency, rates)

Hourly cron
  └── Find depts where nextResetDate <= now and isActive = true
        └── spent = 0
        └── nextResetDate = calculateNextResetDate(period, now)

Manual reset (admin)
  └── Same as cron: spent = 0, nextResetDate recomputed
```

---

## Approval State Machine

```
Submit ticket
  └── Determine if manager approval is required:
        · submitter has a managerId AND
        · amount >= dept.approvalThresholds[currency] (or threshold not set)
      YES → status = 'pending',           managerApproval.required = true
      NO  → status = 'awaiting_finance',  managerApproval = null

Manager reviews (role: canApprove, managerId matches submitterManagerId)
  ├── Approve → status = 'awaiting_finance'
  └── Reject  → status = 'rejected'

Finance reviews (role: canApprove, any finance user with dept access)
  ├── Approve → status = 'approved'
  │               dept.spent += convertedAmount
  │               ticket.exchangeRateSnapshotId = org.currentRateSnapshotId
  │               analytics cache invalidated
  └── Reject  → status = 'rejected'
                  analytics cache invalidated
```
