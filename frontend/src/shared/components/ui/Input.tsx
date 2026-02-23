import { cn } from '@/shared/utils/cn';
import { forwardRef, type InputHTMLAttributes } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: string;
  label?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, error, label, id, ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={id}
            className="block text-sm font-medium text-[var(--foreground)] mb-1.5"
          >
            {label}
          </label>
        )}
        <input
          id={id}
          ref={ref}
          className={cn(
            'w-full px-3.5 py-2.5 rounded-xl border bg-[var(--background)] text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition',
            error ? 'border-danger-500' : 'border-[var(--input)]',
            className,
          )}
          {...props}
        />
        {error && <p className="mt-1.5 text-xs text-danger-500">{error}</p>}
      </div>
    );
  },
);
Input.displayName = 'Input';

export { Input };
