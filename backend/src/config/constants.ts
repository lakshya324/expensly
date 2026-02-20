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

// Analytics snapshot max age before considered stale (ms)
export const ANALYTICS_STALE_AFTER_MS = 60 * 60 * 1000; // 1 hour
