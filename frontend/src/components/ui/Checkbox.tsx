import { forwardRef, type InputHTMLAttributes } from 'react';
import clsx from 'clsx';
import { motion } from 'framer-motion';

export interface CheckboxProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, checked = false, onCheckedChange, ...props }, ref) => {
    return (
      <label
        className={clsx(
          'relative inline-flex items-center justify-center cursor-pointer',
          className
        )}
      >
        <input
          ref={ref}
          type="checkbox"
          checked={checked}
          onChange={(e) => onCheckedChange?.(e.target.checked)}
          className="sr-only"
          {...props}
        />
        <motion.div
          className={clsx(
            'w-6 h-6 rounded-md border-2 flex items-center justify-center transition-colors',
            checked
              ? 'bg-[var(--color-checked)] border-[var(--color-checked)]'
              : 'bg-transparent border-[var(--color-text-muted)]'
          )}
          animate={checked ? { scale: [1, 1.2, 1] } : { scale: 1 }}
          transition={{ duration: 0.3, ease: [0.34, 1.56, 0.64, 1] }}
        >
          {checked && (
            <motion.svg
              className="w-4 h-4 text-white"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ duration: 0.2, delay: 0.1 }}
            >
              <motion.path d="M5 12l5 5L20 7" />
            </motion.svg>
          )}
        </motion.div>
      </label>
    );
  }
);

Checkbox.displayName = 'Checkbox';
