import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileDown, Download, Receipt, Loader2, Flag, Mail, Clock, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { AppShell } from '@/shared/components/layout/AppShell';
import { Button } from '@/shared/components/ui/Button';
import { Input } from '@/shared/components/ui/Input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/shared/components/ui/Card';
import apiClient from '@/infrastructure/api/client';
import { EP } from '@/infrastructure/api/endpoints';
import { listReports, emailReport } from '../api/reports.api';
import type { ReportListItem } from '../api/reports.api';
import { formatDateTime, formatCurrency, formatDate } from '@/core/utils/formatters';
import { ROUTES, TICKET_STATUS_LABELS } from '@/core/constants/constants';
import type { IDepartmentData, ITicketData } from '@/core/types/ticket.types';
import type { ApiResponse, PaginatedData, TicketStatus } from '@/core/types/api.types';

const STATUS_OPTIONS: { value: TicketStatus | ''; label: string }[] = [
  { value: '', label: 'All Statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'awaiting_finance', label: 'Awaiting Finance' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
];

type DatePreset =
  | 'today'
  | 'yesterday'
  | 'this_week'
  | 'last_week'
  | 'this_month'
  | 'last_month'
  | 'this_year'
  | 'custom';

const DATE_PRESETS: { value: DatePreset; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'this_week', label: 'This Week' },
  { value: 'last_week', label: 'Last Week' },
  { value: 'this_month', label: 'This Month' },
  { value: 'last_month', label: 'Last Month' },
  { value: 'this_year', label: 'This Year' },
  { value: 'custom', label: 'Custom' },
];

const STATUS_BADGE_CLASS: Record<TicketStatus, string> = {
  draft: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  scanning: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  failed: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  awaiting_finance: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  approved: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  rejected: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
};

function toDateStr(d: Date): string {
  return d.toISOString().split('T')[0];
}

function getPresetDates(preset: DatePreset): { from: string; to: string } | null {
  if (preset === 'custom') return null;
  const now = new Date();
  const today = toDateStr(now);
  if (preset === 'today') return { from: today, to: today };
  if (preset === 'yesterday') {
    const y = new Date(now);
    y.setDate(y.getDate() - 1);
    const s = toDateStr(y);
    return { from: s, to: s };
  }
  if (preset === 'this_week') {
    const monday = new Date(now);
    monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    return { from: toDateStr(monday), to: today };
  }
  if (preset === 'last_week') {
    const thisMonday = new Date(now);
    thisMonday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    const lastMonday = new Date(thisMonday);
    lastMonday.setDate(thisMonday.getDate() - 7);
    const lastSunday = new Date(thisMonday);
    lastSunday.setDate(thisMonday.getDate() - 1);
    return { from: toDateStr(lastMonday), to: toDateStr(lastSunday) };
  }
  if (preset === 'this_month') {
    const first = new Date(now.getFullYear(), now.getMonth(), 1);
    return { from: toDateStr(first), to: today };
  }
  if (preset === 'last_month') {
    const lastDay = new Date(now.getFullYear(), now.getMonth(), 0);
    const firstDay = new Date(lastDay.getFullYear(), lastDay.getMonth(), 1);
    return { from: toDateStr(firstDay), to: toDateStr(lastDay) };
  }
  if (preset === 'this_year') {
    const first = new Date(now.getFullYear(), 0, 1);
    return { from: toDateStr(first), to: today };
  }
  return null;
}

