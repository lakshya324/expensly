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
  useSuperAdminUsers,
  useSuperAdminOrgs,
  useCreateUser,
  useUpdateUser,
  useToggleUserDisabled,
  type CreateUserPayload,
  type UpdateUserPayload,
} from '../hooks/useSuperAdmin';
import { formatDate } from '@/core/utils/formatters';
import type { IUserData, IOrganizationData } from '@/core/types/user.types';
import type { Role } from '@/core/types/api.types';

const ROLE_OPTIONS: { value: Role | ''; label: string }[] = [
  { value: '', label: 'All Roles' },
  { value: 'user', label: 'User' },
  { value: 'admin', label: 'Admin' },
  // { value: 'super_admin', label: 'Super Admin' },
];

const USER_ROLE_OPTIONS: { value: Role; label: string }[] = [
  { value: 'user', label: 'User' },
  { value: 'admin', label: 'Admin' },
];

// ─── Org Select Helper ────────────────────────────────────────────────────────

function OrgSelect({
  orgs,
  value,
  onChange,
  required,
}: {
  orgs: IOrganizationData[];
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
}) {
  return (
    <div className="w-full">
      <label className="block text-sm font-medium text-[var(--foreground)] mb-1.5">
        Organization{!required && ' (optional)'}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--input)] bg-[var(--background)] text-[var(--foreground)] text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
      >
        <option value="">- None -</option>
        {orgs.map((o) => (
          <option key={o._id} value={o._id}>{o.name}</option>
        ))}
      </select>
    </div>
  );
}

// ─── Create User Dialog ───────────────────────────────────────────────────────

interface CreateUserForm {
  name: string;
  email: string;
  password: string;
  role: Role;
}

