import { useState } from 'react';
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
import type { IDepartmentData } from '@/core/types/ticket.types';

const RESET_PERIOD_LABELS: Record<string, string> = {
  none: 'No Reset',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  yearly: 'Yearly',
};

const CURRENCIES = [
  'USD', 'EUR', 'GBP', 'INR', 'JPY', 'CAD', 'AUD', 'CHF', 'CNY', 'SGD',
  'AED', 'HKD', 'MXN', 'BRL', 'KRW', 'SEK', 'NOK', 'DKK', 'NZD', 'ZAR',
];

export function DepartmentsPage() {
  const { data, loading, refetch } = useDepartments({ limit: 100 });

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
      permissions: { canViewAllTickets: false, canApprove: false },
      approvalThresholds: [],
    },
  });
  const createThresholds = useFieldArray({ control: createForm.control, name: 'approvalThresholds' });

  // Edit
  const [editTarget, setEditTarget] = useState<IDepartmentData | null>(null);
  const { updateDepartment, loading: updating } = useUpdateDepartment(editTarget?._id ?? '', () => {
    setEditTarget(null);
    refetch();
  });
  const editForm = useForm<DepartmentFormValues>({ resolver: zodResolver(departmentSchema) });
  const editThresholds = useFieldArray({ control: editForm.control, name: 'approvalThresholds' });

  const openEdit = (dept: IDepartmentData) => {
    setEditTarget(dept);
    editForm.reset({
      name: dept.name,
      budget: String(dept.budget),
      budgetResetPeriod: dept.budgetResetPeriod,
      permissions: {
        canViewAllTickets: dept.permissions.canViewAllTickets,
        canApprove: dept.permissions.canApprove,
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
    );
    createForm.reset({
      budgetResetPeriod: 'none',
      budget: '0',
      permissions: { canViewAllTickets: false, canApprove: false },
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
            <div className="space-y-2">
              <label className="block text-sm font-medium text-[var(--foreground)]">Default Permissions</label>
              <Controller
                control={createForm.control}
                name="permissions.canViewAllTickets"
                render={({ field }) => (
                  <BoolToggleRow label="Can View All Tickets" checked={field.value} onChange={field.onChange} />
                )}
              />
              <Controller
                control={createForm.control}
                name="permissions.canApprove"
                render={({ field }) => (
                  <BoolToggleRow label="Can Approve Tickets" checked={field.value} onChange={field.onChange} />
                )}
              />
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
            <div className="space-y-2">
              <label className="block text-sm font-medium text-[var(--foreground)]">Default Permissions</label>
              <Controller
                control={editForm.control}
                name="permissions.canViewAllTickets"
                render={({ field }) => (
                  <BoolToggleRow label="Can View All Tickets" checked={field.value} onChange={field.onChange} />
                )}
              />
              <Controller
                control={editForm.control}
                name="permissions.canApprove"
                render={({ field }) => (
                  <BoolToggleRow label="Can Approve Tickets" checked={field.value} onChange={field.onChange} />
                )}
              />
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

function BoolToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between p-3 rounded-xl border border-[var(--border)] bg-[var(--muted)]/30">
      <span className="text-sm font-medium text-[var(--foreground)]">{label}</span>
      <div className="flex items-center gap-1">
        {([true, false] as const).map((val) => (
          <button
            key={String(val)}
            type="button"
            onClick={() => onChange(val)}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition ${
              checked === val
                ? 'bg-brand-600 text-white'
                : 'bg-[var(--muted)] text-[var(--muted-foreground)] hover:bg-[var(--accent)]'
            }`}
          >
            {val ? 'Yes' : 'No'}
          </button>
        ))}
      </div>
    </div>
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
              {formatCurrency(dept.spent, 'USD')} / {formatCurrency(dept.budget, 'USD')}
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
