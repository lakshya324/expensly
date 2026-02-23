# Frontend

Deep-dive into the React 19 single-page application — folder structure, routing, state management, API communication, and real-time updates.

---

## Table of Contents

1. [Folder Structure](#folder-structure)
2. [Feature Modules](#feature-modules)
3. [Routing & Role Guards](#routing--role-guards)
4. [State Management](#state-management)
5. [API Client (Axios)](#api-client-axios)
6. [Token Storage & Refresh Flow](#token-storage--refresh-flow)
7. [Socket.IO Client](#socketio-client)
8. [UI Library & Styling](#ui-library--styling)
9. [Form Handling & Validation](#form-handling--validation)
10. [Build & Configuration](#build--configuration)

---

## Folder Structure

```
frontend/src/
│
├── main.tsx              ← React root, renders <App />
├── App.tsx               ← Applies providers and the router
│
├── app/
│   └── router.tsx        ← React Router DOM v7 route definitions + lazy loading
│
├── core/
│   ├── constants/        ← ROUTES map, CURRENCIES list, status labels, role constants
│   ├── types/            ← Shared TypeScript interfaces (API responses, user, ticket, etc.)
│   └── utils/            ← Date formatting, currency formatting, misc helpers
│
├── features/             ← One sub-folder per product domain (see below)
│
├── infrastructure/
│   ├── api/              ← Axios instance + request/response interceptors
│   ├── socket/           ← Socket.IO client with typed event helpers
│   └── token/            ← In-memory access token store
│
└── shared/
    ├── providers/        ← AuthProvider, ThemeProvider
    ├── components/       ← Reusable UI components (Button, Modal, Table, Badge, etc.)
    ├── hooks/            ← useDebounce, usePagination, useLocalStorage, etc.
    └── utils/            ← cn() class-name helper, date utils, etc.
```

---

## Feature Modules

Each feature lives in `features/<name>/` and contains its own pages, hooks, and local components.

### `auth`

**Pages:** `LoginPage`, `OTPPage`, `ForgotPasswordPage`, `ResetPasswordPage`

The login flow is two-step:
1. `LoginPage` — email + password form; on success receives a `userId` and transitions to the OTP step.
2. `OTPPage` — enters the 6-digit code emailed to the user; on success, the API sets the refresh token cookie and returns the access token, completing the session.

Zustand `useAuthStore` manages the in-progress `otpUserId` across the two-step flow.

### `dashboard`

**Pages:** `UserDashboardPage`, `AdminDashboardPage`

Each role sees its own dashboard:
- **User** — recent tickets, per-status counts (`useExpenses` hook with stats query), quick actions.
- **Admin** — org summary cards, budget overview, pending approval counts.

### `expenses`

**Pages:** `ExpensesPage`, `NewExpensePage`, `ExpenseDetailPage`, `AdminExpensesPage`

**Hooks:**
| Hook | Purpose |
|---|---|
| `useExpenses(params)` | Fetches paginated ticket list with optional filters |
| `useExpense(id)` | Fetches a single ticket's full details |
| `useCreateExpense()` | Handles multipart form submission with optional file |

`NewExpensePage` uses `react-hook-form` with Zod for client-side validation and `FormData` for multipart submission (receipt file + JSON fields).

### `analytics`

**Page:** `AnalyticsPage`

**Hook:** `useAnalytics()`

Displays org-wide charts powered by Recharts:
- Ticket counts by status (bar chart)
- Amount approved by month (area chart)
- Department budget usage (horizontal bar)
- Currency breakdown (pie chart)
- Top tags (word cloud / list)

### `departments`

**Page:** `DepartmentsPage`

Admin-only. Inline CRUD for departments: create, rename, update budgets, set approval thresholds, manage tags, manually reset budget, activate / deactivate.

### `admin-users`

**Page:** `AdminUsersPage`

Admin-only. Paginated user list with roles, department assignment, enable/disable toggle, manager assignment, and fine-grained permission overrides.

### `exchange-rates`

**Page:** `ExchangeRatesPage`

Admin-only. View current rate snapshot, fetch latest from the external API, manually override individual rates, manage the org's active currency list, and browse snapshot history.

### `reports`

**Page:** `ReportsPage`

Available to all roles. Export a filtered CSV of tickets (by status, department, date range). Up to 5 saved reports per user are listed; each can be re-downloaded or emailed.

### `profile`

**Page:** `ProfilePage`

Shared across all roles. Displays the logged-in user's name, email, role, department, and organization details.

### `superadmin`

**Pages:** `SuperAdminOrgsPage`, `SuperAdminUsersPage`

`super_admin` only. Full platform management — list/create/enable/disable orgs and users across all organizations.

---

## Routing & Role Guards

Routes are defined in `app/router.tsx` using React Router DOM v7 with lazy-loaded page components.

```
/                     → redirect based on role
/auth/login           → Public only (redirects to dashboard if session exists)
/auth/otp             → Public only
/auth/forgot-password → Public only
/auth/reset-password  → Public only

/dashboard            → Private, roles: user | admin
/expenses             → Private, roles: user | admin
/expenses/new         → Private, roles: user
/expenses/:id         → Private, roles: user | admin
/admin/expenses       → Private, roles: admin
/admin/users          → Private, roles: admin
/admin/departments    → Private, roles: admin
/admin/analytics      → Private, roles: admin
/admin/exchange-rates → Private, roles: admin
/admin/reports        → Private, roles: admin
/superadmin/orgs      → Private, roles: super_admin
/superadmin/users     → Private, roles: super_admin
/profile              → Private, any authenticated role
```

**Guard mechanism:**

`PrivateRoute` reads `useAuthStore().status`:
- `idle` / `loading` → render a loading spinner while `tryRestoreSession()` runs.
- `unauthenticated` → redirect to `/auth/login`.
- `authenticated` → check `user.role` against the route's `allowedRoles`. If not permitted, redirect to the role's default dashboard.

`PublicRoute` redirects authenticated users away from `/auth/*` to their dashboard.

---

## State Management

Zustand `useAuthStore` is the single global store. Feature-level data is managed by custom hooks (not in global state).

### `useAuthStore`

```typescript
interface AuthStore {
  user: User | null;
  status: 'idle' | 'loading' | 'authenticated' | 'unauthenticated';
  otpUserId: string | null;

  setAuth(user: User): void;           // sets user + status = 'authenticated'
  clearAuth(): void;                   // clears user, removes token from tokenStore
  setOtpUserId(id: string): void;      // stores userId between login-step1 and OTP step
  patchOrg(org: Partial<Org>): void;   // updates org fields within user object
  tryRestoreSession(): Promise<void>;  // called on app mount — hits POST /auth/refresh
}
```

`tryRestoreSession` fires immediately when the app loads. It calls `POST /api/auth/refresh` using the HttpOnly cookie. If successful, it stores the new access token and sets `status = 'authenticated'`. If it fails (no cookie, cookie expired), it sets `status = 'unauthenticated'`.

---

## API Client (Axios)

Located in `infrastructure/api/`. A single Axios instance is created with `baseURL = VITE_API_URL`.

### Request Interceptor

Before every request, reads the access token from `tokenStore.get()` and attaches it:

```
Authorization: Bearer <access-token>
```

### Response Interceptor

On a `401 Unauthorized` response:

1. Checks that this is not already the `/auth/refresh` endpoint (prevents infinite loops).
2. Attempts `POST /api/auth/refresh` once (the HttpOnly cookie is sent automatically).
3. If successful: stores the new access token and **retries the original request** transparently.
4. If the refresh also fails: dispatches a custom `auth:logout` DOM event.

`AuthProvider` listens for `auth:logout` and calls `clearAuth()`, which redirects to the login page.

---

## Token Storage & Refresh Flow

Access tokens are kept **only in memory** (`infrastructure/token/tokenStore.ts`) — never in `localStorage` or `sessionStorage`. This protects against XSS token theft.

Refresh tokens are stored as HttpOnly cookies by the server (`expensly_refresh_token`). They are never accessible from JavaScript.

```
Page load
  └── tryRestoreSession() → POST /auth/refresh (cookie sent automatically)
         ├── 200: store access token in memory, status = 'authenticated'
         └── 401: status = 'unauthenticated', redirect to /auth/login

Normal API request
  └── Request interceptor attaches in-memory access token
         ├── 200: proceed normally
         └── 401: response interceptor attempts refresh
                ├── 200: new access token stored, original request retried
                └── 401: auth:logout event → clearAuth() → redirect to login
```

---

## Socket.IO Client

Located in `infrastructure/socket/socketClient.ts`. A lazily initialized Socket.IO client that:

1. Connects to the backend WebSocket server with the in-memory access token as auth payload.
2. Wraps `socket.on` / `socket.off` / `socket.emit` with typed generics.
3. Handles `connect_error` — if the token is expired, fires `auth:logout`.
4. Exposes `subscribe(dept)` / `unsubscribe(dept)` helpers that emit `subscribe_dept` / `unsubscribe_dept` to join or leave department-scoped rooms.

Feature components connect to specific events via React hooks (`useTicketEvents`, `useAnalyticsEvents`, etc.) that call `socketClient.on(event, handler)` in a `useEffect` and clean up on unmount.

---

## UI Library & Styling

| Library | Purpose |
|---|---|
| **Tailwind CSS v4** | Utility-first styling, configured with a custom theme |
| **Radix UI** | Accessible headless components: Dialog, DropdownMenu, Select, Tabs, Tooltip, Popover, Toggle, Avatar, etc. |
| **Lucide React** | Icon set |
| **Recharts** | Analytics charts (AreaChart, BarChart, PieChart) |
| **Sonner** | Toast notification system |
| **date-fns** | Date formatting and manipulation |
| **tailwind-merge** | Safely merge conflicting Tailwind class names |
| **class-variance-authority (cva)** | Define component variants with type safety |
| **tailwindcss-animate** | Animation utilities |

The `shared/components/` folder contains project-specific wrappers (e.g. `<Button>`, `<Badge>`, `<DataTable>`, `<StatusBadge>`, `<CurrencyAmount>`) built on top of Radix and Tailwind.

---

## Form Handling & Validation

All forms use `react-hook-form` with Zod schema resolvers.

**Pattern:**
```typescript
const schema = z.object({
  amount: z.number().positive(),
  currency: z.enum(SUPPORTED_CURRENCIES),
  title: z.string().min(3).max(100),
});

const form = useForm<z.infer<typeof schema>>({
  resolver: zodResolver(schema),
});
```

Zod schemas for auth forms live in the `auth` feature; for expense forms in the `expenses` feature. Validation runs client-side on submit and on blur. Server-side errors (from `express-validator`) are mapped back to the form's error state via the Axios response interceptor.

---

## Build & Configuration

| File | Purpose |
|---|---|
| `vite.config.ts` | Vite configuration — React plugin, path aliases (`@/` → `src/`) |
| `tsconfig.app.json` | TypeScript config for application source files |
| `tsconfig.node.json` | TypeScript config for Vite config file |
| `eslint.config.js` | ESLint with `@typescript-eslint` and `eslint-plugin-react-hooks` |
| `.env.example` | Required environment variables template |

`VITE_API_URL` is the only required environment variable. It defaults to `/api` in production when both frontend and backend are served from the same origin.