function CreateUserDialog({
  open,
  onOpenChange,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSuccess: () => void;
}) {
  const [orgId, setOrgId] = useState('');
  const { data: orgs } = useSuperAdminOrgs({ isDisabled: false });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateUserForm>({ defaultValues: { role: 'user' } });

  const { createUser, loading } = useCreateUser(() => {
    reset();
    setOrgId('');
    onOpenChange(false);
    onSuccess();
  });

  const onSubmit = (data: CreateUserForm) =>
    createUser({ ...data, orgId: orgId || undefined } as CreateUserPayload);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create User</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-2">
          <Input
            label="Name"
            placeholder="John Doe"
            error={errors.name?.message}
            {...register('name', { required: 'Name is required' })}
          />
          <Input
            label="Email"
            type="email"
            placeholder="john@example.com"
            error={errors.email?.message}
            {...register('email', { required: 'Email is required' })}
          />
          <Input
            label="Password"
            type="password"
            placeholder="Min. 8 characters"
            error={errors.password?.message}
            {...register('password', {
              required: 'Password is required',
              minLength: { value: 8, message: 'Minimum 8 characters' },
            })}
          />
          <div className="w-full">
            <label className="block text-sm font-medium text-[var(--foreground)] mb-1.5">
              Role
            </label>
            <select
              className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--input)] bg-[var(--background)] text-[var(--foreground)] text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              {...register('role', { required: true })}
            >
              {USER_ROLE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <OrgSelect orgs={orgs} value={orgId} onChange={setOrgId} />
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

// ─── Edit User Dialog ─────────────────────────────────────────────────────────

interface EditUserForm {
  name: string;
  role: Role;
}

function EditUserDialog({
  user,
  onOpenChange,
  onSuccess,
}: {
  user: IUserData;
  onOpenChange: (o: boolean) => void;
  onSuccess: () => void;
}) {
  const [orgId, setOrgId] = useState(user.orgId ?? '');
  const { data: orgs } = useSuperAdminOrgs({ isDisabled: false });

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<EditUserForm>({
    defaultValues: { name: user.name, role: user.role === 'super_admin' ? 'admin' : user.role },
  });

  const { updateUser, loading } = useUpdateUser(user._id, () => {
    onOpenChange(false);
    onSuccess();
  });

  const onSubmit = (data: EditUserForm) =>
    updateUser({ ...data, orgId: orgId || null } as UpdateUserPayload);

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit User</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-2">
          <Input
            label="Name"
            error={errors.name?.message}
            {...register('name', { required: 'Name is required' })}
          />
          <div className="w-full">
            <label className="block text-sm font-medium text-[var(--foreground)] mb-1.5">
              Role
            </label>
            <select
              className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--input)] bg-[var(--background)] text-[var(--foreground)] text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              {...register('role', { required: true })}
            >
              {USER_ROLE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <OrgSelect orgs={orgs} value={orgId} onChange={setOrgId} />
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

export function SuperAdminUsersPage() {
  const [page, setPage] = useState(1);
  const [role, setRole] = useState<Role | ''>('');
  const [search, setSearch] = useState('');

  const { data, pagination, loading, refetch } = useSuperAdminUsers({
    page,
    role: role || undefined,
    search: search || undefined,
  });

  const [showCreate, setShowCreate] = useState(false);
  const [editTarget, setEditTarget] = useState<IUserData | null>(null);
  const [toggleTarget, setToggleTarget] = useState<IUserData | null>(null);

  const { toggleUser, loading: toggling } = useToggleUserDisabled(
    toggleTarget?._id ?? '',
    () => {
      setToggleTarget(null);
      refetch();
    },
  );

  const columns: Column<IUserData>[] = [
    {
      key: 'name',
      header: 'Name',
      render: (row) => (
        <div>
          <p className="font-medium text-[var(--foreground)]">{row.name}</p>
          <p className="text-xs text-[var(--muted-foreground)] mt-0.5">{row.email}</p>
        </div>
      ),
    },
    {
      key: 'role',
      header: 'Role',
      width: '120px',
      render: (row) => {
        const variant =
          row.role === 'super_admin'
            ? 'default'
            : row.role === 'admin'
            ? 'info'
            : 'muted';
        return <Badge variant={variant}>{row.role.replace('_', ' ')}</Badge>;
      },
    },
    {
      key: 'org',
      header: 'Organization',
      width: '160px',
      render: (row) =>
        row.org ? (
          <span className="text-sm text-[var(--foreground)]">{row.org.name}</span>
        ) : (
          <span className="text-xs text-[var(--muted-foreground)] italic">-</span>
        ),
    },
    {
      key: 'status',
      header: 'Status',
      width: '100px',
      render: (row) => (
        <Badge variant={row.isDisabled ? 'danger' : 'success'}>
          {row.isDisabled ? 'Disabled' : 'Active'}
        </Badge>
      ),
    },
    {
      key: 'createdAt',
      header: 'Joined',
      width: '110px',
      render: (row) => (
        <span className="text-sm text-[var(--muted-foreground)]">{formatDate(row.createdAt)}</span>
      ),
    },
    {
      key: 'actions',
      header: '',
      width: '190px',
      render: (row) =>
        row.role === 'super_admin' ? null : (
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

  return (
    <AppShell title="All Users">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-[var(--foreground)]">All Users</h2>
            <p className="text-sm text-[var(--muted-foreground)]">
              Every user across all organizations
            </p>
          </div>
          <Button onClick={() => setShowCreate(true)} className="shrink-0 self-start sm:self-auto">
            <Plus className="w-4 h-4 mr-1.5" />
            New User
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted-foreground)]" />
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search by name or email…"
              className="w-full pl-9 pr-3.5 py-2 rounded-xl border border-[var(--input)] bg-[var(--background)] text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
          <select
            value={role}
            onChange={(e) => { setRole(e.target.value as Role | ''); setPage(1); }}
            className="px-3 py-2 rounded-xl border border-[var(--input)] bg-[var(--background)] text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            {ROLE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        <DataTable
          columns={columns}
          data={data}
          loading={loading}
          pagination={pagination ?? undefined}
          onPageChange={setPage}
          emptyTitle="No users found"
          emptyDescription="Adjust your filters or wait for users to register."
        />
      </div>

      {/* Create dialog */}
      <CreateUserDialog
        open={showCreate}
        onOpenChange={setShowCreate}
        onSuccess={refetch}
      />

      {/* Edit dialog */}
      {editTarget && (
        <EditUserDialog
          user={editTarget}
          onOpenChange={(o) => !o && setEditTarget(null)}
          onSuccess={() => { setEditTarget(null); refetch(); }}
        />
      )}

      {/* Toggle confirm */}
      <ConfirmDialog
        open={!!toggleTarget}
        onOpenChange={(o) => !o && setToggleTarget(null)}
        title={toggleTarget?.isDisabled ? 'Enable User' : 'Disable User'}
        description={
          toggleTarget?.isDisabled
            ? `Re-enable "${toggleTarget?.name}"? They will be able to log in again.`
            : `Disable "${toggleTarget?.name}"? They will lose access immediately.`
        }
        confirmLabel={toggleTarget?.isDisabled ? 'Enable' : 'Disable'}
        variant={toggleTarget?.isDisabled ? 'default' : 'destructive'}
        loading={toggling}
        onConfirm={() => toggleTarget && toggleUser(!toggleTarget.isDisabled)}
      />
    </AppShell>
  );
}

