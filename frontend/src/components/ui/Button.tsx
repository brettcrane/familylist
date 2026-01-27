import { forwardRef, type ButtonHTMLAttributes } from 'react';
import clsx from 'clsx';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'destructive';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = 'primary',
      size = 'md',
      isLoading = false,
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={clsx(
          // Base styles
          'inline-flex items-center justify-center gap-2 font-medium transition-all',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          'active:scale-[0.98]',

          // Variants
          {
            // Primary
            'bg-[var(--color-accent)] text-white hover:opacity-90 focus-visible:ring-[var(--color-accent)]':
              variant === 'primary',
            // Secondary
            'bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] hover:bg-[var(--color-bg-card)] border border-[var(--color-text-muted)]/20':
              variant === 'secondary',
            // Ghost
            'bg-transparent text-[var(--color-text-primary)] hover:bg-[var(--color-bg-secondary)]':
              variant === 'ghost',
            // Destructive
            'bg-[var(--color-destructive)] text-white hover:opacity-90 focus-visible:ring-[var(--color-destructive)]':
              variant === 'destructive',
          },

          // Sizes
          {
            'h-8 px-3 text-sm rounded-md': size === 'sm',
            'h-10 px-4 text-base rounded-lg': size === 'md',
            'h-12 px-6 text-lg rounded-xl': size === 'lg',
          },

          className
        )}
        {...props}
      >
        {isLoading ? (
          <>
            <span className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full" />
            <span className="sr-only">Loading...</span>
          </>
        ) : (
          children
        )}
      </button>
    );
  }
);

Button.displayName = 'Button';
