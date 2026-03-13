import { useState, useEffect } from 'react';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, RotateCcw, Trash2, Pencil, Tag, Building2 } from 'lucide-react';
import { AppShell } from '@/shared/components/layout/AppShell';
import { Button } from '@/shared/components/ui/Button';
import { Badge } from '@/shared/components/ui/Badge';
import { Input } from '@/shared/components/ui/Input';
import { Card, CardContent, CardHeader } from '@/shared/components/ui/Card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/shared/components/ui/Dialog';
import { ConfirmDialog } from '@/shared/components/feedback/ConfirmDialog';
import { Skeleton } from '@/shared/components/ui/Skeleton';
import {
  useDepartments,
  useCreateDepartment,
  useUpdateDepartment,
  useDeleteDepartment,
  useResetBudget,
} from '../hooks/useDepartments';
import { departmentSchema, type DepartmentFormValues } from '../validators';
import { formatCurrency, formatPercent } from '@/core/utils/formatters';
import type { IDepartmentData, IPolicyData, PermissionKey } from '@/core/types/ticket.types';
import apiClient from '@/infrastructure/api/client';
import { EP } from '@/infrastructure/api/endpoints';
import type { ApiResponse } from '@/core/types/api.types';
import { CURRENCIES } from '@/core/constants/constants';
import { useAuthStore } from '@/features/auth/store/authStore';

const RESET_PERIOD_LABELS: Record<string, string> = {
  none: 'No Reset',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  yearly: 'Yearly',
};

const DEPT_PERM_LABELS: { key: string; label: string }[] = [
  { key: 'view_all_tickets', label: 'View All Tickets' },
  { key: 'approve_finance', label: 'Finance Approval' },
  { key: 'export_reports', label: 'Export Reports' },
  { key: 'view_analytics', label: 'View Analytics' },
];

