import { useState, useCallback, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Package, CheckCircle, XCircle, Clock, Send,
  FileText, Plus, Trash2, Pencil, X,
} from 'lucide-react';
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AppShell } from '@/shared/components/layout/AppShell';
import { Button } from '@/shared/components/ui/Button';
import { Badge } from '@/shared/components/ui/Badge';
import { Card, CardContent, CardHeader } from '@/shared/components/ui/Card';
import { Skeleton } from '@/shared/components/ui/Skeleton';
import { Input } from '@/shared/components/ui/Input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/shared/components/ui/Dialog';
import { ConfirmDialog } from '@/shared/components/feedback/ConfirmDialog';
import { StatusBadge } from '@/shared/components/data-display/StatusBadge';
import { AddExpenseDialog } from '../components/AddExpenseDialog';
import apiClient from '@/infrastructure/api/client';
import { EP } from '@/infrastructure/api/endpoints';
import type { ApiResponse, PaginatedData } from '@/core/types/api.types';
import type { IBundleData, ITicketData } from '@/core/types/ticket.types';
import { ROUTES, CURRENCY_SYMBOLS, BUNDLE_STATUS_LABELS, BUNDLE_STATUS_VARIANT } from '@/core/constants/constants';
import { formatRelativeTime, formatDate } from '@/core/utils/formatters';
import { useAuthStore } from '@/features/auth/store/authStore';

type BundleApproval = {
  approved: boolean | null;
  reviewedBy: { _id: string; name: string } | null;
  reviewedAt: string | null;
  comments: string | null;
} | null;

