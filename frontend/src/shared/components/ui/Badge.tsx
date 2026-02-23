import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/shared/utils/cn';
import type { HTMLAttributes } from 'react';

const badgeVariants = cva(
  'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors',
  {
    variants: {
      variant: {
        default: 'bg-brand-100 text-brand-700 dark:bg-brand-900/50 dark:text-brand-300',
        success: 'bg-success-50 text-success-600 dark:bg-success-500/15 dark:text-success-400',
        warning: 'bg-warning-50 text-warning-600 dark:bg-warning-500/15 dark:text-warning-400',
        danger: 'bg-danger-50 text-danger-500 dark:bg-danger-500/15 dark:text-danger-400',
        info: 'bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400',
        muted: 'bg-[var(--muted)] text-[var(--muted-foreground)]',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

interface BadgeProps extends HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
