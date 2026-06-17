import { useState, useCallback, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Pencil, Trash2, Store, ToggleLeft, ToggleRight } from 'lucide-react';
import { toast } from 'sonner';
import { AppShell } from '@/shared/components/layout/AppShell';
import { Button } from '@/shared/components/ui/Button';
import { Input } from '@/shared/components/ui/Input';
import { Badge } from '@/shared/components/ui/Badge';
import { Card, CardContent } from '@/shared/components/ui/Card';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/shared/components/ui/Dialog';
import { ConfirmDialog } from '@/shared/components/feedback/ConfirmDialog';
import { Skeleton } from '@/shared/components/ui/Skeleton';
import { DataTable } from '@/shared/components/data-display/DataTable';
import type { Column } from '@/shared/components/data-display/DataTable';
import apiClient from '@/infrastructure/api/client';
import { EP } from '@/infrastructure/api/endpoints';
import type { ApiResponse } from '@/core/types/api.types';
import type { IMerchantData } from '@/core/types/ticket.types';
import { formatDateTime } from '@/core/utils/formatters';

const merchantSchema = z.object({
  name: z.string().min(1, 'Name is required').max(120),
});
type MerchantFormValues = z.infer<typeof merchantSchema>;

type ApiErr = { response?: { data?: { message?: string } } };
const errMsg = (e: unknown, fallback: string) =>
  (e as ApiErr)?.response?.data?.message ?? fallback;

function useMerchants(includeInactive: boolean) {
  const [data, setData] = useState<IMerchantData[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.get<ApiResponse<IMerchantData[]>>(
        EP.ADMIN_MERCHANTS + (includeInactive ? '?includeInactive=true' : ''),
      );
      setData(res.data.data ?? []);
    } catch {
      toast.error('Failed to load merchants');
    } finally {
      setLoading(false);
    }
  }, [includeInactive]);

  useEffect(() => { fetch(); }, [fetch]);
  return { data, loading, refetch: fetch };
}

