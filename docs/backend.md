# Backend

Deep-dive into the Express API server — how it boots, how middleware is wired, and how each service layer works.

---

## Table of Contents

1. [Folder Structure](#folder-structure)
2. [Server Bootstrap](#server-bootstrap)
3. [Middleware Stack](#middleware-stack)
4. [Configuration](#configuration)
5. [Services](#services)
6. [Controllers](#controllers)
7. [Cron Jobs](#cron-jobs)
8. [Logging](#logging)
9. [Swagger / API Docs](#swagger--api-docs)
10. [Error Handling](#error-handling)

---

## Folder Structure

```
backend/src/
│
├── index.ts              ← Entry point: HTTP server + Socket.IO + cron
├── setup.ts              ← Express app factory
├── routes.ts             ← Aggregates and mounts all route files
├── middlewares.ts        ← Global middleware (helmet, cors, morgan, body-parser)
├── socket.ts             ← Socket.IO server instantiation
├── cron.ts               ← Scheduled jobs
├── logs.ts               ← Custom Winston logger setup
├── swagger.ts            ← Swagger JSDoc configuration (dev only)
├── databases.ts          ← MongoDB + Redis connection management
│
├── config/
│   ├── constants.ts      ← App-wide constants (currencies, roles, limits)
│   ├── data.config.ts    ← Seed data helpers
│   ├── db.config.ts      ← Mongoose connection factory
│   ├── email.config.ts   ← Nodemailer transporter factory
│   ├── env.config.ts     ← Typed env variable parsing and validation
│   ├── errorCodes.config.ts ← Centralised error code registry
│   └── redis.config.ts   ← ioredis client factory
│
├── controllers/          ← HTTP request handlers
├── models/               ← Mongoose schema + model definitions
├── middleware/           ← Route-level middleware
├── routes/               ← Express Router instances
├── services/             ← Business logic
├── types/                ← Shared TypeScript types
├── utils/                ← Utility helpers
├── validation/           ← express-validator schemas
└── websocket/            ← Socket.IO handlers and event types
```

---

## Server Bootstrap

### `index.ts`

The entry point:

1. Imports the Express app from `setup.ts`.
2. Creates a `http.Server` wrapping the app.
3. Passes the HTTP server to `initSocketServer()` in `socket.ts`.
4. Calls `connectDatabases()` to establish MongoDB + Redis connections.
5. Starts cron jobs via `startCronJobs()`.
6. Seeds the super admin account via `seedSuperAdmin()` if it does not already exist.
7. Calls `server.listen(PORT)`.

### `setup.ts`

Creates and returns the Express application:

- Applies the global middleware stack (`middlewares.ts`).
- Registers all route groups via `registerRoutes(app)`.
- Attaches error handler middleware as the final layer.
- Mounts Swagger UI at `/api-docs` when `NODE_ENV !== 'production'`.

---

## Middleware Stack

### Global (applied to every request)

| Middleware | Purpose |
|---|---|
| `helmet()` | Sets secure HTTP headers (CSP, HSTS, X-Frame-Options, etc.) |
| `cors()` | Validates `Origin` against `CORS_ORIGIN` env variable (comma-separated list) |
| `morgan('dev')` | HTTP request/response logging to console |
| `express.json()` | Parse `application/json` request bodies |
| `express.urlencoded()` | Parse URL-encoded request bodies |

### Route-Level Middleware

**`middleware/auth.ts` — `authenticate`**

Extracts the Bearer token from the `Authorization` header, verifies it using `JWT_SECRET`, and populates `req.user` and `req.organization` for downstream handlers. Throws `401 Unauthorized` if the token is missing, expired, or invalid.

**`middleware/authorize.ts` — `authorize(...roles)`**

Reads `req.user.role` and confirms it is in the allowed roles array. Throws `403 Forbidden` otherwise.

**`middleware/upload.ts`**

Multer configuration for multipart form data. Files are streamed directly to the S3 service via a custom storage engine — nothing is written to disk.

**`middleware/validate.ts` — `validate(schema)`**

Runs an array of `express-validator` check chains, collects all validation errors, and throws a formatted `400 Bad Request` response with a structured error array before the controller is ever called.

**`middleware/rateLimiter.ts`**

| Limiter | Window | Max requests | Applied to |
|---|---|---|---|
| `apiLimiter` | 1 minute | 200 | All `/api/*` routes |
| `authLimiter` | 15 minutes | 100 | `/api/auth/*` routes |

**`middleware/errorHandler.ts`**

The final Express error middleware. Distinguishes between:
- `AppError` instances (operational errors with a known status code) — returns `{ success: false, error: { code, message } }`
- Mongoose `ValidationError` — maps to `400`
- Mongoose `CastError` (bad ObjectId) — maps to `400`
- Mongoose duplicate key error (code `11000`) — maps to `409 Conflict`
- All other errors in production — returns generic `500` with no internal details leaked

---

## Configuration

### `config/env.config.ts`

Parses and validates all environment variables at startup. Application will throw a descriptive error and refuse to start if any required variable is missing or invalid. Exports a typed `env` object consumed everywhere else.

### `config/constants.ts`

Defines application-wide constants:
- `SUPPORTED_CURRENCIES` — array of 30 ISO 4217 currency codes
- `TICKET_STATUSES` — `pending | awaiting_finance | approved | rejected`
- `USER_ROLES` — `user | admin | super_admin`
- `BUDGET_RESET_PERIODS` — `none | monthly | quarterly | yearly`
- Cookie name (`expensly_refresh_token`), OTP max attempts (5), pagination defaults

### `config/errorCodes.config.ts`

Maps string error codes (e.g. `USER_NOT_FOUND`, `INVALID_OTP`, `BUDGET_EXCEEDED`) to human-readable messages. Used by `AppError` to produce consistent client-facing error responses.

---

## Services

### `auth.service.ts`

| Function | Description |
|---|---|
| `hashPassword(password)` | bcrypt hash (salt rounds 12) |
| `comparePassword(plain, hash)` | bcrypt compare |
| `generateAccessToken(payload)` | Signs a JWT with `JWT_SECRET`, expires in `JWT_EXPIRES_IN` |
| `verifyAccessToken(token)` | Verifies and decodes access JWT |
| `generateRefreshToken(userId)` | Creates a random opaque token, hashes it with SHA-256, stores the hash in `RefreshTokens`, sets `expiresAt` |
| `verifyRefreshToken(token)` | Hashes the incoming token, finds the document, checks expiry |
| `revokeRefreshToken(token)` | Deletes the hash document |
| `revokeAllUserTokens(userId)` | Deletes all refresh-token documents for a user |
| `generateOtp()` | Returns a random 6-digit string |
| `issueTokenPair(res, user)` | Calls `generateAccessToken` + `generateRefreshToken`, sets the refresh token in an `HttpOnly` `SameSite=Strict` cookie |

### `analytics.service.ts`

| Function | Description |
|---|---|
| `refreshOrgAnalytics(orgId)` | Runs MongoDB aggregation pipeline over approved/rejected tickets; converts all amounts to `baseCurrency` using locked `exchangeRateSnapshotId`; upserts `OrgAnalytics` document; invalidates Redis cache |
| `getOrgAnalytics(orgId)` | Returns analytics — Redis cache hit (TTL 1 h) or calls `refreshOrgAnalytics` |
| `invalidateAnalyticsCache(orgId)` | Deletes `analytics:<orgId>` Redis key |

### `budget.service.ts`

| Function | Description |
|---|---|
| `calculateNextResetDate(period, from?)` | Returns the next period boundary date given `monthly` / `quarterly` / `yearly` |
| `resetDepartmentBudget(dept)` | Sets `dept.spent = 0`, recomputes `nextResetDate`, saves |
| `processDueBudgetResets()` | Queries for active departments where `nextResetDate <= now`, resets each one; called by the hourly cron |

### `cache.service.ts`

Thin wrappers around ioredis for consistent JSON serialization:

| Function | Description |
|---|---|
| `getJSON(key)` | `redis.get` then `JSON.parse` |
| `setJSON(key, value, ttl?)` | `JSON.stringify` then `redis.set` with optional `EX ttl` |
| `setString(key, value, ttl?)` | Raw string set |
| `del(key)` | Delete key |

### `email.service.ts`

Uses Nodemailer with a shared transporter configured from `SMTP_*` env variables. All emails are HTML-formatted. Sends:

| Email | Trigger |
|---|---|
| **Login OTP** | `POST /auth/login` — includes 6-digit code and expiry time |
| **Password Reset OTP** | `POST /auth/forgot-password` |
| **Welcome** | Admin creates a new user |
| **Ticket Submitted** | User submits an expense — sent to the user |
| **Ticket Status Change** | Ticket approved or rejected — sent to the submitter |
| **Signup Approved / Rejected** | Super admin action on a pending org |
| **Report Ready** | After CSV generation — includes direct download link or attachment |

### `exchangeRates.service.ts`

| Function | Description |
|---|---|
| `fetchExternalRates(base)` | Calls `open.er-api.com`, caches in Redis for 1 h |
| `getOrgRates(orgId)` | Returns current `ExchangeRateSnapshot` for the org |
| `setOrgRates(orgId, rates, source, userId)` | Creates new snapshot, updates `org.currentRateSnapshotId` |
| `fetchAndSaveOrgRates(orgId, userId)` | `fetchExternalRates` → `setOrgRates` |
| `getRateHistory(orgId, page, limit)` | Paginated snapshots |
| `convertAmount(amount, from, to, rates)` | Cross-currency conversion via base currency as pivot |
| `updateActiveCurrencies(orgId, currencies)` | Updates `org.activeCurrencies` |

### `s3.service.ts`

Wraps `@aws-sdk/client-s3` with `@aws-sdk/s3-request-presigner`:

| Function | Description |
|---|---|
| `uploadFile(buffer, key, mime)` | `PutObjectCommand` |
| `getReceiptSignedUrl(key)` | `GetObjectCommand` presigned URL, 1 h expiry |
| `getReportSignedUrl(key)` | Presigned URL for CSV reports |
| `getReportBuffer(key)` | Full file download as Buffer (for email attachment) |
| `deleteFile(key)` | `DeleteObjectCommand` |
| `buildReceiptKey(orgSlug, ticketId, ext)` | `expensly/<orgSlug>/<ticketId>.<ext>` |
| `buildReportKey(orgSlug, reportId)` | `expensly/<orgSlug>/reports/<reportId>.csv` |

### `csv.service.ts`

`generateTicketsCsv(tickets)` uses `csv-stringify` to produce a UTF-8 BOM-prefixed CSV with columns:

> Title, Description, Tags, Amount, Currency, Submitted By, Department, Date Submitted, Status, Flagged, Manager Review, Manager Reviewed By, Manager Comments, Finance Review, Finance Reviewed By, Finance Comments

---

## Controllers

Each controller file is a thin orchestration layer — it extracts validated inputs from `req`, calls one or more service functions, and returns a JSON response. No business logic lives in controllers.

| Controller | Resource |
|---|---|
| `auth.controller.ts` | Login, OTP, tokens, password reset |
| `ticket.controller.ts` | Expense CRUD, status changes, receipt URL |
| `reports.controller.ts` | CSV generation, list, email |
| `department.controller.ts` | Department CRUD, budget reset, tags |
| `admin.controller.ts` | User management (admin view) |
| `analytics.controller.ts` | Analytics fetch and manual refresh |
| `exchangeRates.controller.ts` | Rate snapshots, fetch, history |
| `superadmin.controller.ts` | Cross-org org and user management |
| `health.controller.ts` | `GET /api/health` — returns server status |

---

## Cron Jobs

Defined in `cron.ts` and started in `index.ts`:

| Schedule | Task | Code path |
|---|---|---|
| Every hour at `:00` | Invoke `processDueBudgetResets()` — resets `spent = 0` for departments past their reset date | `budget.service.ts` |
| Daily at `00:00` | Invoke `refreshOrgAnalytics(orgId)` for every enabled org (uses `Promise.allSettled` so one failing org doesn't block others) | `analytics.service.ts` |

---

## Logging

`logs.ts` configures a Winston logger with:
- **Console transport** — colorized output in development
- **File transport** — JSON logs written to `logs/error.log` (error level) and `logs/combined.log` (all levels)

Morgan HTTP access logs are piped into the same Winston instance so all output is unified.

Log levels used: `error`, `warn`, `info`, `http`, `debug`.

---

## Swagger / API Docs

In `NODE_ENV !== 'production'`, Swagger UI is mounted at `/api-docs`. The spec is generated via `swagger-jsdoc` reading JSDoc `@swagger` annotations from route files. Provides interactive documentation and a try-it-out interface for every endpoint.

---

## Error Handling

All operational errors are thrown as `AppError` instances:

```typescript
throw new AppError('USER_NOT_FOUND', 404);
// Resolves to: { success: false, error: { code: 'USER_NOT_FOUND', message: 'User not found.' } }
```

The `errorHandler` middleware catches all errors — both `AppError` and unexpected ones — formats them appropriately, and ensures no stack traces or internal details are exposed in production responses.
