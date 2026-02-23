import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Skeleton } from '../ui/Skeleton';
import { EmptyState } from '../feedback/EmptyState';
import { Button } from '../ui/Button';
import { cn } from '@/shared/utils/cn';
import type { PaginationMeta } from '@/core/types/api.types';

export interface Column<T> {
  key: string;
  header: string;
  width?: string;
  render: (row: T) => React.ReactNode;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  loading?: boolean;
  pagination?: PaginationMeta;
  onPageChange?: (page: number) => void;
  onRowClick?: (row: T) => void;
  getRowClassName?: (row: T) => string;
  emptyTitle?: string;
  emptyDescription?: string;
  className?: string;
}

export function DataTable<T>({
  columns,
  data,
  loading,
  pagination,
  onPageChange,
  onRowClick,
  getRowClassName,
  emptyTitle = 'No data found',
  emptyDescription,
  className,
}: DataTableProps<T>) {
  return (
    <div className={cn('rounded-2xl border border-[var(--border)] bg-[var(--card)] overflow-hidden', className)}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] bg-[var(--muted)]/50">
              {columns.map((col) => (
                <th
                  key={col.key}
                  style={col.width ? { width: col.width } : undefined}
                  className="px-4 py-3 text-left text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider"
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {loading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i}>
                  {columns.map((col) => (
                    <td key={col.key} className="px-4 py-3">
                      <Skeleton className="h-4 w-full" />
                    </td>
                  ))}
                </tr>
              ))
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={columns.length}>
                  <EmptyState title={emptyTitle} description={emptyDescription} />
                </td>
              </tr>
            ) : (
              data.map((row, i) => (
                <tr
                  key={i}
                  onClick={() => onRowClick?.(row)}
                  className={cn(
                    'transition-colors hover:bg-[var(--muted)]/40',
                    onRowClick && 'cursor-pointer',
                    getRowClassName?.(row),
                  )}
                >
                  {columns.map((col) => (
                    <td key={col.key} className="px-4 py-3 text-[var(--foreground)]">
                      {col.render(row)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-[var(--border)]">
          <p className="text-xs text-[var(--muted-foreground)]">
            Showing {(pagination.page - 1) * pagination.pageSize + 1}–
            {Math.min(pagination.page * pagination.pageSize, pagination.totalItems)} of{' '}
            {pagination.totalItems}
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => onPageChange?.(pagination.page - 1)}
              disabled={pagination.page <= 1}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            {Array.from({ length: Math.min(pagination.totalPages, 5) }).map((_, i) => {
              const page = i + 1;
              return (
                <button
                  key={page}
                  onClick={() => onPageChange?.(page)}
                  className={cn(
                    'w-7 h-7 rounded-lg text-xs font-medium transition',
                    page === pagination.page
                      ? 'bg-brand-600 dark:bg-brand-500 text-white'
                      : 'text-[var(--muted-foreground)] hover:bg-[var(--accent)]',
                  )}
                >
                  {page}
                </button>
              );
            })}
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => onPageChange?.(pagination.page + 1)}
              disabled={pagination.page >= pagination.totalPages}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
