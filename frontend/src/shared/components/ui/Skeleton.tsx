import { cn } from '@/shared/utils/cn';
import type { HTMLAttributes } from 'react';

export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-lg bg-[var(--muted)]',
        className,
      )}
      {...props}
    />
  );
}
