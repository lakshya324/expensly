import { useState, useCallback, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Package, CheckCircle, XCircle, Clock, Send,
  ChevronRight, FileText,
} from 'lucide-react';
import { toast } from 'sonner';
import { AppShell } from '@/shared/components/layout/AppShell';
import { Button } from '@/shared/components/ui/Button';
import { Badge } from '@/shared/components/ui/Badge';
import { Card, CardContent, CardHeader } from '@/shared/components/ui/Card';
import { Skeleton } from '@/shared/components/ui/Skeleton';
import apiClient from '@/infrastructure/api/client';
import { EP } from '@/infrastructure/api/endpoints';
import type { ApiResponse } from '@/core/types/api.types';
import type { IBundleData, BundleStatus } from '@/core/types/ticket.types';
import { ROUTES } from '@/core/constants/constants';
import { formatRelativeTime } from '@/core/utils/formatters';

const STATUS_LABEL: Record<BundleStatus, string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  approved: 'Approved',
  rejected: 'Rejected',
};

const STATUS_VARIANT: Record<BundleStatus, 'muted' | 'warning' | 'success' | 'danger'> = {
  draft: 'muted',
  submitted: 'warning',
  approved: 'success',
  rejected: 'danger',
};

type BundleApproval = {
  approved: boolean | null;
  reviewedBy: { _id: string; name: string } | null;
  reviewedAt: string | null;
  comments: string | null;
} | null;

function ApprovalStep({ label, approval }: { label: string; approval: BundleApproval }) {
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

export function BundleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [bundle, setBundle] = useState<IBundleData | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const fetchBundle = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await apiClient.get<ApiResponse<IBundleData>>(EP.BUNDLE(id));
      setBundle(res.data.data);
    } catch {
      toast.error('Failed to load bundle');
      navigate(ROUTES.BUNDLES);
    } finally {
      setLoading(false);
    }
  }, [id, navigate]);

  useEffect(() => { fetchBundle(); }, [fetchBundle]);

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

  return (
    <AppShell title={bundle.title}>
      <div className="max-w-3xl mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-start gap-3">
          <Button variant="ghost" size="icon-sm" onClick={() => navigate(ROUTES.BUNDLES)}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-[var(--foreground)] truncate">{bundle.title}</h1>
              <Badge variant={STATUS_VARIANT[bundle.status]}>{STATUS_LABEL[bundle.status]}</Badge>
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
          {bundle.status === 'draft' && (
            <Button onClick={handleSubmit} loading={submitting}>
              <Send className="w-3.5 h-3.5" />
              Submit
            </Button>
          )}
        </div>

        {/* Details card */}
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
                <dt className="text-[var(--muted-foreground)]">Expenses</dt>
                <dd className="font-medium text-[var(--foreground)]">{bundle.ticketCount}</dd>
              </div>
              <div className="flex justify-between py-2">
                <dt className="text-[var(--muted-foreground)]">Total (Base)</dt>
                <dd className="font-medium text-[var(--foreground)]">
                  {bundle.totalAmountBase !== null ? `$${bundle.totalAmountBase.toFixed(2)}` : '—'}
                </dd>
              </div>
              <div className="flex justify-between py-2">
                <dt className="text-[var(--muted-foreground)]">Created</dt>
                <dd className="text-[var(--foreground)]">{formatRelativeTime(bundle.createdAt)}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        {/* Approval flow */}
        {bundle.status !== 'draft' && (
          <Card>
            <CardHeader className="pb-2">
              <h2 className="text-sm font-semibold text-[var(--foreground)] flex items-center gap-1.5">
                <CheckCircle className="w-4 h-4" /> Approval Flow
              </h2>
            </CardHeader>
            <CardContent className="pt-0">
              <ApprovalStep label="Manager Approval" approval={bundle.managerApproval} />
              <ApprovalStep label="Finance Approval" approval={bundle.financeApproval} />
            </CardContent>
          </Card>
        )}

        {/* Expenses in bundle */}
        <Card>
          <CardHeader className="pb-2">
            <h2 className="text-sm font-semibold text-[var(--foreground)] flex items-center gap-1.5">
              <FileText className="w-4 h-4" /> Expenses ({bundle.ticketCount})
            </h2>
          </CardHeader>
          <CardContent className="pt-0">
            {bundle.ticketIds.length === 0 ? (
              <p className="text-sm text-[var(--muted-foreground)] py-3 text-center">
                No expenses added to this bundle yet.
              </p>
            ) : (
              <ul className="divide-y divide-[var(--border)]">
                {bundle.ticketIds.map((tid) => (
                  <li key={tid}>
                    <button
                      className="w-full flex items-center justify-between py-2.5 text-sm text-[var(--foreground)] hover:text-brand-600 transition-colors"
                      onClick={() => navigate(`/expenses/${tid}`)}
                    >
                      <span className="font-mono text-xs text-[var(--muted-foreground)]">
                        {String(tid).slice(-12)}
                      </span>
                      <ChevronRight className="w-3.5 h-3.5 text-[var(--muted-foreground)]" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
