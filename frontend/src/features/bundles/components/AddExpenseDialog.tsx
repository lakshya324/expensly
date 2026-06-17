import { useState, useCallback, useEffect } from 'react';
import { Search, Package } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/shared/components/ui/Dialog';
import { Button } from '@/shared/components/ui/Button';
import { Badge } from '@/shared/components/ui/Badge';
import { Skeleton } from '@/shared/components/ui/Skeleton';
import apiClient from '@/infrastructure/api/client';
import { EP } from '@/infrastructure/api/endpoints';
import type { ApiResponse, PaginatedData } from '@/core/types/api.types';
import type { ITicketSummaryData } from '@/core/types/ticket.types';
import { CURRENCY_SYMBOLS } from '@/core/constants/constants';
import { formatDate } from '@/core/utils/formatters';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bundleId: string;
  onAdded: () => void;
}

const LIMIT = 10;

export function AddExpenseDialog({ open, onOpenChange, bundleId, onAdded }: Props) {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [expenses, setExpenses] = useState<ITicketSummaryData[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  const fetchExpenses = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, unknown> = { page, limit: LIMIT };
      if (search.trim()) params.search = search.trim();
      const res = await apiClient.get<ApiResponse<PaginatedData<ITicketSummaryData>>>(EP.EXPENSES, { params });
      setExpenses(res.data.data?.data ?? []);
      setTotalPages(res.data.data?.pagination?.totalPages ?? 1);
    } catch {
      toast.error('Failed to load expenses');
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    if (open) fetchExpenses();
  }, [open, fetchExpenses]);

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setSearch('');
      setPage(1);
      setSelected(new Set());
    }
  }, [open]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleAdd = async () => {
    if (selected.size === 0) return;
    setSaving(true);
    try {
      await apiClient.post<ApiResponse<unknown>>(EP.BUNDLE_ADD_TICKETS(bundleId), {
        ticketIds: Array.from(selected),
      });
      toast.success(`Added ${selected.size} expense${selected.size > 1 ? 's' : ''} to bundle`);
      onOpenChange(false);
      onAdded();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed to add expenses';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Expenses to Bundle</DialogTitle>
          <DialogDescription>
            Select expenses to add. Expenses already in another bundle are marked.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-2 space-y-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-(--muted-foreground) pointer-events-none" />
            <input
              className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-(--border) bg-(--background) text-(--foreground) placeholder:text-(--muted-foreground) focus:outline-none focus:ring-2 focus:ring-brand-500/30"
              placeholder="Search expenses..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />
          </div>

          {/* Expense list */}
          <div className="max-h-72 overflow-y-auto divide-y divide-(--border) rounded-lg border border-(--border)">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-3 py-2.5">
                  <Skeleton className="w-4 h-4 rounded" />
                  <div className="flex-1 space-y-1">
                    <Skeleton className="h-3.5 w-40" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
              ))
            ) : expenses.length === 0 ? (
              <p className="text-sm text-(--muted-foreground) text-center py-6">No expenses found</p>
            ) : (
              expenses.map((exp) => {
                const alreadyInThisBundle = exp.bundle?._id === bundleId;
                const inOtherBundle = !alreadyInThisBundle && exp.bundle != null;
                const isChecked = selected.has(exp._id);
                const sym = exp.currency ? (CURRENCY_SYMBOLS[exp.currency] ?? exp.currency) : '';

                return (
                  <label
                    key={exp._id}
                    className={`flex items-start gap-3 px-3 py-2.5 cursor-pointer hover:bg-(--accent) transition-colors ${alreadyInThisBundle ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <input
                      type="checkbox"
                      className="mt-0.5 accent-brand-600"
                      checked={alreadyInThisBundle || isChecked}
                      disabled={alreadyInThisBundle}
                      onChange={() => !alreadyInThisBundle && toggle(exp._id)}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-(--foreground) truncate">
                          {exp.title ?? <span className="italic text-(--muted-foreground)">Untitled</span>}
                        </span>
                        {alreadyInThisBundle && (
                          <Badge variant="success" className="text-xs">In bundle</Badge>
                        )}
                        {inOtherBundle && (
                          <Badge variant="warning" className="text-xs flex items-center gap-0.5">
                            <Package className="w-2.5 h-2.5" />
                            {exp.bundle?.title ?? 'Other bundle'}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-(--muted-foreground) mt-0.5">
                        {exp.amount != null ? `${sym}${exp.amount.toLocaleString()}` : '-'}
                        {exp.merchant ? ` · ${exp.merchant.name}` : ''}
                        {' · '}{formatDate(exp.createdAt)}
                      </p>
                    </div>
                  </label>
                );
              })
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between text-xs text-(--muted-foreground)">
              <button
                className="px-2 py-1 rounded hover:bg-(--accent) disabled:opacity-40"
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </button>
              <span>Page {page} of {totalPages}</span>
              <button
                className="px-2 py-1 rounded hover:bg-(--accent) disabled:opacity-40"
                disabled={page === totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </button>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleAdd}
              loading={saving}
              disabled={selected.size === 0}
            >
              Add {selected.size > 0 ? `${selected.size} ` : ''}Expense{selected.size !== 1 ? 's' : ''}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
