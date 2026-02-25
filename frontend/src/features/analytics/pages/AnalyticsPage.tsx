import { RefreshCw, BarChart3, TrendingUp, CheckCircle2, Clock, XCircle, Receipt } from 'lucide-react';
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { AppShell } from '@/shared/components/layout/AppShell';
import { StatCard } from '@/shared/components/data-display/StatCard';
import { Button } from '@/shared/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/shared/components/ui/Card';
import { Skeleton } from '@/shared/components/ui/Skeleton';
import { useAnalytics } from '../hooks/useAnalytics';
import { formatCurrency, formatDuration, formatPercent } from '@/core/utils/formatters';
import type { Currency } from '@/core/types/api.types';

const PIE_COLORS = ['#7c3aed', '#a855f7', '#c084fc', '#ddd6fe', '#ede9fe'];
const BAR_COLOR = '#7c3aed';

export function AnalyticsPage() {
  const { data, loading, refreshing, refresh } = useAnalytics();

  return (
    <AppShell title="Analytics">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-xl font-bold text-[var(--foreground)]">Analytics</h2>
            <p className="text-sm text-[var(--muted-foreground)]">
              {data?.generatedAt ? `Last updated: ${new Date(data.generatedAt).toLocaleString()}` : 'Organisation expense insights'}
            </p>
          </div>
          <Button variant="outline" loading={refreshing} onClick={refresh}>
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Total Expenses"
            value={loading ? '—' : (data?.org.totalTickets ?? 0)}
            icon={Receipt}
            color="brand"
            loading={loading}
          />
          <StatCard
            title="Approved"
            value={loading ? '—' : (data?.org.totalApproved ?? 0)}
            subtitle={data ? `${formatCurrency(data.org.totalAmountApproved, 'USD', true)} total` : undefined}
            icon={CheckCircle2}
            color="success"
            loading={loading}
          />
          <StatCard
            title="Pending"
            value={loading ? '—' : ((data?.org.totalPending ?? 0) + (data?.org.totalAwaitingFinance ?? 0))}
            icon={Clock}
            color="warning"
            loading={loading}
          />
          <StatCard
            title="Rejected"
            value={loading ? '—' : (data?.org.totalRejected ?? 0)}
            icon={XCircle}
            color="danger"
            loading={loading}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Currency Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle>Currency Breakdown</CardTitle>
              <CardDescription>Approved amount by currency (converted to base currency)</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? <Skeleton className="h-48 w-full" /> : (
                data?.org.currencyBreakdown && data.org.currencyBreakdown.length > 0 ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie
                        data={data.org.currencyBreakdown}
                        dataKey="total"
                        nameKey="currency"
                        cx="50%"
                        cy="50%"
                        outerRadius={75}
                        label={(props: any) => `${props.currency} ${((props.percent ?? 0) * 100).toFixed(0)}%`}
                      >
                        {data.org.currencyBreakdown.map((_, i) => (
                          <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(_v: number | undefined, _name: string | undefined, props: { payload?: { currency?: string; originalTotal?: number } }) => {
                        const currency = props?.payload?.currency ?? '';
                        const originalTotal = props?.payload?.originalTotal ?? 0;
                        return [formatCurrency(originalTotal, currency as Currency), 'Total'];
                      }} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-sm text-[var(--muted-foreground)] text-center py-12">No data yet</p>
                )
              )}
            </CardContent>
          </Card>

          {/* Top Tags */}
          <Card>
            <CardHeader>
              <CardTitle>Top Tags</CardTitle>
              <CardDescription>Most used expense tags</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? <Skeleton className="h-48 w-full" /> : (
                data?.org.topTags && data.org.topTags.length > 0 ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={data.org.topTags.slice(0, 8)} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis type="number" tick={{ fontSize: 11 }} />
                      <YAxis type="category" dataKey="tag" tick={{ fontSize: 11 }} width={80} />
                      <Tooltip />
                      <Bar dataKey="count" fill={BAR_COLOR} radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-sm text-[var(--muted-foreground)] text-center py-12">No tags yet</p>
                )
              )}
            </CardContent>
          </Card>
        </div>

        {/* Department Breakdown */}
        {!loading && data?.departments && data.departments.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Department Budget Usage</CardTitle>
              <CardDescription>Spending vs budget per department</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={data.departments}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} unit="%" />
                  <Tooltip
                    formatter={(v: number | undefined) => [`${(v ?? 0).toFixed(1)}%`, 'Budget Used']}
                    contentStyle={{
                      backgroundColor: 'var(--popover)',
                      border: '1px solid var(--border)',
                      borderRadius: '12px',
                      color: 'var(--popover-foreground)',
                    }}
                  />
                  <Bar dataKey="budgetUsagePercent" fill={BAR_COLOR} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Department Table */}
        {!loading && data?.departments && data.departments.length > 0 && (
          <Card>
            <CardHeader><CardTitle>Department Summary</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)]">
                    <th className="pb-2 text-left text-xs font-semibold text-[var(--muted-foreground)] uppercase">Department</th>
                    <th className="pb-2 text-right text-xs font-semibold text-[var(--muted-foreground)] uppercase">Total</th>
                    <th className="pb-2 text-right text-xs font-semibold text-[var(--muted-foreground)] uppercase">Approved</th>
                    <th className="pb-2 text-right text-xs font-semibold text-[var(--muted-foreground)] uppercase">Budget Used</th>
                    <th className="pb-2 text-right text-xs font-semibold text-[var(--muted-foreground)] uppercase">Avg Resolution</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {data.departments.map((dept) => (
                    <tr key={dept.departmentId} className="hover:bg-[var(--muted)]/40 transition">
                      <td className="py-3 font-medium text-[var(--foreground)]">{dept.name}</td>
                      <td className="py-3 text-right text-[var(--muted-foreground)]">{dept.totalTickets}</td>
                      <td className="py-3 text-right text-success-600 dark:text-success-400 font-medium">{dept.totalApproved}</td>
                      <td className="py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="h-1.5 w-24 rounded-full bg-[var(--muted)] overflow-hidden">
                            <div
                              className="h-full rounded-full bg-brand-500"
                              style={{ width: `${Math.min(dept.budgetUsagePercent ?? 0, 100)}%` }}
                            />
                          </div>
                          <span className="text-xs font-medium text-[var(--foreground)]">
                            {formatPercent(dept.budgetUsagePercent)}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 text-right text-[var(--muted-foreground)]">
                        {formatDuration(dept.avgResolutionTimeMs)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
