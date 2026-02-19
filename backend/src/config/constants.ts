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
  MANAGER_APPROVED: 'manager_approved',
  APPROVED: 'approved',
  REJECTED: 'rejected',
} as const;

export type TicketStatus = (typeof TICKET_STATUS)[keyof typeof TICKET_STATUS];

// Supported currencies
export const CURRENCIES = ['USD', 'INR'] as const;
export type Currency = (typeof CURRENCIES)[number];

// Approval thresholds (mirrors frontend currency.js)
export const APPROVAL_THRESHOLDS: Record<Currency, number> = {
  USD: 100,
  INR: 5000,
};

// SSE
export const SSE_UPDATE_INTERVAL = 5000; // 5 seconds

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
