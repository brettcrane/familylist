import { useRef, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { MagnifyingGlassIcon, XMarkIcon, UserIcon } from '@heroicons/react/24/outline';

interface FilterBarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  myItemsOnly: boolean;
  onMyItemsToggle: () => void;
  showMyItems: boolean;
}

export function FilterBar({
  searchQuery,
  onSearchChange,
  myItemsOnly,
  onMyItemsToggle,
  showMyItems,
}: FilterBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when search icon area is clicked
  const focusInput = () => inputRef.current?.focus();

  // Clear search on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && searchQuery) {
        onSearchChange('');
        inputRef.current?.blur();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [searchQuery, onSearchChange]);

  return (
    <div className="flex items-center gap-2 px-4 py-2">
      {/* Search input */}
      <div className="relative flex-1">
        <button
          type="button"
          onClick={focusInput}
          className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]"
          tabIndex={-1}
          aria-hidden
        >
          <MagnifyingGlassIcon className="h-4 w-4" />
        </button>
        <input
          ref={inputRef}
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search items..."
          className="w-full h-9 pl-8 pr-8 rounded-lg bg-[var(--color-bg-secondary)] text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] border border-transparent focus:border-[var(--color-accent)]/30 focus:outline-none transition-colors"
        />
        <AnimatePresence>
          {searchQuery && (
            <motion.button
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.1 }}
              type="button"
              onClick={() => onSearchChange('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded-full text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-primary)] transition-colors"
            >
              <XMarkIcon className="h-4 w-4" />
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* Mine chip */}
      <AnimatePresence>
        {showMyItems && (
          <motion.button
            initial={{ opacity: 0, width: 0 }}
            animate={{ opacity: 1, width: 'auto' }}
            exit={{ opacity: 0, width: 0 }}
            transition={{ duration: 0.15 }}
            type="button"
            onClick={onMyItemsToggle}
            className={`flex items-center gap-1 h-9 px-3 rounded-lg text-sm font-medium whitespace-nowrap border transition-colors ${
              myItemsOnly
                ? 'bg-[var(--color-accent)]/15 text-[var(--color-accent)] border-[var(--color-accent)]/30'
                : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)] border-transparent hover:text-[var(--color-text-primary)]'
            }`}
          >
            <UserIcon className="h-4 w-4" />
            Mine
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
