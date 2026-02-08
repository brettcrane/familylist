import { forwardRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import { PlusIcon, SparklesIcon } from '@heroicons/react/24/outline';
import type { ListType } from '../../types/api';
import { AI_MODE_PLACEHOLDERS, AI_MODE_HINTS } from '../../types/api';

interface BottomInputBarProps {
  listType: ListType;
  inputValue: string;
  onInputChange: (value: string) => void;
  onInputSubmit: (e: React.FormEvent) => void;
  isLoading: boolean;
  aiMode: boolean;
  onAiModeToggle: () => void;
  inputDisabled: boolean;
}

export const BottomInputBar = forwardRef<HTMLInputElement, BottomInputBarProps>(
  function BottomInputBar(
    {
      listType,
      inputValue,
      onInputChange,
      onInputSubmit,
      isLoading,
      aiMode,
      onAiModeToggle,
      inputDisabled,
    },
    ref
  ) {
    const placeholder = aiMode ? AI_MODE_PLACEHOLDERS[listType] : 'Add item...';
    const hintText = AI_MODE_HINTS[listType];

    return (
      <div className="bg-[var(--color-bg-primary)] border-t border-[var(--color-text-muted)]/10">
        {/* Input row */}
        <div className="px-4 py-3">
          <form onSubmit={onInputSubmit} className="flex gap-2 items-center">
            {/* AI Mode Toggle */}
            <motion.button
              type="button"
              onClick={onAiModeToggle}
              disabled={inputDisabled}
              className={clsx(
                'relative flex-shrink-0 w-11 h-11 rounded-xl',
                'flex items-center justify-center',
                'transition-all duration-200',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                aiMode
                  ? 'bg-[var(--color-accent)] text-white shadow-sm'
                  : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)] hover:text-[var(--color-accent)]'
              )}
              whileTap={{ scale: 0.95 }}
              aria-label={aiMode ? 'AI mode on' : 'AI mode off'}
            >
              <motion.div
                animate={aiMode ? {
                  scale: [1, 1.2, 1],
                  rotate: [0, -8, 8, 0],
                } : { scale: 1, rotate: 0 }}
                transition={aiMode ? {
                  duration: 2,
                  repeat: Infinity,
                  ease: 'easeInOut',
                } : { duration: 0.2 }}
              >
                <SparklesIcon className="w-5 h-5" />
              </motion.div>
            </motion.button>

            {/* Input field */}
            <div className="flex-1 relative">
              <input
                ref={ref}
                type="text"
                value={inputValue}
                onChange={(e) => onInputChange(e.target.value)}
                placeholder={placeholder}
                disabled={inputDisabled}
                className={clsx(
                  'w-full h-11 pl-4 pr-10 rounded-xl',
                  'bg-[var(--color-bg-secondary)] border-2 border-transparent',
                  'text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]',
                  'focus:outline-none focus:border-[var(--color-accent)]/40',
                  'transition-all duration-200',
                  'disabled:opacity-50 disabled:cursor-not-allowed',
                  aiMode && 'border-[var(--color-accent)]/30 bg-[var(--color-accent)]/5'
                )}
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]">
                {isLoading ? (
                  <motion.svg
                    className="w-5 h-5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  >
                    <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
                    <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
                  </motion.svg>
                ) : (
                  <PlusIcon className="w-5 h-5" />
                )}
              </div>
            </div>
          </form>

          {/* AI mode hint */}
          <AnimatePresence>
            {aiMode && !inputDisabled && (
              <motion.p
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-2 text-xs text-[var(--color-accent)] flex items-center gap-1.5 overflow-hidden"
              >
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-[var(--color-accent)] animate-pulse" />
                {hintText}
              </motion.p>
            )}
          </AnimatePresence>
        </div>
      </div>
    );
  }
);
