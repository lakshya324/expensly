import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Filter, X } from 'lucide-react';
import { AppShell } from '@/shared/components/layout/AppShell';
import { DataTable, type Column } from '@/shared/components/data-display/DataTable';
import { StatusBadge } from '@/shared/components/data-display/StatusBadge';
import { Button } from '@/shared/components/ui/Button';
import { useExpenses } from '../hooks/useExpenses';
import { ROUTES } from '@/core/constants/constants';
import { formatCurrency, formatDate } from '@/core/utils/formatters';
import type { ITicketData } from '@/core/types/ticket.types';
import type { TicketStatus } from '@/core/types/api.types';

const STATUS_OPTIONS: { value: TicketStatus | ''; label: string }[] = [
  { value: '', label: 'All Statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'awaiting_finance', label: 'Awaiting Finance' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
];

export function ExpensesPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<TicketStatus | ''>('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');

  // Debounce: commit search 500ms after user stops typing
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const { data, pagination, loading } = useExpenses({ page, limit: 15, status: status || undefined, search: search || undefined });

  const columns: Column<ITicketData>[] = [
    {
      key: 'title',
      header: 'Title',
      render: (row) => (
        <div>
          <p className="font-medium text-[var(--foreground)] truncate max-w-[200px]">{row.title}</p>
          <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
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
        <span className="font-semibold text-[var(--foreground)]">
          {formatCurrency(row.amount, row.currency)}
        </span>
      ),
    },
    {
      key: 'department',
      header: 'Department',
      width: '140px',
      render: (row) => (
        <span className="text-sm text-[var(--muted-foreground)]">
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
        <span className="text-sm text-[var(--muted-foreground)]">{formatDate(row.createdAt)}</span>
      ),
    },
  ];

  return (
    <AppShell title="My Expenses">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-[var(--foreground)]">Expenses</h2>
            <p className="text-sm text-[var(--muted-foreground)]">Track and manage your expense submissions</p>
          </div>
          <Button onClick={() => navigate(ROUTES.EXPENSE_NEW)}>
            <Plus className="w-4 h-4" />
            New Expense
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted-foreground)]" />
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search expenses..."
              className="w-full pl-9 pr-8 py-2 rounded-xl border border-[var(--input)] bg-[var(--background)] text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            {searchInput && (
              <button
                type="button"
                onClick={() => setSearchInput('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-[var(--accent)] transition"
              >
                <X className="w-3.5 h-3.5 text-[var(--muted-foreground)]" />
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-[var(--muted-foreground)]" />
            <select
              value={status}
              onChange={(e) => { setStatus(e.target.value as TicketStatus | ''); setPage(1); }}
              className="px-3 py-2 rounded-xl border border-[var(--input)] bg-[var(--background)] text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            {status && (
              <button onClick={() => setStatus('')} className="p-1.5 rounded-lg hover:bg-[var(--accent)] transition">
                <X className="w-3.5 h-3.5 text-[var(--muted-foreground)]" />
              </button>
            )}
          </div>
        </div>

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
