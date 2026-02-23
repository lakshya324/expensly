# WebSockets

How Expensly uses Socket.IO for real-time updates — server setup, authentication, room management, and the complete event catalogue.

---

## Table of Contents

1. [Server Setup](#server-setup)
2. [Connection Authentication](#connection-authentication)
3. [Room Strategy](#room-strategy)
4. [Client-to-Server Events](#client-to-server-events)
5. [Server-to-Client Events](#server-to-client-events)
6. [Frontend Client](#frontend-client)
7. [Emitting from Controllers](#emitting-from-controllers)

---

## Server Setup

Socket.IO is attached to the same `http.Server` instance as Express:

```
index.ts
  ├── const app = createApp()          // Express app
  ├── const server = http.createServer(app)
  ├── initSocketServer(server)         // Attaches Socket.IO
  └── server.listen(PORT)
```

`socket.ts` — `initSocketServer`:
1. Creates a `Server` instance from `socket.io` with CORS settings mirroring the REST API.
2. Registers the `AuthHandler` middleware for socket connections.
3. Binds the `ConnectionHandler` on each authenticated socket.
4. Exports the `io` instance for use in controllers.

---

## Connection Authentication

The `AuthHandler` runs before the socket is established (Socket.IO middleware, equivalent to an HTTP middleware):

1. Reads `socket.handshake.auth.token` or `socket.handshake.query.token`.
2. Calls `verifyAccessToken(token)` from `auth.service.ts`.
3. If valid: attaches `socket.data.user` (user object) and `socket.data.orgId`.
4. If invalid or expired: calls `next(new Error('Unauthorized'))` — the connection is rejected and the client receives a `connect_error` event.

---

## Room Strategy

After authentication, the `ConnectionHandler` auto-joins the socket to:

| Room | Name pattern | Members |
|---|---|---|
| Org room | `org:<orgId>` | All connected users in the same organization |

Additionally, clients can subscribe to department-scoped rooms:

| Room | Name pattern | Members |
|---|---|---|
| Department room | `dept:<deptId>` | Users who have subscribed to that department |

Admins broadcasting org-wide events (like analytics or rate updates) emit to `org:<orgId>`. Ticket events are emitted to either the org room or a specific department room as appropriate.

---

## Client-to-Server Events

Events sent from the browser to the server.

### `ping`

Heartbeat / connectivity check.

**Payload:** _(none)_

---

### `subscribe_dept`

Join a department room to receive department-scoped ticket events.

**Payload**
```typescript
{ deptId: string }
```

The server validates that the authenticated user belongs to (or has access to) the requested department before joining.

---

### `unsubscribe_dept`

Leave a previously joined department room.

**Payload**
```typescript
{ deptId: string }
```

---

## Server-to-Client Events

Events pushed from the server to connected clients. All payloads are strongly typed via `websocket/events.types.ts`.

### Ticket Events

#### `new_ticket`

Emitted when a new expense ticket is submitted.

**Room:** `dept:<deptId>`

**Payload**
```typescript
{
  ticket: {
    id: string;
    title: string;
    amount: number;
    currency: string;
    status: 'pending';
    submittedBy: { id: string; name: string };
    department: { id: string; name: string };
    createdAt: string;
  }
}
```

---

#### `ticket_update`

Emitted when a ticket's fields are updated by the submitter.

**Room:** `dept:<deptId>`

**Payload**
```typescript
{ ticketId: string; changes: Partial<Ticket> }
```

---

#### `ticket_delete`

Emitted when a ticket is deleted.

**Room:** `dept:<deptId>`

**Payload**
```typescript
{ ticketId: string }
```

---

#### `ticket_flag`

Emitted when a ticket's `flagged` state is toggled.

**Room:** `dept:<deptId>`

**Payload**
```typescript
{ ticketId: string; flagged: boolean }
```

---

#### `ticket_status_change`

Emitted when a ticket's approval status changes (manager approves/rejects, finance approves/rejects).

**Room:** `org:<orgId>`

**Payload**
```typescript
{
  ticketId: string;
  status: 'pending' | 'awaiting_finance' | 'approved' | 'rejected';
  reviewType: 'manager' | 'finance';
  reviewedBy: { id: string; name: string };
  comments?: string;
}
```

---

### User Events

#### `user_update`

Emitted when an admin updates a user's profile (name, department, manager, permissions).

**Room:** `org:<orgId>`

**Payload**
```typescript
{ userId: string; changes: Partial<User> }
```

---

#### `user_disable`

Emitted when a user is enabled or disabled.

**Room:** `org:<orgId>`

**Payload**
```typescript
{ userId: string; isDisabled: boolean }
```

---

### Department Events

#### `dept_created`

Emitted when an admin creates a new department.

**Room:** `org:<orgId>`

**Payload**
```typescript
{ department: Department }
```

---

#### `dept_update`

Emitted when a department is updated (name, budget, settings, tags).

**Room:** `org:<orgId>`

**Payload**
```typescript
{ departmentId: string; changes: Partial<Department> }
```

---

### Analytics & Rate Events

#### `analytics_update`

Emitted when org analytics are refreshed (triggered by cron, manual refresh, or ticket status change).

**Room:** `org:<orgId>`

**Payload**
```typescript
{ analytics: OrgAnalytics }
```

---

#### `rates_update`

Emitted when exchange rates are updated (manual or fetched).

**Room:** `org:<orgId>`

**Payload**
```typescript
{
  snapshot: {
    id: string;
    baseCurrency: string;
    rates: Record<string, number>;
    source: 'manual' | 'fetched';
    createdAt: string;
  }
}
```

---

## Frontend Client

Located at `frontend/src/infrastructure/socket/socketClient.ts`.

```typescript
// Connect with access token
socketClient.connect(accessToken);

// Type-safe event subscription
socketClient.on('ticket_status_change', (payload) => { /* ... */ });

// Unsubscribe
socketClient.off('ticket_status_change', handler);

// Subscribe to a department room
socketClient.emit('subscribe_dept', { deptId });

// Disconnect
socketClient.disconnect();
```

The client is lazily initialized — it only connects when the user is authenticated. On `connect_error`, if the error message is `'Unauthorized'`, it fires the `auth:logout` DOM event to trigger the React auth flow (token refresh or redirect to login).

Feature hooks subscribe in `useEffect` and clean up with `off` on unmount to prevent memory leaks and duplicate listeners.

---

## Emitting from Controllers

After mutating state, controllers call typed emit helpers from `utils/socket.ts`:

```typescript
import { emitToOrg, emitToDept } from '../utils/socket';

// Notify everyone in the org
emitToOrg(orgId, 'ticket_status_change', payload);

// Notify only subscribers of a specific department
emitToDept(deptId, 'new_ticket', payload);
```

These helpers call `io.to(roomName).emit(event, payload)` using the exported `io` instance from `socket.ts`.
