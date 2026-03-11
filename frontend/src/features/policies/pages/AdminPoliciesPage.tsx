import { useState, useCallback, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Pencil, Trash2, ShieldCheck } from 'lucide-react';
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
import type { IPolicyData, PermissionKey } from '@/core/types/ticket.types';
import { formatDateTime } from '@/core/utils/formatters';

const PERMISSION_OPTIONS: { key: PermissionKey; label: string; description: string }[] = [
  { key: 'view_all_tickets', label: 'View All Tickets', description: 'Can see all expense tickets in the org' },
  { key: 'approve_finance', label: 'Finance Approval', description: 'Can approve/reject expenses at the finance level' },
  { key: 'export_reports', label: 'Export Reports', description: 'Can export expense reports' },
  { key: 'view_analytics', label: 'View Analytics', description: 'Can view org-wide analytics dashboards' },
];

const policySchema = z.object({
  name: z.string().min(1, 'Name is required').max(120),
  description: z.string().max(500).optional(),
  grants: z.array(z.string()),
});
type PolicyFormValues = z.infer<typeof policySchema>;

function usePolicies() {
  const [data, setData] = useState<IPolicyData[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.get<ApiResponse<IPolicyData[]>>(
        EP.ADMIN_POLICIES,
      );
      setData(res.data.data ?? []);
    } catch {
      toast.error('Failed to load policies');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);
  return { data, loading, refetch: fetch };
}

function GrantsCheckboxes({
  value,
  onChange,
  disabled,
}: {
  value: string[];
  onChange: (v: string[]) => void;
  disabled?: boolean;
}) {
  const toggle = (key: string) => {
    if (value.includes(key)) onChange(value.filter((k) => k !== key));
    else onChange([...value, key]);
  };

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-[var(--foreground)]">Permissions</p>
      {PERMISSION_OPTIONS.map((opt) => (
        <label
          key={opt.key}
          className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
            value.includes(opt.key)
              ? 'border-brand-500 bg-brand-50 dark:bg-brand-950/40'
              : 'border-[var(--border)] hover:bg-[var(--muted)]'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <input
            type="checkbox"
            className="mt-0.5 accent-brand-600"
            checked={value.includes(opt.key)}
            onChange={() => toggle(opt.key)}
            disabled={disabled}
          />
          <div>
            <p className="text-sm font-medium text-[var(--foreground)]">{opt.label}</p>
            <p className="text-xs text-[var(--muted-foreground)]">{opt.description}</p>
          </div>
        </label>
      ))}
    </div>
  );
}

export function AdminPoliciesPage() {
  const { data, loading, refetch } = usePolicies();
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<IPolicyData | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<IPolicyData | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const createForm = useForm<PolicyFormValues>({
    resolver: zodResolver(policySchema),
    defaultValues: { grants: [] },
  });
  const editForm = useForm<PolicyFormValues>({
    resolver: zodResolver(policySchema),
    defaultValues: { grants: [] },
  });

  const openEdit = (p: IPolicyData) => {
    setEditTarget(p);
    editForm.reset({ name: p.name, description: p.description ?? '', grants: p.grants });
  };

  const handleCreate = createForm.handleSubmit(async (values) => {
    setSaving(true);
    try {
      await apiClient.post(EP.ADMIN_POLICIES, values);
      toast.success('Policy created');
      setCreateOpen(false);
      createForm.reset({ grants: [] });
      refetch();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed to create policy';
      toast.error(msg);
    } finally { setSaving(false); }
  });

  const handleEdit = editForm.handleSubmit(async (values) => {
    if (!editTarget) return;
    setSaving(true);
    try {
      await apiClient.patch(EP.ADMIN_POLICY(editTarget._id), values);
      toast.success('Policy updated');
      setEditTarget(null);
      refetch();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed to update policy';
      toast.error(msg);
    } finally { setSaving(false); }
  });

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiClient.delete(EP.ADMIN_POLICY(deleteTarget._id));
      toast.success('Policy deleted');
      setDeleteTarget(null);
      refetch();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed to delete policy';
      toast.error(msg);
    } finally { setDeleting(false); }
  };

  const columns: Column<IPolicyData>[] = [
    {
      key: 'name',
      header: 'Name',
      render: (row) => (
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-3.5 h-3.5 text-(--muted-foreground)" />
          <div>
            <span className="font-medium text-(--foreground)">{row.name}</span>
            {row.isSystem && <Badge variant="info" className="ml-2 text-[10px] px-1.5 py-0">System</Badge>}
          </div>
        </div>
      ),
    },
    {
      key: 'grants',
      header: 'Permissions',
      render: (row) => (
        <div className="flex flex-wrap gap-1">
          {row.grants.length === 0
            ? <span className="text-xs text-(--muted-foreground)">No permissions</span>
            : row.grants.map((g) => (
                <Badge key={g} variant="muted" className="text-[10px] px-1.5 py-0">
                  {PERMISSION_OPTIONS.find((o) => o.key === g)?.label ?? g}
                </Badge>
              ))
          }
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
    <AppShell title="Policies">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-[var(--foreground)]">Policies</h1>
            <p className="text-sm text-[var(--muted-foreground)]">Define permission grants assignable to users</p>
          </div>
          <Button onClick={() => { createForm.reset({ grants: [] }); setCreateOpen(true); }}>
            <Plus className="w-4 h-4" />
            Add Policy
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
      <Dialog open={createOpen} onOpenChange={(o) => { if (!o) { setCreateOpen(false); createForm.reset({ grants: [] }); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Policy</DialogTitle>
            <DialogDescription>Create a new permission policy.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4 mt-2">
            <Input
              label="Name"
              placeholder="e.g. Finance Team"
              error={createForm.formState.errors.name?.message}
              {...createForm.register('name')}
            />
            <Input
              label="Description"
              placeholder="Optional description"
              {...createForm.register('description')}
            />
            <Controller
              control={createForm.control}
              name="grants"
              render={({ field }) => (
                <GrantsCheckboxes value={field.value} onChange={field.onChange} />
              )}
            />
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => { setCreateOpen(false); createForm.reset({ grants: [] }); }} disabled={saving}>
                Cancel
              </Button>
              <Button type="submit" loading={saving}>Create</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={!!editTarget} onOpenChange={(o) => { if (!o) setEditTarget(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Policy</DialogTitle>
            <DialogDescription>
              {editTarget?.isSystem ? 'System policies can be updated but not deleted.' : 'Update this policy.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEdit} className="space-y-4 mt-2">
            <Input
              label="Name"
              error={editForm.formState.errors.name?.message}
              {...editForm.register('name')}
            />
            <Input
              label="Description"
              {...editForm.register('description')}
            />
            <Controller
              control={editForm.control}
              name="grants"
              render={({ field }) => (
                <GrantsCheckboxes value={field.value} onChange={field.onChange} />
              )}
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
        title="Delete Policy"
        description={`Are you sure you want to delete "${deleteTarget?.name}"? Users assigned this policy will lose the associated permissions.`}
        confirmLabel="Delete"
        variant="destructive"
        loading={deleting}
        onConfirm={handleDelete}
      />
    </AppShell>
  );
}
