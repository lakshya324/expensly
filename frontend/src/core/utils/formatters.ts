import { format, formatDistanceToNow, parseISO } from 'date-fns';
import { CURRENCY_SYMBOLS } from '../constants/constants';
import type { Currency } from '../types/api.types';

export function formatDate(date: string | Date | null | undefined, fmt = 'MMM d, yyyy'): string {
  if (!date) return '—';
  const d = typeof date === 'string' ? parseISO(date) : date;
  if (isNaN(d.getTime())) return '—';
  return format(d, fmt);
}

export function formatDateTime(date: string | Date | null | undefined): string {
  if (!date) return '—';
  const d = typeof date === 'string' ? parseISO(date) : date;
  if (isNaN(d.getTime())) return '—';
  return format(d, 'MMM d, yyyy HH:mm');
}

export function formatRelativeTime(date: string | Date | null | undefined): string {
  if (!date) return '—';
  const d = typeof date === 'string' ? parseISO(date) : date;
  if (isNaN(d.getTime())) return '—';
  return formatDistanceToNow(d, { addSuffix: true });
}

export function formatCurrency(
  amount: number,
  currency: Currency | string,
  compact = false,
): string {
  const symbol = CURRENCY_SYMBOLS[currency] ?? currency;
  if (compact && Math.abs(amount) >= 1_000_000) {
    return `${symbol}${(amount / 1_000_000).toFixed(1)}M`;
  }
  if (compact && Math.abs(amount) >= 1_000) {
    return `${symbol}${(amount / 1_000).toFixed(1)}K`;
  }
  return `${symbol}${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatDuration(ms: number | null | undefined): string {
  if (ms == null || isNaN(ms)) return '—';
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`;
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)}m`;
  if (ms < 86_400_000) return `${Math.round(ms / 3_600_000)}h`;
  return `${Math.round(ms / 86_400_000)}d`;
}

export function formatPercent(value: number | null | undefined, digits = 1): string {
  if (value == null || isNaN(value)) return '—';
  return `${value.toFixed(digits)}%`;
}

export const cn = (...classes: (string | undefined | null | false)[]): string =>
  classes.filter(Boolean).join(' ');