export function DepartmentsPage() {
  const { data, loading, refetch } = useDepartments({ limit: 100 });
  const baseCurrency = useAuthStore((s) => s.user?.org?.baseCurrency ?? 'USD');

  // Policies
  const [policies, setPolicies] = useState<IPolicyData[]>([]);
  useEffect(() => {
    apiClient
      .get<ApiResponse<IPolicyData[]>>(EP.ADMIN_POLICIES)
      .then((r) => setPolicies(r.data.data ?? []))
      .catch(() => {});
  }, []);

  // Create
  const [createOpen, setCreateOpen] = useState(false);
  const { createDepartment, loading: creating } = useCreateDepartment(() => {
    setCreateOpen(false);
    refetch();
  });
  const createForm = useForm<DepartmentFormValues>({
    resolver: zodResolver(departmentSchema),
    defaultValues: {
      budgetResetPeriod: 'none',
      budget: '0',
      policyId: null,
      permissions: { view_all_tickets: false, approve_finance: false, export_reports: false, view_analytics: false },
      approvalThresholds: [],
    },
  });
  const createThresholds = useFieldArray({ control: createForm.control, name: 'approvalThresholds' });
  const watchedCreatePolicy = createForm.watch('policyId');

  // Edit
  const [editTarget, setEditTarget] = useState<IDepartmentData | null>(null);
  const { updateDepartment, loading: updating } = useUpdateDepartment(editTarget?._id ?? '', () => {
    setEditTarget(null);
    refetch();
  });
  const editForm = useForm<DepartmentFormValues>({ resolver: zodResolver(departmentSchema) });
  const editThresholds = useFieldArray({ control: editForm.control, name: 'approvalThresholds' });
  const watchedEditPolicy = editForm.watch('policyId');

  const openEdit = (dept: IDepartmentData) => {
    setEditTarget(dept);
    editForm.reset({
      name: dept.name,
      budget: String(dept.budget),
      budgetResetPeriod: dept.budgetResetPeriod,
      policyId: dept.policyId ?? null,
      permissions: {
        view_all_tickets: dept.permissions.view_all_tickets,
        approve_finance: dept.permissions.approve_finance,
        export_reports: dept.permissions.export_reports,
        view_analytics: dept.permissions.view_analytics,
      },
      approvalThresholds: Object.entries(dept.approvalThresholds).map(([currency, amount]) => ({
        currency,
        amount: String(amount),
      })),
    });
  };

  // Delete
  const [deleteTarget, setDeleteTarget] = useState<IDepartmentData | null>(null);
  const { deleteDepartment, loading: deleting } = useDeleteDepartment(
    deleteTarget?._id ?? '',
    () => {
      setDeleteTarget(null);
      refetch();
    },
  );

  // Reset Budget
  const [resetTarget, setResetTarget] = useState<IDepartmentData | null>(null);
  const { resetBudget, loading: resetting } = useResetBudget(resetTarget?._id ?? '', () => {
    setResetTarget(null);
    refetch();
  });

  const handleCreate = createForm.handleSubmit(async (values) => {
    await createDepartment(
      {
        name: values.name,
        budget: Number(values.budget),
        budgetResetPeriod: values.budgetResetPeriod,
        approvalThresholds: Object.fromEntries(
          values.approvalThresholds.map(({ currency, amount }) => [currency, Number(amount)]),
        ),
      },
      values.permissions,
      values.policyId ?? null,
    );
    createForm.reset({
      budgetResetPeriod: 'none',
      budget: '0',
      policyId: null,
      permissions: { view_all_tickets: false, approve_finance: false, export_reports: false, view_analytics: false },
      approvalThresholds: [],
    });
  });

  const handleEdit = editForm.handleSubmit(async (values) => {
    await updateDepartment(
      {
        name: values.name,
        budget: Number(values.budget),
        budgetResetPeriod: values.budgetResetPeriod,
        approvalThresholds: Object.fromEntries(
          values.approvalThresholds.map(({ currency, amount }) => [currency, Number(amount)]),
        ),
      },
      values.permissions,
      values.policyId ?? null,
    );
  });

  return (
    <AppShell title="Departments">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-[var(--foreground)]">Departments</h2>
            <p className="text-sm text-[var(--muted-foreground)]">
              Manage budgets, tags and settings per department
            </p>
          </div>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="w-4 h-4" />
            New Department
          </Button>
        </div>

        {/* Cards Grid */}
        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-2xl border border-[var(--border)] p-5 space-y-3">
                <Skeleton className="h-5 w-1/2" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-3/4" />
              </div>
            ))}
          </div>
        ) : data.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="w-16 h-16 rounded-2xl bg-[var(--muted)] flex items-center justify-center">
              <Building2 className="w-8 h-8 text-[var(--muted-foreground)]" />
            </div>
            <p className="font-semibold text-[var(--foreground)]">No departments yet</p>
            <p className="text-sm text-[var(--muted-foreground)]">
              Create your first department to start tracking budgets.
            </p>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="w-4 h-4" />
              New Department
            </Button>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {data.map((dept) => {
              const pct = dept.budget > 0 ? Math.min((dept.spent / dept.budget) * 100, 100) : 0;
              const isOverBudget = dept.spent > dept.budget && dept.budget > 0;
              return (
                <DepartmentCard
                  key={dept._id}
                  dept={dept}
                  pct={pct}
                  isOverBudget={isOverBudget}
                  onEdit={() => openEdit(dept)}
                  onReset={() => setResetTarget(dept)}
                  onDelete={() => setDeleteTarget(dept)}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Department</DialogTitle>
            <DialogDescription>Set up a new department with a budget.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4 mt-2">
            <Input
              label="Name"
              placeholder="Engineering"
              error={createForm.formState.errors.name?.message}
              {...createForm.register('name')}
            />
            <Input
              label="Budget"
              type="number"
              min="0"
              step="0.01"
              placeholder="10000"
              error={createForm.formState.errors.budget?.message}
              {...createForm.register('budget')}
            />
            <div className="w-full">
              <label className="block text-sm font-medium text-[var(--foreground)] mb-1.5">
                Budget Reset Period
              </label>
              <select
                className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--input)] bg-[var(--background)] text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-brand-500"
                {...createForm.register('budgetResetPeriod')}
              >
                {Object.entries(RESET_PERIOD_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>
            {/* Permissions */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="block text-sm font-medium text-[var(--foreground)]">Permissions</label>
                <span className="text-xs text-[var(--muted-foreground)]">optional</span>
              </div>
              <Controller
                control={createForm.control}
                name="policyId"
                render={({ field }) => (
                  <select
                    value={field.value ?? ''}
                    onChange={(e) => field.onChange(e.target.value || null)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--input)] bg-[var(--background)] text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-brand-500"
                  >
                    <option value="">No policy — set manually</option>
                    {policies.map((pol) => (
                      <option key={pol._id} value={pol._id}>
                        {pol.name}{pol.isSystem ? ' (system)' : ''}
                      </option>
                    ))}
                  </select>
                )}
              />
              <div className="flex flex-wrap gap-2">
                {DEPT_PERM_LABELS.map(({ key, label }) => {
                  const fromPolicy = !!(policies.find((p) => p._id === watchedCreatePolicy)?.grants ?? []).includes(key as PermissionKey);
                  return (
                    <Controller
                      key={key}
                      control={createForm.control}
                      name={`permissions.${key}` as `permissions.${keyof DepartmentFormValues['permissions']}`}
                      render={({ field }) => (
                        <button
                          type="button"
                          onClick={() => field.onChange(!field.value)}
                          title={field.value ? 'Explicitly granted — click to remove' : fromPolicy ? 'Granted via policy — click to also set explicitly' : 'Not granted — click to enable'}
                          className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                            field.value
                              ? 'bg-brand-600 text-white border-brand-600'
                              : fromPolicy
                              ? 'bg-brand-50 dark:bg-brand-950/40 text-brand-700 dark:text-brand-300 border-brand-300 dark:border-brand-700'
                              : 'bg-[var(--background)] text-[var(--muted-foreground)] border-[var(--border)] hover:border-brand-400 hover:text-[var(--foreground)]'
                          }`}
                        >
                          {label}
                        </button>
                      )}
                    />
                  );
                })}
              </div>
            </div>
            {/* Approval Thresholds */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-sm font-medium text-[var(--foreground)]">Approval Thresholds</label>
                <button
                  type="button"
                  onClick={() => createThresholds.append({ currency: 'USD', amount: '0' })}
                  className="flex items-center gap-1 text-xs text-brand-600 hover:text-brand-700 font-medium"
                >
                  <Plus className="w-3 h-3" /> Add
                </button>
              </div>
              {createThresholds.fields.length === 0 ? (
                <p className="text-xs text-[var(--muted-foreground)]">No thresholds — approvals won't be gated by amount.</p>
              ) : (
                createThresholds.fields.map((field, idx) => (
                  <div key={field.id} className="flex items-center gap-2">
                    <select
                      className="w-24 px-2 py-2.5 rounded-xl border border-[var(--input)] bg-[var(--background)] text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-brand-500"
                      {...createForm.register(`approvalThresholds.${idx}.currency`)}
                    >
                      {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="1000"
                      className="flex-1"
                      error={createForm.formState.errors.approvalThresholds?.[idx]?.amount?.message}
                      {...createForm.register(`approvalThresholds.${idx}.amount`)}
                    />
                    <button
                      type="button"
                      onClick={() => createThresholds.remove(idx)}
                      className="p-1.5 rounded-lg hover:bg-danger-50 transition text-[var(--muted-foreground)] hover:text-danger-500"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" type="button" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" loading={creating}>
                Create
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editTarget} onOpenChange={(o) => !o && setEditTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Department</DialogTitle>
            <DialogDescription>Update {editTarget?.name}.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEdit} className="space-y-4 mt-2">
            <Input
              label="Name"
              error={editForm.formState.errors.name?.message}
              {...editForm.register('name')}
            />
            <Input
              label="Budget"
              type="number"
              min="0"
              step="0.01"
              error={editForm.formState.errors.budget?.message}
              {...editForm.register('budget')}
            />
            <div className="w-full">
              <label className="block text-sm font-medium text-[var(--foreground)] mb-1.5">
                Budget Reset Period
              </label>
              <select
                className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--input)] bg-[var(--background)] text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-brand-500"
                {...editForm.register('budgetResetPeriod')}
              >
                {Object.entries(RESET_PERIOD_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>
            {/* Permissions */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="block text-sm font-medium text-[var(--foreground)]">Permissions</label>
                <span className="text-xs text-[var(--muted-foreground)]">optional</span>
              </div>
              <Controller
                control={editForm.control}
                name="policyId"
                render={({ field }) => (
                  <select
                    value={field.value ?? ''}
                    onChange={(e) => field.onChange(e.target.value || null)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--input)] bg-[var(--background)] text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-brand-500"
                  >
                    <option value="">No policy — set manually</option>
                    {policies.map((pol) => (
                      <option key={pol._id} value={pol._id}>
                        {pol.name}{pol.isSystem ? ' (system)' : ''}
                      </option>
                    ))}
                  </select>
                )}
              />
              <div className="flex flex-wrap gap-2">
                {DEPT_PERM_LABELS.map(({ key, label }) => {
                  const fromPolicy = !!(policies.find((p) => p._id === watchedEditPolicy)?.grants ?? []).includes(key as PermissionKey);
                  return (
                    <Controller
                      key={key}
                      control={editForm.control}
                      name={`permissions.${key}` as `permissions.${keyof DepartmentFormValues['permissions']}`}
                      render={({ field }) => (
                        <button
                          type="button"
                          onClick={() => field.onChange(!field.value)}
                          title={field.value ? 'Explicitly granted — click to remove' : fromPolicy ? 'Granted via policy — click to also set explicitly' : 'Not granted — click to enable'}
                          className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                            field.value
                              ? 'bg-brand-600 text-white border-brand-600'
                              : fromPolicy
                              ? 'bg-brand-50 dark:bg-brand-950/40 text-brand-700 dark:text-brand-300 border-brand-300 dark:border-brand-700'
                              : 'bg-[var(--background)] text-[var(--muted-foreground)] border-[var(--border)] hover:border-brand-400 hover:text-[var(--foreground)]'
                          }`}
                        >
                          {label}
                        </button>
                      )}
                    />
                  );
                })}
              </div>
            </div>
            {/* Approval Thresholds */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-sm font-medium text-[var(--foreground)]">Approval Thresholds</label>
                <button
                  type="button"
                  onClick={() => editThresholds.append({ currency: 'USD', amount: '0' })}
                  className="flex items-center gap-1 text-xs text-brand-600 hover:text-brand-700 font-medium"
                >
                  <Plus className="w-3 h-3" /> Add
                </button>
              </div>
              {editThresholds.fields.length === 0 ? (
                <p className="text-xs text-[var(--muted-foreground)]">No thresholds — approvals won't be gated by amount.</p>
              ) : (
                editThresholds.fields.map((field, idx) => (
                  <div key={field.id} className="flex items-center gap-2">
                    <select
                      className="w-24 px-2 py-2.5 rounded-xl border border-[var(--input)] bg-[var(--background)] text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-brand-500"
                      {...editForm.register(`approvalThresholds.${idx}.currency`)}
                    >
                      {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="1000"
                      className="flex-1"
                      error={editForm.formState.errors.approvalThresholds?.[idx]?.amount?.message}
                      {...editForm.register(`approvalThresholds.${idx}.amount`)}
                    />
                    <button
                      type="button"
                      onClick={() => editThresholds.remove(idx)}
                      className="p-1.5 rounded-lg hover:bg-danger-50 transition text-[var(--muted-foreground)] hover:text-danger-500"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" type="button" onClick={() => setEditTarget(null)}>
                Cancel
              </Button>
              <Button type="submit" loading={updating}>
                Save
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Confirm Reset Budget */}
      <ConfirmDialog
        open={!!resetTarget}
        onOpenChange={(o) => !o && setResetTarget(null)}
        title="Reset Budget"
        description={`Reset spent amount for "${resetTarget?.name}" to zero?`}
        confirmLabel="Reset"
        variant="default"
        loading={resetting}
        onConfirm={resetBudget}
      />

      {/* Confirm Delete */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title="Delete Department"
        description={`Permanently delete "${deleteTarget?.name}"? This cannot be undone.`}
        confirmLabel="Delete"
        variant="destructive"
        loading={deleting}
        onConfirm={deleteDepartment}
      />
    </AppShell>
  );
}

interface DepartmentCardProps {
  dept: IDepartmentData;
  pct: number;
  isOverBudget: boolean;
  onEdit: () => void;
  onReset: () => void;
  onDelete: () => void;
}

function DepartmentCard({
  dept,
  pct,
  isOverBudget,
  onEdit,
  onReset,
  onDelete,
}: DepartmentCardProps) {
  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-semibold text-[var(--foreground)]">{dept.name}</p>
            <div className="flex items-center gap-1.5 mt-1">
              <Badge variant={dept.isActive ? 'success' : 'muted'}>
                {dept.isActive ? 'Active' : 'Inactive'}
              </Badge>
              {dept.budgetResetPeriod !== 'none' && (
                <Badge variant="info">{RESET_PERIOD_LABELS[dept.budgetResetPeriod]}</Badge>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={onEdit}
              className="p-1.5 rounded-lg hover:bg-[var(--accent)] transition text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={onReset}
              className="p-1.5 rounded-lg hover:bg-[var(--accent)] transition text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              title="Reset Budget"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={onDelete}
              className="p-1.5 rounded-lg hover:bg-danger-50 transition text-[var(--muted-foreground)] hover:text-danger-500"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {/* Budget bar */}
        <div>
          <div className="flex justify-between text-xs mb-1.5">
            <span className="text-[var(--muted-foreground)]">Spent</span>
            <span
              className={`font-medium ${isOverBudget ? 'text-danger-500' : 'text-[var(--foreground)]'}`}
            >
              {formatCurrency(dept.spent, baseCurrency)} / {formatCurrency(dept.budget, baseCurrency)}
            </span>
          </div>
          <div className="h-2 rounded-full bg-[var(--muted)] overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                isOverBudget
                  ? 'bg-danger-500'
                  : pct > 80
                  ? 'bg-warning-500'
                  : 'bg-brand-500'
              }`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="text-xs text-[var(--muted-foreground)] mt-1">
            {formatPercent(pct)} used
          </p>
        </div>

        {/* Tags */}
        {dept.tags.length > 0 && (
          <div className="flex items-center gap-1 flex-wrap">
            <Tag className="w-3 h-3 text-[var(--muted-foreground)]" />
            {dept.tags.slice(0, 4).map((t) => (
              <span
                key={t}
                className="text-xs px-2 py-0.5 rounded-full bg-[var(--muted)] text-[var(--muted-foreground)]"
              >
                {t}
              </span>
            ))}
            {dept.tags.length > 4 && (
              <span className="text-xs text-[var(--muted-foreground)]">
                +{dept.tags.length - 4}
              </span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
