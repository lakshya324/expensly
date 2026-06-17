import { cva } from 'class-variance-authority';

export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold transition-all disabled:pointer-events-none disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] cursor-pointer',
  {
    variants: {
      variant: {
        default:
          'bg-brand-600 text-white shadow-sm shadow-brand-500/20 hover:bg-brand-700 dark:bg-brand-500 dark:hover:bg-brand-600',
        secondary:
          'bg-[var(--secondary)] text-[var(--secondary-foreground)] hover:bg-[var(--muted)]',
        outline:
          'border border-[var(--border)] bg-transparent text-[var(--foreground)] hover:bg-[var(--accent)]',
        ghost:
          'text-[var(--foreground)] hover:bg-[var(--accent)] hover:text-[var(--accent-foreground)]',
        destructive:
          'bg-danger-500 text-white hover:bg-danger-600 shadow-sm shadow-danger-500/20',
        success:
          'bg-success-500 text-white hover:bg-success-600 shadow-sm shadow-success-500/20',
        link: 'text-brand-600 dark:text-brand-400 underline-offset-4 hover:underline',
      },
      size: {
        xs: 'h-7 px-2.5 text-xs rounded-lg',
        sm: 'h-8 px-3',
        md: 'h-9 px-4',
        lg: 'h-10 px-6 text-base',
        icon: 'h-9 w-9',
        'icon-sm': 'h-7 w-7',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
    },
  },
);
