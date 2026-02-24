import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { AppShell } from '@/shared/components/layout/AppShell';
import { DataTable, type Column } from '@/shared/components/data-display/DataTable';
import { StatusBadge } from '@/shared/components/data-display/StatusBadge';
import { Button } from '@/shared/components/ui/Button';
import { ExpenseFiltersBar } from '../components/ExpenseFiltersBar';
import { useExpenses } from '../hooks/useExpenses';
import { ROUTES } from '@/core/constants/constants';
import { formatCurrency, formatDate } from '@/core/utils/formatters';
import type { ITicketData } from '@/core/types/ticket.types';
import type { TicketStatus } from '@/core/types/api.types';

export function ExpensesPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<TicketStatus | ''>('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [flagged, setFlagged] = useState(false);

  // Debounce: commit search 500ms after user stops typing
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const { data, pagination, loading } = useExpenses({ page, limit: 15, status: status || undefined, search: search || undefined, from: dateFrom || undefined, to: dateTo || undefined, flagged: flagged ? 'true' : undefined });

  const clearFilters = () => {
    setSearchInput('');
    setSearch('');
    setStatus('');
    setDateFrom('');
    setDateTo('');
    setFlagged(false);
    setPage(1);
  };

  const hasActiveFilters = !!searchInput || !!status || !!dateFrom || !!dateTo || flagged;

  const columns: Column<ITicketData>[] = [
    {
      key: 'title',
      header: 'Title',
      render: (row) => (
        <div>
          <p className="font-medium text-(--foreground) truncate max-w-50">{row.title}</p>
          <p className="text-xs text-(--muted-foreground) mt-0.5">
            {row.tags.slice(0, 2).join(', ')}
          </p>
        </div>
      ),
    },
    {
      key: 'amount',
      header: 'Amount',
      width: '120px',
      render: (row) => (
        <span className="font-semibold text-(--foreground)">
          {formatCurrency(row.amount, row.currency)}
        </span>
      ),
    },
    {
      key: 'department',
      header: 'Department',
      width: '140px',
      render: (row) => (
        <span className="text-sm text-(--muted-foreground)">
          {row.department?.name ?? '—'}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      width: '150px',
      render: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: 'date',
      header: 'Date',
      width: '110px',
      render: (row) => (
        <span className="text-sm text-(--muted-foreground)">{formatDate(row.createdAt)}</span>
      ),
    },
  ];

  return (
    <AppShell title="My Expenses">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-(--foreground)">Expenses</h2>
            <p className="text-sm text-(--muted-foreground)">Track and manage your expense submissions</p>
          </div>
          <Button onClick={() => navigate(ROUTES.EXPENSE_NEW)}>
            <Plus className="w-4 h-4" />
            New Expense
          </Button>
        </div>

        {/* Filters */}
        <ExpenseFiltersBar
          searchInput={searchInput}
          onSearchChange={(v) => setSearchInput(v)}
          status={status}
          onStatusChange={(v) => { setStatus(v); setPage(1); }}
          hasActiveFilters={hasActiveFilters}
          onClear={clearFilters}
          dateFrom={dateFrom}
          dateTo={dateTo}
          onDateFromChange={(v) => { setDateFrom(v); setPage(1); }}
          onDateToChange={(v) => { setDateTo(v); setPage(1); }}
          flagged={flagged}
          onFlaggedChange={(v) => { setFlagged(v); setPage(1); }}
        />

        {/* Table */}
        <DataTable
          columns={columns}
          data={data}
          loading={loading}
          pagination={pagination ?? undefined}
          onPageChange={setPage}
          onRowClick={(row) => navigate(ROUTES.EXPENSE_DETAIL(row._id))}
          getRowClassName={(row) => row.flagged ? 'border-l-4 border-l-yellow-500 bg-yellow-50/30 dark:bg-yellow-500/10' : ''}
          emptyTitle="No expenses found"
          emptyDescription="Submit your first expense to get started."
        />
      </div>
    </AppShell>
  );
}
