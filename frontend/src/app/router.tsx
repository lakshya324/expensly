import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '@/features/auth/store/authStore';
import { FullPageSpinner } from '@/shared/components/ui/Spinner';
import { ROUTES } from '@/core/constants/constants';
import type { Role } from '@/core/types/api.types';

// ── Lazy pages ────────────────────────────────────────────────
// Auth
const LoginPage = lazy(() => import('@/features/auth/pages/LoginPage').then((m) => ({ default: m.LoginPage })));
const OTPPage = lazy(() => import('@/features/auth/pages/OTPPage').then((m) => ({ default: m.OTPPage })));
const ForgotPasswordPage = lazy(() => import('@/features/auth/pages/ForgotPasswordPage').then((m) => ({ default: m.ForgotPasswordPage })));
const ResetPasswordPage = lazy(() => import('@/features/auth/pages/ResetPasswordPage').then((m) => ({ default: m.ResetPasswordPage })));

// User
const UserDashboardPage = lazy(() =>
  import('@/features/dashboard/pages/UserDashboardPage').then((m) => ({ default: m.UserDashboardPage })),
);
const ExpensesPage = lazy(() =>
  import('@/features/expenses/pages/ExpensesPage').then((m) => ({ default: m.ExpensesPage })),
);
const NewExpensePage = lazy(() =>
  import('@/features/expenses/pages/NewExpensePage').then((m) => ({ default: m.NewExpensePage })),
);
const ExpenseDetailPage = lazy(() =>
  import('@/features/expenses/pages/ExpenseDetailPage').then((m) => ({ default: m.ExpenseDetailPage })),
);

// Admin
const AdminDashboardPage = lazy(() =>
  import('@/features/dashboard/pages/AdminDashboardPage').then((m) => ({ default: m.AdminDashboardPage })),
);
const AdminExpensesPage = lazy(() =>
  import('@/features/expenses/pages/AdminExpensesPage').then((m) => ({ default: m.AdminExpensesPage })),
);
const AdminUsersPage = lazy(() =>
  import('@/features/admin-users/pages/AdminUsersPage').then((m) => ({ default: m.AdminUsersPage })),
);
const DepartmentsPage = lazy(() =>
  import('@/features/departments/pages/DepartmentsPage').then((m) => ({ default: m.DepartmentsPage })),
);
const AnalyticsPage = lazy(() =>
  import('@/features/analytics/pages/AnalyticsPage').then((m) => ({ default: m.AnalyticsPage })),
);
const ExchangeRatesPage = lazy(() =>
  import('@/features/exchange-rates/pages/ExchangeRatesPage').then((m) => ({ default: m.ExchangeRatesPage })),
);
const ReportsPage = lazy(() =>
  import('@/features/reports/pages/ReportsPage').then((m) => ({ default: m.ReportsPage })),
);

// Superadmin
const SuperAdminOrgsPage = lazy(() =>
  import('@/features/superadmin/pages/SuperAdminOrgsPage').then((m) => ({ default: m.SuperAdminOrgsPage })),
);
const SuperAdminUsersPage = lazy(() =>
  import('@/features/superadmin/pages/SuperAdminUsersPage').then((m) => ({ default: m.SuperAdminUsersPage })),
);

// Shared
const ProfilePage = lazy(() =>
  import('@/features/profile/pages/ProfilePage').then((m) => ({ default: m.ProfilePage })),
);

// ── Helpers ───────────────────────────────────────────────────
function roleHome(role: Role): string {
  if (role === 'admin') return ROUTES.ADMIN_DASHBOARD;
  if (role === 'super_admin') return ROUTES.SA_ORGANIZATIONS;
  return ROUTES.USER_DASHBOARD;
}

// ── Route guards ──────────────────────────────────────────────

/**
 * Public-only route: authenticated users are redirected to their home.
 */
function PublicRoute() {
  const { status, user } = useAuthStore();
  if (status === 'idle' || status === 'loading') return <FullPageSpinner />;
  if (status === 'authenticated' && user) return <Navigate to={roleHome(user.role)} replace />;
  return <Outlet />;
}

/**
 * Private route: unauthenticated redirected to login.
 * Optionally restricts to specific roles.
 */
function PrivateRoute({ roles }: { roles?: Role[] }) {
  const { status, user } = useAuthStore();
  if (status === 'idle' || status === 'loading') return <FullPageSpinner />;
  if (status === 'unauthenticated' || !user) return <Navigate to={ROUTES.LOGIN} replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to={roleHome(user.role)} replace />;
  return <Outlet />;
}

// ── Router ────────────────────────────────────────────────────
export function AppRouter() {
  return (
    <Suspense fallback={<FullPageSpinner />}>
      <Routes>
        {/* Root redirect */}
        <Route path="/" element={<RootRedirect />} />

        {/* Auth */}
        <Route element={<PublicRoute />}>
          <Route path={ROUTES.LOGIN} element={<LoginPage />} />
          <Route path={ROUTES.OTP} element={<OTPPage />} />
          <Route path={ROUTES.FORGOT_PASSWORD} element={<ForgotPasswordPage />} />
          <Route path={ROUTES.RESET_PASSWORD} element={<ResetPasswordPage />} />
        </Route>

        {/* User routes */}
        <Route element={<PrivateRoute roles={['user']} />}>
          <Route path={ROUTES.USER_DASHBOARD} element={<UserDashboardPage />} />
          <Route path={ROUTES.EXPENSES} element={<ExpensesPage />} />
          <Route path={ROUTES.EXPENSE_NEW} element={<NewExpensePage />} />
          <Route path="/expenses/:id" element={<ExpenseDetailPage />} />
        </Route>

        {/* Expense detail accessible by both users and admins */}
        <Route element={<PrivateRoute roles={['user', 'admin']} />}>
          <Route path="/expenses/:id" element={<ExpenseDetailPage />} />
        </Route>

        {/* Admin routes */}
        <Route element={<PrivateRoute roles={['admin']} />}>
          <Route path={ROUTES.ADMIN_DASHBOARD} element={<AdminDashboardPage />} />
          <Route path={ROUTES.ADMIN_EXPENSES} element={<AdminExpensesPage />} />
          <Route path={ROUTES.ADMIN_USERS} element={<AdminUsersPage />} />
          <Route path={ROUTES.ADMIN_DEPARTMENTS} element={<DepartmentsPage />} />
          <Route path={ROUTES.ADMIN_ANALYTICS} element={<AnalyticsPage />} />
          <Route path={ROUTES.ADMIN_EXCHANGE_RATES} element={<ExchangeRatesPage />} />
          <Route path={ROUTES.ADMIN_REPORTS} element={<ReportsPage />} />
        </Route>

        {/* Superadmin routes */}
        <Route element={<PrivateRoute roles={['super_admin']} />}>
          <Route path={ROUTES.SA_ORGANIZATIONS} element={<SuperAdminOrgsPage />} />
          <Route path={ROUTES.SA_USERS} element={<SuperAdminUsersPage />} />
        </Route>

        {/* Common */}
        <Route element={<PrivateRoute />}>
          <Route path={ROUTES.PROFILE} element={<ProfilePage />} />
        </Route>

        {/* 404 → root */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}

function RootRedirect() {
  const { status, user } = useAuthStore();
  if (status === 'idle' || status === 'loading') return <FullPageSpinner />;
  if (status === 'authenticated' && user) return <Navigate to={roleHome(user.role)} replace />;
  return <Navigate to={ROUTES.LOGIN} replace />;
}
