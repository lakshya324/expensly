import { Badge } from '../ui/Badge';
import { TICKET_STATUS_LABELS } from '@/core/constants/constants';
import type { TicketStatus } from '@/core/types/api.types';

interface StatusBadgeProps {
  status: TicketStatus;
}

const variantMap: Record<TicketStatus, 'warning' | 'info' | 'success' | 'danger' | 'muted'> = {
  draft: 'muted',
  scanning: 'info',
  ocr_failed: 'danger',
  pending: 'warning',
  awaiting_finance: 'info',
  approved: 'success',
  rejected: 'danger',
};

export function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <Badge variant={variantMap[status]}>
      {status === 'scanning' && (
        <span className="mr-1.5 inline-block w-1.5 h-1.5 rounded-full bg-blue-500 dark:bg-blue-400 animate-pulse" />
      )}
      {TICKET_STATUS_LABELS[status] ?? status}
    </Badge>
  );
}
