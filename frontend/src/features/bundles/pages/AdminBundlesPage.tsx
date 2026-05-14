import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Package } from 'lucide-react';
import { toast } from 'sonner';
import { AppShell } from '@/shared/components/layout/AppShell';
import { Badge } from '@/shared/components/ui/Badge';
import { Card, CardContent } from '@/shared/components/ui/Card';
import { DataTable } from '@/shared/components/data-display/DataTable';
import type { Column } from '@/shared/components/data-display/DataTable';
import apiClient from '@/infrastructure/api/client';
import { EP } from '@/infrastructure/api/endpoints';
import type { ApiResponse, PaginatedData } from '@/core/types/api.types';
import type { IBundleData, BundleStatus } from '@/core/types/ticket.types';
import { ROUTES, BUNDLE_STATUS_LABELS, BUNDLE_STATUS_VARIANT } from '@/core/constants/constants';
import { formatRelativeTime } from '@/core/utils/formatters';

function useAdminBundles(page: number, status: string) {
  const [data, setData] = useState<IBundleData[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, unknown> = { page, limit: 15, all: true };
      if (status) params.status = status;
      const res = await apiClient.get<ApiResponse<PaginatedData<IBundleData>>>(
        EP.BUNDLES,
        { params },
      );
      setData(res.data.data?.data ?? []);
      setTotal(res.data.data?.pagination?.totalItems ?? 0);
    } catch {
      toast.error('Failed to load bundles');
    } finally {
      setLoading(false);
    }
  }, [page, status]);

  useEffect(() => { fetch(); }, [fetch]);
  return { data, total, loading };
}

export function AdminBundlesPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>('submitted');

  const { data, total, loading } = useAdminBundles(page, statusFilter);

  const handleStatusChange = (val: string) => {
    setStatusFilter(val);
    setPage(1);
  };

  const columns: Column<IBundleData>[] = [
    {
      key: 'title',
      header: 'Title',
      render: (row) => (
        <div className="flex items-center gap-2">
          <Package className="w-3.5 h-3.5 text-(--muted-foreground)" />
          <span className="font-medium text-(--foreground)">{row.title}</span>
        </div>
      ),
    },
    {
      key: 'submittedBy',
      header: 'Submitted By',
      render: (row) => (
        <div>
          <p className="text-sm text-(--foreground)">{row.submittedBy.name}</p>
          <p className="text-xs text-(--muted-foreground)">{row.submittedBy.email}</p>
        </div>
      ),
    },
    {
      key: 'submittedByDepartment',
      header: 'Department',
      render: (row) => (
        <span className="text-sm text-(--foreground)">
          {row.submittedByDepartment?.name ?? '-'}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <Badge variant={BUNDLE_STATUS_VARIANT[row.status]}>
          {BUNDLE_STATUS_LABELS[row.status]}
        </Badge>
      ),
    },
    {
      key: 'ticketCount',
      header: 'Expenses',
      render: (row) => (
        <span className="text-sm text-(--foreground)">{row.ticketCount}</span>
      ),
    },
    {
      key: 'totalAmountBase',
      header: 'Total',
      render: (row) => (
        <span className="text-sm text-(--foreground)">
          {row.totalAmountBase !== null
            ? `${row.baseCurrency ?? ''}\u00a0${row.totalAmountBase.toFixed(2)}`
            : '-'}
        </span>
      ),
    },
    {
      key: 'createdAt',
      header: 'Created',
      render: (row) => (
        <span className="text-sm text-(--muted-foreground)">{formatRelativeTime(row.createdAt)}</span>
      ),
    },
  ];

  return (
    <AppShell title="Bundles">
      <div className="space-y-4">
        <div>
          <h1 className="text-xl font-bold text-[var(--foreground)]">Expense Bundles</h1>
          <p className="text-sm text-[var(--muted-foreground)]">Review and approve submitted expense bundles</p>
        </div>

        {/* Status filter */}
        <div className="flex items-center gap-2">
          {(['', 'draft', 'submitted', 'approved', 'rejected'] as const).map((s) => (
            <button
              key={s}
              onClick={() => handleStatusChange(s)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                statusFilter === s
                  ? 'bg-brand-600 text-white'
                  : 'bg-[var(--accent)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
              }`}
            >
              {s === '' ? 'All' : BUNDLE_STATUS_LABELS[s as BundleStatus]}
            </button>
          ))}
        </div>

        <Card>
          <CardContent className="p-0">
            <DataTable
              columns={columns}
              data={data}
              loading={loading}
              pagination={{ page, pageSize: 15, totalItems: total, totalPages: Math.ceil(total / 15) }}
              onPageChange={setPage}
              onRowClick={(row) => navigate(ROUTES.ADMIN_BUNDLE_DETAIL(row._id))}
            />
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
