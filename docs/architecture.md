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

---

## Overview

Expensly is a monorepo composed of two packages:

| Package | Purpose |
|---|---|
| `backend/` | Express REST API + Socket.IO WebSocket server + cron scheduler |
| `frontend/` | React 19 single-page application |

The backend is the source of truth for all business logic. The frontend consumes the REST API for CRUD operations and receives live push updates via Socket.IO.

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
