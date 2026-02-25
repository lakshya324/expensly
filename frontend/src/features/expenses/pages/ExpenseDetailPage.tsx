import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Flag, Download, CheckCircle, XCircle, Loader2, Clock, User, AlertTriangle
} from 'lucide-react';
import { AppShell } from '@/shared/components/layout/AppShell';
import { Button } from '@/shared/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/Card';
import { StatusBadge } from '@/shared/components/data-display/StatusBadge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/shared/components/ui/Dialog';
import { useExpense, useUpdateExpenseStatus, useFlagExpense, useReceiptUrl } from '../hooks/useExpenses';
import { useAuthStore } from '@/features/auth/store/authStore';
import { formatCurrency, formatDateTime, formatRelativeTime } from '@/core/utils/formatters';
import { CURRENCY_SYMBOLS } from '@/core/constants/constants';

export function ExpenseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const { data: ticket, loading, setData } = useExpense(id!);
  const { toggleFlag, loading: flagLoading } = useFlagExpense(id!, setData);
  const { openReceipt } = useReceiptUrl(id!);
  const [statusModal, setStatusModal] = useState<{ 
    open: boolean; 
    action: 'approved' | 'rejected' | null;
    isManagerApproval: boolean;
    requiresOverrideWarning: boolean;
  }>({
    open: false,
    action: null,
    isManagerApproval: false,
    requiresOverrideWarning: false,
  });
  const [comments, setComments] = useState('');

  const { updateStatus, loading: statusLoading } = useUpdateExpenseStatus(id!, (updated) => {
    setData(updated);
    setStatusModal({ open: false, action: null, isManagerApproval: false, requiresOverrideWarning: false });
    setComments('');
  });

  if (loading) {
    return (
      <AppShell title="Expense">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-6 h-6 animate-spin text-brand-500" />
        </div>
      </AppShell>
    );
  }

  if (!ticket) return null;

  // Check if user can do manager approval (only the actual assigned manager — not admin)
  const canApproveAsManager =
    ticket.managerApproval !== null &&
    ticket.managerApproval.approved === null &&
    ticket.status === 'pending' &&
    user?.role !== 'admin' &&
    ticket.submitterManagerId === user?._id;

  // Check if user can do finance approval
  // Priority: user role (admin) → user-level permission → dept-level permission
  const hasFinancePermission =
    user?.role === 'admin' ||
    user?.permissions?.canApprove === true ||
    (user?.permissions?.canApprove == null && user?.department?.permissions?.canApprove === true);

  // Finance users can act when:
  //   - status is 'awaiting_finance' (manager already approved)
  //   - status is 'pending' AND manager step is done or not required (ticket has no manager approval, or it was already approved)
  //   - admin can also override a still-pending manager step
  const managerStepDoneOrNotNeeded =
    ticket.managerApproval === null ||
    ticket.managerApproval.approved === true;

  const canApproveAsFinance =
    hasFinancePermission &&
    ticket.financeApproval?.approved === null &&
    (
      ticket.status === 'awaiting_finance' ||
      (ticket.status === 'pending' && managerStepDoneOrNotNeeded) ||
      (user?.role === 'admin' && ticket.status === 'pending')
    );

  // True when an admin approves a pending ticket that still has an unreviewed manager step.
  const needsManagerOverride =
    user?.role === 'admin' &&
    ticket.status === 'pending' &&
    ticket.managerApproval !== null &&
    ticket.managerApproval.approved === null;

  const isSubmitter = ticket.submittedBy._id === user?._id;

  return (
    <AppShell title="Expense Detail">
      <div className="max-w-3xl mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon-sm" onClick={() => navigate(-1)}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <h2 className="text-xl font-bold text-[var(--foreground)]">{ticket.title}</h2>
              <p className="text-sm text-[var(--muted-foreground)]">
                Submitted {formatRelativeTime(ticket.createdAt)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status={ticket.status} />
            {ticket.flagged && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-warning-50 text-warning-600 dark:bg-warning-500/15 dark:text-warning-400">
                <Flag className="w-3 h-3 fill-current" /> Flagged
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Main Info */}
          <Card className="md:col-span-2">
            <CardHeader><CardTitle>Details</CardTitle></CardHeader>
            <CardContent>
              <dl className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <div>
                  <dt className="text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wide">Amount</dt>
                  <dd className="mt-1 text-xl font-bold text-[var(--foreground)]">
                    {formatCurrency(ticket.amount, ticket.currency)}
                  </dd>
                  {ticket.convertedAmount && (
                    <dd className="text-xs text-[var(--muted-foreground)]">
                      ≈ {CURRENCY_SYMBOLS['USD'] ?? '$'}{ticket.convertedAmount.toFixed(2)} USD (locked)
                    </dd>
                  )}
                </div>
                <div>
                  <dt className="text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wide">Department</dt>
                  <dd className="mt-1 text-sm font-semibold text-[var(--foreground)]">
                    {ticket.department?.name ?? '—'}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wide">Submitted By</dt>
                  <dd className="mt-1 text-sm font-semibold text-[var(--foreground)]">
                    {ticket.submittedBy.name}
                  </dd>
                  <dd className="text-xs text-[var(--muted-foreground)]">{ticket.submittedBy.email}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wide">Date</dt>
                  <dd className="mt-1 text-sm text-[var(--foreground)]">{formatDateTime(ticket.createdAt)}</dd>
                </div>
                {ticket.tags.length > 0 && (
                  <div className="col-span-2">
                    <dt className="text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wide mb-1.5">Tags</dt>
                    <dd className="flex flex-wrap gap-1.5">
                      {ticket.tags.map((t) => (
                        <span key={t} className="px-2.5 py-0.5 rounded-full bg-brand-50 dark:bg-brand-950/50 text-xs font-medium text-brand-700 dark:text-brand-300">
                          {t}
                        </span>
                      ))}
                    </dd>
                  </div>
                )}
                {ticket.description && (
                  <div className="col-span-3">
                    <dt className="text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wide">Description</dt>
                    <dd className="mt-1 text-sm text-[var(--foreground)]">{ticket.description}</dd>
                  </div>
                )}
              </dl>
            </CardContent>
          </Card>

          {/* Approval Timeline */}
          <Card>
            <CardHeader><CardTitle>Approval Flow</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Manager step */}
                {ticket.managerApproval && (
                  <div className="flex gap-3">
                    <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                      ticket.managerApproval.approved === true ? 'bg-success-50 dark:bg-success-500/10' :
                      ticket.managerApproval.approved === false ? 'bg-danger-50 dark:bg-danger-500/10' :
                      'bg-warning-50 dark:bg-warning-500/10'
                    }`}>
                      {ticket.managerApproval.approved === true ? <CheckCircle className="w-4 h-4 text-success-600 dark:text-success-400" /> :
                       ticket.managerApproval.approved === false ? <XCircle className="w-4 h-4 text-danger-500" /> :
                       <Clock className="w-4 h-4 text-warning-600 dark:text-warning-400" />}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-[var(--foreground)]">Manager Review</p>
                      {ticket.managerApproval.reviewedBy ? (
                        <p className="text-xs text-[var(--muted-foreground)]">
                          {ticket.managerApproval.reviewedBy.name} · {ticket.managerApproval.reviewedAt ? formatDateTime(ticket.managerApproval.reviewedAt) : ''}
                        </p>
                      ) : (
                        <p className="text-xs text-[var(--muted-foreground)]">Awaiting manager</p>
                      )}
                      {ticket.managerApproval.comments && (
                        <p className="mt-1 text-xs italic text-[var(--muted-foreground)]">"{ticket.managerApproval.comments}"</p>
                      )}
                    </div>
                  </div>
                )}

                {/* Finance step */}
                <div className="flex gap-3">
                  <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                    ticket.financeApproval?.approved === true ? 'bg-success-50 dark:bg-success-500/10' :
                    ticket.financeApproval?.approved === false ? 'bg-danger-50 dark:bg-danger-500/10' :
                    'bg-[var(--muted)]'
                  }`}>
                    {ticket.financeApproval?.approved === true ? <CheckCircle className="w-4 h-4 text-success-600 dark:text-success-400" /> :
                     ticket.financeApproval?.approved === false ? <XCircle className="w-4 h-4 text-danger-500" /> :
                     <User className="w-4 h-4 text-[var(--muted-foreground)]" />}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[var(--foreground)]">Finance Review</p>
                    {ticket.financeApproval?.reviewedBy ? (
                      <p className="text-xs text-[var(--muted-foreground)]">
                        {ticket.financeApproval.reviewedBy.name} · {ticket.financeApproval.reviewedAt ? formatDateTime(ticket.financeApproval.reviewedAt) : ''}
                      </p>
                    ) : (
                      <p className="text-xs text-[var(--muted-foreground)]">
                        {ticket.status === 'approved' || ticket.status === 'rejected' ? 'Reviewed' : 'Pending'}
                      </p>
                    )}
                    {ticket.financeApproval?.comments && (
                      <p className="mt-1 text-xs italic text-[var(--muted-foreground)]">"{ticket.financeApproval.comments}"</p>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <Card>
            <CardHeader><CardTitle>Actions</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {ticket.receiptKey && (
                <Button variant="outline" size="sm" className="w-full" onClick={openReceipt}>
                  <Download className="w-4 h-4" />
                  View Receipt
                </Button>
              )}
              {(isSubmitter || user?.role === 'admin' || hasFinancePermission) && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  loading={flagLoading}
                  onClick={toggleFlag}
                >
                  <Flag className={`w-4 h-4 ${ticket.flagged ? 'fill-warning-500 text-warning-500' : ''}`} />
                  {ticket.flagged ? 'Unflag' : 'Flag'} Expense
                </Button>
              )}
              {canApproveAsManager && (
                <>
                  <Button
                    variant="success"
                    size="sm"
                    className="w-full"
                    onClick={() => setStatusModal({ open: true, action: 'approved', isManagerApproval: true, requiresOverrideWarning: false })}
                  >
                    <CheckCircle className="w-4 h-4" />
                    Manager Approve
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="w-full"
                    onClick={() => setStatusModal({ open: true, action: 'rejected', isManagerApproval: true, requiresOverrideWarning: false })}
                  >
                    <XCircle className="w-4 h-4" />
                    Manager Reject
                  </Button>
                </>
              )}
              {canApproveAsFinance && (
                <>
                  <Button
                    variant="success"
                    size="sm"
                    className="w-full"
                    onClick={() => setStatusModal({ open: true, action: 'approved', isManagerApproval: false, requiresOverrideWarning: needsManagerOverride && true })}
                  >
                    <CheckCircle className="w-4 h-4" />
                    {needsManagerOverride ? 'Override & Approve' : 'Finance Approve'}
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="w-full"
                    onClick={() => setStatusModal({ open: true, action: 'rejected', isManagerApproval: false, requiresOverrideWarning: false })}
                  >
                    <XCircle className="w-4 h-4" />
                    Finance Reject
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Status Change Dialog */}
        <Dialog open={statusModal.open} onOpenChange={(o) => { if (!o) setStatusModal({ open: false, action: null, isManagerApproval: false, requiresOverrideWarning: false }); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {statusModal.requiresOverrideWarning
                  ? 'Override & Approve Expense'
                  : `${statusModal.isManagerApproval ? 'Manager ' : 'Finance '}${statusModal.action === 'approved' ? 'Approve' : 'Reject'} Expense`}
              </DialogTitle>
              <DialogDescription>
                {statusModal.action === 'approved'
                  ? statusModal.isManagerApproval
                    ? 'Approve and forward to finance for final review.'
                    : 'Confirm final approval. The exchange rate will be locked at current rates.'
                  : 'Please provide a reason for rejection.'}
              </DialogDescription>
            </DialogHeader>

            {/* Admin override warning */}
            {statusModal.requiresOverrideWarning && (
              <div className="flex gap-2.5 items-start rounded-lg bg-warning-50 dark:bg-warning-500/10 border border-warning-200 dark:border-warning-500/30 px-3.5 py-3">
                <AlertTriangle className="w-4 h-4 text-warning-600 dark:text-warning-400 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-warning-700 dark:text-warning-400">
                  Manager approval is still pending. Approving now will <strong>automatically override</strong> and skip the manager review step.
                </p>
              </div>
            )}

            <div className="mt-2">
              <label className="block text-sm font-medium text-[var(--foreground)] mb-1.5">
                Comments {statusModal.action === 'rejected' && <span className="text-danger-500">*</span>}
              </label>
              <textarea
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                rows={3}
                placeholder="Optional comments..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--input)] bg-[var(--background)] text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
              />
            </div>
            <div className="flex gap-2 justify-end mt-4">
              <Button variant="outline" onClick={() => setStatusModal({ open: false, action: null, isManagerApproval: false, requiresOverrideWarning: false })} disabled={statusLoading}>
                Cancel
              </Button>
              <Button
                variant={statusModal.action === 'approved' ? 'success' : 'destructive'}
                loading={statusLoading}
                onClick={() => {
                  if (statusModal.action) {
                    // Manager approval: send 'awaiting_finance' for approve, 'rejected' for reject
                    // Finance approval: send 'approved' for approve, 'rejected' for reject
                    const targetStatus = statusModal.isManagerApproval
                      ? (statusModal.action === 'approved' ? 'awaiting_finance' : 'rejected')
                      : statusModal.action;
                    updateStatus(targetStatus, comments || undefined);
                  }
                }}
              >
                {statusModal.action === 'approved' ? 'Approve' : 'Reject'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AppShell>
  );
}
