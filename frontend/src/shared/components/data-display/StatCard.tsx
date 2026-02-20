import { cn } from '@/shared/utils/cn';
import { Skeleton } from '../ui/Skeleton';
import type { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: LucideIcon;
  trend?: { value: number; label: string };
  color?: 'brand' | 'success' | 'warning' | 'danger';
  loading?: boolean;
  className?: string;
}

const colorMap = {
  brand: { bg: 'bg-brand-50 dark:bg-brand-950/50', icon: 'text-brand-600 dark:text-brand-400' },
  success: { bg: 'bg-success-50 dark:bg-success-500/10', icon: 'text-success-600 dark:text-success-400' },
  warning: { bg: 'bg-warning-50 dark:bg-warning-500/10', icon: 'text-warning-600 dark:text-warning-400' },
  danger: { bg: 'bg-danger-50 dark:bg-danger-500/10', icon: 'text-danger-500 dark:text-danger-400' },
};

export function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  color = 'brand',
  loading,
  className,
}: StatCardProps) {
  const colors = colorMap[color];

  return (
    <div
      className={cn(
        'rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 flex items-start gap-4',
        className,
      )}
    >
      {Icon && (
        <div className={cn('flex-shrink-0 flex items-center justify-center w-11 h-11 rounded-xl', colors.bg)}>
          <Icon className={cn('w-5 h-5', colors.icon)} />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wide">{title}</p>
        {loading ? (
          <>
            <Skeleton className="h-7 w-24 mt-1" />
            <Skeleton className="h-3 w-16 mt-1.5" />
          </>
        ) : (
          <>
            <p className="text-2xl font-bold text-[var(--foreground)] mt-0.5">{value}</p>
            {(subtitle || trend) && (
              <div className="flex items-center gap-1.5 mt-1">
                {trend && (
                  <span
                    className={cn(
                      'text-xs font-medium',
                      trend.value >= 0 ? 'text-success-600 dark:text-success-400' : 'text-danger-500',
                    )}
                  >
                    {trend.value >= 0 ? '+' : ''}{trend.value}%
                  </span>
                )}
                {subtitle && (
                  <span className="text-xs text-[var(--muted-foreground)]">{subtitle}</span>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
