import type { VariantProps } from 'class-variance-authority';
import { cn } from '@/shared/utils/cn';
import { Loader2 } from 'lucide-react';
import { Slot } from '@radix-ui/react-slot';
import type { ButtonHTMLAttributes } from 'react';
import { buttonVariants } from './button.variants';

interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  loading?: boolean;
  asChild?: boolean;
}

export function Button({
  className,
  variant,
  size,
  loading,
  asChild,
  children,
  disabled,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot : 'button';
  return (
    <Comp
      className={cn(buttonVariants({ variant, size, className }))}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Loader2 className="w-4 h-4 animate-spin shrink-0" />}
      {children}
    </Comp>
  );
}
