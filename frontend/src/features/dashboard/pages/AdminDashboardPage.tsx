import { useNavigate } from 'react-router-dom';
import { Users, Building2, Receipt, Clock, CheckCircle2, XCircle, BarChart3, RefreshCw } from 'lucide-react';
import { AppShell } from '@/shared/components/layout/AppShell';
import { StatCard } from '@/shared/components/data-display/StatCard';
import { Button } from '@/shared/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/shared/components/ui/Card';
import { Skeleton } from '@/shared/components/ui/Skeleton';
import { useAnalytics } from '@/features/analytics/hooks/useAnalytics';
import { ROUTES } from '@/core/constants/constants';
import { formatCurrency, formatPercent } from '@/core/utils/formatters';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';

export function AdminDashboardPage() {
  const navigate = useNavigate();
  const { data, loading, refreshing, refresh } = useAnalytics();

  return (
    <AppShell title="Admin Dashboard">
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-2xl font-bold text-[var(--foreground)]">Admin Dashboard</h2>
            <p className="text-sm text-[var(--muted-foreground)]">Organisation-wide expense overview</p>
          </div>
          <Button variant="outline" loading={refreshing} onClick={refresh}>
            <RefreshCw className="w-4 h-4" />
            Refresh
          </Button>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Total Expenses"
            value={loading ? '—' : (data?.org.totalTickets ?? 0)}
            icon={Receipt} color="brand" loading={loading}
          />
          <StatCard
            title="Pending"
            value={loading ? '—' : ((data?.org.totalPending ?? 0) + (data?.org.totalAwaitingFinance ?? 0))}
            icon={Clock} color="warning" loading={loading}
          />
          <StatCard
            title="Approved"
            value={loading ? '—' : (data?.org.totalApproved ?? 0)}
            subtitle={data ? formatCurrency(data.org.totalAmountApproved, 'USD', true) : undefined}
            icon={CheckCircle2} color="success" loading={loading}
          />
          <StatCard
            title="Rejected"
            value={loading ? '—' : (data?.org.totalRejected ?? 0)}
            icon={XCircle} color="danger" loading={loading}
          />
        </div>

        {/* Quick links */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Manage Expenses', to: ROUTES.ADMIN_EXPENSES, icon: Receipt },
            { label: 'Users', to: ROUTES.ADMIN_USERS, icon: Users },
            { label: 'Departments', to: ROUTES.ADMIN_DEPARTMENTS, icon: Building2 },
            { label: 'Analytics', to: ROUTES.ADMIN_ANALYTICS, icon: BarChart3 },
          ].map(({ label, to, icon: Icon }) => (
            <button
              key={to}
              onClick={() => navigate(to)}
              className="flex items-center gap-3 p-4 rounded-2xl border border-[var(--border)] bg-[var(--card)] hover:border-brand-300 dark:hover:border-brand-700 hover:shadow-sm transition-all text-left"
            >
              <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-brand-50 dark:bg-brand-950/50">
                <Icon className="w-4.5 h-4.5 text-brand-600 dark:text-brand-400" size={18} />
              </div>
              <span className="text-sm font-medium text-[var(--foreground)]">{label}</span>
            </button>
          ))}
        </div>

        {/* Budget chart */}
        {!loading && data?.departments && data.departments.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Department Budget Usage</CardTitle>
              <CardDescription>Spending vs budget across departments</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={data.departments}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} unit="%" />
                  <Tooltip
                    formatter={(v: number) => [`${v.toFixed(1)}%`, 'Used']}
                    contentStyle={{ backgroundColor: 'var(--popover)', border: '1px solid var(--border)', borderRadius: '12px' }}
                  />
                  <Bar dataKey="budgetUsagePercent" fill="#7c3aed" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {loading && <Skeleton className="h-64 w-full rounded-2xl" />}
      </div>
    </AppShell>
  );
}
