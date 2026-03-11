import type { Currency, TicketStatus } from '../types/api.types';

export const CURRENCIES: Currency[] = [
  'USD', 'EUR', 'GBP', 'INR', 'JPY', 'CAD', 'AUD', 'CHF', 'CNY', 'SGD',
  'AED', 'HKD', 'MXN', 'BRL', 'KRW', 'SEK', 'NOK', 'DKK', 'NZD', 'ZAR',
  'THB', 'MYR', 'IDR', 'PHP', 'PKR', 'BDT', 'EGP', 'SAR', 'QAR', 'TRY',
];

export const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$', EUR: '€', GBP: '£', INR: '₹', JPY: '¥', CAD: 'C$',
  AUD: 'A$', CHF: 'Fr', CNY: '¥', SGD: 'S$', AED: 'د.إ', HKD: 'HK$',
  MXN: 'MX$', BRL: 'R$', KRW: '₩', SEK: 'kr', NOK: 'kr', DKK: 'kr',
  NZD: 'NZ$', ZAR: 'R', THB: '฿', MYR: 'RM', IDR: 'Rp', PHP: '₱',
  PKR: '₨', BDT: '৳', EGP: 'E£', SAR: '﷼', QAR: '﷼', TRY: '₺',
};

export const TICKET_STATUS_LABELS: Record<TicketStatus, string> = {
  draft: 'Draft',
  scanning: 'Scanning',
  pending: 'Pending',
  awaiting_finance: 'Awaiting Finance',
  approved: 'Approved',
  rejected: 'Rejected',
};

export const TICKET_STATUS_COLORS: Record<TicketStatus, string> = {
  draft: 'muted',
  scanning: 'info',
  pending: 'warning',
  awaiting_finance: 'info',
  approved: 'success',
  rejected: 'danger',
};

export const ROUTES = {
  // Auth
  LOGIN: '/auth/login',
  OTP: '/auth/otp',
  FORGOT_PASSWORD: '/auth/forgot-password',
  RESET_PASSWORD: '/auth/reset-password',

  // User
  USER_DASHBOARD: '/dashboard',
  EXPENSES: '/expenses',
  EXPENSE_NEW: '/expenses/new',
  EXPENSE_DETAIL: (id: string) => `/expenses/${id}`,

  // User — Bundles
  BUNDLES: '/bundles',
  BUNDLE_DETAIL: (id: string) => `/bundles/${id}`,

  // Admin
  ADMIN_DASHBOARD: '/admin/dashboard',
  ADMIN_EXPENSES: '/admin/expenses',
  ADMIN_USERS: '/admin/users',
  ADMIN_DEPARTMENTS: '/admin/departments',
  ADMIN_ANALYTICS: '/admin/analytics',
  ADMIN_EXCHANGE_RATES: '/admin/exchange-rates',
  ADMIN_REPORTS: '/admin/reports',
  ADMIN_MERCHANTS: '/admin/merchants',
  ADMIN_CATEGORIES: '/admin/categories',
  ADMIN_POLICIES: '/admin/policies',
  ADMIN_AUDIT_LOG: '/admin/audit-log',

  // Superadmin
  SA_ORGANIZATIONS: '/superadmin/organizations',
  SA_USERS: '/superadmin/users',

  // Common
  PROFILE: '/profile',
} as const;
