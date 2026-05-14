import { useState, useCallback, useEffect } from 'react';
import { AppShell } from '@/shared/components/layout/AppShell';
import { Badge } from '@/shared/components/ui/Badge';
import { DataTable } from '@/shared/components/data-display/DataTable';
import type { Column } from '@/shared/components/data-display/DataTable';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/Select';
import apiClient from '@/infrastructure/api/client';
import { EP } from '@/infrastructure/api/endpoints';
import type { ApiResponse, PaginatedData } from '@/core/types/api.types';
import type { IAuditLogData, EntityType, AuditAction } from '@/core/types/ticket.types';
import { formatDateTime } from '@/core/utils/formatters';
import { toast } from 'sonner';
import { Info, X } from 'lucide-react';

const ENTITY_TYPE_OPTIONS: { label: string; value: EntityType | 'all' }[] = [
  { label: 'All Types', value: 'all' },
  { label: 'Ticket', value: 'ticket' },
  { label: 'User', value: 'user' },
  { label: 'Department', value: 'department' },
  { label: 'Bundle', value: 'bundle' },
  { label: 'Merchant', value: 'merchant' },
  { label: 'Category', value: 'category' },
];

const ACTION_OPTIONS: { label: string; value: AuditAction | 'all' }[] = [
  { label: 'All Actions', value: 'all' },
  { label: 'Created', value: 'created' },
  { label: 'Updated', value: 'updated' },
  { label: 'Status Changed', value: 'status_changed' },
  { label: 'Deleted', value: 'deleted' },
  { label: 'Approved', value: 'approved' },
  { label: 'Rejected', value: 'rejected' },
  { label: 'Flagged', value: 'flagged' },
  { label: 'Commented', value: 'commented' },
  { label: 'User Created', value: 'user_created' },
  { label: 'User Updated', value: 'user_updated' },
  { label: 'Permissions Updated', value: 'permissions_updated' },
];

const ACTION_BADGE_VARIANT: Record<AuditAction, 'success' | 'danger' | 'warning' | 'info' | 'muted'> = {
  created: 'success',
  updated: 'info',
  status_changed: 'info',
  deleted: 'danger',
  flagged: 'warning',
  unflagged: 'muted',
  approved: 'success',
  rejected: 'danger',
  commented: 'muted',
  bundle_added: 'info',
  bundle_removed: 'warning',
  user_created: 'success',
  user_updated: 'info',
  user_disabled: 'danger',
  user_enabled: 'success',
  permissions_updated: 'warning',
};

function useAuditLog(filters: { entityType?: string; action?: string; page: number }) {
  const [data, setData] = useState<IAuditLogData[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { page: filters.page, limit: 25 };
      if (filters.entityType) params.entityType = filters.entityType;
      if (filters.action) params.action = filters.action;
      const res = await apiClient.get<ApiResponse<PaginatedData<IAuditLogData>>>(
        EP.ADMIN_AUDIT_LOG,
        { params },
      );
      setData(res.data.data?.data ?? []);
      setTotal(res.data.data?.pagination?.totalItems ?? 0);
    } catch {
      toast.error('Failed to load audit log');
    } finally {
      setLoading(false);
    }
  }, [filters.entityType, filters.action, filters.page]);

  useEffect(() => { fetch(); }, [fetch]);
  return { data, total, loading };
}

