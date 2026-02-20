import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Search, Plus } from 'lucide-react';
import { AppShell } from '@/shared/components/layout/AppShell';
import { DataTable, type Column } from '@/shared/components/data-display/DataTable';
import { Button } from '@/shared/components/ui/Button';
import { Badge } from '@/shared/components/ui/Badge';
import { Input } from '@/shared/components/ui/Input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/Dialog';
import { ConfirmDialog } from '@/shared/components/feedback/ConfirmDialog';
import {
  useSuperAdminOrgs,
  useToggleOrgDisabled,
  useCreateOrg,
  useUpdateOrg,
  type CreateOrgPayload,
  type UpdateOrgPayload,
} from '../hooks/useSuperAdmin';
import { formatDate } from '@/core/utils/formatters';
import { CURRENCIES } from '@/core/constants/constants';
import type { IOrganizationData } from '@/core/types/user.types';
import type { Currency } from '@/core/types/api.types';

type FilterState = 'all' | 'enabled' | 'disabled';

// ─── Create Org Form ──────────────────────────────────────────────────────────

interface CreateOrgForm {
  name: string;
  slug: string;
  baseCurrency: Currency;
}

function CreateOrgDialog({
  open,
  onOpenChange,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSuccess: () => void;
}) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateOrgForm>({ defaultValues: { baseCurrency: 'USD' } });

  const { createOrg, loading } = useCreateOrg(() => {
    reset();
    onOpenChange(false);
    onSuccess();
  });

  const onSubmit = (data: CreateOrgForm) => createOrg(data as CreateOrgPayload);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Organization</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-2">
          <Input
            label="Name"
            placeholder="Acme Corp"
            error={errors.name?.message}
            {...register('name', { required: 'Name is required' })}
          />
          <Input
            label="Slug"
            placeholder="acme-corp"
            error={errors.slug?.message}
            {...register('slug', { required: 'Slug is required' })}
          />
          <div className="w-full">
            <label className="block text-sm font-medium text-[var(--foreground)] mb-1.5">
              Base Currency
            </label>
            <select
              className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--input)] bg-[var(--background)] text-[var(--foreground)] text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              {...register('baseCurrency', { required: true })}
            >
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={loading}>
              Create
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Edit Org Form ────────────────────────────────────────────────────────────

interface EditOrgForm {
  name: string;
  baseCurrency: Currency;
}

