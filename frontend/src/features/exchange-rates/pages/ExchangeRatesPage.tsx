import { useState } from 'react';
import { RefreshCw, Pencil, BarChart2 } from 'lucide-react';
import { AppShell } from '@/shared/components/layout/AppShell';
import { Button } from '@/shared/components/ui/Button';
import { Badge } from '@/shared/components/ui/Badge';
import { Input } from '@/shared/components/ui/Input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/shared/components/ui/Card';
import { DataTable, type Column } from '@/shared/components/data-display/DataTable';
import { Skeleton } from '@/shared/components/ui/Skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/shared/components/ui/Dialog';
import {
  useExchangeRates,
  useExchangeRateHistory,
  useSetManualRates,
  useUpdateActiveCurrencies,
  useFetchRatesPreview,
} from '../hooks/useExchangeRates';
import { useAuthStore } from '@/features/auth/store/authStore';
import { CURRENCIES } from '@/core/constants/constants';
import { formatDate } from '@/core/utils/formatters';
import type { IExchangeRateSnapshot } from '@/core/types/analytics.types';

export function ExchangeRatesPage() {
  const user = useAuthStore((s) => s.user);
  const orgActiveCurrencies: string[] = user?.org?.activeCurrencies ?? [];
  const baseCurrency = user?.org?.baseCurrency ?? 'USD';

  const { data: current, loading: loadingCurrent, refetch: refetchCurrent } = useExchangeRates();
  const [histPage, setHistPage] = useState(1);
  const {
    data: history,
    pagination: histPagination,
    loading: loadingHistory,
    refetch: refetchHistory,
  } = useExchangeRateHistory({ page: histPage, limit: 10 });

  const refetchAll = () => {
    refetchCurrent();
    refetchHistory();
  };

  const { setManualRates, loading: savingManual } = useSetManualRates(refetchAll);
  const { updateActiveCurrencies, loading: savingCurrencies } = useUpdateActiveCurrencies(refetchAll);
  const { fetchPreview, loading: fetchingPreview } = useFetchRatesPreview();

  // ── Manual rates dialog ────────────────────────────────────────────────────
  const [manualOpen, setManualOpen] = useState(false);
  const [manualValues, setManualValues] = useState<Record<string, string>>({});

  const openManual = () => {
    const initial: Record<string, string> = {};
    orgActiveCurrencies.forEach((c) => {
      initial[c] = String(current?.rates[c as keyof typeof current.rates] ?? '');
    });
    setManualValues(initial);
    setManualOpen(true);
  };

  const handleSaveManual = async () => {
    const rates: Record<string, number> = {};
    Object.entries(manualValues).forEach(([k, v]) => {
      if (v !== '' && !isNaN(Number(v))) rates[k] = Number(v);
    });
    await setManualRates({ rates });
    setManualOpen(false);
  };

  // ── Fetch Latest preview dialog ────────────────────────────────────────────
  const [fetchPreviewOpen, setFetchPreviewOpen] = useState(false);
  const [fetchPreviewValues, setFetchPreviewValues] = useState<Record<string, string>>({});

  const openFetchPreview = async () => {
    const rates = await fetchPreview();
    if (!rates) return;
    const currencies = orgActiveCurrencies.length > 0 ? orgActiveCurrencies : Object.keys(rates);
    const initial: Record<string, string> = {};
    currencies.forEach((c) => {
      if (rates[c] != null) initial[c] = String(rates[c]);
    });
    setFetchPreviewValues(initial);
    setFetchPreviewOpen(true);
  };

  const handleSaveFetchedRates = async () => {
    const rates: Record<string, number> = {};
    Object.entries(fetchPreviewValues).forEach(([k, v]) => {
      if (v !== '' && !isNaN(Number(v))) rates[k] = Number(v);
    });
    await setManualRates({ rates });
    setFetchPreviewOpen(false);
  };

  // ── Active currencies ──────────────────────────────────────────────────────
  // null = not yet edited — falls back to org value from auth store
  const [localCurrencies, setLocalCurrencies] = useState<Set<string> | null>(null);
  const activeCurrencies = localCurrencies ?? new Set(orgActiveCurrencies);

  const toggleCurrency = (c: string) => {
    setLocalCurrencies((prev) => {
      const base = prev ?? new Set(orgActiveCurrencies);
      const next = new Set(base);
      if (next.has(c)) next.delete(c);
      else next.add(c);
      return next;
    });
  };

  // ── Snapshot detail modal (history table) ─────────────────────────────────
  const [detailSnapshot, setDetailSnapshot] = useState<IExchangeRateSnapshot | null>(null);

  const historyColumns: Column<IExchangeRateSnapshot>[] = [
    {
      key: 'date',
      header: 'Date',
      render: (row) => (
        <span className="text-sm text-[var(--foreground)]">{formatDate(row.createdAt)}</span>
      ),
    },
    {
      key: 'source',
      header: 'Source',
      width: '100px',
      render: (row) => (
        <Badge variant={row.source === 'fetched' ? 'success' : 'info'}>{row.source}</Badge>
      ),
    },
    {
      key: 'base',
      header: 'Base',
      width: '80px',
      render: (row) => <Badge variant="muted">{row.baseCurrency}</Badge>,
    },
    {
      key: 'status',
      header: 'Status',
      width: '90px',
      render: (row) =>
        row._id === current?._id ? (
          <Badge variant="success">Active</Badge>
        ) : (
          <Badge variant="muted">Past</Badge>
        ),
    },
    {
      key: 'rates',
      header: 'Rates',
      width: '80px',
      render: (row) => (
        <Button variant="outline" size="sm" onClick={() => setDetailSnapshot(row)}>
          <BarChart2 className="w-3.5 h-3.5" />
          View
        </Button>
      ),
    },
  ];

  return (
    <AppShell title="Exchange Rates">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-[var(--foreground)]">Exchange Rates</h2>
            <p className="text-sm text-[var(--muted-foreground)]">
              Manage currency rates used for expense conversion
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={openManual}>
              <Pencil className="w-4 h-4" />
              Set Manually
            </Button>
            <Button loading={fetchingPreview} onClick={openFetchPreview}>
              <RefreshCw className="w-4 h-4" />
              Fetch Latest
            </Button>
          </div>
        </div>

        {/* Current Rates Card */}
        <Card>
          <CardHeader>
            <CardTitle>Current Rates</CardTitle>
            {current && (
              <CardDescription>
                Base: {current.baseCurrency} · Source:{' '}
                <span className="capitalize">{current.source}</span> · {formatDate(current.createdAt)}
              </CardDescription>
            )}
          </CardHeader>
          <CardContent>
            {loadingCurrent ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-4 w-full" />
                ))}
              </div>
            ) : !current ? (
              <p className="text-sm text-[var(--muted-foreground)]">
                No rates available. Fetch the latest or set manually.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border)]">
                      <th className="pb-2 text-left font-semibold text-xs text-[var(--muted-foreground)] uppercase tracking-wider">
                        Currency
                      </th>
                      <th className="pb-2 text-right font-semibold text-xs text-[var(--muted-foreground)] uppercase tracking-wider">
                        Rate (per 1 {current.baseCurrency})
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {orgActiveCurrencies.map((c) => (
                      <tr key={c} className="hover:bg-[var(--muted)]/30 transition-colors">
                        <td className="py-2 font-medium text-[var(--foreground)]">{c}</td>
                        <td className="py-2 text-right text-[var(--muted-foreground)]">
                          {current.rates[c as keyof typeof current.rates]?.toFixed(4) ?? '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Active Currencies */}
        <Card>
          <CardHeader>
            <CardTitle>Active Currencies</CardTitle>
            <CardDescription>Select currencies to track and convert expenses.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2 mb-4">
              {CURRENCIES.map((c) => {
                const active = activeCurrencies.has(c);
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => toggleCurrency(c)}
                    className={`px-2 py-1.5 rounded-lg text-xs font-medium transition border ${
                      active
                        ? 'bg-brand-600 text-white border-brand-600'
                        : 'border-[var(--border)] bg-[var(--background)] text-[var(--muted-foreground)] hover:bg-[var(--accent)]'
                    }`}
                  >
                    {c}
                  </button>
                );
              })}
            </div>
            <Button
              loading={savingCurrencies}
              onClick={async () => {
                await updateActiveCurrencies(Array.from(activeCurrencies));
                setLocalCurrencies(null);
              }}
            >
              Save Active Currencies
            </Button>
          </CardContent>
        </Card>

        {/* History */}
        <div>
          <h3 className="text-base font-semibold text-[var(--foreground)] mb-3">Rate History</h3>
          <DataTable
            columns={historyColumns}
            data={history}
            loading={loadingHistory}
            pagination={histPagination ?? undefined}
            onPageChange={setHistPage}
            emptyTitle="No rate history"
            emptyDescription="Fetch or set rates to start tracking history."
          />
        </div>
      </div>

      {/* ── Set Manually dialog ───────────────────────────────────────────── */}
      <Dialog open={manualOpen} onOpenChange={setManualOpen}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Set Manual Rates</DialogTitle>
            <DialogDescription>
              Enter exchange rates relative to {baseCurrency}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            {Object.keys(manualValues).length === 0 && (
              <p className="text-sm text-[var(--muted-foreground)]">
                No active currencies to configure. Add active currencies first.
              </p>
            )}
            {Object.keys(manualValues).map((currency) => (
              <div key={currency} className="flex items-center gap-3">
                <span className="w-12 text-sm font-medium text-[var(--foreground)] shrink-0">
                  {currency}
                </span>
                <Input
                  type="number"
                  step="0.0001"
                  min="0"
                  placeholder="0.0000"
                  value={manualValues[currency]}
                  onChange={(e) =>
                    setManualValues((prev) => ({ ...prev, [currency]: e.target.value }))
                  }
                />
              </div>
            ))}
          </div>
          <div className="flex gap-2 justify-end mt-4">
            <Button variant="outline" onClick={() => setManualOpen(false)}>
              Cancel
            </Button>
            <Button loading={savingManual} onClick={handleSaveManual}>
              Save Rates
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Fetch Latest preview dialog ───────────────────────────────────── */}
      <Dialog open={fetchPreviewOpen} onOpenChange={setFetchPreviewOpen}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Fetch Latest Rates</DialogTitle>
            <DialogDescription>
              Live rates from the exchange API (base: {baseCurrency}). Edit values if needed before saving.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            {Object.keys(fetchPreviewValues).length === 0 && (
              <p className="text-sm text-[var(--muted-foreground)]">No rates available to preview.</p>
            )}
            {Object.keys(fetchPreviewValues).map((currency) => (
              <div key={currency} className="flex items-center gap-3">
                <span className="w-12 text-sm font-medium text-[var(--foreground)] shrink-0">
                  {currency}
                </span>
                <Input
                  type="number"
                  step="0.0001"
                  min="0"
                  placeholder="0.0000"
                  value={fetchPreviewValues[currency]}
                  onChange={(e) =>
                    setFetchPreviewValues((prev) => ({ ...prev, [currency]: e.target.value }))
                  }
                />
              </div>
            ))}
          </div>
          <div className="flex gap-2 justify-end mt-4">
            <Button variant="outline" onClick={() => setFetchPreviewOpen(false)}>
              Cancel
            </Button>
            <Button loading={savingManual} onClick={handleSaveFetchedRates}>
              Save Rates
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Snapshot detail modal ─────────────────────────────────────────── */}
      <Dialog open={!!detailSnapshot} onOpenChange={(open) => !open && setDetailSnapshot(null)}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Snapshot Rates</DialogTitle>
            {detailSnapshot && (
              <DialogDescription>
                {formatDate(detailSnapshot.createdAt)} · Base: {detailSnapshot.baseCurrency} ·{' '}
                <span className="capitalize">{detailSnapshot.source}</span>
              </DialogDescription>
            )}
          </DialogHeader>
          {detailSnapshot && (
            <div className="overflow-x-auto mt-2">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)]">
                    <th className="pb-2 text-left font-semibold text-xs text-[var(--muted-foreground)] uppercase tracking-wider">
                      Currency
                    </th>
                    <th className="pb-2 text-right font-semibold text-xs text-[var(--muted-foreground)] uppercase tracking-wider">
                      Rate
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {Object.entries(detailSnapshot.rates)
                    .sort(([a], [b]) => a.localeCompare(b))
                    .map(([currency, rate]) => (
                      <tr key={currency} className="hover:bg-[var(--muted)]/30 transition-colors">
                        <td className="py-1.5 font-medium text-[var(--foreground)]">{currency}</td>
                        <td className="py-1.5 text-right text-[var(--muted-foreground)]">
                          {Number(rate).toFixed(4)}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="flex justify-end mt-4">
            <Button variant="outline" onClick={() => setDetailSnapshot(null)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
