import { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { MoreHorizontal, Plus, UserCheck, UserX, Shield, Pencil } from 'lucide-react';
import { AppShell } from '@/shared/components/layout/AppShell';
import { DataTable, type Column } from '@/shared/components/data-display/DataTable';
import { Button } from '@/shared/components/ui/Button';
import { Badge } from '@/shared/components/ui/Badge';
import { Input } from '@/shared/components/ui/Input';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/Card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/shared/components/ui/Dialog';
import { ConfirmDialog } from '@/shared/components/feedback/ConfirmDialog';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/shared/components/ui/DropdownMenu';
import {
  useAdminUsers,
  useCreateUser,
  useUpdateUser,
  useToggleDisableUser,
  useUpdateUserPermissions,
} from '../hooks/useAdminUsers';
import {
  createUserSchema,
  updateUserSchema,
  type CreateUserFormValues,
  type UpdateUserFormValues,
} from '../validators';
import apiClient from '@/infrastructure/api/client';
import { EP } from '@/infrastructure/api/endpoints';
import { formatDate } from '@/core/utils/formatters';
import type { IUserData } from '@/core/types/user.types';
import type { IDepartmentData, IPolicyData, PermissionKey } from '@/core/types/ticket.types';
import type { ApiResponse, PaginatedData } from '@/core/types/api.types';

type PermissionValue = boolean | null;

type UserPermsMap = { [K in PermissionKey]: PermissionValue };

interface PermissionsState {
  permissions: UserPermsMap;
  policyId: string | null;
}

const BLANK_PERMS: UserPermsMap = {
  view_all_tickets: null,
  approve_finance: null,
  export_reports: null,
  view_analytics: null,
};

const PERM_LABELS: { key: PermissionKey; label: string }[] = [
  { key: 'view_all_tickets', label: 'View All Tickets' },
  { key: 'approve_finance', label: 'Finance Approval' },
  { key: 'export_reports', label: 'Export Reports' },
  { key: 'view_analytics', label: 'View Analytics' },
];

export function AdminUsersPage() {
  const [page, setPage] = useState(1);
  const [deptFilter, setDeptFilter] = useState('');

  // Data
  const { data, pagination, loading, refetch } = useAdminUsers({
    page,
    limit: 15,
    department: deptFilter || undefined,
  });

  // Departments & policies for selects — fetched once on mount
  const [departments, setDepartments] = useState<IDepartmentData[]>([]);
  const [policies, setPolicies] = useState<IPolicyData[]>([]);
  useEffect(() => {
    apiClient
      .get<ApiResponse<PaginatedData<IDepartmentData>>>(EP.ADMIN_DEPARTMENTS)
      .then((r) => setDepartments(r.data.data.data))
      .catch(() => {});
    apiClient
      .get<ApiResponse<IPolicyData[]>>(EP.ADMIN_POLICIES)
      .then((r) => setPolicies(r.data.data ?? []))
      .catch(() => {});
  }, []);

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false);
  const { createUser, loading: creating } = useCreateUser();
  const createForm = useForm<CreateUserFormValues>({
    resolver: zodResolver(createUserSchema),
    defaultValues: { role: 'user' },
  });
  const watchedCreateDept = createForm.watch('department');
  const [createDeptUsers, setCreateDeptUsers] = useState<IUserData[]>([]);

  // Edit dialog
  const [editTarget, setEditTarget] = useState<IUserData | null>(null);
  const { updateUser, loading: updating } = useUpdateUser(editTarget?._id ?? '');
  const editForm = useForm<UpdateUserFormValues>({ resolver: zodResolver(updateUserSchema) });
  const watchedEditDept = editForm.watch('department');
  const [editDeptUsers, setEditDeptUsers] = useState<IUserData[]>([]);

  useEffect(() => {
    if (editTarget) {
      editForm.reset({
        name: editTarget.name,
        department: editTarget.department?._id ?? '',
        managerId: editTarget.manager?._id ?? '',
      });
      // Load users from the existing dept for the manager dropdown
      if (editTarget.department?._id) {
        apiClient
          .get<ApiResponse<PaginatedData<IUserData>>>(EP.ADMIN_USERS, {
            params: { department: editTarget.department._id, limit: 100 },
          })
          .then((r) => setEditDeptUsers(r.data.data.data))
          .catch(() => {});
      } else {
        setEditDeptUsers([]);
      }
    } else {
      setEditDeptUsers([]);
    }
  }, [editTarget]);

  // Fetch users in selected dept for manager dropdown (create form)
  useEffect(() => {
    createForm.setValue('managerId', '');
    if (!watchedCreateDept) {
      setCreateDeptUsers([]);
      return;
    }
    apiClient
      .get<ApiResponse<PaginatedData<IUserData>>>(EP.ADMIN_USERS, {
        params: { department: watchedCreateDept, limit: 100 },
      })
      .then((r) => setCreateDeptUsers(r.data.data.data))
      .catch(() => {});
  }, [watchedCreateDept]);

  // Re-fetch users when dept changes in edit form (skip initial render that matches editTarget)
  useEffect(() => {
    if (!editTarget) return;
    if (watchedEditDept === (editTarget.department?._id ?? '')) return;
    editForm.setValue('managerId', '');
    if (!watchedEditDept) {
      setEditDeptUsers([]);
      return;
    }
    apiClient
      .get<ApiResponse<PaginatedData<IUserData>>>(EP.ADMIN_USERS, {
        params: { department: watchedEditDept, limit: 100 },
      })
      .then((r) => setEditDeptUsers(r.data.data.data))
      .catch(() => {});
  }, [watchedEditDept]);

  // Disable / enable
  const [disableTarget, setDisableTarget] = useState<IUserData | null>(null);
  const { toggle: toggleDisable, loading: toggling } = useToggleDisableUser(
    disableTarget?._id ?? '',
    () => {
      setDisableTarget(null);
      refetch();
    },
  );

  // Permissions dialog
  const [permTarget, setPermTarget] = useState<IUserData | null>(null);
  const [perms, setPerms] = useState<PermissionsState>({
    permissions: { ...BLANK_PERMS },
    policyId: null,
  });
  const { update: updatePerms, loading: updatingPerms } = useUpdateUserPermissions(
    permTarget?._id ?? '',
    () => {
      setPermTarget(null);
      refetch();
    },
  );

  useEffect(() => {
    if (permTarget) {
      setPerms({
        permissions: {
          view_all_tickets: permTarget.permissions.view_all_tickets,
          approve_finance: permTarget.permissions.approve_finance,
          export_reports: permTarget.permissions.export_reports,
          view_analytics: permTarget.permissions.view_analytics,
        },
        policyId: permTarget.policyId ?? null,
      });
    }
  }, [permTarget]);

  const handleCreate = createForm.handleSubmit(async (values) => {
    const result = await createUser({
      name: values.name,
      email: values.email,
      password: values.password,
      department: values.department || undefined,
      managerId: values.managerId || undefined,
      role: values.role,
    });
    if (result) {
      if (values.policyId) {
        await apiClient
          .patch(EP.ADMIN_USER_PERMISSIONS(result._id), { permissions: BLANK_PERMS, policyId: values.policyId })
          .catch(() => {});
      }
      setCreateOpen(false);
      createForm.reset();
      refetch();
    }
  });

  const handleEdit = editForm.handleSubmit(async (values) => {
    if (!editTarget) return;
    const result = await updateUser({
      name: values.name,
      department: values.department || undefined,
      managerId: values.managerId || undefined,
    });
    if (result) {
      setEditTarget(null);
      refetch();
    }
  });

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
      width: '100px',
      render: (row) => (
        <Badge variant={row.role === 'admin' ? 'default' : 'muted'}>
          {row.role}
        </Badge>
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
      key: 'manager',
      header: 'Manager',
      width: '140px',
      render: (row) => (
        <span className="text-sm text-[var(--muted-foreground)]">
          {row.manager?.name ?? '—'}
        </span>
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
      width: '50px',
      render: (row) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="p-1.5 rounded-lg hover:bg-[var(--accent)] transition">
              <MoreHorizontal className="w-4 h-4 text-[var(--muted-foreground)]" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setEditTarget(row)}>
              <Pencil className="w-4 h-4" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setPermTarget(row)}>
              <Shield className="w-4 h-4" />
              Permissions
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setDisableTarget(row)}
              className={row.isDisabled ? 'text-success-600' : 'text-danger-500'}
            >
              {row.isDisabled ? (
                <>
                  <UserCheck className="w-4 h-4" /> Enable
                </>
              ) : (
                <>
                  <UserX className="w-4 h-4" /> Disable
                </>
              )}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  const deptPolicy = permTarget?.department?.policyId
    ? (policies.find((p) => p._id === permTarget.department?.policyId) ?? null)
    : null;

  return (
    <AppShell title="Users">
      <div className="space-y-4">
        {/* Header */ }
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-[var(--foreground)]">Team Members</h2>
            <p className="text-sm text-[var(--muted-foreground)]">
              Manage your organisation's users and their permissions
            </p>
          </div>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="w-4 h-4" />
            Add User
          </Button>
        </div>

        {/* Dept filter */}
        <div className="flex items-center gap-2">
          <select
            value={deptFilter}
            onChange={(e) => { setDeptFilter(e.target.value); setPage(1); }}
            className="px-3 py-2 rounded-xl border border-[var(--input)] bg-[var(--background)] text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="">All Departments</option>
            {departments.map((d) => (
              <option key={d._id} value={d._id}>{d.name}</option>
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
          emptyDescription="Add your first team member to get started."
        />
      </div>

      {/* Create User Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add User</DialogTitle>
            <DialogDescription>Create a new team member account.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4 mt-2">
            <Input
              label="Full Name"
              placeholder="Jane Smith"
              error={createForm.formState.errors.name?.message}
              {...createForm.register('name')}
            />
            <Input
              label="Email"
              type="email"
              placeholder="jane@example.com"
              error={createForm.formState.errors.email?.message}
              {...createForm.register('email')}
            />
            <Input
              label="Password"
              type="password"
              placeholder="••••••••"
              error={createForm.formState.errors.password?.message}
              {...createForm.register('password')}
            />
            <div className="w-full">
              <label className="block text-sm font-medium text-[var(--foreground)] mb-1.5">
                Department <span className="text-[var(--muted-foreground)]">(optional)</span>
              </label>
              <select
                className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--input)] bg-[var(--background)] text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-brand-500"
                {...createForm.register('department')}
              >
                <option value="">No department</option>
                {departments.map((d) => (
                  <option key={d._id} value={d._id}>{d.name}</option>
                ))}
              </select>
            </div>
            <div className="w-full">
              <label className="block text-sm font-medium text-[var(--foreground)] mb-1.5">
                Role
              </label>
              <select
                className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--input)] bg-[var(--background)] text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-brand-500"
                {...createForm.register('role')}
              >
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div className="w-full">
              <label className="block text-sm font-medium text-[var(--foreground)] mb-1.5">
                Manager <span className="text-[var(--muted-foreground)]">(optional)</span>
              </label>
              <select
                className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--input)] bg-[var(--background)] text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-brand-500"
                disabled={!watchedCreateDept}
                {...createForm.register('managerId')}
              >
                <option value="">{watchedCreateDept ? 'No manager' : 'Select a department first'}</option>
                {createDeptUsers.map((u) => (
                  <option key={u._id} value={u._id}>{u.name}</option>
                ))}
              </select>
            </div>
            <div className="w-full">
              <label className="block text-sm font-medium text-[var(--foreground)] mb-1.5">
                Policy <span className="text-[var(--muted-foreground)]">(optional)</span>
              </label>
              <select
                className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--input)] bg-[var(--background)] text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-brand-500"
                {...createForm.register('policyId')}
              >
                <option value="">No policy</option>
                {policies.map((pol) => (
                  <option key={pol._id} value={pol._id}>
                    {pol.name}{pol.isSystem ? ' (system)' : ''}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" type="button" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" loading={creating}>
                Create User
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={!!editTarget} onOpenChange={(o) => !o && setEditTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>Update {editTarget?.name}'s information.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEdit} className="space-y-4 mt-2">
            <Input
              label="Full Name"
              error={editForm.formState.errors.name?.message}
              {...editForm.register('name')}
            />
            <div className="w-full">
              <label className="block text-sm font-medium text-[var(--foreground)] mb-1.5">
                Department
              </label>
              <select
                className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--input)] bg-[var(--background)] text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-brand-500"
                {...editForm.register('department')}
              >
                <option value="">No department</option>
                {departments.map((d) => (
                  <option key={d._id} value={d._id}>{d.name}</option>
                ))}
              </select>
            </div>
            <div className="w-full">
              <label className="block text-sm font-medium text-[var(--foreground)] mb-1.5">
                Manager
              </label>
              <select
                className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--input)] bg-[var(--background)] text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-brand-500"
                disabled={!watchedEditDept}
                {...editForm.register('managerId')}
              >
                <option value="">{watchedEditDept ? 'No manager' : 'Select a department first'}</option>
                {editDeptUsers
                  .filter((u) => u._id !== editTarget?._id)
                  .map((u) => (
                    <option key={u._id} value={u._id}>{u.name}</option>
                  ))}
              </select>
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" type="button" onClick={() => setEditTarget(null)}>
                Cancel
              </Button>
              <Button type="submit" loading={updating}>
                Save Changes
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Permissions Dialog */}
      <Dialog open={!!permTarget} onOpenChange={(o) => !o && setPermTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Permissions — {permTarget?.name}</DialogTitle>
            <DialogDescription>
              Assign a policy and/or override individual permissions. "Inherit" falls back to the department default.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-5 mt-2">
            {/* Policy picker */}
            <div>
              <label className="block text-sm font-medium text-[var(--foreground)] mb-2">Policy</label>
              <select
                value={perms.policyId ?? ''}
                onChange={(e) => setPerms((p) => ({ ...p, policyId: e.target.value || null }))}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--input)] bg-[var(--background)] text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="">
                  {deptPolicy ? `Inherit from department (${deptPolicy.name})` : 'No policy'}
                </option>
                {policies.map((pol) => (
                  <option key={pol._id} value={pol._id}>
                    {pol.name}{pol.isSystem ? ' (system)' : ''}
                  </option>
                ))}
              </select>
              {(() => {
                const activePol = perms.policyId
                  ? policies.find((p) => p._id === perms.policyId)
                  : deptPolicy;
                const isInherited = !perms.policyId && !!deptPolicy;
                return activePol && activePol.grants.length > 0 ? (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {isInherited && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--muted)] text-[var(--muted-foreground)] border border-[var(--border)] font-medium">
                        from dept
                      </span>
                    )}
                    {activePol.grants.map((g) => (
                      <span
                        key={g}
                        className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${
                          isInherited
                            ? 'bg-[var(--muted)] text-[var(--muted-foreground)] border-[var(--border)]'
                            : 'bg-brand-50 dark:bg-brand-950/40 text-brand-700 dark:text-brand-300 border-brand-200 dark:border-brand-800'
                        }`}
                      >
                        {PERM_LABELS.find((l) => l.key === g)?.label ?? g}
                      </span>
                    ))}
                  </div>
                ) : null;
              })()}
            </div>

            {/* Per-permission overrides */}
            <div className="space-y-2">
              <p className="text-sm font-medium text-[var(--foreground)]">Overrides</p>
              {PERM_LABELS.map(({ key, label }) => (
                <PermissionRow
                  key={key}
                  label={label}
                  value={perms.permissions[key]}
                  onChange={(v) =>
                    setPerms((p) => ({ ...p, permissions: { ...p.permissions, [key]: v } }))
                  }
                />
              ))}
            </div>

            <div className="flex gap-2 justify-end pt-1">
              <Button variant="outline" onClick={() => setPermTarget(null)}>
                Cancel
              </Button>
              <Button
                loading={updatingPerms}
                onClick={() => updatePerms({ permissions: perms.permissions, policyId: perms.policyId })}
              >
                Save Permissions
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirm Disable / Enable */}
      <ConfirmDialog
        open={!!disableTarget}
        onOpenChange={(o) => !o && setDisableTarget(null)}
        title={disableTarget?.isDisabled ? 'Enable User' : 'Disable User'}
        description={
          disableTarget?.isDisabled
            ? `Enable ${disableTarget?.name} so they can log in again?`
            : `Disable ${disableTarget?.name}? They will no longer be able to log in.`
        }
        confirmLabel={disableTarget?.isDisabled ? 'Enable' : 'Disable'}
        variant={disableTarget?.isDisabled ? 'default' : 'destructive'}
        loading={toggling}
        onConfirm={() => disableTarget && toggleDisable(!disableTarget.isDisabled)}
      />
    </AppShell>
  );
}

function PermissionRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean | null;
  onChange: (v: boolean | null) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 p-3 rounded-xl border border-[var(--border)] bg-[var(--muted)]/30">
      <span className="text-sm font-medium text-[var(--foreground)]">{label}</span>
      <div className="flex items-center gap-1">
        {(['inherit', 'on', 'off'] as const).map((opt) => {
          const optValue: boolean | null =
            opt === 'inherit' ? null : opt === 'on' ? true : false;
          const active = value === optValue;
          return (
            <button
              key={opt}
              type="button"
              onClick={() => onChange(optValue)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition ${
                active
                  ? 'bg-brand-600 text-white'
                  : 'bg-[var(--muted)] text-[var(--muted-foreground)] hover:bg-[var(--accent)]'
              }`}
            >
              {opt === 'inherit' ? 'Inherit' : opt === 'on' ? 'Yes' : 'No'}
            </button>
          );
        })}
      </div>
    </div>
  );
}