export function AdminMerchantsPage() {
  const [showInactive, setShowInactive] = useState(true);
  const { data, loading, refetch } = useMerchants(showInactive);
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<IMerchantData | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<IMerchantData | null>(null);
  const [toggleTarget, setToggleTarget] = useState<IMerchantData | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [toggling, setToggling] = useState(false);

  const createForm = useForm<MerchantFormValues>({
    resolver: zodResolver(merchantSchema),
    defaultValues: { name: '' },
  });
  const editForm = useForm<MerchantFormValues>({
    resolver: zodResolver(merchantSchema),
    defaultValues: { name: '' },
  });

  const openEdit = (m: IMerchantData) => {
    setEditTarget(m);
    editForm.reset({ name: m.name });
  };

  const handleCreate = createForm.handleSubmit(async (values) => {
    setSaving(true);
    try {
      await apiClient.post(EP.ADMIN_MERCHANTS, {
        name: values.name.trim(),
      });
      toast.success('Merchant created');
      setCreateOpen(false);
      createForm.reset();
      refetch();
    } catch (e: unknown) {
      toast.error(errMsg(e, 'Failed to create merchant'));
    } finally { setSaving(false); }
  });

  const handleEdit = editForm.handleSubmit(async (values) => {
    if (!editTarget) return;
    setSaving(true);
    try {
      await apiClient.patch(EP.ADMIN_MERCHANT(editTarget._id), {
        name: values.name.trim(),
      });
      toast.success('Merchant updated');
      setEditTarget(null);
      editForm.reset();
      refetch();
    } catch (e: unknown) {
      toast.error(errMsg(e, 'Failed to update merchant'));
    } finally { setSaving(false); }
  });

  const handleConfirmToggle = async () => {
    if (!toggleTarget) return;
    setToggling(true);
    try {
      await apiClient.patch(EP.ADMIN_MERCHANT(toggleTarget._id), { isActive: !toggleTarget.isActive });
      toast.success(toggleTarget.isActive ? 'Merchant deactivated' : 'Merchant activated');
      setToggleTarget(null);
      refetch();
    } catch (e: unknown) {
      toast.error(errMsg(e, 'Failed to update status'));
    } finally { setToggling(false); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiClient.delete(EP.ADMIN_MERCHANT(deleteTarget._id));
      toast.success('Merchant deleted');
      setDeleteTarget(null);
      refetch();
    } catch (e: unknown) {
      toast.error(errMsg(e, 'Failed to delete merchant'));
    } finally { setDeleting(false); }
  };

  const columns: Column<IMerchantData>[] = [
    {
      key: 'name',
      header: 'Name',
      render: (row) => (
        <div className="flex items-center gap-2">
          <Store className="w-3.5 h-3.5 text-(--muted-foreground)" />
          <span className="font-medium text-(--foreground)">{row.name}</span>
        </div>
      ),
    },
    {
      key: 'isActive',
      header: 'Status',
      render: (row) => (
        <Badge variant={row.isActive ? 'success' : 'muted'}>
          {row.isActive ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
    {
      key: 'createdAt',
      header: 'Created',
      render: (row) => (
        <span className="text-sm text-(--muted-foreground)">{formatDateTime(row.createdAt)}</span>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (row) => (
        <div className="flex items-center gap-1 justify-end">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={(e) => { e.stopPropagation(); setToggleTarget(row); }}
            title={row.isActive ? 'Deactivate' : 'Activate'}
            className={row.isActive ? 'text-warning-500 hover:text-warning-600 hover:bg-warning-50 dark:hover:bg-warning-500/10' : 'text-success-500 hover:text-success-600 hover:bg-success-50 dark:hover:bg-success-500/10'}
          >
            {row.isActive
              ? <ToggleRight className="w-4 h-4" />
              : <ToggleLeft className="w-4 h-4" />}
          </Button>
          <Button variant="ghost" size="icon-sm" onClick={(e) => { e.stopPropagation(); openEdit(row); }}>
            <Pencil className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={(e) => { e.stopPropagation(); setDeleteTarget(row); }}
            className="text-danger-500 hover:text-danger-600 hover:bg-danger-50 dark:hover:bg-danger-500/10"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <AppShell title="Merchants">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-(--foreground)">Merchants</h1>
            <p className="text-sm text-(--muted-foreground)">Manage your organisation's merchant directory</p>
          </div>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 text-sm text-(--muted-foreground) cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showInactive}
                onChange={(e) => setShowInactive(e.target.checked)}
                className="accent-brand-600"
              />
              Show inactive
            </label>
            <Button onClick={() => { createForm.reset(); setCreateOpen(true); }}>
              <Plus className="w-4 h-4" />
              Add Merchant
            </Button>
          </div>
        </div>

        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-6 space-y-3">
                {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
              </div>
            ) : (
              <DataTable columns={columns} data={data} loading={false} />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={(o) => { if (!o) { setCreateOpen(false); createForm.reset(); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Merchant</DialogTitle>
            <DialogDescription>Add a new merchant to your organisation's directory.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4 mt-2">
            <Input
              label="Name"
              placeholder="e.g. Starbucks"
              error={createForm.formState.errors.name?.message}
              {...createForm.register('name')}
            />
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => { setCreateOpen(false); createForm.reset(); }} disabled={saving}>
                Cancel
              </Button>
              <Button type="submit" loading={saving}>Create</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={!!editTarget} onOpenChange={(o) => {
        if (!o) {
          setEditTarget(null);
          editForm.reset();
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Merchant</DialogTitle>
            <DialogDescription>Update the merchant's name.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEdit} className="space-y-4 mt-2">
            <Input
              label="Name"
              placeholder="e.g. Starbucks"
              error={editForm.formState.errors.name?.message}
              {...editForm.register('name')}
            />
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => { setEditTarget(null); editForm.reset(); }} disabled={saving}>
                Cancel
              </Button>
              <Button type="submit" loading={saving}>Save</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        title="Delete Merchant"
        description={`Are you sure you want to delete "${deleteTarget?.name}"? This cannot be undone.`}
        confirmLabel="Delete"
        variant="destructive"
        loading={deleting}
        onConfirm={handleDelete}
      />

      <ConfirmDialog
        open={!!toggleTarget}
        onOpenChange={(open) => { if (!open) setToggleTarget(null); }}
        title={`${toggleTarget?.isActive ? 'Deactivate' : 'Activate'} Merchant`}
        description={toggleTarget
          ? `Are you sure you want to ${toggleTarget.isActive ? 'deactivate' : 'activate'} "${toggleTarget.name}"?`
          : ''}
        confirmLabel={toggleTarget?.isActive ? 'Deactivate' : 'Activate'}
        variant={toggleTarget?.isActive ? 'destructive' : 'default'}
        loading={toggling}
        onConfirm={handleConfirmToggle}
      />
    </AppShell>
  );
}
