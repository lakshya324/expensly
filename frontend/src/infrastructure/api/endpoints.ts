export const EP = {
  // Auth
  AUTH_LOGIN: '/auth/login',
  AUTH_VERIFY_OTP: '/auth/verify-otp',
  AUTH_RESEND_OTP: '/auth/resend-otp',
  AUTH_FORGOT_PASSWORD: '/auth/forgot-password',
  AUTH_RESET_PASSWORD: '/auth/reset-password',
  AUTH_REFRESH: '/auth/refresh',
  AUTH_LOGOUT: '/auth/logout',

  // Expenses (user + admin)
  EXPENSES: '/users/expenses',
  EXPENSE_STATS: '/users/expenses/stats',
  EXPENSE: (id: string) => `/users/expenses/${id}`,
  EXPENSE_FLAG: (id: string) => `/users/expenses/${id}/flag`,
  EXPENSE_STATUS: (id: string) => `/users/expenses/${id}/status`,
  EXPENSE_RECEIPT: (id: string) => `/users/expenses/${id}/receipt`,
  EXPENSE_SCAN: '/users/expenses/scan',
  EXPENSE_SUBMIT_DRAFT: (id: string) => `/users/expenses/${id}/submit`,
  EXPENSE_ENRICH: (id: string) => `/users/expenses/${id}/enrich`,
  EXPENSE_DISCUSSION: (id: string) => `/users/expenses/${id}/discussion`,

  // Merchants
  ADMIN_MERCHANTS: '/admin/merchants',
  ADMIN_MERCHANT: (id: string) => `/admin/merchants/${id}`,
  USER_MERCHANTS: '/users/merchants',

  // Categories
  ADMIN_CATEGORIES: '/admin/categories',
  ADMIN_CATEGORY: (id: string) => `/admin/categories/${id}`,
  USER_CATEGORIES: '/users/categories',

  // Policies
  ADMIN_POLICIES: '/admin/policies',
  ADMIN_POLICY: (id: string) => `/admin/policies/${id}`,

  // Bundles
  BUNDLES: '/users/bundles',
  BUNDLE: (id: string) => `/users/bundles/${id}`,
  BUNDLE_SUBMIT: (id: string) => `/users/bundles/${id}/submit`,
  BUNDLE_TICKETS: (id: string) => `/users/bundles/${id}/tickets`,
  BUNDLE_ADD_TICKETS: (id: string) => `/users/bundles/${id}/tickets`,
  BUNDLE_REMOVE_TICKET: (id: string, ticketId: string) => `/users/bundles/${id}/tickets/${ticketId}`,
  BUNDLE_STATUS: (id: string) => `/users/bundles/${id}/status`,

  // Audit Log
  ADMIN_AUDIT_LOG: '/admin/audit-log',

  // Departments (user-facing)
  USER_DEPARTMENTS: '/users/departments',
  USER_DEPT_TAGS: (id: string) => `/users/departments/${id}/tags`,

  // Departments (admin)
  ADMIN_DEPARTMENTS: '/admin/departments',
  ADMIN_DEPT: (id: string) => `/admin/departments/${id}`,
  ADMIN_DEPT_PERMISSIONS: (id: string) => `/admin/departments/${id}/permissions`,
  ADMIN_DEPT_RESET_BUDGET: (id: string) => `/admin/departments/${id}/reset-budget`,
  ADMIN_DEPT_TAGS: (id: string) => `/admin/departments/${id}/tags`,
  ADMIN_DEPT_TAG: (id: string, tag: string) => `/admin/departments/${id}/tags/${encodeURIComponent(tag)}`,

  // Users (admin)
  ADMIN_USERS: '/admin/users',
  ADMIN_USER: (id: string) => `/admin/users/${id}`,
  ADMIN_USER_DISABLE: (id: string) => `/admin/users/${id}/disable`,
  ADMIN_USER_PERMISSIONS: (id: string) => `/admin/users/${id}/permissions`,

  // Analytics
  ADMIN_ANALYTICS: '/admin/analytics',
  ADMIN_ANALYTICS_REFRESH: '/admin/analytics/refresh',

  // Exchange Rates
  EXCHANGE_RATES: '/admin/exchange-rates',
  EXCHANGE_RATES_FETCH_LATEST: '/admin/exchange-rates/fetch-latest',
  EXCHANGE_RATES_FETCH_PREVIEW: '/admin/exchange-rates/fetch-preview',
  EXCHANGE_RATES_HISTORY: '/admin/exchange-rates/history',
  EXCHANGE_RATES_CURRENCIES: '/admin/exchange-rates/active-currencies',

  // Reports
  EXPORT_REPORT: '/users/reports/export',
  REPORT_LIST: '/users/reports',
  REPORT_EMAIL: (id: string) => `/users/reports/${id}/email`,

  // Superadmin — Organizations
  SA_ORGANIZATIONS: '/superadmin/organizations',
  SA_ORG: (id: string) => `/superadmin/organizations/${id}`,
  SA_ORG_DISABLE: (id: string) => `/superadmin/organizations/${id}/disable`,

  // Superadmin — Users
  SA_USERS: '/superadmin/users',
  SA_USER: (id: string) => `/superadmin/users/${id}`,
  SA_USER_DISABLE: (id: string) => `/superadmin/users/${id}/disable`,
} as const;
