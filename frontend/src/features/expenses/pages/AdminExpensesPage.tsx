import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppShell } from '@/shared/components/layout/AppShell';
import { DataTable, type Column } from '@/shared/components/data-display/DataTable';
import { StatusBadge } from '@/shared/components/data-display/StatusBadge';
import { ExpenseFiltersBar } from '../components/ExpenseFiltersBar';
import { useExpenses } from '../hooks/useExpenses';
import { formatDate, formatCurrency } from '@/core/utils/formatters';
import { ROUTES } from '@/core/constants/constants';
import type { TicketStatus } from '@/core/types/api.types';
import type { ITicketData } from '@/core/types/ticket.types';

const COLUMNS: Column<ITicketData>[] = [
  {
    key: 'title',
    header: 'Title',
    render: (row) => (
      <div>
        <p className="font-medium text-foreground line-clamp-1">{row.title}</p>
        {row.tags?.length > 0 && (
          <p className="text-xs text-muted-foreground mt-0.5">{row.tags.slice(0, 3).join(', ')}</p>
        )}
      </div>
    ),
  },
  {
    key: 'submitter',
    header: 'Submitted By',
    render: (row) => (
      <div>
        <p className="text-sm font-medium">{(row as unknown as { submittedBy?: { name?: string } }).submittedBy?.name ?? '—'}</p>
        <p className="text-xs text-muted-foreground">{(row as unknown as { submittedBy?: { email?: string } }).submittedBy?.email ?? ''}</p>
      </div>
    ),
  },
  {
    key: 'department',
    header: 'Department',
    render: (row) => <span className="text-sm">{row.department?.name ?? '—'}</span>,
  },
  {
    key: 'amount',
    header: 'Amount',
    render: (row) => (
      <span className="font-semibold text-foreground">
        {formatCurrency(row.amount, row.currency)}
      </span>
    ),
  },
  {
    key: 'status',
    header: 'Status',
    render: (row) => <StatusBadge status={row.status} />,
  },
  {
    key: 'createdAt',
    header: 'Submitted',
    render: (row) => <span className="text-muted-foreground text-sm">{formatDate(row.createdAt)}</span>,
  },
];

export function AdminExpensesPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<TicketStatus | ''>('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');

  // Debounce: commit search 500 ms after the user stops typing
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Admin endpoint — returns all tickets for the org
  const { data, pagination, loading } = useExpenses({
    page,
    limit: 15,
    status: statusFilter || undefined,
    search: search || undefined,
  });

  const clearFilters = () => {
    setStatusFilter('');
    setSearchInput('');
    setSearch('');
    setPage(1);
  };

  const hasActiveFilters = !!searchInput || !!statusFilter;

  return (
    <AppShell title="All Expenses">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-(--foreground)">All Expenses</h2>
            <p className="text-sm text-(--muted-foreground)">Review and manage expense submissions across the organisation</p>
          </div>
        </div>

        {/* Filters */}
        <ExpenseFiltersBar
          searchInput={searchInput}
          onSearchChange={(v) => setSearchInput(v)}
          status={statusFilter}
          onStatusChange={(v) => { setStatusFilter(v); setPage(1); }}
          hasActiveFilters={hasActiveFilters}
          onClear={clearFilters}
          placeholder="Search by title or description…"
        />

        {/* Table */}
        <DataTable
          columns={COLUMNS}
          data={data}
          loading={loading}
          pagination={pagination ?? undefined}
          onPageChange={setPage}
          onRowClick={(row) => navigate(ROUTES.EXPENSE_DETAIL(row._id))}
          getRowClassName={(row) => row.flagged ? 'border-l-4 border-l-yellow-500 bg-yellow-50/30 dark:bg-yellow-500/10' : ''}
          emptyTitle="No expenses found"
        />
      </div>
    </AppShell>
  );
}
