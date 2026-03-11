import { useState, useCallback, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Pencil, Trash2, Tag } from 'lucide-react';
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
import type { ICategoryData } from '@/core/types/ticket.types';
import { formatDateTime } from '@/core/utils/formatters';

const categorySchema = z.object({
  name: z.string().min(1, 'Name is required').max(120),
  description: z.string().max(500).optional(),
});
type CategoryFormValues = z.infer<typeof categorySchema>;

function useCategories() {
  const [data, setData] = useState<ICategoryData[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.get<ApiResponse<ICategoryData[]>>(
        EP.ADMIN_CATEGORIES,
      );
      setData(res.data.data ?? []);
    } catch {
      toast.error('Failed to load categories');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);
  return { data, loading, refetch: fetch };
}

export function AdminCategoriesPage() {
  const { data, loading, refetch } = useCategories();
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<ICategoryData | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ICategoryData | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const createForm = useForm<CategoryFormValues>({ resolver: zodResolver(categorySchema) });
  const editForm = useForm<CategoryFormValues>({ resolver: zodResolver(categorySchema) });

  const openEdit = (c: ICategoryData) => {
    setEditTarget(c);
    editForm.reset({ name: c.name, description: c.description || '' });
  };

  const handleCreate = createForm.handleSubmit(async (values) => {
    setSaving(true);
    try {
      await apiClient.post(EP.ADMIN_CATEGORIES, values);
      toast.success('Category created');
      setCreateOpen(false);
      createForm.reset();
      refetch();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed to create category';
      toast.error(msg);
    } finally { setSaving(false); }
  });

  const handleEdit = editForm.handleSubmit(async (values) => {
    if (!editTarget) return;
    setSaving(true);
    try {
      await apiClient.patch(EP.ADMIN_CATEGORY(editTarget._id), values);
      toast.success('Category updated');
      setEditTarget(null);
      refetch();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed to update category';
      toast.error(msg);
    } finally { setSaving(false); }
  });

  const handleToggleActive = async (c: ICategoryData) => {
    try {
      await apiClient.patch(EP.ADMIN_CATEGORY(c._id), { isActive: !c.isActive });
      toast.success(c.isActive ? 'Category deactivated' : 'Category activated');
      refetch();
    } catch {
      toast.error('Failed to update status');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiClient.delete(EP.ADMIN_CATEGORY(deleteTarget._id));
      toast.success('Category deleted');
      setDeleteTarget(null);
      refetch();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed to delete category';
      toast.error(msg);
    } finally { setDeleting(false); }
  };

  const columns: Column<ICategoryData>[] = [
    {
      key: 'name',
      header: 'Name',
      render: (row) => (
        <div className="flex items-center gap-2">
          <Tag className="w-3.5 h-3.5 text-(--muted-foreground)" />
          <div>
            <span className="font-medium text-(--foreground)">{row.name}</span>
            {row.isSystem && <Badge variant="info" className="ml-2 text-[10px] px-1.5 py-0">System</Badge>}
          </div>
        </div>
      ),
    },
    {
      key: 'description',
      header: 'Description',
      render: (row) => (
        <span className="text-sm text-(--muted-foreground) truncate max-w-xs block">
          {row.description || '—'}
        </span>
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
            onClick={(e) => { e.stopPropagation(); handleToggleActive(row); }}
          >
            <span className="text-xs">{row.isActive ? 'Deactivate' : 'Activate'}</span>
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
    <AppShell title="Categories">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-[var(--foreground)]">Categories</h1>
            <p className="text-sm text-[var(--muted-foreground)]">Manage expense categories for your organisation</p>
          </div>
          <Button onClick={() => { createForm.reset(); setCreateOpen(true); }}>
            <Plus className="w-4 h-4" />
            Add Category
          </Button>
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
            <DialogTitle>Add Category</DialogTitle>
            <DialogDescription>Add a new expense category.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4 mt-2">
            <Input
              label="Name"
              placeholder="e.g. Travel"
              error={createForm.formState.errors.name?.message}
              {...createForm.register('name')}
            />
            <Input
              label="Description"
              placeholder="Optional description"
              error={createForm.formState.errors.description?.message}
              {...createForm.register('description')}
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
      <Dialog open={!!editTarget} onOpenChange={(o) => { if (!o) setEditTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Category</DialogTitle>
            <DialogDescription>Update the category details.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEdit} className="space-y-4 mt-2">
            <Input
              label="Name"
              error={editForm.formState.errors.name?.message}
              {...editForm.register('name')}
            />
            <Input
              label="Description"
              error={editForm.formState.errors.description?.message}
              {...editForm.register('description')}
            />
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setEditTarget(null)} disabled={saving}>
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
        title="Delete Category"
        description={`Are you sure you want to delete "${deleteTarget?.name}"? This cannot be undone.`}
        confirmLabel="Delete"
        variant="destructive"
        loading={deleting}
        onConfirm={handleDelete}
      />
    </AppShell>
  );
}
