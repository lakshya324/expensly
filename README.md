# Expensly

> A multi-tenant expense management platform for organizations - submit, review, approve, and track employee expenses with real-time updates, multi-currency support, and automated analytics.

![Project Image](docs/images/readme.png)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE) [![Backend](https://img.shields.io/badge/Backend-Node.js%20%2B%20Express-green)](./backend) [![Frontend](https://img.shields.io/badge/Frontend-React%2019%20%2B%20Vite-blue)](./frontend)

**Author:** Lakshya Sharma - [github.com/lakshya324](https://github.com/lakshya324) · [lakshya.off31@gmail.com](mailto:lakshya.off31@gmail.com)

**Repository:** [github.com/lakshya324/expensly](https://github.com/lakshya324/expensly)

---

## What Is Expensly?

Expensly lets organizations manage the full lifecycle of employee expense reimbursements. Employees submit expense tickets; managers and finance teams review and approve them through a configurable workflow. Admins manage departments, budgets, users, and exchange rates. A super admin oversees all organizations on the platform.

**Key capabilities at a glance:**

- Two-factor authentication (password + email OTP)
- Role-based access: `user` → `admin` → `super_admin`
- Configurable approval chain per department (manager + finance)
- Per-department budgets with automatic scheduled resets
- Multi-currency expenses with locked historical exchange rates
- Receipt uploads via AWS S3
- CSV report generation, S3 storage, and email delivery
- Real-time ticket and analytics updates via Socket.IO
- Organization-level analytics with Redis caching

---

## Repository Structure

```
expensly/
├── backend/           # Node.js + Express API server (TypeScript)
├── frontend/          # React 19 + Vite SPA (TypeScript)
├── docs/              # Detailed technical documentation
├── LICENSE
└── README.md
```

| Folder | Description |
|---|---|
| [`backend/`](./backend) | REST API server, WebSocket server, cron jobs, database models, business logic |
| [`frontend/`](./frontend) | Single-page React application, role-based routing, real-time UI |
| [`docs/`](./docs) | Architecture, API reference, data models, feature guides |

---

## Tech Stack

| Layer | Technologies |
|---|---|
| **Backend runtime** | Node.js (ESM), TypeScript |
| **HTTP framework** | Express.js v5 |
| **Database** | MongoDB 7 via Mongoose 9 |
| **Cache / OTP** | Redis (ioredis) |
| **Auth** | JWT (access 15 min) + opaque refresh tokens (7 d, HttpOnly cookie) |
| **File storage** | AWS S3 |
| **Email** | Nodemailer (SMTP / Gmail) |
| **Real-time** | Socket.IO v4 |
| **Scheduled jobs** | node-cron |
| **API docs (dev)** | Swagger UI |
| **Frontend framework** | React 19 |
| **Build tool** | Vite 5 |
| **Styling** | Tailwind CSS v4 + Radix UI |
| **State management** | Zustand |
| **Charts** | Recharts |
| **Validation** | express-validator (backend) · Zod + react-hook-form (frontend) |

---

## Prerequisites

| Tool | Minimum version |
|---|---|
| Node.js | 20 LTS |
| npm | 10 |
| MongoDB | 7 (Atlas or local) |
| Redis | 7 (Cloud or local) |
| AWS account | S3 bucket configured |
| SMTP credentials | Gmail app password or any SMTP |

---

## Setup & Running Locally

### 1. Clone the repository

```bash
git clone https://github.com/lakshya324/expensly.git
cd expensly
```

---

### 2. Backend

#### 2a. Install dependencies

```bash
cd backend
npm install
```

#### 2b. Configure environment variables

```bash
cp .env.example .env
```

Open `.env` and fill in every placeholder:

| Variable | Description |
|---|---|
| `PORT` | Port the server listens on (default `3000`) |
| `NODE_ENV` | `development` or `production` |
| `CORS_ORIGIN` | Comma-separated allowed origins (e.g. `http://localhost:5173`) |
| `MONGODB_URI` | MongoDB connection string (Atlas URI or `mongodb://localhost:27017/expensly`) |
| `JWT_SECRET` | Long random string for signing access tokens |
| `JWT_REFRESH_SECRET` | Long random string for signing refresh tokens |
| `JWT_EXPIRES_IN` | Access token lifetime (default `15m`) |
| `JWT_REFRESH_EXPIRES_IN` | Refresh token lifetime (default `7d`) |
| `SUPER_ADMIN_EMAIL` | Email address of the seeded super admin account |
| `SUPER_ADMIN_PASSWORD` | Password of the seeded super admin account |
| `AWS_BUCKET` | S3 bucket name |
| `AWS_REGION` | AWS region (e.g. `ap-south-1`) |
| `AWS_ACCESS_KEY_ID` | AWS IAM access key ID |
| `AWS_SECRET_ACCESS_KEY` | AWS IAM secret access key |
| `AWS_SQS_QUEUE_URL` | SQS queue URL for OCR/AI validation jobs |
| `REDIS_URL` | Redis connection URL |
| `SMTP_HOST` | SMTP server host (e.g. `smtp.gmail.com`) |
| `SMTP_PORT` | SMTP port (e.g. `587`) |
| `SMTP_USER` | SMTP username / email address |
| `SMTP_PASS` | SMTP password / app password |
| `OTP_EXPIRES_IN` | OTP validity in seconds (default `300`) |
| `OPENAI_API_KEY` | OpenAI API key for AI validation |
| `OPENAI_MODEL` | Model used for AI validation (default `gpt-5-nano`) |

#### 2c. Start the development server

```bash
npm run dev
```

The API server starts at `http://localhost:3000`.  
Swagger UI (development only) is available at `http://localhost:3000/api-docs`.

#### 2d. Available scripts

| Script | Description |
|---|---|
| `npm run dev` | Start with ts-node / nodemon (hot reload) |
| `npm run dev:worker` | Start the dedicated OCR/AI queue worker in development |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Run compiled output from `dist/` |
| `npm run start:worker` | Run the compiled OCR/AI queue worker |

---

### 3. Frontend

#### 3a. Install dependencies

```bash
cd frontend
npm install
```

#### 3b. Configure environment variables

```bash
cp .env.example .env
```

| Variable | Description |
|---|---|
| `VITE_API_URL` | Full URL of the backend API (e.g. `http://localhost:3000/api`) |

#### 3c. Start the development server

```bash
npm run dev
```

The app starts at `http://localhost:5173`.

#### 3d. Available scripts

| Script | Description |
|---|---|
| `npm run dev` | Start Vite dev server with HMR |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Preview the production build locally |
| `npm run lint` | Run ESLint |

---

## First-Time Platform Setup

1. Start the backend — the super admin account is automatically seeded from `SUPER_ADMIN_EMAIL` / `SUPER_ADMIN_PASSWORD` on first boot.
2. Sign in as super admin.
3. New organizations register themselves via **Sign Up**. Each registration creates an org + admin user, both initially disabled.
4. The super admin approves or rejects each organization from the **Organizations** panel.
5. Once approved, the org admin can create departments, invite users, and configure budgets.

---

## Documentation

| File | Contents |
|---|---|
| [docs/architecture.md](./docs/architecture.md) | System design, component interaction, multi-tenancy model, role hierarchy |
| [docs/features.md](./docs/features.md) | End-to-end feature walkthroughs for every part of the product |
| [docs/backend.md](./docs/backend.md) | Backend internals — server setup, middleware, all services, cron jobs, logging |
| [docs/frontend.md](./docs/frontend.md) | Frontend architecture — routing, state management, Axios interceptors, Socket.IO |
| [docs/api-reference.md](./docs/api-reference.md) | Full REST API reference — every route, parameters, auth, and responses |
| [docs/data-models.md](./docs/data-models.md) | MongoDB models — fields, relationships, approval state machine, budget lifecycle |
| [docs/websockets.md](./docs/websockets.md) | WebSocket architecture — all client↔server events and payloads |
| [docs/deployment-runbook.md](./docs/deployment-runbook.md) | Deployment, worker, SQS DLQ, health checks, backups, and rollback notes |

---

## License

[MIT](./LICENSE) © 2026 Lakshya Sharma
