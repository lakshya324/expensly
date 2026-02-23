# API Reference

Complete reference for every REST endpoint in the Expensly API.

**Base URL:** `http://localhost:3000/api` (development)

---

## Conventions

- All requests and responses use `Content-Type: application/json` unless noted.
- All authenticated routes require `Authorization: Bearer <access-token>` header.
- Successful responses return `{ success: true, data: {...} }`.
- Error responses return `{ success: false, error: { code: string, message: string } }`.
- Paginated responses return `{ success: true, data: { items: [...], total, page, limit, totalPages } }`.
- Timestamps are ISO 8601 strings.
- `orgId` / `userId` are always MongoDB ObjectId strings.

---

## Table of Contents

1. [Health](#health)
2. [Auth](#auth)
3. [Users — Expenses](#users--expenses)
4. [Users — Reports](#users--reports)
5. [Users — Departments](#users--departments)
6. [Admin — Users](#admin--users)
7. [Admin — Departments](#admin--departments)
8. [Admin — Exchange Rates](#admin--exchange-rates)
9. [Admin — Analytics](#admin--analytics)
10. [Super Admin — Organizations](#super-admin--organizations)
11. [Super Admin — Users](#super-admin--users)

---

## Health

### `GET /api/health`

Public. Returns server status.

**Response**
```json
{ "success": true, "data": { "status": "ok", "timestamp": "2025-01-01T00:00:00.000Z" } }
```

---

## Auth

All auth routes are public. A 100 req / 15 min rate limit applies to this path group.

---

### `POST /api/auth/signup`

Register a new organization and its admin user. Both start disabled until the super admin approves.

**Body**
```json
{
  "orgName": "Acme Corp",
  "orgSlug": "acme-corp",
  "adminName": "Alice",
  "adminEmail": "alice@acme.com",
  "adminPassword": "Str0ngP@ss!"
}
```

**Response `201`**
```json
{ "success": true, "data": { "message": "Signup successful. Awaiting super admin approval." } }
```

---

### `POST /api/auth/login`

Step 1 of 2FA. Validates credentials and sends a 6-digit OTP to the user's email.

**Body**
```json
{ "email": "alice@acme.com", "password": "Str0ngP@ss!" }
```

**Response `200`**
```json
{ "success": true, "data": { "userId": "<userId>", "message": "OTP sent to email." } }
```

---

### `POST /api/auth/verify-otp`

Step 2 of 2FA. Verifies the OTP and issues tokens.

**Body**
```json
{ "userId": "<userId>", "otp": "123456" }
```

**Response `200`** — Sets `expensly_refresh_token` HttpOnly cookie.
```json
{
  "success": true,
  "data": {
    "accessToken": "<jwt>",
    "user": { "id": "...", "name": "Alice", "email": "...", "role": "admin", "org": {...} }
  }
}
```

---

### `POST /api/auth/resend-otp`

Resends the login OTP.

**Body**
```json
{ "userId": "<userId>" }
```

**Response `200`**
```json
{ "success": true, "data": { "message": "OTP resent." } }
```

---

### `POST /api/auth/forgot-password`

Sends a password-reset OTP to the user's email.

**Body**
```json
{ "email": "alice@acme.com" }
```

**Response `200`**
```json
{ "success": true, "data": { "userId": "<userId>", "message": "Password reset OTP sent." } }
```

---

### `POST /api/auth/reset-password`

Verifies the reset OTP and sets a new password.

**Body**
```json
{ "userId": "<userId>", "otp": "654321", "newPassword": "NewP@ss1!" }
```

**Response `200`**
```json
{ "success": true, "data": { "message": "Password updated successfully." } }
```

---

### `POST /api/auth/refresh`

Rotates the refresh token. Reads `expensly_refresh_token` HttpOnly cookie.

**Body:** _(empty)_

**Response `200`** — Sets new `expensly_refresh_token` cookie.
```json
{ "success": true, "data": { "accessToken": "<new-jwt>" } }
```

---

### `POST /api/auth/logout`

Revokes the current refresh token.

**Body:** _(empty)_

**Response `200`** — Clears the cookie.
```json
{ "success": true, "data": { "message": "Logged out." } }
```

---

## Users — Expenses

**Auth:** Required. **Roles:** `user`, `admin`

---

### `GET /api/users/expenses`

Paginated list of expense tickets. Regular users see their own tickets by default; users/admins with `canViewAllTickets` see all department tickets.

**Query Parameters**

| Param | Type | Description |
|---|---|---|
| `page` | number | Default `1` |
| `limit` | number | Default `20`, max `100` |
| `status` | string | Filter by `pending \| awaiting_finance \| approved \| rejected` |
| `department` | string | ObjectId — filter by department |
| `flagged` | boolean | Filter flagged tickets |
| `from` | ISO date | Filter by submission date (start) |
| `to` | ISO date | Filter by submission date (end) |
| `search` | string | Text search on title and description |

**Response `200`**
```json
{
  "success": true,
  "data": {
    "items": [ /* Ticket objects */ ],
    "total": 42, "page": 1, "limit": 20, "totalPages": 3
  }
}
```

---

### `GET /api/users/expenses/stats`

Per-status ticket counts for the requesting user's scope.

**Response `200`**
```json
{ "success": true, "data": { "total": 10, "pending": 3, "awaiting_finance": 1, "approved": 5, "rejected": 1 } }
```

---

### `POST /api/users/expenses`

Submit a new expense. Accepts `multipart/form-data` to allow an optional receipt file.

**Body (multipart/form-data)**

| Field | Type | Required | Description |
|---|---|---|---|
| `title` | string | Yes | Max 100 chars |
| `amount` | number | Yes | Positive number |
| `currency` | string | Yes | ISO 4217 code from org's active currencies |
| `department` | string | Yes | Department ObjectId |
| `description` | string | No | Max 500 chars |
| `tags` | string (JSON array) | No | e.g. `["travel","meals"]` |
| `receipt` | file | No | Image or PDF, max 5 MB |

**Response `201`**
```json
{ "success": true, "data": { "ticket": { /* Ticket object */ } } }
```

---

### `GET /api/users/expenses/:id`

Get full details of a single expense ticket.

**Response `200`**
```json
{ "success": true, "data": { "ticket": { /* Ticket object with populated department, submittedBy */ } } }
```

---

### `PATCH /api/users/expenses/:id`

Update a ticket. Only the submitter can edit; only while `status = 'pending'`.

**Body** — any subset of create fields (title, amount, currency, description, tags, receipt).

**Response `200`**
```json
{ "success": true, "data": { "ticket": { /* Updated ticket */ } } }
```

---

### `DELETE /api/users/expenses/:id`

Delete a ticket. Only the submitter can delete; only while `status = 'pending'`.

**Response `200`**
```json
{ "success": true, "data": { "message": "Expense deleted." } }
```

---

### `PATCH /api/users/expenses/:id/flag`

Toggle the `flagged` boolean on a ticket. Requires `canApprove` permission.

**Body:** _(empty)_

**Response `200`**
```json
{ "success": true, "data": { "flagged": true } }
```

---

### `PATCH /api/users/expenses/:id/status`

Approve or reject a ticket. Requires `canApprove` permission.

**Body**
```json
{ "approved": true, "comments": "Looks good." }
```

**Response `200`**
```json
{ "success": true, "data": { "ticket": { /* Updated ticket */ } } }
```

---

### `GET /api/users/expenses/:id/receipt`

Get a pre-signed S3 URL to download the receipt (1 h expiry).

**Response `200`**
```json
{ "success": true, "data": { "url": "https://s3.amazonaws.com/..." } }
```

---

## Users — Reports

**Auth:** Required. **Roles:** `user`, `admin`

---

### `GET /api/users/reports`

List the last 5 saved CSV reports for the requesting user.

**Response `200`**
```json
{ "success": true, "data": { "reports": [ /* Report objects */ ] } }
```

---

### `GET /api/users/reports/export`

Generate a CSV of filtered tickets, upload it to S3, save metadata, and return a pre-signed download URL. Old reports beyond the 5-report limit are deleted automatically.

**Query Parameters** — same filters as `GET /expenses`.

**Response `200`**
```json
{ "success": true, "data": { "url": "https://s3.amazonaws.com/...", "report": { /* Report object */ } } }
```

---

### `POST /api/users/reports/:id/email`

Email a previously saved report to the requesting user's email address (as an attachment).

**Body:** _(empty)_

**Response `200`**
```json
{ "success": true, "data": { "message": "Report sent to your email." } }
```

---

## Users — Departments

**Auth:** Required. **Roles:** `user`, `admin`

---

### `GET /api/users/departments`

List active departments for the requesting user's organization.

**Response `200`**
```json
{ "success": true, "data": { "departments": [ { "id": "...", "name": "Engineering", "tags": [...] } ] } }
```

---

### `GET /api/users/departments/:id/tags`

Get available tags for a specific department.

**Response `200`**
```json
{ "success": true, "data": { "tags": ["travel", "meals", "software"] } }
```

---

## Admin — Users

**Auth:** Required. **Role:** `admin`

---

### `GET /api/admin/users`

Paginated list of users in the admin's organization.

**Query Parameters:** `page`, `limit`, `department` (ObjectId), `search`, `disabled` (boolean)

**Response `200`** — paginated `User` objects.

---

### `POST /api/admin/users`

Create a new user and send a welcome email with a temporary password.

**Body**
```json
{
  "name": "Bob",
  "email": "bob@acme.com",
  "password": "TempP@ss1!",
  "role": "user",
  "department": "<deptId>",
  "managerId": "<userId>"
}
```

**Response `201`**
```json
{ "success": true, "data": { "user": { /* User object */ } } }
```

---

### `PUT /api/admin/users/:id`

Update a user's name, department, or manager.

**Body** — any subset of `name`, `department`, `managerId`.

**Response `200`**

---

### `PATCH /api/admin/users/:id/disable`

Toggle a user's `isDisabled` state.

**Body:** _(empty)_

**Response `200`**
```json
{ "success": true, "data": { "isDisabled": true } }
```

---

### `PATCH /api/admin/users/:id/permissions`

Override fine-grained permissions for a user.

**Body**
```json
{ "canViewAllTickets": true, "canApprove": false }
```

**Response `200`**

---

## Admin — Departments

**Auth:** Required. **Role:** `admin`

---

### `GET /api/admin/departments`

Paginated list of all departments (including inactive).

**Query Parameters:** `page`, `limit`, `search`, `active` (boolean)

---

### `GET /api/admin/departments/:id`

Get full details of a single department.

---

### `POST /api/admin/departments`

Create a new department.

**Body**
```json
{
  "name": "Engineering",
  "budget": 50000,
  "budgetResetPeriod": "monthly",
  "approvalThresholds": { "USD": 500, "INR": 40000 },
  "permissions": { "canViewAllTickets": false, "canApprove": true },
  "tags": ["travel", "software", "meals"]
}
```

**Response `201`**

---

### `PATCH /api/admin/departments/:id`

Update department settings (name, budget, reset period, thresholds).

---

### `PATCH /api/admin/departments/:id/permissions`

Update department-level permission defaults.

**Body**
```json
{ "canViewAllTickets": true, "canApprove": true }
```

---

### `DELETE /api/admin/departments/:id`

Soft-deactivate a department (`isActive: false`). Does not delete tickets.

---

### `POST /api/admin/departments/:id/reset-budget`

Manually reset `spent = 0` for the department, regardless of the scheduled reset date.

**Body:** _(empty)_

---

### `GET /api/admin/departments/:id/tags`

Get tag list for a department.

---

### `DELETE /api/admin/departments/:id/tags/:tag`

Remove a tag from the department's tag list.

---

## Admin — Exchange Rates

**Auth:** Required. **Role:** `admin`

---

### `GET /api/admin/exchange-rates`

Get the organization's current active exchange rate snapshot.

**Response `200`**
```json
{
  "success": true,
  "data": {
    "snapshot": {
      "id": "...", "baseCurrency": "USD",
      "rates": { "EUR": 0.92, "INR": 83.5, "GBP": 0.79 },
      "source": "fetched", "createdAt": "..."
    }
  }
}
```

---

### `PATCH /api/admin/exchange-rates`

Manually set exchange rates (creates a new `manual` snapshot).

**Body**
```json
{ "rates": { "EUR": 0.90, "INR": 84.0 } }
```

---

### `POST /api/admin/exchange-rates/fetch-latest`

Pull latest rates from `open.er-api.com` and save as the current snapshot.

---

### `GET /api/admin/exchange-rates/fetch-preview`

Preview what the external rates would be without saving them.

**Response `200`** — same shape as current snapshot but with `"preview": true`.

---

### `GET /api/admin/exchange-rates/history`

Paginated list of past snapshots.

**Query Parameters:** `page`, `limit`

---

### `PATCH /api/admin/exchange-rates/active-currencies`

Update the list of currencies active for this organization.

**Body**
```json
{ "activeCurrencies": ["USD", "EUR", "INR", "GBP"] }
```

---

## Admin — Analytics

**Auth:** Required. **Role:** `admin`

---

### `GET /api/admin/analytics`

Get the organization's analytics snapshot (Redis-cached, 1 h TTL).

**Response `200`**
```json
{
  "success": true,
  "data": {
    "analytics": {
      "totalTickets": 120,
      "totalApproved": 80,
      "totalRejected": 15,
      "totalPending": 20,
      "totalAwaitingFinance": 5,
      "totalAmountApproved": 45000.00,
      "totalAmountPending": 8000.00,
      "avgResolutionTimeMs": 172800000,
      "topTags": [{ "tag": "travel", "count": 32 }],
      "currencyBreakdown": [{ "currency": "USD", "total": 40000, "count": 60 }],
      "departments": [
        {
          "departmentId": "...",
          "name": "Engineering",
          "budget": 50000,
          "spent": 12000,
          "budgetUsagePercent": 24,
          "ticketCount": 30,
          "approvedAmount": 12000,
          "avgResolutionTimeMs": 86400000,
          "topTags": [...]
        }
      ],
      "lastUpdated": "2025-01-01T00:00:00.000Z"
    }
  }
}
```

---

### `POST /api/admin/analytics/refresh`

Trigger a manual recomputation of analytics (bypasses the Redis cache).

**Body:** _(empty)_

**Response `200`** — same shape as `GET /analytics`.

---

## Super Admin — Organizations

**Auth:** Required. **Role:** `super_admin`

---

### `GET /api/superadmin/organizations`

Paginated list of all organizations on the platform.

**Query Parameters:** `page`, `limit`, `search`, `disabled` (boolean)

---

### `POST /api/superadmin/organizations`

Create a new organization (and optionally an admin user).

**Body**
```json
{ "name": "Newco", "slug": "newco", "baseCurrency": "USD" }
```

---

### `PATCH /api/superadmin/organizations/:id`

Update an organization's name, slug, base currency, or active currencies.

---

### `PATCH /api/superadmin/organizations/:id/disable`

Toggle an organization's `isDisabled` state. Disabling an org prevents all users of that org from logging in.

---

## Super Admin — Users

**Auth:** Required. **Role:** `super_admin`

---

### `GET /api/superadmin/users`

Paginated list of all users across all organizations.

**Query Parameters:** `page`, `limit`, `search`, `orgId`, `role`

---

### `POST /api/superadmin/users`

Create a user in any organization.

**Body**
```json
{ "name": "Charlie", "email": "charlie@newco.com", "password": "...", "role": "admin", "orgId": "<orgId>" }
```

---

### `PATCH /api/superadmin/users/:id`

Update a user's details.

---

### `PATCH /api/superadmin/users/:id/disable`

Toggle a user's `isDisabled` state.
