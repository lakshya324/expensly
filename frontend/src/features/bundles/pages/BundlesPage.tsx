import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Package } from 'lucide-react';
import { toast } from 'sonner';
import { AppShell } from '@/shared/components/layout/AppShell';
import { Button } from '@/shared/components/ui/Button';
import { Badge } from '@/shared/components/ui/Badge';
import { Card, CardContent } from '@/shared/components/ui/Card';
import { DataTable } from '@/shared/components/data-display/DataTable';
import type { Column } from '@/shared/components/data-display/DataTable';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/shared/components/ui/Dialog';
import { Input } from '@/shared/components/ui/Input';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import apiClient from '@/infrastructure/api/client';
import { EP } from '@/infrastructure/api/endpoints';
import type { ApiResponse, PaginatedData } from '@/core/types/api.types';
import type { IBundleData, BundleStatus } from '@/core/types/ticket.types';
import { ROUTES } from '@/core/constants/constants';
import { formatRelativeTime } from '@/core/utils/formatters';

const BUNDLE_STATUS_LABELS: Record<BundleStatus, string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  approved: 'Approved',
  rejected: 'Rejected',
};

const BUNDLE_STATUS_VARIANT: Record<BundleStatus, 'muted' | 'warning' | 'success' | 'danger'> = {
  draft: 'muted',
  submitted: 'warning',
  approved: 'success',
  rejected: 'danger',
};

const bundleSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().max(500).optional(),
});
type BundleFormValues = z.infer<typeof bundleSchema>;

function useBundles(page: number) {
  const [data, setData] = useState<IBundleData[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.get<ApiResponse<PaginatedData<IBundleData>>>(
        EP.BUNDLES,
        { params: { page, limit: 15 } },
      );
      setData(res.data.data?.data ?? []);
      setTotal(res.data.data?.pagination?.totalItems ?? res.data.data?.total ?? 0);
    } catch {
      toast.error('Failed to load bundles');
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => { fetch(); }, [fetch]);
  return { data, total, loading };
}

export function BundlesPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const { data, total, loading } = useBundles(page);
  const [createOpen, setCreateOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const form = useForm<BundleFormValues>({ resolver: zodResolver(bundleSchema) });

  const handleCreate = form.handleSubmit(async (values) => {
    setSaving(true);
    try {
      const res = await apiClient.post<ApiResponse<IBundleData>>(EP.BUNDLES, values);
      toast.success('Bundle created');
      setCreateOpen(false);
      form.reset();
      navigate(ROUTES.BUNDLE_DETAIL(res.data.data._id));
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed to create bundle';
      toast.error(msg);
    } finally { setSaving(false); }
  });

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
          {row.totalAmountBase !== null ? `$${row.totalAmountBase.toFixed(2)}` : '—'}
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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-[var(--foreground)]">Expense Bundles</h1>
            <p className="text-sm text-[var(--muted-foreground)]">Group related expenses and submit them together</p>
          </div>
          <Button onClick={() => { form.reset(); setCreateOpen(true); }}>
            <Plus className="w-4 h-4" />
            New Bundle
          </Button>
        </div>

        <Card>
          <CardContent className="p-0">
            <DataTable
              columns={columns}
              data={data}
              loading={loading}
              pagination={{ page, pageSize: 15, totalItems: total, totalPages: Math.ceil(total / 15) }}
              onPageChange={setPage}
              onRowClick={(row) => navigate(ROUTES.BUNDLE_DETAIL(row._id))}
            />
          </CardContent>
        </Card>
      </div>

      <Dialog open={createOpen} onOpenChange={(o) => { if (!o) { setCreateOpen(false); form.reset(); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Bundle</DialogTitle>
            <DialogDescription>Create a bundle to group related expense submissions.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4 mt-2">
            <Input
              label="Title"
              placeholder="e.g. Q3 Travel Expenses"
              error={form.formState.errors.title?.message}
              {...form.register('title')}
            />
            <Input
              label="Description"
              placeholder="Optional description"
              error={form.formState.errors.description?.message}
              {...form.register('description')}
            />
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => { setCreateOpen(false); form.reset(); }} disabled={saving}>
                Cancel
              </Button>
              <Button type="submit" loading={saving}>Create</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
