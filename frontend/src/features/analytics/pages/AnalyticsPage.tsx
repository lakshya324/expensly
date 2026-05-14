import { RefreshCw, CheckCircle2, Clock, XCircle, Receipt, AlertTriangle } from 'lucide-react';
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend, ComposedChart, Area, Line,
} from 'recharts';
import { AppShell } from '@/shared/components/layout/AppShell';
import { StatCard } from '@/shared/components/data-display/StatCard';
import { Button } from '@/shared/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/shared/components/ui/Card';
import { Skeleton } from '@/shared/components/ui/Skeleton';
import { useAnalytics } from '../hooks/useAnalytics';
import { formatCurrency, formatDuration, formatPercent, formatRelativeTime } from '@/core/utils/formatters';
import { useAuthStore } from '@/features/auth/store/authStore';
import type { Currency } from '@/core/types/api.types';
import type { ExpenseTypeBreakdownItem } from '@/core/types/analytics.types';

const PIE_COLORS = ['#6d28d9', '#7c3aed', '#8b5cf6', '#a855f7', '#9333ea', '#7e22ce', '#6b21a8', '#9d4edd', '#7c3aed', '#5b21b6'];
const BAR_COLOR = '#7c3aed';
const AREA_COLOR = '#a855f7';

const EXPENSE_TYPE_COLORS: Record<string, string> = {
  regular: '#7c3aed',
  per_diem: '#0ea5e9',
  mileage: '#10b981',
};

const EXPENSE_TYPE_LABELS: Record<string, string> = {
  regular: 'Regular',
  per_diem: 'Per Diem',
  mileage: 'Mileage',
};

function formatMonthLabel(year: number, month: number): string {
  return new Date(year, month - 1, 1).toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
}

function expenseTypeColor(item: ExpenseTypeBreakdownItem): string {
  return EXPENSE_TYPE_COLORS[item.type] ?? '#94a3b8';
}

