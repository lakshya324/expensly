import { Badge } from '../ui/Badge';
import { TICKET_STATUS_LABELS } from '@/core/constants/constants';
import type { TicketStatus } from '@/core/types/api.types';

interface StatusBadgeProps {
  status: TicketStatus;
}

const variantMap: Record<TicketStatus, 'warning' | 'info' | 'success' | 'danger'> = {
  pending: 'warning',
  awaiting_finance: 'info',
  approved: 'success',
  rejected: 'danger',
};

export function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <Badge variant={variantMap[status]}>
      {TICKET_STATUS_LABELS[status] ?? status}
    </Badge>
  );
}