function EditOrgDialog({
  org,
  onOpenChange,
  onSuccess,
}: {
  org: IOrganizationData;
  onOpenChange: (o: boolean) => void;
  onSuccess: () => void;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<EditOrgForm>({
    defaultValues: { name: org.name, baseCurrency: org.baseCurrency },
  });

  const { updateOrg, loading } = useUpdateOrg(org._id, () => {
    onOpenChange(false);
    onSuccess();
  });

  const onSubmit = (data: EditOrgForm) => updateOrg(data as UpdateOrgPayload);

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Organization</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-2">
          <Input
            label="Name"
            error={errors.name?.message}
            {...register('name', { required: 'Name is required' })}
          />
          <div className="w-full">
            <label className="block text-sm font-medium text-[var(--foreground)] mb-1.5">
              Base Currency
            </label>
            <select
              className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--input)] bg-[var(--background)] text-[var(--foreground)] text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              {...register('baseCurrency', { required: true })}
            >
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={loading}>
              Save Changes
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function SuperAdminOrgsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterState>('all');

  const isDisabledParam =
    filter === 'enabled' ? false : filter === 'disabled' ? true : undefined;

  const { data, pagination, loading, refetch } = useSuperAdminOrgs({
    page,
    search: search || undefined,
    isDisabled: isDisabledParam,
  });

  const [showCreate, setShowCreate] = useState(false);
  const [editTarget, setEditTarget] = useState<IOrganizationData | null>(null);
  const [toggleTarget, setToggleTarget] = useState<IOrganizationData | null>(null);
  const { toggleOrg, loading: toggling } = useToggleOrgDisabled(toggleTarget?._id ?? '', () => {
    setToggleTarget(null);
    refetch();
  });

  const columns: Column<IOrganizationData>[] = [
    {
      key: 'name',
      header: 'Name',
      render: (row) => (
        <div>
          <p className="font-medium text-[var(--foreground)]">{row.name}</p>
          <p className="text-xs text-[var(--muted-foreground)] mt-0.5">{row.slug}</p>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      width: '110px',
      render: (row) => (
        <Badge variant={row.isDisabled ? 'danger' : 'success'}>
          {row.isDisabled ? 'Disabled' : 'Enabled'}
        </Badge>
      ),
    },
    {
      key: 'baseCurrency',
      header: 'Base Currency',
      width: '130px',
      render: (row) => (
        <Badge variant="muted">{row.baseCurrency}</Badge>
      ),
    },
    {
      key: 'createdAt',
      header: 'Created',
      width: '120px',
      render: (row) => (
        <span className="text-sm text-[var(--muted-foreground)]">{formatDate(row.createdAt)}</span>
      ),
    },
    {
      key: 'actions',
      header: '',
      width: '180px',
      render: (row) => (
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={(e) => {
              e.stopPropagation();
              setEditTarget(row);
            }}
          >
            Edit
          </Button>
          <Button
            size="sm"
            variant={row.isDisabled ? 'success' : 'destructive'}
            onClick={(e) => {
              e.stopPropagation();
              setToggleTarget(row);
            }}
          >
            {row.isDisabled ? 'Enable' : 'Disable'}
          </Button>
        </div>
      ),
    },
  ];

  const FILTERS: { label: string; value: FilterState }[] = [
    { label: 'All', value: 'all' },
    { label: 'Enabled', value: 'enabled' },
    { label: 'Disabled', value: 'disabled' },
  ];

  return (
    <AppShell title="Organizations">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-[var(--foreground)]">Organizations</h2>
            <p className="text-sm text-[var(--muted-foreground)]">
              All tenants registered in Expensly
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted-foreground)]" />
              <input
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                placeholder="Search organizations…"
                className="w-full pl-9 pr-3.5 py-2 rounded-xl border border-[var(--input)] bg-[var(--background)] text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <Button onClick={() => setShowCreate(true)} className="shrink-0">
              <Plus className="w-4 h-4 mr-1.5" />
              New Org
            </Button>
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1 bg-[var(--muted)] p-1 rounded-xl w-fit">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => { setFilter(f.value); setPage(1); }}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                filter === f.value
                  ? 'bg-[var(--card)] text-[var(--foreground)] shadow-sm'
                  : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <DataTable
          columns={columns}
          data={data}
          loading={loading}
          pagination={pagination ?? undefined}
          onPageChange={setPage}
          emptyTitle="No organizations found"
          emptyDescription={
            search
              ? 'Try a different search term.'
              : 'No organizations have been registered yet.'
          }
        />
      </div>

      {/* Create dialog */}
      <CreateOrgDialog
        open={showCreate}
        onOpenChange={setShowCreate}
        onSuccess={refetch}
      />

      {/* Edit dialog */}
      {editTarget && (
        <EditOrgDialog
          org={editTarget}
          onOpenChange={(o) => !o && setEditTarget(null)}
          onSuccess={() => { setEditTarget(null); refetch(); }}
        />
      )}

      {/* Toggle confirm */}
      <ConfirmDialog
        open={!!toggleTarget}
        onOpenChange={(o) => !o && setToggleTarget(null)}
        title={toggleTarget?.isDisabled ? 'Enable Organization' : 'Disable Organization'}
        description={
          toggleTarget?.isDisabled
            ? `Re-enable "${toggleTarget?.name}"? Users will be able to log in again.`
            : `Disable "${toggleTarget?.name}"? All users in this org will lose access.`
        }
        confirmLabel={toggleTarget?.isDisabled ? 'Enable' : 'Disable'}
        variant={toggleTarget?.isDisabled ? 'default' : 'destructive'}
        loading={toggling}
        onConfirm={() => toggleTarget && toggleOrg(!toggleTarget.isDisabled)}
      />
    </AppShell>
  );
}
