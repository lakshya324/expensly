import { useNavigate } from 'react-router-dom';
import { Plus, Receipt, Clock, CheckCircle2, XCircle } from 'lucide-react';
import { AppShell } from '@/shared/components/layout/AppShell';
import { StatCard } from '@/shared/components/data-display/StatCard';
import { DataTable, type Column } from '@/shared/components/data-display/DataTable';
import { StatusBadge } from '@/shared/components/data-display/StatusBadge';
import { Button } from '@/shared/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/Card';
import { useExpenses, useExpenseStats } from '@/features/expenses/hooks/useExpenses';
import { useAuthStore } from '@/features/auth/store/authStore';
import { ROUTES } from '@/core/constants/constants';
import { formatCurrency, formatRelativeTime } from '@/core/utils/formatters';
import type { ITicketSummaryData } from '@/core/types/ticket.types';

export function UserDashboardPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const { data: recent, loading: recentLoading } = useExpenses({ page: 1, limit: 5 });
  const { data: statsData, loading: statsLoading } = useExpenseStats();

  const stats = {
    total:    statsData?.total    ?? 0,
    pending:  statsData?.pending  ?? 0,
    approved: statsData?.approved ?? 0,
    rejected: statsData?.rejected ?? 0,
  };

  const recentColumns: Column<ITicketSummaryData>[] = [
    {
      key: 'title',
      header: 'Title',
      render: (row) => <span className="font-medium text-[var(--foreground)] truncate max-w-[160px] block">{row.title}</span>,
    },
    {
      key: 'amount',
      header: 'Amount',
      render: (row) => (
        <span className="font-semibold text-[var(--foreground)]">
          {row.amount != null && row.currency
            ? formatCurrency(row.amount, row.currency)
            : <span className="text-[var(--muted-foreground)] italic text-xs">Pending</span>}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: 'date',
      header: 'Date',
      render: (row) => <span className="text-xs text-[var(--muted-foreground)]">{formatRelativeTime(row.createdAt)}</span>,
    },
  ];

  return (
    <AppShell title="Dashboard">
      <div className="space-y-6">
        {/* Welcome */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-2xl font-bold text-[var(--foreground)]">
              Good {getGreeting()}, {user?.name?.split(' ')[0]} 👋
            </h2>
            <p className="text-sm text-[var(--muted-foreground)] mt-0.5">
              Here's an overview of your expense activity
            </p>
          </div>
          <Button onClick={() => navigate(ROUTES.EXPENSE_NEW)}>
            <Plus className="w-4 h-4" />
            New Expense
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard title="Total Submitted" value={statsLoading ? '—' : stats.total} icon={Receipt} color="brand" />
          <StatCard title="Pending Review" value={statsLoading ? '—' : stats.pending} icon={Clock} color="warning" />
          <StatCard title="Approved" value={statsLoading ? '—' : stats.approved} icon={CheckCircle2} color="success" />
          <StatCard title="Rejected" value={statsLoading ? '—' : stats.rejected} icon={XCircle} color="danger" />
        </div>

        {/* Recent Expenses */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle>Recent Expenses</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => navigate(ROUTES.EXPENSES)}>
              View all
            </Button>
          </CardHeader>
          <CardContent className="pt-0 px-0">
            <DataTable
              columns={recentColumns}
              data={recent}
              loading={recentLoading}
              onRowClick={(row) => navigate(ROUTES.EXPENSE_DETAIL(row._id))}
              emptyTitle="No expenses yet"
              emptyDescription="Submit your first expense request."
              className="border-0 shadow-none rounded-none"
            />
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 18) return 'afternoon';
  return 'evening';
}
