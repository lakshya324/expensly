import { useState, useCallback, useEffect } from 'react';
import { AppShell } from '@/shared/components/layout/AppShell';
import { Card, CardContent } from '@/shared/components/ui/Card';
import { Badge } from '@/shared/components/ui/Badge';
import { Skeleton } from '@/shared/components/ui/Skeleton';
import { DataTable } from '@/shared/components/data-display/DataTable';
import type { Column } from '@/shared/components/data-display/DataTable';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/Select';
import apiClient from '@/infrastructure/api/client';
import { EP } from '@/infrastructure/api/endpoints';
import type { ApiResponse, PaginatedData } from '@/core/types/api.types';
import type { IAuditLogData, EntityType, AuditAction } from '@/core/types/ticket.types';
import { formatDateTime } from '@/core/utils/formatters';
import { toast } from 'sonner';

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
      setTotal(res.data.data?.pagination?.totalItems ?? res.data.data?.total ?? 0);
    } catch {
      toast.error('Failed to load audit log');
    } finally {
      setLoading(false);
    }
  }, [filters.entityType, filters.action, filters.page]);

  useEffect(() => { fetch(); }, [fetch]);
  return { data, total, loading };
}

export function AdminAuditLogPage() {
  const [entityTypeFilter, setEntityTypeFilter] = useState<EntityType | 'all'>('all');
  const [actionFilter, setActionFilter] = useState<AuditAction | 'all'>('all');
  const [page, setPage] = useState(1);

  const { data, total, loading } = useAuditLog({
    entityType: entityTypeFilter !== 'all' ? entityTypeFilter : undefined,
    action: actionFilter !== 'all' ? actionFilter : undefined,
    page,
  });

  const columns: Column<IAuditLogData>[] = [
    {
      key: 'entityType',
      header: 'Entity Type',
      render: (row) => (
        <Badge variant="muted" className="capitalize">{row.entityType}</Badge>
      ),
    },
    {
      key: 'entityId',
      header: 'Entity ID',
      render: (row) => (
        <span className="text-xs font-mono text-(--muted-foreground)">
          {row.entityId.slice(0, 8)}…
        </span>
      ),
    },
    {
      key: 'action',
      header: 'Action',
      render: (row) => (
        <Badge variant={ACTION_BADGE_VARIANT[row.action] ?? 'muted'} className="capitalize">
          {row.action.replace(/_/g, ' ')}
        </Badge>
      ),
    },
    {
      key: 'performedBy',
      header: 'Performed By',
      render: (row) => (
        <span className="text-sm text-(--foreground)">
          {typeof row.performedBy === 'object' ? row.performedBy.name : row.performedBy.slice(0, 8) + '…'}
        </span>
      ),
    },
    {
      key: 'ip',
      header: 'IP',
      render: (row) => (
        <span className="text-xs font-mono text-(--muted-foreground)">{row.ip ?? '—'}</span>
      ),
    },
    {
      key: 'createdAt',
      header: 'Time',
      render: (row) => (
        <span className="text-sm text-(--muted-foreground)">{formatDateTime(row.createdAt)}</span>
      ),
    },
  ];

  return (
    <AppShell title="Audit Log">
      <div className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-bold text-[var(--foreground)]">Audit Log</h1>
            <p className="text-sm text-[var(--muted-foreground)]">Immutable record of all organisation actions</p>
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

        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-6 space-y-3">
                {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
              </div>
            ) : (
              <DataTable
                columns={columns}
                data={data}
                loading={false}
                pagination={{ page, pageSize: 25, totalItems: total, totalPages: Math.ceil(total / 25) }}
                onPageChange={setPage}
              />
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
