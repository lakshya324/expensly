# Architecture

This document describes the high-level system design of Expensly — how the major components fit together, how data flows through the system, and the key design decisions.

---

## Table of Contents

1. [Overview](#overview)
2. [Component Diagram](#component-diagram)
3. [Request Lifecycle](#request-lifecycle)
4. [Multi-Tenancy Model](#multi-tenancy-model)
5. [Role Hierarchy](#role-hierarchy)
6. [Approval State Machine](#approval-state-machine)
7. [Caching Strategy](#caching-strategy)
8. [Real-Time Layer](#real-time-layer)
9. [Background Processing](#background-processing)
10. [Operational Baseline](#operational-baseline)

---

## Overview

Expensly is a monorepo composed of two packages:

| Package | Purpose |
|---|---|
| `backend/` | Express REST API + Socket.IO WebSocket server + cron scheduler + dedicated AI/OCR worker |
| `frontend/` | React 19 single-page application |

The backend is the source of truth for all business logic. The frontend consumes the REST API for CRUD operations and receives live push updates via Socket.IO. Long-running OCR and AI validation work is queued in SQS and handled by a separately scalable worker process.

```
┌─────────────────────────────────────────────────────────────┐
│                          Client                             │
│              React SPA  (Vite + TypeScript)                 │
│  Axios REST ──────────────────────────────────── Socket.IO  │
└──────────┬──────────────────────────────────────────┬───────┘
           │ HTTPS REST                                │ WSS
┌──────────▼──────────────────────────────────────────▼───────┐
│                       Backend Server                         │
│              Express v5  +  Socket.IO v4                     │
│                                                              │
│  ┌─────────────┐  ┌──────────┐  ┌──────────┐  ┌─────────┐  │
│  │  Controllers│  │ Services │  │   Cron   │  │  Sock   │  │
│  └──────┬──────┘  └────┬─────┘  └────┬─────┘  └────┬────┘  │
│         └──────────────┴─────────────┘              │       │
│                    Data Layer                        │       │
│  ┌─────────────┐  ┌──────────┐  ┌──────────┐        │       │
│  │   MongoDB   │  │  Redis   │  │  AWS S3  │        │       │
│  │  (Mongoose) │  │ (ioredis)│  │(receipts)│        │       │
│  └─────────────┘  └──────────┘  └──────────┘        │       │
│                                                      │       │
│  ┌─────────────────────────────────────────────────┐ │       │
│  │         SMTP Email (Nodemailer)                 │ │       │
│  └─────────────────────────────────────────────────┘ │       │
└──────────────────────────────────────────────────────┘       

┌─────────────────────────────────────────────────────────────┐
│                    AI / OCR Worker Process                  │
│        Polls SQS, validates job payloads, updates tickets   │
│        and emits Socket.IO events through shared handlers    │
└─────────────────────────────────────────────────────────────┘
```

---

## Component Diagram

```
backend/src/
│
├── index.ts          ← Bootstrap: creates HTTP server, attaches Socket.IO, starts cron
├── setup.ts          ← Express app factory: applies middleware, registers routes
├── routes.ts         ← Mounts all route files under /api/*
├── middlewares.ts    ← Global middleware stack (helmet, cors, morgan, body-parser)
├── socket.ts         ← Socket.IO server setup
├── cron.ts           ← node-cron job definitions
├── workers/          ← Dedicated SQS worker runtime and OCR/AI handlers
│
├── controllers/      ← Thin HTTP handlers — validate input, call services, respond
├── services/         ← Core business logic — no HTTP knowledge
├── models/           ← Mongoose schema definitions
├── middleware/       ← Route-level middleware (auth, authorize, upload, validate, rate-limit)
├── routes/           ← Express Router instances per resource
├── config/           ← Env parsing, constants, DB/Redis/email connection factories
├── types/            ← Shared TypeScript interfaces and enums
├── validation/       ← express-validator schema definitions
├── utils/            ← Helpers (error formatting, logger, socket emitter, superadmin seed)
└── websocket/        ← Socket.IO auth, event type definitions, event handlers
```

---

## Request Lifecycle

A typical authenticated REST request travels through the following layers:

```
1. Client sends:  POST /api/users/expenses
   Headers: Authorization: Bearer <access-token>

2. Global middleware (middlewares.ts)
   └── requestContext()  — assigns x-request-id for correlation
   └── helmet()          — security headers
   └── cors()            — origin validation
   └── morgan()          — HTTP request logging
   └── express.json()    — body parsing

3. Rate limiter middleware
   └── apiLimiter        — 200 req / min per IP

4. Route file (routes/reports.routes.ts → routes.ts)

5. Route-level middleware chain
   ├── authenticate      — verifies JWT, loads req.user + req.organization
   ├── authorize('user') — checks role
   ├── upload.single()   — multer S3 upload (if multipart)
   └── validate(schema)  — express-validator + error formatting

6. Controller function
   └── Calls one or more service functions
   └── Formats and returns JSON response

7. Error handler middleware (errorHandler.ts)
   └── Catches any thrown AppError or unhandled errors
   └── Returns structured { success: false, error: { code, message } }
```

---

## Multi-Tenancy Model

Every piece of data (users, tickets, departments, analytics, reports, exchange rate snapshots) carries an `orgId` field referencing an `Organization` document.

```
Organization (tenant boundary)
    │
    ├── Users        (orgId)
    ├── Departments  (orgId)
    ├── Tickets      (orgId)
    ├── Reports      (orgId)
    ├── ExchangeRateSnapshots  (orgId)
    └── OrgAnalytics (orgId, 1-to-1)
```

All database queries in controllers and services include `orgId` as a mandatory filter, derived from `req.organization` (populated by the `authenticate` middleware via the JWT payload).

`super_admin` users have no `orgId`; their queries operate across all orgs or target specific orgs via URL parameters.

---

## Role Hierarchy

```
super_admin
    │  Full platform access — manages all organizations and users
    │
    ▼
admin
    │  Org-level access — manages users, departments, budgets, rates, analytics
    │
    ▼
user
       Regular employee — submits, views, and tracks own expense tickets
       Optional elevated permissions (per-user or per-department overrides):
         · canViewAllTickets  — can see all department tickets (not just own)
         · canApprove         — can approve/reject tickets (finance role)
```

Permission resolution order (most specific wins):

```
user.permissions.canApprove
    ?? department.permissions.canApprove
    ?? false
```

---

## Approval State Machine

Each expense ticket progresses through these states:

```
                  ┌─────────┐
  Submit ────────►│ pending │
                  └────┬────┘
                       │
         ┌─────────────┴──────────────┐
         │ Manager approval           │ Manager rejects
         │ required?                  │
         │  YES                       │
         ▼                            ▼
  Manager reviews               ┌──────────┐
         │                      │ rejected │
         ├─ Approve ──────────► └──────────┘
         │
         ▼
  ┌──────────────────┐
  │ awaiting_finance │
  └────────┬─────────┘
           │
           ├─ Finance approves ──────────► ┌──────────┐
           │                               │ approved │
           └─ Finance rejects ──────────── └──────────┘
                                    │
                                    ▼
                               ┌──────────┐
                               │ rejected │
                               └──────────┘
```

**Manager approval skip condition:** If the submitting user has no assigned manager, OR the ticket amount is below `department.approvalThresholds[currency]`, the ticket goes directly to `awaiting_finance`.

---

## Caching Strategy

```
┌──────────────────────────────────────────────────────────────┐
│                          Redis Keys                          │
├────────────────────────────┬─────────────────────────────────┤
│ otp:<userId>               │ Login OTP (6 digits, TTL 300 s)  │
│ pwd:<userId>               │ Password-reset OTP (TTL 300 s)  │
│ analytics:<orgId>          │ OrgAnalytics JSON (TTL 1 h)     │
│ exchange_rates:<orgId>     │ Latest rate preview (TTL 1 h)   │
└────────────────────────────┴─────────────────────────────────┘
```

Cache invalidation rules:

| Event | Cache cleared |
|---|---|
| Ticket approved / rejected | `analytics:<orgId>` |
| Ticket created / deleted | `analytics:<orgId>` |
| Daily cron (midnight) | Analytics are recomputed and re-cached |
| Exchange rates fetched | `exchange_rates:<orgId>` |

---

## Real-Time Layer

Socket.IO runs on the same HTTP server as Express. The WebSocket connection is authenticated using the same JWT access token passed as a query parameter or auth payload on connect.

After authentication, the server assigns the socket to rooms based on the user's org and (optionally) their subscribed departments. Controllers emit typed events via a shared `emitToOrg` / `emitToDept` helper after mutating state, so all connected clients receive live updates without polling.

See [websockets.md](./websockets.md) for the full event catalogue.

---

## Background Processing

Receipt OCR and AI validation are intentionally outside the HTTP request path:

1. Ticket creation enqueues an SQS job with metadata: `jobId`, `traceId`, `attempt`, `createdAt`, and optional `requestedBy`.
2. The worker process (`npm run start:worker`) long-polls SQS and validates each message with runtime schemas.
3. OCR jobs mark ticket `ocrData`, emit completion/failure events, and enqueue AI validation when OCR succeeds.
4. AI validation jobs validate provider output before saving advisory checks and extracted suggestions.
5. Successful, skipped, malformed, and explicitly non-retryable jobs are deleted from SQS.
6. Retryable failures are left in SQS so the queue redrive policy can retry and eventually move poison messages to the DLQ.

Tickets keep a `processingJobs` history for operational visibility: queued, processing, completed, failed, retryable, and skipped states.

---

## Operational Baseline

The repo now has root orchestration and CI-quality commands:

| Command | Purpose |
|---|---|
| `npm run typecheck` | Backend + frontend TypeScript checks |
| `npm run lint` | Backend + frontend ESLint checks |
| `npm run test` | Backend + frontend Vitest suites |
| `npm run build` | Backend compile + frontend production build |
| `npm run audit:ci` | Production dependency audit for both packages |

Health endpoints are split by deployment use case:

| Endpoint | Purpose |
|---|---|
| `/api/health/live` | Process liveness |
| `/api/health/ready` | Traffic readiness; requires MongoDB |
| `/api/health/dependencies` | MongoDB and Redis dependency detail |

See [deployment-runbook.md](./deployment-runbook.md) for Docker Compose, worker deployment, SQS DLQ, backup, and rollback notes.
