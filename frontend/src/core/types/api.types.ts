export interface ApiResponse<T> {
  success: boolean;
  message: string;
  timestamp: string;
  data: T;
}

export interface PaginationMeta {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export interface PaginatedData<T> {
  data: T[];
  pagination: PaginationMeta;
}

export interface ApiError {
  code: string;
  details?: Record<string, unknown>;
}

export type Role = 'user' | 'admin' | 'super_admin';

export type TicketStatus =
  | 'draft'
  | 'scanning'
  | 'failed'
  | 'pending'
  | 'awaiting_finance'
  | 'approved'
  | 'rejected';

export type ExpenseType = 'regular' | 'per_diem' | 'mileage';

export type Currency =
  | 'USD' | 'EUR' | 'GBP' | 'INR' | 'JPY' | 'CAD' | 'AUD' | 'CHF' | 'CNY' | 'SGD'
  | 'AED' | 'HKD' | 'MXN' | 'BRL' | 'KRW' | 'SEK' | 'NOK' | 'DKK' | 'NZD' | 'ZAR'
  | 'THB' | 'MYR' | 'IDR' | 'PHP' | 'PKR' | 'BDT' | 'EGP' | 'SAR' | 'QAR' | 'TRY';

export type BudgetResetPeriod = 'none' | 'monthly' | 'quarterly' | 'yearly';