function ApprovalStepRow({ label, approval }: { label: string; approval: BundleApproval }) {
  const derived = approval === null
    ? 'pending'
    : approval.approved === true
    ? 'approved'
    : approval.approved === false
    ? 'rejected'
    : 'pending';

  return (
    <div className="flex items-start gap-3 py-3 border-b last:border-0 border-(--border)">
      <div className="mt-0.5">
        {derived === 'approved' && <CheckCircle className="w-4 h-4 text-green-500" />}
        {derived === 'rejected' && <XCircle className="w-4 h-4 text-red-500" />}
        {derived === 'pending' && <Clock className="w-4 h-4 text-(--muted-foreground)" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-(--foreground)">{label}</p>
        {approval?.reviewedBy && (
          <p className="text-xs text-(--muted-foreground) mt-0.5">
            {approval.reviewedBy.name}
            {approval.reviewedAt ? ` · ${formatRelativeTime(approval.reviewedAt)}` : ''}
          </p>
        )}
        {approval?.comments && (
          <p className="text-xs italic text-(--muted-foreground) mt-0.5">{approval.comments}</p>
        )}
      </div>
      <Badge
        variant={derived === 'approved' ? 'success' : derived === 'rejected' ? 'danger' : 'muted'}
        className="shrink-0 text-xs"
      >
        {derived.charAt(0).toUpperCase() + derived.slice(1)}
      </Badge>
    </div>
  );
}

// ─── Edit bundle schema ───────────────────────────────────────────────────────
const editSchema = z.object({
  name: z.string().min(1, 'Title is required').max(200),
  description: z.string().max(500).optional(),
});
type EditFormValues = z.infer<typeof editSchema>;

// ─── Approve/reject comment schema ────────────────────────────────────────────
const reviewSchema = z.object({
  comments: z.string().max(500).optional(),
});
type ReviewFormValues = z.infer<typeof reviewSchema>;

const TICKET_LIMIT = 20;

export function BundleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);

  const [bundle, setBundle] = useState<IBundleData | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Expense list state
  const [tickets, setTickets] = useState<ITicketData[]>([]);
  const [ticketPage, setTicketPage] = useState(1);
  const [ticketTotal, setTicketTotal] = useState(0);
  const [ticketsLoading, setTicketsLoading] = useState(false);

  // Dialog state
  const [addExpenseOpen, setAddExpenseOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editSaving, setEditSaving] = useState(false);

  // Admin approval dialog
  const [reviewAction, setReviewAction] = useState<'approve' | 'reject' | null>(null);
  const [reviewSaving, setReviewSaving] = useState(false);

  const editForm = useForm<EditFormValues>({ resolver: zodResolver(editSchema) });
  const reviewForm = useForm<ReviewFormValues>({ resolver: zodResolver(reviewSchema) });

  const canApprove =
    user?.role === 'admin' ||
    user?.effectivePermissions?.approve_finance === true;

  const fetchBundle = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await apiClient.get<ApiResponse<IBundleData>>(EP.BUNDLE(id));
      setBundle(res.data.data);
    } catch {
      toast.error('Failed to load bundle');
      navigate(user?.role === 'admin' ? ROUTES.ADMIN_BUNDLES : ROUTES.BUNDLES);
    } finally {
      setLoading(false);
    }
  }, [id, navigate, user?.role]);

  const fetchTickets = useCallback(async () => {
    if (!id) return;
    setTicketsLoading(true);
    try {
      const res = await apiClient.get<ApiResponse<PaginatedData<ITicketData>>>(
        EP.BUNDLE_TICKETS(id),
        { params: { page: ticketPage, limit: TICKET_LIMIT } },
      );
      setTickets(res.data.data?.data ?? []);
      setTicketTotal(res.data.data?.pagination?.totalItems ?? 0);
    } catch {
      toast.error('Failed to load expenses');
    } finally {
      setTicketsLoading(false);
    }
  }, [id, ticketPage]);

  useEffect(() => { fetchBundle(); }, [fetchBundle]);
  useEffect(() => { if (bundle?._id) fetchTickets(); }, [fetchTickets, bundle?._id]);

  // ── Submit ──────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!id) return;
    setSubmitting(true);
    try {
      const res = await apiClient.post<ApiResponse<IBundleData>>(EP.BUNDLE_SUBMIT(id));
      setBundle(res.data.data);
      toast.success('Bundle submitted for approval');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed to submit bundle';
      toast.error(msg);
    } finally { setSubmitting(false); }
  };

  // ── Delete ──────────────────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!id) return;
    setDeleting(true);
    try {
      await apiClient.delete(EP.BUNDLE(id));
      toast.success('Bundle deleted');
      navigate(user?.role === 'admin' ? ROUTES.ADMIN_BUNDLES : ROUTES.BUNDLES);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed to delete bundle';
      toast.error(msg);
    } finally { setDeleting(false); setDeleteConfirmOpen(false); }
  };

  // ── Edit ────────────────────────────────────────────────────────────────────
  const openEdit = () => {
    if (!bundle) return;
    editForm.reset({ name: bundle.title, description: bundle.description ?? '' });
    setEditOpen(true);
  };

  const handleEdit = editForm.handleSubmit(async (values) => {
    if (!id) return;
    setEditSaving(true);
    try {
      const res = await apiClient.patch<ApiResponse<IBundleData>>(EP.BUNDLE(id), {
        title: values.name,
        description: values.description,
      });
      setBundle(res.data.data);
      setEditOpen(false);
      toast.success('Bundle updated');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed to update bundle';
      toast.error(msg);
    } finally { setEditSaving(false); }
  });

  // ── Remove expense from bundle ───────────────────────────────────────────────
  const handleRemoveExpense = async (ticketId: string) => {
    if (!id) return;
    try {
      const res = await apiClient.delete<ApiResponse<IBundleData>>(EP.BUNDLE_REMOVE_TICKET(id, ticketId));
      setBundle(res.data.data);
      setTickets((prev) => prev.filter((t) => t._id !== ticketId));
      setTicketTotal((prev) => prev - 1);
      toast.success('Expense removed from bundle');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed to remove expense';
      toast.error(msg);
    }
  };

  // ── Admin approve / reject ───────────────────────────────────────────────────
  const handleReview = reviewForm.handleSubmit(async (values) => {
    if (!id || !reviewAction) return;
    setReviewSaving(true);
    try {
      const res = await apiClient.patch<ApiResponse<IBundleData>>(EP.BUNDLE_STATUS(id), {
        step: 'finance',
        approved: reviewAction === 'approve',
        comments: values.comments || undefined,
      });
      setBundle(res.data.data);
      setReviewAction(null);
      reviewForm.reset();
      toast.success(res.data.message ?? `Bundle ${reviewAction === 'approve' ? 'approved' : 'rejected'}`);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed to update status';
      toast.error(msg);
    } finally { setReviewSaving(false); }
  });

  // ── Loading skeleton ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <AppShell title="Bundle">
        <div className="space-y-4 max-w-3xl mx-auto">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      </AppShell>
    );
  }

  if (!bundle) return null;

  const isDraft = bundle.status === 'draft';
  const isSubmitted = bundle.status === 'submitted';
  const ticketTotalPages = Math.ceil(ticketTotal / TICKET_LIMIT);

  return (
    <AppShell title={bundle.title}>
      <div className="max-w-3xl mx-auto space-y-4">
        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="flex items-start gap-3">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => navigate(user?.role === 'admin' ? ROUTES.ADMIN_BUNDLES : ROUTES.BUNDLES)}
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-[var(--foreground)] truncate">{bundle.title}</h1>
              <Badge variant={BUNDLE_STATUS_VARIANT[bundle.status]}>{BUNDLE_STATUS_LABELS[bundle.status]}</Badge>
            </div>
            {bundle.tags && bundle.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {bundle.tags.map((tag) => (
                  <span
                    key={tag}
                    className="text-xs px-2 py-0.5 rounded-full bg-[var(--accent)] text-[var(--muted-foreground)]"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {isDraft && (
              <>
                <Button variant="ghost" size="icon-sm" onClick={openEdit} title="Edit bundle">
                  <Pencil className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="text-red-500 hover:text-red-600"
                  onClick={() => setDeleteConfirmOpen(true)}
                  title="Delete bundle"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
                <Button onClick={handleSubmit} loading={submitting}>
                  <Send className="w-3.5 h-3.5" />
                  Submit
                </Button>
              </>
            )}
          </div>
        </div>

        {/* ── Admin approve/reject actions ─────────────────────────────────── */}
        {isSubmitted && canApprove && (
          <Card className="border-amber-200 dark:border-amber-500/30 bg-amber-50/50 dark:bg-amber-500/5">
            <CardContent className="flex items-center justify-between gap-3 py-3 px-4">
              <div>
                <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
                  This bundle is awaiting your review
                </p>
                <p className="text-xs text-amber-700/80 dark:text-amber-400/80">
                  Approving will auto-approve eligible expenses (pending and awaiting finance).
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="border-red-300 text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10"
                  onClick={() => { setReviewAction('reject'); reviewForm.reset(); }}
                >
                  <XCircle className="w-3.5 h-3.5" />
                  Reject
                </Button>
                <Button
                  size="sm"
                  className="bg-green-600 hover:bg-green-700 text-white"
                  onClick={() => { setReviewAction('approve'); reviewForm.reset(); }}
                >
                  <CheckCircle className="w-3.5 h-3.5" />
                  Approve
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Details card ─────────────────────────────────────────────────── */}
        <Card>
          <CardHeader className="pb-2">
            <h2 className="text-sm font-semibold text-[var(--foreground)] flex items-center gap-1.5">
              <Package className="w-4 h-4" /> Details
            </h2>
          </CardHeader>
          <CardContent>
            <dl className="divide-y divide-[var(--border)] text-sm">
              {bundle.description && (
                <div className="flex justify-between py-2 gap-4">
                  <dt className="text-[var(--muted-foreground)] shrink-0">Description</dt>
                  <dd className="text-[var(--foreground)] text-right">{bundle.description}</dd>
                </div>
              )}
              <div className="flex justify-between py-2">
                <dt className="text-[var(--muted-foreground)]">Submitted by</dt>
                <dd className="text-[var(--foreground)]">{bundle.submittedBy.name}</dd>
              </div>
              <div className="flex justify-between py-2">
                <dt className="text-[var(--muted-foreground)]">Expenses</dt>
                <dd className="font-medium text-[var(--foreground)]">{bundle.ticketCount}</dd>
              </div>
              <div className="flex justify-between py-2">
                <dt className="text-[var(--muted-foreground)]">Total (Base)</dt>
                <dd className="font-medium text-[var(--foreground)]">
                  {bundle.totalAmountBase !== null
                    ? `${bundle.baseCurrency ?? ''}\u00a0${bundle.totalAmountBase.toFixed(2)}`
                    : '\u2014'}
                </dd>
              </div>
              <div className="flex justify-between py-2">
                <dt className="text-[var(--muted-foreground)]">Created</dt>
                <dd className="text-[var(--foreground)]">{formatRelativeTime(bundle.createdAt)}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        {/* ── Approval flow ────────────────────────────────────────────────── */}
        {bundle.status !== 'draft' && (
          <Card>
            <CardHeader className="pb-2">
              <h2 className="text-sm font-semibold text-[var(--foreground)] flex items-center gap-1.5">
                <CheckCircle className="w-4 h-4" /> Approval Flow
              </h2>
            </CardHeader>
            <CardContent className="pt-0">
              {bundle.managerApproval && (
                <ApprovalStepRow label="Manager Approval" approval={bundle.managerApproval} />
              )}
              <ApprovalStepRow label="Finance Approval" approval={bundle.financeApproval} />
            </CardContent>
          </Card>
        )}

        {/* ── Expenses in bundle ───────────────────────────────────────────── */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-[var(--foreground)] flex items-center gap-1.5">
                <FileText className="w-4 h-4" /> Expenses ({ticketTotal})
              </h2>
              {isDraft && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setAddExpenseOpen(true)}
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Expenses
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {ticketsLoading ? (
              <div className="space-y-2 py-2">
                {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : tickets.length === 0 ? (
              <p className="text-sm text-[var(--muted-foreground)] py-3 text-center">
                No expenses added to this bundle yet.
                {isDraft && (
                  <button
                    className="ml-1 text-brand-600 hover:underline"
                    onClick={() => setAddExpenseOpen(true)}
                  >
                    Add some?
                  </button>
                )}
              </p>
            ) : (
              <>
                <ul className="divide-y divide-[var(--border)]">
                  {tickets.map((ticket) => {
                    const sym = ticket.currency ? (CURRENCY_SYMBOLS[ticket.currency] ?? ticket.currency) : '';
                    return (
                      <li key={ticket._id} className="flex items-center gap-3 py-2.5">
                        <button
                          className="flex-1 flex items-start gap-3 text-left hover:opacity-80 transition-opacity"
                          onClick={() => navigate(ROUTES.EXPENSE_DETAIL(ticket._id))}
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-(--foreground) truncate">
                              {ticket.title ?? <span className="italic text-(--muted-foreground)">Untitled</span>}
                            </p>
                            <p className="text-xs text-(--muted-foreground) mt-0.5">
                              {ticket.amount != null ? `${sym}${ticket.amount.toLocaleString()}` : '-'}
                              {ticket.merchant ? ` · ${ticket.merchant.name}` : ''}
                              {' · '}{formatDate(ticket.createdAt)}
                            </p>
                          </div>
                          <StatusBadge status={ticket.status} />
                        </button>
                        {isDraft && (
                          <button
                            className="p-1.5 rounded-md text-(--muted-foreground) hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors shrink-0"
                            onClick={() => handleRemoveExpense(ticket._id)}
                            title="Remove from bundle"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
                {ticketTotalPages > 1 && (
                  <div className="flex items-center justify-between pt-3 border-t border-(--border) text-xs text-(--muted-foreground)">
                    <button
                      className="px-2 py-1 rounded hover:bg-(--accent) disabled:opacity-40"
                      disabled={ticketPage === 1}
                      onClick={() => setTicketPage((p) => p - 1)}
                    >
                      Previous
                    </button>
                    <span>Page {ticketPage} of {ticketTotalPages}</span>
                    <button
                      className="px-2 py-1 rounded hover:bg-(--accent) disabled:opacity-40"
                      disabled={ticketPage === ticketTotalPages}
                      onClick={() => setTicketPage((p) => p + 1)}
                    >
                      Next
                    </button>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Add Expense dialog ──────────────────────────────────────────────── */}
      <AddExpenseDialog
        open={addExpenseOpen}
        onOpenChange={setAddExpenseOpen}
        bundleId={id!}
        onAdded={() => { fetchBundle(); fetchTickets(); }}
      />

      {/* ── Edit bundle dialog ──────────────────────────────────────────────── */}
      <Dialog open={editOpen} onOpenChange={(o) => { if (!o) setEditOpen(false); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Bundle</DialogTitle>
            <DialogDescription>Update the bundle title and description.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEdit} className="space-y-4 mt-2">
            <Input
              label="Title"
              placeholder="e.g. Q3 Travel Expenses"
              error={editForm.formState.errors.name?.message}
              {...editForm.register('name')}
            />
            <Input
              label="Description"
              placeholder="Optional description"
              error={editForm.formState.errors.description?.message}
              {...editForm.register('description')}
            />
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setEditOpen(false)} disabled={editSaving}>
                Cancel
              </Button>
              <Button type="submit" loading={editSaving}>Save</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Delete confirm ──────────────────────────────────────────────────── */}
      <ConfirmDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        title="Delete bundle?"
        description="This will permanently delete the bundle. Expenses will not be deleted."
        confirmLabel="Delete"
        loading={deleting}
        onConfirm={handleDelete}
      />

      {/* ── Approve / reject dialog ─────────────────────────────────────────── */}
      <Dialog open={reviewAction !== null} onOpenChange={(o) => { if (!o) setReviewAction(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {reviewAction === 'approve' ? 'Approve Bundle' : 'Reject Bundle'}
            </DialogTitle>
            <DialogDescription>
              {reviewAction === 'approve'
                ? 'Confirm approval of this expense bundle.'
                : 'Provide a reason for rejection (optional).'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleReview} className="space-y-4 mt-2">
            <Input
              label="Comments (optional)"
              placeholder="Add a note..."
              {...reviewForm.register('comments')}
            />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setReviewAction(null)} disabled={reviewSaving}>
                Cancel
              </Button>
              <Button
                type="submit"
                loading={reviewSaving}
                variant={reviewAction === 'reject' ? 'destructive' : 'default'}
              >
                {reviewAction === 'approve' ? 'Approve' : 'Reject'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
