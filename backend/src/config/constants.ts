// Application Constants

// Roles
export const ROLES = {
  USER: 'user',
  ADMIN: 'admin',
  SUPER_ADMIN: 'super_admin',
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

// Ticket statuses
export const TICKET_STATUS = {
  PENDING: 'pending',
  AWAITING_FINANCE: 'awaiting_finance', // previously manager_approved
  APPROVED: 'approved',
  REJECTED: 'rejected',
} as const;

export type TicketStatus = (typeof TICKET_STATUS)[keyof typeof TICKET_STATUS];

// Supported currencies (ISO 4217)
export const CURRENCIES = [
  'USD', 'EUR', 'GBP', 'INR', 'JPY', 'CAD', 'AUD', 'CHF', 'CNY', 'SGD',
  'AED', 'HKD', 'MXN', 'BRL', 'KRW', 'SEK', 'NOK', 'DKK', 'NZD', 'ZAR',
  'THB', 'MYR', 'IDR', 'PHP', 'PKR', 'BDT', 'EGP', 'SAR', 'QAR', 'TRY',
] as const;

export type Currency = (typeof CURRENCIES)[number];

// Default base currency
export const DEFAULT_BASE_CURRENCY: Currency = 'USD';

// Default active currencies for new orgs
export const DEFAULT_ACTIVE_CURRENCIES: Currency[] = ['USD', 'EUR', 'GBP', 'INR'];

// Budget reset periods
export const BUDGET_RESET_PERIODS = {
  NONE: 'none',
  MONTHLY: 'monthly',
  QUARTERLY: 'quarterly',
  YEARLY: 'yearly',
} as const;

export type BudgetResetPeriod = (typeof BUDGET_RESET_PERIODS)[keyof typeof BUDGET_RESET_PERIODS];

// Pagination defaults
export const DEFAULT_PAGE = 1;
export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 100;

// JWT cookie name
export const REFRESH_TOKEN_COOKIE = 'expensly_refresh_token';

// Bcrypt rounds
export const BCRYPT_ROUNDS = 12;

// S3 signed URL expiry (seconds)
export const S3_URL_EXPIRY = 3600; // 1 hour

// ─── Expense type ────────────────────────────────────────────────────────────
export const EXPENSE_TYPE = {
  REGULAR: 'regular',
  PER_DIEM: 'per_diem',
  MILEAGE: 'mileage',
} as const;

export type ExpenseType = (typeof EXPENSE_TYPE)[keyof typeof EXPENSE_TYPE];

// ─── Receipt OCR status ───────────────────────────────────────────────────────
export const OCR_STATUS = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
} as const;

export type OcrStatus = (typeof OCR_STATUS)[keyof typeof OCR_STATUS];

// ─── AI validation status ─────────────────────────────────────────────────────
export const AI_VALIDATION_STATUS = {
  PENDING: 'pending',
  IN_PROGRESS: 'in_progress',
  PASSED: 'passed',
  FLAGGED: 'flagged',
  ERROR: 'error',
} as const;

export type AiValidationStatus = (typeof AI_VALIDATION_STATUS)[keyof typeof AI_VALIDATION_STATUS];

// ─── Permission keys ──────────────────────────────────────────────────────────
export const PERMISSION_KEY = {
  VIEW_ALL_TICKETS: 'view_all_tickets',
  APPROVE_FINANCE: 'approve_finance',
  EXPORT_REPORTS: 'export_reports',
  VIEW_ANALYTICS: 'view_analytics',
} as const;

export type PermissionKey = (typeof PERMISSION_KEY)[keyof typeof PERMISSION_KEY];

// ─── Expense bundle status ────────────────────────────────────────────────────
export const BUNDLE_STATUS = {
  DRAFT: 'draft',
  SUBMITTED: 'submitted',
  APPROVED: 'approved',
  REJECTED: 'rejected',
} as const;

export type BundleStatus = (typeof BUNDLE_STATUS)[keyof typeof BUNDLE_STATUS];

// ─── Audit log actions ────────────────────────────────────────────────────────
export const AUDIT_ACTION = {
  CREATED: 'created',
  UPDATED: 'updated',
  STATUS_CHANGED: 'status_changed',
  DELETED: 'deleted',
  FLAGGED: 'flagged',
  UNFLAGGED: 'unflagged',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  COMMENTED: 'commented',
  BUNDLE_ADDED: 'bundle_added',
  BUNDLE_REMOVED: 'bundle_removed',
  USER_CREATED: 'user_created',
  USER_UPDATED: 'user_updated',
  USER_DISABLED: 'user_disabled',
  USER_ENABLED: 'user_enabled',
  PERMISSIONS_UPDATED: 'permissions_updated',
} as const;

export type AuditAction = (typeof AUDIT_ACTION)[keyof typeof AUDIT_ACTION];

// ─── Audit log entity types ───────────────────────────────────────────────────
export const ENTITY_TYPE = {
  TICKET: 'ticket',
  USER: 'user',
  DEPARTMENT: 'department',
  BUNDLE: 'bundle',
  MERCHANT: 'merchant',
  CATEGORY: 'category',
} as const;

export type EntityType = (typeof ENTITY_TYPE)[keyof typeof ENTITY_TYPE];

// Analytics snapshot max age before considered stale (ms)
export const ANALYTICS_STALE_AFTER_MS = 60 * 60 * 1000; // 1 hour