export function ReportsPage() {
  const navigate = useNavigate();
  const [departments, setDepartments] = useState<IDepartmentData[]>([]);
  const [status, setStatus] = useState<TicketStatus | ''>('');
  const [department, setDepartment] = useState('');
  const [datePreset, setDatePreset] = useState<DatePreset>('this_month');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [exporting, setExporting] = useState(false);
  const [reportHistory, setReportHistory] = useState<ReportListItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [emailingId, setEmailingId] = useState<string | null>(null);

  // Preview state
  const [previewTickets, setPreviewTickets] = useState<ITicketData[]>([]);
  const [previewTotal, setPreviewTotal] = useState<number | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // Apply default preset on mount
  useEffect(() => {
    const dates = getPresetDates('this_month');
    if (dates) { setFrom(dates.from); setTo(dates.to); }
  }, []);

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const items = await listReports();
      setReportHistory(items);
    } catch {
      // silently ignore - history is a nice-to-have
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  useEffect(() => {
    apiClient
      .get<ApiResponse<PaginatedData<IDepartmentData>>>(EP.ADMIN_DEPARTMENTS, {
        params: { limit: 100 },
      })
      .then((r) => setDepartments(r.data.data.data))
      .catch(() => {});
  }, []);

  const handlePresetChange = (preset: DatePreset) => {
    setDatePreset(preset);
    const dates = getPresetDates(preset);
    if (dates) { setFrom(dates.from); setTo(dates.to); }
  };

  const fetchPreview = useCallback(async () => {
    setPreviewLoading(true);
    try {
      const params: Record<string, string> = { limit: '5', page: '1' };
      if (status) params.status = status;
      if (department) params.department = department;
      if (from) params.from = from;
      if (to) params.to = to;
      const res = await apiClient.get<ApiResponse<PaginatedData<ITicketData>>>(EP.EXPENSES, { params });
      setPreviewTickets(res.data.data.data);
      setPreviewTotal(res.data.data.pagination.totalItems);
    } catch {
      setPreviewTickets([]);
      setPreviewTotal(null);
    } finally {
      setPreviewLoading(false);
    }
  }, [status, department, from, to]);

  useEffect(() => {
    const t = setTimeout(fetchPreview, 400);
    return () => clearTimeout(t);
  }, [fetchPreview]);

  const handleExport = async () => {
    setExporting(true);
    try {
      const params: Record<string, string> = {};
      if (status) params.status = status;
      if (department) params.department = department;
      if (from) params.from = from;
      if (to) params.to = to;

      const res = await apiClient.get(EP.EXPORT_REPORT, {
        params,
        responseType: 'blob',
      });

      const contentDisposition = (res.headers as Record<string, string>)['content-disposition'] ?? '';
      const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/);
      const filename = filenameMatch?.[1] ?? `expenses-export-${Date.now()}.csv`;

      const url = window.URL.createObjectURL(new Blob([res.data as BlobPart]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      toast.success('CSV exported successfully');
      // Refresh history so the new report appears immediately
      loadHistory();
    } catch {
      toast.error('Failed to export CSV');
    } finally {
      setExporting(false);
    }
  };

  const handleEmailReport = async (id: string) => {
    setEmailingId(id);
    try {
      await emailReport(id);
      toast.success('Report emailed to your inbox');
    } catch {
      toast.error('Failed to email report');
    } finally {
      setEmailingId(null);
    }
  };

  const selectClass =
    'w-full px-3.5 py-2.5 rounded-xl border border-[var(--input)] bg-[var(--background)] text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-brand-500';

  return (
    <AppShell title="Reports">
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h2 className="text-xl font-bold text-[var(--foreground)]">Reports</h2>
          <p className="text-sm text-[var(--muted-foreground)]">
            Export expense data as a CSV file with custom filters.
          </p>
        </div>

        {/* Two-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6 items-start">

          {/* Left: Export Form */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Export CSV</CardTitle>
                <CardDescription>Apply filters to narrow down the data before exporting.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Status */}
                  <div className="w-full">
                    <label className="block text-sm font-medium text-[var(--foreground)] mb-1.5">Status</label>
                    <select value={status} onChange={(e) => setStatus(e.target.value as TicketStatus | '')} className={selectClass}>
                      {STATUS_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>

                  {/* Department */}
                  <div className="w-full">
                    <label className="block text-sm font-medium text-[var(--foreground)] mb-1.5">Department</label>
                    <select value={department} onChange={(e) => setDepartment(e.target.value)} className={selectClass}>
                      <option value="">All Departments</option>
                      {departments.map((d) => (
                        <option key={d._id} value={d._id}>{d.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Time Period preset chips */}
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-[var(--foreground)] mb-1.5">Time Period</label>
                    <div className="flex flex-wrap gap-2">
                      {DATE_PRESETS.map((p) => (
                        <button
                          key={p.value}
                          type="button"
                          onClick={() => handlePresetChange(p.value)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                            datePreset === p.value
                              ? 'bg-brand-600 border-brand-600 text-white'
                              : 'border-[var(--input)] text-[var(--muted-foreground)] hover:border-brand-400 hover:text-[var(--foreground)] bg-[var(--background)]'
                          }`}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* From / To - editable only when Custom */}
                  <Input
                    label="From Date"
                    type="date"
                    value={from}
                    disabled={datePreset !== 'custom'}
                    onChange={(e) => setFrom(e.target.value)}
                  />
                  <Input
                    label="To Date"
                    type="date"
                    value={to}
                    disabled={datePreset !== 'custom'}
                    onChange={(e) => setTo(e.target.value)}
                  />
                </div>

                <Button loading={exporting} onClick={handleExport} className="w-full sm:w-auto">
                  <Download className="w-4 h-4" />
                  Export CSV
                </Button>
              </CardContent>
            </Card>

            {/* Report History */}
            {historyLoading ? (
              <div className="flex items-center gap-2 py-6 text-[var(--muted-foreground)] text-sm">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading report history…
              </div>
            ) : reportHistory.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 gap-3 rounded-2xl border border-dashed border-[var(--border)]">
                <div className="w-14 h-14 rounded-2xl bg-[var(--muted)] flex items-center justify-center">
                  <FileDown className="w-7 h-7 text-[var(--muted-foreground)]" />
                </div>
                <p className="font-medium text-[var(--foreground)]">No exports yet</p>
                <p className="text-sm text-[var(--muted-foreground)] text-center max-w-xs">
                  Configure the filters above and click "Export CSV" to download your first report.
                </p>
              </div>
            ) : (
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">Report History</CardTitle>
                    <button
                      onClick={loadHistory}
                      className="p-1.5 rounded-lg hover:bg-[var(--muted)] text-[var(--muted-foreground)] transition-colors"
                      title="Refresh history"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <CardDescription>Your last {reportHistory.length} generated report{reportHistory.length !== 1 ? 's' : ''}. Download or email any of them below.</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <ul className="divide-y divide-[var(--border)]">
                    {reportHistory.map((report, idx) => (
                      <li key={report._id} className="px-4 py-3.5 flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex items-center gap-2">
                            {idx === 0 && (
                              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-400 shrink-0">Latest</span>
                            )}
                            <p className="text-sm font-medium text-[var(--foreground)] truncate">{report.filename}</p>
                          </div>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-[var(--muted-foreground)]">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {formatDateTime(report.createdAt)}
                            </span>
                            <span>{report.ticketCount} ticket{report.ticketCount !== 1 ? 's' : ''}</span>
                            {report.filters.status && <span className="capitalize">{report.filters.status.replace('_', ' ')}</span>}
                            {(report.filters.from || report.filters.to) && (
                              <span>{report.filters.from ?? '-'} → {report.filters.to ?? '-'}</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <a
                            href={report.downloadUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 rounded-lg hover:bg-[var(--muted)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
                            title="Download report"
                          >
                            <Download className="w-4 h-4" />
                          </a>
                          <button
                            onClick={() => handleEmailReport(report._id)}
                            disabled={emailingId === report._id}
                            className="p-1.5 rounded-lg hover:bg-[var(--muted)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors disabled:opacity-50"
                            title="Email me this report"
                          >
                            {emailingId === report._id
                              ? <Loader2 className="w-4 h-4 animate-spin" />
                              : <Mail className="w-4 h-4" />}
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right: Live Ticket Preview */}
          <div className="sticky top-6">
            <Card className="overflow-hidden">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Preview</CardTitle>
                  {previewLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin text-[var(--muted-foreground)]" />
                  ) : previewTotal !== null ? (
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-[var(--muted)] text-[var(--muted-foreground)]">
                      {previewTotal} ticket{previewTotal !== 1 ? 's' : ''}
                    </span>
                  ) : null}
                </div>
                <CardDescription>Matching tickets for current filters</CardDescription>
              </CardHeader>

              <CardContent className="p-0">
                {previewLoading && previewTickets.length === 0 ? (
                  <div className="flex items-center justify-center py-14">
                    <Loader2 className="w-6 h-6 animate-spin text-[var(--muted-foreground)]" />
                  </div>
                ) : previewTickets.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 gap-2 px-4">
                    <div className="w-10 h-10 rounded-xl bg-[var(--muted)] flex items-center justify-center">
                      <Receipt className="w-5 h-5 text-[var(--muted-foreground)]" />
                    </div>
                    <p className="text-sm font-medium text-[var(--foreground)]">No tickets found</p>
                    <p className="text-xs text-[var(--muted-foreground)] text-center">
                      No results match the current filters.
                    </p>
                  </div>
                ) : (
                  <ul className="divide-y divide-[var(--border)]">
                    {previewTickets.map((t) => {
                      const badgeClass = STATUS_BADGE_CLASS[t.status];
                      return (
                        <li
                          key={t._id}
                          onClick={() => navigate(ROUTES.EXPENSE_DETAIL(t._id))}
                          className={`px-4 py-3 space-y-1 cursor-pointer transition-colors hover:bg-[var(--muted)]/40 ${
                            t.flagged
                              ? 'border-l-4 border-l-yellow-500 bg-yellow-50/30 dark:bg-yellow-500/10'
                              : ''
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-1.5 flex-1 min-w-0">
                              {t.flagged && (
                                <Flag className="w-3 h-3 shrink-0 text-yellow-500 fill-yellow-500" />
                              )}
                              <p className="text-sm font-medium text-[var(--foreground)] truncate leading-snug">
                                {t.title}
                              </p>
                            </div>
                            <span className={`shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${badgeClass}`}>
                              {TICKET_STATUS_LABELS[t.status]}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-xs text-[var(--muted-foreground)]">
                            <span className="truncate max-w-[140px]">{t.submittedBy.name}</span>
                            <span className="font-semibold text-[var(--foreground)] shrink-0">
                              {formatCurrency(t.amount, t.currency)}
                            </span>
                          </div>
                          <p className="text-[11px] text-[var(--muted-foreground)]">
                            {t.department?.name ?? 'No dept'} · {formatDate(t.createdAt)}
                          </p>
                        </li>
                      );
                    })}
                  </ul>
                )}

                {!previewLoading && previewTotal !== null && previewTotal > 5 && (
                  <div className="px-4 py-2.5 border-t border-[var(--border)] bg-[var(--muted)]/30">
                    <p className="text-xs text-center text-[var(--muted-foreground)]">
                      Showing 5 of {previewTotal} - export CSV to see all
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

        </div>
      </div>
    </AppShell>
  );
}
