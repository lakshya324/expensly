/**
 * Swagger / OpenAPI 3.0 Specification  
 * Active only when NODE_ENV === 'development'
 */
import swaggerJsdoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";
import { Express } from "express";
import config from "./config/env.config.js";
import { logInfo } from "./utils/logger.js";

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: "3.0.3",
    info: {
      title: "Expensly API",
      version: "2.2.0",
      description:
        "REST API for Expensly - a multi-tenant expense management platform. " +
        "Supports multi-role authentication (super_admin, admin, user), " +
        "expense ticket lifecycle management, department budgets, exchange rates, real-time analytics, and file uploads.",
      contact: {
        name: "Lakshya Sharma",
        url: "https://github.com/lakshya324/expensly",
      },
      license: {
        name: "MIT",
        url: "https://opensource.org/licenses/MIT",
      },
    },
    servers: [
      {
        url: `http://localhost:${config.port}/api`,
        description: "Local Development Server",
      },
    ],
    tags: [
      { name: "Health", description: "Server health & status" },
      { name: "Auth", description: "Authentication - signup, login (2-step OTP), token refresh, logout" },
      { name: "Tickets", description: "Expense tickets - CRUD, status transitions, receipt uploads" },
      { name: "Admin - Users", description: "Admin: user management within the organisation" },
      { name: "Admin - Departments", description: "Admin: department management, budgets, tags" },
      { name: "Admin - Exchange Rates", description: "Admin: exchange rate snapshots" },
      { name: "Admin - Analytics", description: "Admin: org-level analytics" },
      { name: "SuperAdmin", description: "Super-admin: organisation and cross-org user management" },
    ],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description:
            "Include the access token returned by `POST /auth/verify-otp` as `Bearer <token>` in the Authorization header.",
        },
      },
      schemas: {
        // ── Generic wrappers ───────────────────────────────────────────────
        SuccessResponse: {
          type: "object",
          properties: {
            success: { type: "boolean", example: true },
            message: { type: "string" },
            timestamp: { type: "string", format: "date-time" },
          },
        },
        ErrorResponse: {
          type: "object",
          properties: {
            success: { type: "boolean", example: false },
            message: { type: "string" },
            code: { type: "string", example: "INVALID_CREDENTIALS" },
            timestamp: { type: "string", format: "date-time" },
          },
        },
        Pagination: {
          type: "object",
          properties: {
            page: { type: "integer", example: 1 },
            pageSize: { type: "integer", example: 20 },
            totalItems: { type: "integer", example: 100 },
            totalPages: { type: "integer", example: 5 },
          },
        },
        // ── Auth ───────────────────────────────────────────────────────────
        SignupRequest: {
          type: "object",
          required: ["userName", "orgName", "orgSlug", "adminEmail", "adminPassword"],
          properties: {
            userName: { type: "string", example: "Alice Admin" },
            orgName: { type: "string", example: "Acme Corp" },
            orgSlug: { type: "string", example: "acme-corp" },
            adminEmail: { type: "string", format: "email", example: "alice@acme.com" },
            adminPassword: { type: "string", minLength: 8, example: "SecurePass123!" },
          },
        },
        LoginRequest: {
          type: "object",
          required: ["email", "password"],
          properties: {
            email: { type: "string", format: "email", example: "alice@acme.com" },
            password: { type: "string", example: "SecurePass123!" },
          },
        },
        LoginResponse: {
          allOf: [
            { $ref: "#/components/schemas/SuccessResponse" },
            {
              type: "object",
              properties: {
                data: {
                  type: "object",
                  properties: {
                    otpSessionId: {
                      type: "string",
                      description: "Hex session ID to be passed to POST /auth/verify-otp",
                      example: "a1b2c3d4...",
                    },
                  },
                },
              },
            },
          ],
        },
        VerifyOtpRequest: {
          type: "object",
          required: ["otpSessionId", "otp"],
          properties: {
            otpSessionId: { type: "string", example: "a1b2c3d4..." },
            otp: { type: "string", length: 6, example: "482910" },
          },
        },
        TokenResponse: {
          allOf: [
            { $ref: "#/components/schemas/SuccessResponse" },
            {
              type: "object",
              properties: {
                data: {
                  type: "object",
                  properties: {
                    token: { type: "string", example: "Bearer eyJhbG..." },
                    user: { $ref: "#/components/schemas/User" },
                  },
                },
              },
            },
          ],
        },
        // ── User & Organisation ────────────────────────────────────────────
        User: {
          type: "object",
          properties: {
            id: { type: "string" },
            name: { type: "string" },
            email: { type: "string", format: "email" },
            role: { type: "string", enum: ["user", "admin", "super_admin"] },
            orgId: { type: "string", nullable: true },
            department: { type: "string", nullable: true },
            managerId: { type: "string", nullable: true },
            isDisabled: { type: "boolean" },
            permissions: {
              type: "object",
              properties: {
                canViewAllTickets: { type: "boolean", nullable: true },
                canApprove: { type: "boolean", nullable: true },
              },
            },
            createdAt: { type: "string", format: "date-time" },
          },
        },
        Organization: {
          type: "object",
          properties: {
            id: { type: "string" },
            name: { type: "string" },
            slug: { type: "string" },
            isDisabled: { type: "boolean" },
            baseCurrency: { type: "string", example: "USD" },
            activeCurrencies: { type: "array", items: { type: "string" } },
            createdAt: { type: "string", format: "date-time" },
          },
        },
        // ── Ticket ─────────────────────────────────────────────────────────
        Ticket: {
          type: "object",
          properties: {
            id: { type: "string" },
            title: { type: "string" },
            amount: { type: "number" },
            currency: { type: "string", example: "USD" },
            convertedAmount: { type: "number", nullable: true },
            description: { type: "string" },
            tags: { type: "array", items: { type: "string" } },
            status: {
              type: "string",
              enum: ["pending", "awaiting_finance", "approved", "rejected"],
            },
            receiptKey: { type: "string", nullable: true, description: "S3 key - pass to GET /expenses/:id/receipt for a signed URL" },
            submittedBy: { $ref: "#/components/schemas/User" },
            department: { type: "string", nullable: true },
            orgId: { type: "string" },
            flagged: { type: "boolean" },
            managerApproval: {
              type: "object",
              nullable: true,
              properties: {
                required: { type: "boolean" },
                approved: { type: "boolean", nullable: true },
                reviewedBy: { type: "string", nullable: true },
                reviewedAt: { type: "string", format: "date-time", nullable: true },
                comments: { type: "string", nullable: true },
              },
            },
            financeApproval: {
              type: "object",
              nullable: true,
              properties: {
                approved: { type: "boolean", nullable: true },
                reviewedBy: { type: "string", nullable: true },
                reviewedAt: { type: "string", format: "date-time", nullable: true },
                comments: { type: "string", nullable: true },
              },
            },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
        },
        CreateTicketRequest: {
          type: "object",
          required: ["title", "amount", "currency", "department"],
          properties: {
            title: { type: "string" },
            amount: { type: "number" },
            currency: { type: "string", example: "USD" },
            department: { type: "string", description: "Department ObjectId" },
            description: { type: "string" },
            tags: { type: "array", items: { type: "string" } },
            timestamp: { type: "string", format: "date-time", description: "Override creation timestamp" },
            receipt: { type: "string", format: "binary", description: "Receipt file (image/pdf, max 5MB)" },
          },
        },
        // ── Department ─────────────────────────────────────────────────────
        Department: {
          type: "object",
          properties: {
            id: { type: "string" },
            name: { type: "string" },
            orgId: { type: "string" },
            isActive: { type: "boolean" },
            budget: { type: "number" },
            spent: { type: "number" },
            budgetResetPeriod: { type: "string", enum: ["none", "monthly", "quarterly", "yearly"] },
            tags: { type: "array", items: { type: "string" } },
            permissions: {
              type: "object",
              properties: {
                canViewAllTickets: { type: "boolean" },
                canApprove: { type: "boolean" },
              },
            },
          },
        },
        // ── Exchange Rate ──────────────────────────────────────────────────
        ExchangeRateSnapshot: {
          type: "object",
          properties: {
            id: { type: "string" },
            orgId: { type: "string" },
            baseCurrency: { type: "string" },
            rates: { type: "object", additionalProperties: { type: "number" } },
            activeCurrencies: { type: "array", items: { type: "string" } },
            source: { type: "string", enum: ["manual", "fetched"] },
            createdBy: { type: "string" },
            createdAt: { type: "string", format: "date-time" },
          },
        },
        // ── Analytics ─────────────────────────────────────────────────────
        OrgAnalytics: {
          type: "object",
          properties: {
            orgId: { type: "string" },
            generatedAt: { type: "string", format: "date-time" },
            org: {
              type: "object",
              properties: {
                totalTickets: { type: "integer" },
                totalApproved: { type: "integer" },
                totalRejected: { type: "integer" },
                totalPending: { type: "integer" },
                totalAmountApproved: { type: "number" },
                avgResolutionTimeMs: { type: "number" },
                topTags: { type: "array", items: { type: "object", properties: { tag: { type: "string" }, count: { type: "integer" } } } },
                currencyBreakdown: { type: "array", items: { type: "object" } },
              },
            },
            departments: { type: "array", items: { type: "object" } },
          },
        },
      },
      responses: {
        Unauthorized: {
          description: "Missing or invalid access token",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ErrorResponse" },
              example: { success: false, message: "Not authenticated.", code: "UNAUTHORIZED" },
            },
          },
        },
        Forbidden: {
          description: "Insufficient permissions",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ErrorResponse" },
              example: { success: false, message: "Forbidden", code: "FORBIDDEN" },
            },
          },
        },
        NotFound: {
          description: "Resource not found",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ErrorResponse" },
              example: { success: false, message: "Not found", code: "NOT_FOUND" },
            },
          },
        },
        ValidationError: {
          description: "Request body / params failed validation",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ErrorResponse" },
              example: { success: false, message: "Validation failed", code: "VALIDATION_ERROR" },
            },
          },
        },
        InternalError: {
          description: "Unexpected server error",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ErrorResponse" },
              example: { success: false, message: "Internal server error", code: "INTERNAL_ERROR" },
            },
          },
        },
      },
    },
    security: [{ BearerAuth: [] }],
    paths: {
      // ── Health ────────────────────────────────────────────────────────────
      "/health": {
        get: {
          tags: ["Health"],
          summary: "Health check",
          description: "Returns server status, uptime, and current timestamp.",
          security: [],
          responses: {
            200: {
              description: "Server is healthy",
              content: {
                "application/json": {
                  schema: {
                    allOf: [
                      { $ref: "#/components/schemas/SuccessResponse" },
                      {
                        type: "object",
                        properties: {
                          data: {
                            type: "object",
                            properties: {
                              status: { type: "string", example: "ok" },
                              uptime: { type: "number" },
                              timestamp: { type: "string", format: "date-time" },
                            },
                          },
                        },
                      },
                    ],
                  },
                },
              },
            },
          },
        },
      },

      // ── Auth ──────────────────────────────────────────────────────────────
      "/auth/signup": {
        post: {
          tags: ["Auth"],
          summary: "Register a new organisation",
          description:
            "Creates a new Organisation and its admin User. Both are disabled by default until a super admin approves them.",
          security: [],
          requestBody: {
            required: true,
            content: { "application/json": { schema: { $ref: "#/components/schemas/SignupRequest" } } },
          },
          responses: {
            201: { description: "Signup successful - awaiting super admin approval", content: { "application/json": { schema: { $ref: "#/components/schemas/SuccessResponse" } } } },
            400: {
              description: "Slug or email already taken",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ErrorResponse" },
                  examples: {
                    slugTaken: { value: { success: false, code: "ORG_SLUG_TAKEN", message: "Organization slug already in use" } },
                    emailTaken: { value: { success: false, code: "EMAIL_TAKEN", message: "Admin email already in use" } },
                  },
                },
              },
            },
            422: { $ref: "#/components/responses/ValidationError" },
          },
        },
      },
      "/auth/login": {
        post: {
          tags: ["Auth"],
          summary: "Login Step 1 - validate credentials, send OTP",
          description:
            "Validates email & password. On success, sends a 6-digit OTP to the user's email and returns an `otpSessionId`. " +
            "Pass the `otpSessionId` + OTP to `POST /auth/verify-otp` to receive tokens.",
          security: [],
          requestBody: {
            required: true,
            content: { "application/json": { schema: { $ref: "#/components/schemas/LoginRequest" } } },
          },
          responses: {
            200: { description: "OTP sent to email", content: { "application/json": { schema: { $ref: "#/components/schemas/LoginResponse" } } } },
            401: {
              description: "Invalid credentials",
              content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" }, example: { success: false, code: "INVALID_CREDENTIALS", message: "Invalid credentials" } } },
            },
            403: {
              description: "Account disabled",
              content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" }, example: { success: false, code: "ACCOUNT_DISABLED", message: "Your account has been disabled." } } },
            },
          },
        },
      },
      "/auth/verify-otp": {
        post: {
          tags: ["Auth"],
          summary: "Login Step 2 - verify OTP, receive access token",
          description:
            "Verifies the OTP within its session. On success issues a JWT access token (in the response body) and a `httpOnly` refresh token (in a cookie). " +
            "Max 5 attempts per session before the session is invalidated.",
          security: [],
          requestBody: {
            required: true,
            content: { "application/json": { schema: { $ref: "#/components/schemas/VerifyOtpRequest" } } },
          },
          responses: {
            200: { description: "Login successful - access token issued", content: { "application/json": { schema: { $ref: "#/components/schemas/TokenResponse" } } } },
            401: {
              description: "OTP invalid or session expired",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ErrorResponse" },
                  examples: {
                    invalidOtp: { value: { success: false, code: "INVALID_OTP", message: "Invalid OTP. 4 attempt(s) remaining." } },
                    expired: { value: { success: false, code: "OTP_EXPIRED", message: "OTP expired or invalid session." } },
                  },
                },
              },
            },
            429: {
              description: "Max OTP attempts exceeded",
              content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" }, example: { success: false, code: "OTP_MAX_ATTEMPTS", message: "Too many incorrect OTP attempts." } } },
            },
          },
        },
      },
      "/auth/refresh": {
        post: {
          tags: ["Auth"],
          summary: "Refresh access token",
          description:
            "Issues a new access token using the `expensly_refresh_token` httpOnly cookie. The old refresh token is invalidated (single-use rotation).",
          security: [],
          responses: {
            200: { description: "New access token issued", content: { "application/json": { schema: { allOf: [{ $ref: "#/components/schemas/SuccessResponse" }, { type: "object", properties: { accessToken: { type: "string" } } }] } } } },
            401: {
              description: "No / invalid / expired refresh token",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ErrorResponse" },
                  examples: {
                    missing: { value: { success: false, code: "NO_REFRESH_TOKEN" } },
                    invalid: { value: { success: false, code: "INVALID_REFRESH_TOKEN" } },
                    expired: { value: { success: false, code: "EXPIRED_REFRESH_TOKEN" } },
                  },
                },
              },
            },
          },
        },
      },
      "/auth/logout": {
        post: {
          tags: ["Auth"],
          summary: "Logout - revoke refresh token",
          description: "Revokes the current refresh token and clears the cookie. Requires a valid access token.",
          responses: {
            200: { description: "Logged out successfully" },
            401: { $ref: "#/components/responses/Unauthorized" },
          },
        },
      },

      // ── Tickets ───────────────────────────────────────────────────────────
      "/users/expenses": {
        get: {
          tags: ["Tickets"],
          summary: "List expense tickets",
          description:
            "Returns a paginated list of tickets visible to the requesting user based on their role and permissions. " +
            "Admins see all org tickets; managers see their team's tickets; regular users see their own.",
          parameters: [
            { name: "page", in: "query", schema: { type: "integer", default: 1 } },
            { name: "limit", in: "query", schema: { type: "integer", default: 20, maximum: 100 } },
            { name: "status", in: "query", schema: { type: "string", enum: ["pending", "awaiting_finance", "approved", "rejected"] } },
            { name: "department", in: "query", schema: { type: "string" }, description: "Filter by department ObjectId" },
            { name: "flagged", in: "query", schema: { type: "boolean" } },
          ],
          responses: {
            200: {
              description: "Paginated ticket list",
              content: {
                "application/json": {
                  schema: {
                    allOf: [
                      { $ref: "#/components/schemas/SuccessResponse" },
                      { type: "object", properties: { data: { type: "object", properties: { data: { type: "array", items: { $ref: "#/components/schemas/Ticket" } }, pagination: { $ref: "#/components/schemas/Pagination" } } } } },
                    ],
                  },
                },
              },
            },
            401: { $ref: "#/components/responses/Unauthorized" },
          },
        },
        post: {
          tags: ["Tickets"],
          summary: "Create expense ticket",
          description: "Creates a new expense ticket. Optionally attach a receipt (image or PDF, max 5MB). File is stored at `expensly/<orgSlug>/<ticketId>.<ext>` in S3.",
          requestBody: {
            required: true,
            content: {
              "multipart/form-data": { schema: { $ref: "#/components/schemas/CreateTicketRequest" } },
            },
          },
          responses: {
            201: { description: "Ticket created", content: { "application/json": { schema: { allOf: [{ $ref: "#/components/schemas/SuccessResponse" }, { type: "object", properties: { data: { $ref: "#/components/schemas/Ticket" } } }] } } } },
            400: { $ref: "#/components/responses/ValidationError" },
            401: { $ref: "#/components/responses/Unauthorized" },
          },
        },
      },
      "/users/expenses/{id}": {
        get: {
          tags: ["Tickets"],
          summary: "Get ticket by ID",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
          responses: {
            200: { description: "Ticket detail", content: { "application/json": { schema: { allOf: [{ $ref: "#/components/schemas/SuccessResponse" }, { type: "object", properties: { data: { $ref: "#/components/schemas/Ticket" } } }] } } } },
            401: { $ref: "#/components/responses/Unauthorized" },
            404: { $ref: "#/components/responses/NotFound" },
          },
        },
        patch: {
          tags: ["Tickets"],
          summary: "Update ticket fields",
          description: "Submitter or admin can update title, amount, currency, description, and tags.",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
          requestBody: {
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    title: { type: "string" },
                    amount: { type: "number" },
                    currency: { type: "string" },
                    description: { type: "string" },
                    tags: { type: "array", items: { type: "string" } },
                  },
                },
              },
            },
          },
          responses: {
            200: { description: "Updated", content: { "application/json": { schema: { allOf: [{ $ref: "#/components/schemas/SuccessResponse" }, { type: "object", properties: { data: { $ref: "#/components/schemas/Ticket" } } }] } } } },
            401: { $ref: "#/components/responses/Unauthorized" },
            403: { $ref: "#/components/responses/Forbidden" },
            404: { $ref: "#/components/responses/NotFound" },
          },
        },
        delete: {
          tags: ["Tickets"],
          summary: "Delete ticket",
          description: "Submitter or admin only. Also deletes the receipt from S3.",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
          responses: {
            200: { description: "Deleted" },
            401: { $ref: "#/components/responses/Unauthorized" },
            403: { $ref: "#/components/responses/Forbidden" },
            404: { $ref: "#/components/responses/NotFound" },
          },
        },
      },
      "/users/expenses/{id}/flag": {
        patch: {
          tags: ["Tickets"],
          summary: "Flag / unflag ticket",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
          requestBody: {
            required: true,
            content: { "application/json": { schema: { type: "object", required: ["flagged"], properties: { flagged: { type: "boolean" } } } } },
          },
          responses: { 200: { description: "Updated" }, 401: { $ref: "#/components/responses/Unauthorized" }, 404: { $ref: "#/components/responses/NotFound" } },
        },
      },
      "/users/expenses/{id}/status": {
        patch: {
          tags: ["Tickets"],
          summary: "Update ticket status",
          description:
            "Progresses a ticket through the approval workflow. " +
            "Transitions: `pending` → `awaiting_finance` (manager approves) → `approved` | `rejected` (finance). " +
            "Manager approval step is skipped if the submitter has no `managerId`.",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["status"],
                  properties: {
                    status: { type: "string", enum: ["awaiting_finance", "approved", "rejected"] },
                    comments: { type: "string" },
                  },
                },
              },
            },
          },
          responses: {
            200: { description: "Status updated - submitter receives email notification" },
            400: { description: "Manager approval required first", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" }, example: { code: "MANAGER_APPROVAL_REQUIRED" } } } },
            401: { $ref: "#/components/responses/Unauthorized" },
            404: { $ref: "#/components/responses/NotFound" },
          },
        },
      },
      "/users/expenses/{id}/receipt": {
        get: {
          tags: ["Tickets"],
          summary: "Get pre-signed receipt URL",
          description: "Generates a 1-hour pre-signed S3 URL to download the ticket receipt.",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
          responses: {
            200: {
              description: "Signed URL",
              content: { "application/json": { schema: { allOf: [{ $ref: "#/components/schemas/SuccessResponse" }, { type: "object", properties: { data: { type: "string", example: "https://s3.amazonaws.com/..." } } }] } } },
            },
            404: { description: "Ticket or receipt not found" },
          },
        },
      },

      // ── Admin - Users ─────────────────────────────────────────────────────
      "/admin/users": {
        get: {
          tags: ["Admin - Users"],
          summary: "List org users",
          parameters: [
            { name: "page", in: "query", schema: { type: "integer", default: 1 } },
            { name: "limit", in: "query", schema: { type: "integer", default: 20 } },
            { name: "department", in: "query", schema: { type: "string" } },
          ],
          responses: { 200: { description: "User list" }, 401: { $ref: "#/components/responses/Unauthorized" }, 403: { $ref: "#/components/responses/Forbidden" } },
        },
        post: {
          tags: ["Admin - Users"],
          summary: "Create org user",
          description: "Creates a new user within the admin's organisation. A welcome email is sent to the new user.",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["name", "email", "password", "department"],
                  properties: {
                    name: { type: "string" },
                    email: { type: "string", format: "email" },
                    password: { type: "string" },
                    department: { type: "string" },
                    managerId: { type: "string" },
                  },
                },
              },
            },
          },
          responses: {
            201: { description: "User created - welcome email sent" },
            409: { description: "Email already exists", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" }, example: { code: "DUPLICATE_EMAIL" } } } },
            401: { $ref: "#/components/responses/Unauthorized" },
            403: { $ref: "#/components/responses/Forbidden" },
          },
        },
      },
      "/admin/users/{id}": {
        put: {
          tags: ["Admin - Users"],
          summary: "Edit user",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
          requestBody: {
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    name: { type: "string" },
                    department: { type: "string" },
                    managerId: { type: "string", nullable: true },
                  },
                },
              },
            },
          },
          responses: { 200: { description: "Updated" }, 401: { $ref: "#/components/responses/Unauthorized" }, 404: { $ref: "#/components/responses/NotFound" } },
        },
      },
      "/admin/users/{id}/disable": {
        patch: {
          tags: ["Admin - Users"],
          summary: "Enable / disable user",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
          requestBody: {
            required: true,
            content: { "application/json": { schema: { type: "object", required: ["isDisabled"], properties: { isDisabled: { type: "boolean" } } } } },
          },
          responses: { 200: { description: "Status toggled" }, 401: { $ref: "#/components/responses/Unauthorized" }, 404: { $ref: "#/components/responses/NotFound" } },
        },
      },
      "/admin/users/{id}/permissions": {
        patch: {
          tags: ["Admin - Users"],
          summary: "Update user permissions",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
          requestBody: {
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    canViewAllTickets: { type: "boolean", nullable: true },
                    canApprove: { type: "boolean", nullable: true },
                  },
                },
              },
            },
          },
          responses: { 200: { description: "Permissions updated" }, 401: { $ref: "#/components/responses/Unauthorized" } },
        },
      },

      // ── Admin - Departments ───────────────────────────────────────────────
      "/admin/departments": {
        get: {
          tags: ["Admin - Departments"],
          summary: "List departments",
          responses: { 200: { description: "Department list" }, 401: { $ref: "#/components/responses/Unauthorized" } },
        },
        post: {
          tags: ["Admin - Departments"],
          summary: "Create department",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["name"],
                  properties: {
                    name: { type: "string" },
                    budget: { type: "number" },
                    budgetResetPeriod: { type: "string", enum: ["none", "monthly", "quarterly", "yearly"] },
                  },
                },
              },
            },
          },
          responses: { 201: { description: "Created" }, 401: { $ref: "#/components/responses/Unauthorized" } },
        },
      },
      "/admin/departments/{id}": {
        get: { tags: ["Admin - Departments"], summary: "Get department", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { 200: { description: "Department" }, 404: { $ref: "#/components/responses/NotFound" } } },
        patch: { tags: ["Admin - Departments"], summary: "Update department", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], requestBody: { content: { "application/json": { schema: { $ref: "#/components/schemas/Department" } } } }, responses: { 200: { description: "Updated" } } },
        delete: { tags: ["Admin - Departments"], summary: "Deactivate department", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { 200: { description: "Deactivated" } } },
      },
      "/admin/departments/{id}/reset-budget": {
        post: { tags: ["Admin - Departments"], summary: "Reset department budget", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { 200: { description: "Budget reset" } } },
      },
      "/admin/departments/{id}/tags": {
        get: { tags: ["Admin - Departments"], summary: "Get department tags", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { 200: { description: "Tags" } } },
      },
      "/admin/departments/{id}/tags/{tag}": {
        delete: { tags: ["Admin - Departments"], summary: "Remove department tag", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }, { name: "tag", in: "path", required: true, schema: { type: "string" } }], responses: { 200: { description: "Removed" } } },
      },

      // ── Admin - Exchange Rates ─────────────────────────────────────────────
      "/admin/exchange-rates": {
        get: {
          tags: ["Admin - Exchange Rates"],
          summary: "Get current exchange rate snapshot",
          description: "Returns the most recent exchange rate snapshot for the organisation.",
          responses: { 200: { description: "Current snapshot", content: { "application/json": { schema: { allOf: [{ $ref: "#/components/schemas/SuccessResponse" }, { type: "object", properties: { data: { $ref: "#/components/schemas/ExchangeRateSnapshot" } } }] } } } }, 401: { $ref: "#/components/responses/Unauthorized" } },
        },
        patch: {
          tags: ["Admin - Exchange Rates"],
          summary: "Manually set exchange rates",
          requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["rates"], properties: { rates: { type: "object", additionalProperties: { type: "number" } }, activeCurrencies: { type: "array", items: { type: "string" } } } } } } },
          responses: { 200: { description: "Rates saved" }, 401: { $ref: "#/components/responses/Unauthorized" } },
        },
      },
      "/admin/exchange-rates/fetch-latest": {
        post: {
          tags: ["Admin - Exchange Rates"],
          summary: "Fetch & save latest rates from external API",
          description: "Fetches from `open.er-api.com` (result is cached in Redis for 1 hour per base currency).",
          responses: { 200: { description: "Rates fetched and saved" }, 502: { description: "External API unavailable", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" }, example: { code: "EXCHANGE_RATE_FETCH_ERROR" } } } } },
        },
      },
      "/admin/exchange-rates/history": {
        get: {
          tags: ["Admin - Exchange Rates"],
          summary: "Rate snapshot history",
          parameters: [
            { name: "page", in: "query", schema: { type: "integer", default: 1 } },
            { name: "limit", in: "query", schema: { type: "integer", default: 20 } },
          ],
          responses: { 200: { description: "History list" } },
        },
      },
      "/admin/exchange-rates/active-currencies": {
        patch: {
          tags: ["Admin - Exchange Rates"],
          summary: "Update active currencies",
          requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["activeCurrencies"], properties: { activeCurrencies: { type: "array", items: { type: "string" } } } } } } },
          responses: { 200: { description: "Updated" } },
        },
      },

      // ── Admin - Analytics ─────────────────────────────────────────────────
      "/admin/analytics": {
        get: {
          tags: ["Admin - Analytics"],
          summary: "Get org analytics",
          description: "Returns the pre-computed analytics snapshot (served from Redis cache if fresh, otherwise from MongoDB).",
          responses: {
            200: { description: "Analytics data", content: { "application/json": { schema: { allOf: [{ $ref: "#/components/schemas/SuccessResponse" }, { type: "object", properties: { data: { $ref: "#/components/schemas/OrgAnalytics" } } }] } } } },
            401: { $ref: "#/components/responses/Unauthorized" },
          },
        },
      },
      "/admin/analytics/refresh": {
        post: {
          tags: ["Admin - Analytics"],
          summary: "Force refresh analytics",
          description: "Recomputes analytics from raw ticket data, updates MongoDB, and invalidates Redis cache.",
          responses: { 200: { description: "Analytics refreshed" }, 401: { $ref: "#/components/responses/Unauthorized" } },
        },
      },

      // ── SuperAdmin ────────────────────────────────────────────────────────
      "/superadmin/organizations": {
        get: {
          tags: ["SuperAdmin"],
          summary: "List all organisations",
          parameters: [
            { name: "page", in: "query", schema: { type: "integer", default: 1 } },
            { name: "limit", in: "query", schema: { type: "integer", default: 20 } },
            { name: "search", in: "query", schema: { type: "string" } },
            { name: "isDisabled", in: "query", schema: { type: "boolean" } },
          ],
          responses: { 200: { description: "Organisation list" }, 401: { $ref: "#/components/responses/Unauthorized" }, 403: { $ref: "#/components/responses/Forbidden" } },
        },
      },
      "/superadmin/organizations/{id}/disable": {
        patch: {
          tags: ["SuperAdmin"],
          summary: "Enable / disable organisation",
          description:
            "Enables or disables an organisation. " +
            "The org admin receives an email notification. " +
            "Disabling after initial signup = rejection; enabling = approval.",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
          requestBody: {
            required: true,
            content: { "application/json": { schema: { type: "object", required: ["isDisabled"], properties: { isDisabled: { type: "boolean" } } } } },
          },
          responses: {
            200: { description: "Status toggled - approval/rejection email sent to org admin" },
            400: { description: "Invalid ID", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" }, example: { code: "VALIDATION_ERROR" } } } },
            401: { $ref: "#/components/responses/Unauthorized" },
            403: { $ref: "#/components/responses/Forbidden" },
            404: { $ref: "#/components/responses/NotFound" },
          },
        },
      },
      "/superadmin/users": {
        get: {
          tags: ["SuperAdmin"],
          summary: "List all users across orgs",
          parameters: [
            { name: "page", in: "query", schema: { type: "integer" } },
            { name: "limit", in: "query", schema: { type: "integer" } },
            { name: "orgId", in: "query", schema: { type: "string" } },
            { name: "role", in: "query", schema: { type: "string", enum: ["user", "admin"] } },
          ],
          responses: { 200: { description: "User list" }, 401: { $ref: "#/components/responses/Unauthorized" }, 403: { $ref: "#/components/responses/Forbidden" } },
        },
      },
    },
  },
  apis: [],
};

export const swaggerSpec = swaggerJsdoc(options);

/**
 * Mount Swagger UI at /api-docs (development only).
 */
export function mountSwagger(app: Express): void {
  if (config.nodeEnv !== "development") return;

  logInfo("Mounting Swagger UI at /api-docs");

  app.use(
    "/api-docs",
    swaggerUi.serve,
    swaggerUi.setup(swaggerSpec, {
      customSiteTitle: "Expensly API Docs",
      customCss: `
        .swagger-ui .topbar { background: linear-gradient(135deg, #2563eb, #7c3aed); }
        .swagger-ui .topbar .download-url-wrapper input { color: #2563eb; }
        .swagger-ui .information-container { background: #f8fafc; border-bottom: 2px solid #e2e8f0; }
      `,
      swaggerOptions: {
        persistAuthorization: true,
        displayRequestDuration: true,
        docExpansion: "none",
        filter: true,
        showExtensions: true,
      },
    }),
  );

  // Also serve raw JSON spec
  app.get("/api-docs.json", (_req, res) => {
    res.setHeader("Content-Type", "application/json");
    res.send(swaggerSpec);
  });
}