function AuditDetailPanel({ entry, onClose }: { entry: IAuditLogData; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="fixed inset-0 bg-black/30" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md bg-[var(--card)] border-l border-[var(--border)] h-full overflow-y-auto shadow-xl flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-[var(--border)]">
          <h2 className="text-base font-semibold text-[var(--foreground)]">Audit Entry Details</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)] transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-5 flex-1">
          <section className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">Event</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-[var(--muted-foreground)] mb-1">Entity Type</p>
                <Badge variant="muted" className="capitalize">{entry.entityType}</Badge>
              </div>
              <div>
                <p className="text-xs text-[var(--muted-foreground)] mb-1">Action</p>
                <Badge variant={ACTION_BADGE_VARIANT[entry.action] ?? 'muted'} className="capitalize">
                  {entry.action.replace(/_/g, ' ')}
                </Badge>
              </div>
            </div>
          </section>

          <div className="h-px bg-[var(--border)]" />

          <section className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">Entity</h3>
            <div>
              <p className="text-xs text-[var(--muted-foreground)] mb-1">Entity ID</p>
              <p className="text-sm font-mono text-[var(--foreground)] break-all">{entry.entityId}</p>
            </div>
          </section>

          <div className="h-px bg-[var(--border)]" />

          <section className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">Performer</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-[var(--muted-foreground)] mb-1">Name</p>
                <p className="text-sm text-[var(--foreground)]">{entry.performer.name}</p>
              </div>
              <div>
                <p className="text-xs text-[var(--muted-foreground)] mb-1">User ID</p>
                <p className="text-sm font-mono text-[var(--foreground)] break-all">{entry.performer._id}</p>
              </div>
            </div>
            <div>
              <p className="text-xs text-[var(--muted-foreground)] mb-1">IP Address</p>
              <p className="text-sm font-mono text-[var(--foreground)]">{entry.ip ?? '—'}</p>
            </div>
          </section>

          <div className="h-px bg-[var(--border)]" />

          <section className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">Timestamp</h3>
            <p className="text-sm text-[var(--foreground)]">{formatDateTime(entry.createdAt)}</p>
          </section>

          {entry.metadata && Object.keys(entry.metadata).length > 0 && (
            <>
              <div className="h-px bg-[var(--border)]" />
              <section className="space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">Metadata</h3>
                <pre className="text-xs bg-[var(--muted)] text-[var(--foreground)] rounded-lg p-3 overflow-x-auto whitespace-pre-wrap break-all">
                  {JSON.stringify(entry.metadata, null, 2)}
                </pre>
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export function AdminAuditLogPage() {
  const [entityTypeFilter, setEntityTypeFilter] = useState<EntityType | 'all'>('all');
  const [actionFilter, setActionFilter] = useState<AuditAction | 'all'>('all');
  const [page, setPage] = useState(1);
  const [selectedEntry, setSelectedEntry] = useState<IAuditLogData | null>(null);

  const { data, total, loading } = useAuditLog({
    entityType: entityTypeFilter !== 'all' ? entityTypeFilter : undefined,
    action: actionFilter !== 'all' ? actionFilter : undefined,
    page,
  });

  const columns: Column<IAuditLogData>[] = [
    {
      key: 'entityType',
      header: 'Entity Type',
      width: '160px',
      render: (row) => (
        <Badge variant="muted" className="capitalize">{row.entityType}</Badge>
      ),
    },
    {
      key: 'action',
      header: 'Action',
      width: '200px',
      render: (row) => (
        <Badge variant={ACTION_BADGE_VARIANT[row.action] ?? 'muted'} className="capitalize">
          {row.action.replace(/_/g, ' ')}
        </Badge>
      ),
    },
    {
      key: 'performer',
      header: 'Performed By',
      render: (row) => (
        <span className="text-sm font-medium text-(--foreground)">{row.performer.name}</span>
      ),
    },
    {
      key: 'createdAt',
      header: 'Time',
      width: '200px',
      render: (row) => (
        <span className="text-sm text-(--muted-foreground)">{formatDateTime(row.createdAt)}</span>
      ),
    },
    {
      key: '_id',
      header: '',
      width: '56px',
      render: (row) => (
        <div className="flex justify-center">
          <button
            onClick={(e) => { e.stopPropagation(); setSelectedEntry(row); }}
            className="p-1.5 rounded-lg border border-(--border) text-(--muted-foreground) hover:text-(--foreground) hover:bg-(--muted) hover:border-(--foreground)/20 transition-colors"
            title="View details"
          >
            <Info size={14} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <AppShell title="Audit Log">
      <div className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-bold text-(--foreground)">Audit Log</h1>
            <p className="text-sm text-(--muted-foreground)">Immutable record of all organisation actions</p>
          </div>
          <div className="flex items-center gap-2">
            <Select
              value={entityTypeFilter}
              onValueChange={(v) => { setEntityTypeFilter(v as EntityType | 'all'); setPage(1); }}
            >
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Entity type" />
              </SelectTrigger>
              <SelectContent>
                {ENTITY_TYPE_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={actionFilter}
              onValueChange={(v) => { setActionFilter(v as AuditAction | 'all'); setPage(1); }}
            >
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Action" />
              </SelectTrigger>
              <SelectContent>
                {ACTION_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DataTable
          columns={columns}
          data={data}
          loading={loading}
          pagination={{ page, pageSize: 25, totalItems: total, totalPages: Math.ceil(total / 25) }}
          onPageChange={setPage}
        />
      </div>

      {selectedEntry && (
        <AuditDetailPanel entry={selectedEntry} onClose={() => setSelectedEntry(null)} />
      )}
    </AppShell>
  );
}