function truncateLabel(value: string, max = 18): string {
  if (!value) return '';
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

const PIE_SIDE_LEGEND_STYLE = {
  fontSize: '11px',
  lineHeight: '14px',
  paddingLeft: '2px',
  right: '8px',
};

function renderLegendLabel(value: string): JSX.Element {
  return <span className="text-[11px] text-[var(--foreground)]">{value}</span>;
}

function merchantChartHeight(count: number): number {
  return Math.max(160, Math.min(240, count * 34));
}

export function AnalyticsPage() {
  const { data, loading, refreshing, refresh } = useAnalytics();
  const baseCurrency = useAuthStore((s) => s.user?.org?.baseCurrency ?? 'USD');

  return (
    <AppShell title="Analytics">
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-xl font-bold text-[var(--foreground)]">Analytics</h2>
            <p className="text-sm text-[var(--muted-foreground)]">
              {data?.generatedAt ? `Last updated: ${formatRelativeTime(data.generatedAt)}` : 'Organisation expense insights'}
            </p>
          </div>
          <Button variant="outline" loading={refreshing} onClick={refresh}>
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <StatCard
            title="Total Expenses"
            value={loading ? '-' : (data?.org.totalTickets ?? 0)}
            icon={Receipt}
            color="brand"
            loading={loading}
          />
          <StatCard
            title="Approved"
            value={loading ? '-' : (data?.org.totalApproved ?? 0)}
            subtitle={data ? `${formatCurrency(data.org.totalAmountApproved, baseCurrency, true)} total` : undefined}
            icon={CheckCircle2}
            color="success"
            loading={loading}
          />
          <StatCard
            title="Pending"
            value={loading ? '-' : ((data?.org.totalPending ?? 0) + (data?.org.totalAwaitingFinance ?? 0))}
            icon={Clock}
            color="warning"
            loading={loading}
          />
          <StatCard
            title="Rejected"
            value={loading ? '-' : (data?.org.totalRejected ?? 0)}
            icon={XCircle}
            color="danger"
            loading={loading}
          />
          <StatCard
            title="Flagged"
            value={loading ? '-' : (data?.org.totalFlagged ?? 0)}
            subtitle={data?.org.flaggedRate != null ? `${data.org.flaggedRate.toFixed(1)}% of total` : undefined}
            icon={AlertTriangle}
            color="warning"
            loading={loading}
          />
        </div>

        {/* Monthly Spending Trend */}
        <Card>
          <CardHeader>
            <CardTitle>Monthly Spending Trend</CardTitle>
            <CardDescription>Expenses submitted and approved over the last 12 months</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-64 w-full" /> : (
              data?.org.monthlyTrend && data.org.monthlyTrend.length > 0 ? (
                <ResponsiveContainer width="100%" height={260}>
                  <ComposedChart data={data.org.monthlyTrend.map((p) => ({
                    ...p,
                    label: formatMonthLabel(p.year, p.month),
                  }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis yAxisId="left" tick={{ fontSize: 11 }} allowDecimals={false} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} tickFormatter={(v) => formatCurrency(v, baseCurrency, true)} width={90} />
                    <Tooltip
                      contentStyle={{ backgroundColor: 'var(--popover)', border: '1px solid var(--border)', borderRadius: '12px', color: 'var(--popover-foreground)' }}
                      formatter={(value: number, name: string) =>
                        name === 'Approved Amount'
                          ? [formatCurrency(value, baseCurrency), name]
                          : [value, name]
                      }
                    />
                    <Legend />
                    <Area yAxisId="left" type="monotone" dataKey="submittedCount" name="Submitted" fill={AREA_COLOR} stroke={AREA_COLOR} fillOpacity={0.15} dot={false} />
                    <Line yAxisId="right" type="monotone" dataKey="approvedAmount" name="Approved Amount" stroke={BAR_COLOR} strokeWidth={2} dot={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm text-[var(--muted-foreground)] text-center py-12">No trend data yet</p>
              )
            )}
          </CardContent>
        </Card>

        {/* Category Breakdown + Expense Type Split */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <Card>
            <CardHeader>
              <CardTitle>Category Breakdown</CardTitle>
              <CardDescription>Top 10 categories by approved spend (All-time)</CardDescription>
            </CardHeader>
            <CardContent className="pt-2 pb-3">
              {loading ? <Skeleton className="h-44 w-full" /> : (
                data?.org.categoryBreakdown && data.org.categoryBreakdown.length > 0 ? (
                  <ResponsiveContainer width="100%" height={210}>
                    <PieChart>
                      <Pie
                        data={data.org.categoryBreakdown}
                        dataKey="totalAmount"
                        nameKey="name"
                        cx="40%"
                        cy="48%"
                        innerRadius={36}
                        outerRadius={70}
                        label={false}
                        labelLine={false}
                      >
                        {data.org.categoryBreakdown.map((_, i) => (
                          <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Legend
                        layout="vertical"
                        align="right"
                        verticalAlign="middle"
                        iconSize={7}
                        wrapperStyle={PIE_SIDE_LEGEND_STYLE}
                        iconType="circle"
                        formatter={(value) => renderLegendLabel(truncateLabel(String(value), 14))}
                      />
                      <Tooltip
                        formatter={(v: number, _name: string, props: any) => [
                          formatCurrency(v, baseCurrency),
                          props?.payload?.name ?? 'Category',
                        ]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-sm text-[var(--muted-foreground)] text-center py-12">No category data yet</p>
                )
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Expense Type Split</CardTitle>
              <CardDescription>Distribution by expense type (All-time)</CardDescription>
            </CardHeader>
            <CardContent className="pt-2 pb-3">
              {loading ? <Skeleton className="h-44 w-full" /> : (
                data?.org.expenseTypeBreakdown && data.org.expenseTypeBreakdown.length > 0 ? (
                  <ResponsiveContainer width="100%" height={210}>
                    <PieChart>
                      <Pie
                        data={data.org.expenseTypeBreakdown.map((e) => ({ ...e, label: EXPENSE_TYPE_LABELS[e.type] ?? e.type }))}
                        dataKey="count"
                        nameKey="label"
                        cx="40%"
                        cy="48%"
                        innerRadius={36}
                        outerRadius={70}
                        label={false}
                        labelLine={false}
                      >
                        {data.org.expenseTypeBreakdown.map((e, i) => (
                          <Cell key={i} fill={expenseTypeColor(e)} />
                        ))}
                      </Pie>
                      <Legend
                        layout="vertical"
                        align="right"
                        verticalAlign="middle"
                        iconSize={7}
                        wrapperStyle={PIE_SIDE_LEGEND_STYLE}
                        iconType="circle"
                        formatter={(value) => renderLegendLabel(truncateLabel(String(value), 14))}
                      />
                      <Tooltip formatter={(v: number, _name: string, props: any) => [
                        `${v} tickets · ${formatCurrency(props?.payload?.totalAmount ?? 0, baseCurrency, true)}`,
                        props?.payload?.label ?? '',
                      ]} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-sm text-[var(--muted-foreground)] text-center py-12">No data yet</p>
                )
              )}
            </CardContent>
          </Card>
        </div>

        {/* Top Merchants + Currency Breakdown */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <Card>
            <CardHeader>
              <CardTitle>Top Merchants</CardTitle>
              <CardDescription>Top 10 merchants by approved spend (All-time)</CardDescription>
            </CardHeader>
            <CardContent className="pt-2 pb-3">
              {loading ? <Skeleton className="h-44 w-full" /> : (
                data?.org.merchantBreakdown && data.org.merchantBreakdown.length > 0 ? (
                  <ResponsiveContainer width="100%" height={merchantChartHeight(data.org.merchantBreakdown.slice(0, 8).length)}>
                    <BarChart data={data.org.merchantBreakdown.slice(0, 8)} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => formatCurrency(v, baseCurrency, true)} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={88} />
                      <Tooltip formatter={(v: number) => [formatCurrency(v, baseCurrency), 'Spend']} />
                      <Bar dataKey="totalAmount" fill={BAR_COLOR} radius={[0, 4, 4, 0]} barSize={16} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-sm text-[var(--muted-foreground)] text-center py-12">No merchant data yet</p>
                )
              )}
            </CardContent>
          </Card>

          {/* Currency Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle>Currency Breakdown</CardTitle>
              <CardDescription>Approved amount by currency (All-time, converted to {baseCurrency})</CardDescription>
            </CardHeader>
            <CardContent className="pt-2 pb-3">
              {loading ? <Skeleton className="h-44 w-full" /> : (
                data?.org.currencyBreakdown && data.org.currencyBreakdown.length > 0 ? (
                  <ResponsiveContainer width="100%" height={210}>
                    <PieChart>
                      <Pie
                        data={data.org.currencyBreakdown}
                        dataKey="total"
                        nameKey="currency"
                        cx="40%"
                        cy="48%"
                        innerRadius={36}
                        outerRadius={70}
                        label={false}
                        labelLine={false}
                      >
                        {data.org.currencyBreakdown.map((_, i) => (
                          <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Legend
                        layout="vertical"
                        align="right"
                        verticalAlign="middle"
                        iconSize={7}
                        wrapperStyle={PIE_SIDE_LEGEND_STYLE}
                        iconType="circle"
                        formatter={(value) => renderLegendLabel(truncateLabel(String(value), 14))}
                      />
                      <Tooltip formatter={(_v: number | undefined, _name: string | undefined, props: { payload?: { currency?: string; originalTotal?: number; total?: number } }) => {
                        const currency = props?.payload?.currency ?? '';
                        const originalTotal = props?.payload?.originalTotal ?? 0;
                        const convertedTotal = props?.payload?.total ?? 0;
                        return [
                          `${formatCurrency(convertedTotal, baseCurrency, true)} • ${formatCurrency(originalTotal, currency as Currency, true)}`,
                          currency || 'Currency',
                        ];
                      }} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-sm text-[var(--muted-foreground)] text-center py-12">No data yet</p>
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
