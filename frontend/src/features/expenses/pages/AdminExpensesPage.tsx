import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppShell } from '@/shared/components/layout/AppShell';
import { DataTable, type Column } from '@/shared/components/data-display/DataTable';
import { StatusBadge } from '@/shared/components/data-display/StatusBadge';
import { ExpenseFiltersBar } from '../components/ExpenseFiltersBar';
import { useExpenses } from '../hooks/useExpenses';
import { formatDate, formatCurrency } from '@/core/utils/formatters';
import { ROUTES } from '@/core/constants/constants';
import { EP } from '@/infrastructure/api/endpoints';
import apiClient from '@/infrastructure/api/client';
import type { TicketStatus, ApiResponse, PaginatedData } from '@/core/types/api.types';
import type { ITicketData, IDepartmentData } from '@/core/types/ticket.types';
import type { IUserData } from '@/core/types/user.types';
import type { ComboboxOption } from '@/shared/components/ui/SearchCombobox';

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
        {row.amount != null && row.currency
          ? formatCurrency(row.amount, row.currency)
          : <span className="text-muted-foreground italic text-xs">Pending</span>}
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
  const [departmentId, setDepartmentId] = useState('');
  const [departmentLabel, setDepartmentLabel] = useState('');
  const [userId, setUserId] = useState('');
  const [userLabel, setUserLabel] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [flagged, setFlagged] = useState(false);

  // Debounce title/description search
  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput); setPage(1); }, 500);
    return () => clearTimeout(t);
  }, [searchInput]);

  // ── Combobox fetch functions (debounce is handled inside SearchCombobox) ──

  const fetchDepartments = useCallback(async (query: string): Promise<ComboboxOption[]> => {
    const res = await apiClient.get<ApiResponse<PaginatedData<IDepartmentData>>>(
      EP.ADMIN_DEPARTMENTS,
      { params: { search: query, active: true, limit: 15 } },
    );
    return res.data.data.data.map((d) => ({ id: d._id, label: d.name }));
  }, []);

  const fetchUsers = useCallback(async (query: string): Promise<ComboboxOption[]> => {
    const res = await apiClient.get<ApiResponse<PaginatedData<IUserData>>>(
      EP.ADMIN_USERS,
      { params: { search: query, department: departmentId, limit: 15 } },
    );
    return res.data.data.data.map((u) => ({
      id: u._id,
      label: u.name,
      sublabel: u.email,
    }));
  }, [departmentId]);

  const handleDepartmentChange = (id: string, label: string) => {
    setDepartmentId(id);
    setDepartmentLabel(label);
    setUserId('');
    setUserLabel('');
    setPage(1);
  };

  const handleUserChange = (id: string, label: string) => {
    setUserId(id);
    setUserLabel(label);
    setPage(1);
  };

  // Expenses query
  const { data, pagination, loading } = useExpenses({
    page,
    limit: 15,
    status: statusFilter || undefined,
    search: search || undefined,
    department: departmentId || undefined,
    userId: userId || undefined,
    from: dateFrom || undefined,
    to: dateTo || undefined,
    flagged: flagged ? 'true' : undefined,
  });

  const clearFilters = () => {
    setStatusFilter('');
    setSearchInput('');
    setSearch('');
    setDepartmentId(''); setDepartmentLabel('');
    setUserId(''); setUserLabel('');
    setDateFrom('');
    setDateTo('');
    setFlagged(false);
    setPage(1);
  };

  const hasActiveFilters =
    !!searchInput || !!statusFilter || !!departmentId || !!userId ||
    !!dateFrom || !!dateTo || flagged;

  return (
    <AppShell title="All Expenses">
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-(--foreground)">All Expenses</h2>
            <p className="text-sm text-(--muted-foreground)">Review and manage expense submissions across the organisation</p>
          </div>
        </div>

        <ExpenseFiltersBar
          searchInput={searchInput}
          onSearchChange={(v) => setSearchInput(v)}
          status={statusFilter}
          onStatusChange={(v) => { setStatusFilter(v); setPage(1); }}
          hasActiveFilters={hasActiveFilters}
          onClear={clearFilters}
          placeholder="Search by title or description…"
          fetchDepartments={fetchDepartments}
          departmentId={departmentId}
          departmentLabel={departmentLabel}
          onDepartmentChange={handleDepartmentChange}
          fetchUsers={fetchUsers}
          userId={userId}
          userLabel={userLabel}
          onUserChange={handleUserChange}
          dateFrom={dateFrom}
          dateTo={dateTo}
          onDateFromChange={(v) => { setDateFrom(v); setPage(1); }}
          onDateToChange={(v) => { setDateTo(v); setPage(1); }}
          flagged={flagged}
          onFlaggedChange={(v) => { setFlagged(v); setPage(1); }}
        />

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
