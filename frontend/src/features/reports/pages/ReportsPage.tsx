import { useState, useEffect } from 'react';
import { FileDown, Download } from 'lucide-react';
import { toast } from 'sonner';
import { AppShell } from '@/shared/components/layout/AppShell';
import { Button } from '@/shared/components/ui/Button';
import { Input } from '@/shared/components/ui/Input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/shared/components/ui/Card';
import apiClient from '@/infrastructure/api/client';
import { EP } from '@/infrastructure/api/endpoints';
import { formatDateTime } from '@/core/utils/formatters';
import type { IDepartmentData } from '@/core/types/ticket.types';
import type { ApiResponse, PaginatedData, TicketStatus } from '@/core/types/api.types';

const STATUS_OPTIONS: { value: TicketStatus | ''; label: string }[] = [
  { value: '', label: 'All Statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'awaiting_finance', label: 'Awaiting Finance' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
];

interface LastExport {
  filename: string;
  timestamp: string;
  status: string;
  department: string;
  from: string;
  to: string;
}

export function ReportsPage() {
  const [departments, setDepartments] = useState<IDepartmentData[]>([]);
  const [status, setStatus] = useState<TicketStatus | ''>('');
  const [department, setDepartment] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [exporting, setExporting] = useState(false);
  const [lastExport, setLastExport] = useState<LastExport | null>(null);

  useEffect(() => {
    apiClient
      .get<ApiResponse<PaginatedData<IDepartmentData>>>(EP.ADMIN_DEPARTMENTS, {
        params: { limit: 100 },
      })
      .then((r) => setDepartments(r.data.data.data))
      .catch(() => {});
  }, []);

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

      const deptName = departments.find((d) => d._id === department)?.name ?? 'All';
      setLastExport({
        filename,
        timestamp: new Date().toISOString(),
        status: status || 'All',
        department: deptName,
        from: from || '—',
        to: to || '—',
      });

      toast.success('CSV exported successfully');
    } catch {
      toast.error('Failed to export CSV');
    } finally {
      setExporting(false);
    }
  };

  return (
    <AppShell title="Reports">
      <div className="space-y-6 max-w-2xl">
        {/* Header */}
        <div>
          <h2 className="text-xl font-bold text-[var(--foreground)]">Reports</h2>
          <p className="text-sm text-[var(--muted-foreground)]">
            Export expense data as a CSV file with custom filters.
          </p>
        </div>

        {/* Export Form */}
        <Card>
          <CardHeader>
            <CardTitle>Export CSV</CardTitle>
            <CardDescription>
              Apply filters to narrow down the data before exporting.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Status */}
              <div className="w-full">
                <label className="block text-sm font-medium text-[var(--foreground)] mb-1.5">
                  Status
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as TicketStatus | '')}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--input)] bg-[var(--background)] text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  {STATUS_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>

              {/* Department */}
              <div className="w-full">
                <label className="block text-sm font-medium text-[var(--foreground)] mb-1.5">
                  Department
                </label>
                <select
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--input)] bg-[var(--background)] text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  <option value="">All Departments</option>
                  {departments.map((d) => (
                    <option key={d._id} value={d._id}>{d.name}</option>
                  ))}
                </select>
              </div>

              {/* From */}
              <Input
                label="From Date"
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />

              {/* To */}
              <Input
                label="To Date"
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
            </div>

            <Button loading={exporting} onClick={handleExport} className="w-full sm:w-auto">
              <Download className="w-4 h-4" />
              Export CSV
            </Button>
          </CardContent>
        </Card>

        {/* Last Export Info */}
        {lastExport ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Last Export</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                <dt className="text-[var(--muted-foreground)]">File</dt>
                <dd className="font-medium text-[var(--foreground)] truncate">
                  {lastExport.filename}
                </dd>
                <dt className="text-[var(--muted-foreground)]">Exported at</dt>
                <dd className="text-[var(--foreground)]">{formatDateTime(lastExport.timestamp)}</dd>
                <dt className="text-[var(--muted-foreground)]">Status filter</dt>
                <dd className="capitalize text-[var(--foreground)]">{lastExport.status}</dd>
                <dt className="text-[var(--muted-foreground)]">Department</dt>
                <dd className="text-[var(--foreground)]">{lastExport.department}</dd>
                <dt className="text-[var(--muted-foreground)]">Date range</dt>
                <dd className="text-[var(--foreground)]">
                  {lastExport.from} → {lastExport.to}
                </dd>
              </dl>
            </CardContent>
          </Card>
        ) : (
          <div className="flex flex-col items-center justify-center py-14 gap-3 rounded-2xl border border-dashed border-[var(--border)]">
            <div className="w-14 h-14 rounded-2xl bg-[var(--muted)] flex items-center justify-center">
              <FileDown className="w-7 h-7 text-[var(--muted-foreground)]" />
            </div>
            <p className="font-medium text-[var(--foreground)]">No exports yet</p>
            <p className="text-sm text-[var(--muted-foreground)] text-center max-w-xs">
              Configure the filters above and click "Export CSV" to download your first report.
            </p>
          </div>
        )}
      </div>
    </AppShell>
  );
}
