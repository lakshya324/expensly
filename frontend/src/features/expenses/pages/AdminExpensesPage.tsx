import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Filter, X } from 'lucide-react';
import { AppShell } from '@/shared/components/layout/AppShell';
import { DataTable, type Column } from '@/shared/components/data-display/DataTable';
import { StatusBadge } from '@/shared/components/data-display/StatusBadge';
import { Input } from '@/shared/components/ui/Input';
import { Button } from '@/shared/components/ui/Button';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/shared/components/ui/Select';
import { useExpenses } from '../hooks/useExpenses';
import { formatDate, formatCurrency } from '@/core/utils/formatters';
import { ROUTES } from '@/core/constants/constants';
import type { TicketStatus } from '@/core/types/api.types';
import type { ITicketData } from '@/core/types/ticket.types';

const STATUS_OPTIONS: { label: string; value: TicketStatus | '' }[] = [
  { label: 'All statuses', value: '' },
  { label: 'Pending', value: 'pending' },
  { label: 'Awaiting Finance', value: 'awaiting_finance' },
  { label: 'Approved', value: 'approved' },
  { label: 'Rejected', value: 'rejected' },
];

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
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');

  // Admin endpoint — returns all tickets for the org
  const { data, pagination, loading } = useExpenses({
    page,
    limit: 15,
    status: statusFilter || undefined,
    search: search || undefined,
  });

  const clearFilters = () => {
    setStatusFilter('');
    setSearch('');
    setSearchInput('');
    setPage(1);
  };

  const hasFilters = statusFilter || search;

  return (
    <AppShell title="All Expenses">
      <div className="space-y-4">
        {/* Filters */}
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[200px] max-w-sm">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setSearch(searchInput);
                setPage(1);
              }}
            >
              <Input
                placeholder="Search title or description…"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
              />
            </form>
          </div>

          <Select
            value={statusFilter || 'all'}
            onValueChange={(v) => {
              setStatusFilter(v === 'all' ? '' : (v as TicketStatus));
              setPage(1);
            }}
          >
            <SelectTrigger className="w-[180px]">
              <Filter className="w-3.5 h-3.5 mr-1.5 text-muted-foreground" />
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((opt) => (
                <SelectItem key={opt.value || 'all'} value={opt.value || 'all'}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              <X className="w-4 h-4 mr-1.5" />
              Clear
            </Button>
          )}
        </div>

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
