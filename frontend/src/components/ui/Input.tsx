import { forwardRef, type InputHTMLAttributes } from 'react';
import clsx from 'clsx';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: string;
  icon?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, error, icon, ...props }, ref) => {
    return (
      <div className="relative">
        {icon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]">
            {icon}
          </div>
        )}
        <input
          ref={ref}
          className={clsx(
            'w-full h-12 px-4 rounded-xl',
            'bg-[var(--color-bg-card)] border border-[var(--color-text-muted)]/20',
            'text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]',
            'transition-all duration-200',
            'focus:outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent)]/20',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            icon && 'pl-10',
            error && 'border-[var(--color-destructive)]',
            className
          )}
          {...props}
        />
        {error && (
          <p className="mt-1.5 text-sm text-[var(--color-destructive)]">
            {error}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
