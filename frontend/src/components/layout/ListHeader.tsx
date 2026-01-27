import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import { useUIStore, type Theme } from '../../stores/uiStore';

interface ListHeaderProps {
  title: string;
  listType: string;
  uncheckedCount: number;
  checkedCount: number;
  activeTab: 'todo' | 'done';
  onTabChange: (tab: 'todo' | 'done') => void;
  inputValue: string;
  onInputChange: (value: string) => void;
  onInputSubmit: (e: React.FormEvent) => void;
  isLoading: boolean;
  mealMode: boolean;
  onMealModeToggle: () => void;
  inputDisabled: boolean;
  inputRef: React.RefObject<HTMLInputElement | null>;
  scrollContainerRef: React.RefObject<HTMLElement | null>;
}

export function ListHeader({
  title,
  uncheckedCount,
  checkedCount,
  activeTab,
  onTabChange,
  inputValue,
  onInputChange,
  onInputSubmit,
  isLoading,
  mealMode,
  onMealModeToggle,
  inputDisabled,
  inputRef,
  scrollContainerRef,
}: ListHeaderProps) {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [isCompact, setIsCompact] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const lastScrollY = useRef(0);

  const theme = useUIStore((state) => state.theme);
  const setTheme = useUIStore((state) => state.setTheme);

  // Handle scroll to collapse/expand header
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const currentScrollY = container.scrollTop;
      const scrollingDown = currentScrollY > lastScrollY.current;

      // Only collapse after scrolling down 60px
      if (scrollingDown && currentScrollY > 60) {
        setIsCompact(true);
      } else if (!scrollingDown && currentScrollY < 30) {
        setIsCompact(false);
      }

      lastScrollY.current = currentScrollY;
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, [scrollContainerRef]);

  // Close menu on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    if (menuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [menuOpen]);

  const placeholder = mealMode
    ? "What's cooking? (e.g., tacos)"
    : "Add item...";

  const themeOptions: { value: Theme; label: string; icon: React.ReactNode }[] = [
    {
      value: 'light',
      label: 'Light',
      icon: (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="5" />
          <line x1="12" y1="1" x2="12" y2="3" />
          <line x1="12" y1="21" x2="12" y2="23" />
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
          <line x1="1" y1="12" x2="3" y2="12" />
          <line x1="21" y1="12" x2="23" y2="12" />
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
        </svg>
      ),
    },
    {
      value: 'dark',
      label: 'Dark',
      icon: (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      ),
    },
    {
      value: 'system',
      label: 'System',
      icon: (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="2" y="3" width="20" height="14" rx="2" />
          <line x1="8" y1="21" x2="16" y2="21" />
          <line x1="12" y1="17" x2="12" y2="21" />
        </svg>
      ),
    },
  ];

  return (
    <header className="sticky top-0 z-40 safe-top bg-[var(--color-bg-primary)] border-b border-[var(--color-text-muted)]/10">
      {/* Top row: Back button, title, menu */}
      <div className="flex items-center justify-between h-12 px-4">
        <div className="flex items-center gap-2">
          <motion.button
            onClick={() => navigate(-1)}
            className="flex items-center justify-center w-9 h-9 -ml-2 rounded-full hover:bg-[var(--color-bg-secondary)] transition-colors"
            aria-label="Go back"
            whileTap={{ scale: 0.95 }}
          >
            <svg
              className="w-5 h-5 text-[var(--color-text-primary)]"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </motion.button>
          <h1 className="text-base font-semibold text-[var(--color-text-primary)] truncate max-w-[180px]">
            {title}
          </h1>
        </div>

        <div className="relative" ref={menuRef}>
          <motion.button
            onClick={() => setMenuOpen(!menuOpen)}
            className="flex items-center justify-center w-9 h-9 rounded-full hover:bg-[var(--color-bg-secondary)] transition-colors"
            aria-label="Menu"
            whileTap={{ scale: 0.95 }}
          >
            <svg
              className="w-5 h-5 text-[var(--color-text-secondary)]"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <circle cx="12" cy="6" r="1.5" />
              <circle cx="12" cy="12" r="1.5" />
              <circle cx="12" cy="18" r="1.5" />
            </svg>
          </motion.button>

          <AnimatePresence>
            {menuOpen && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: -8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -8 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 top-full mt-1 w-44 bg-[var(--color-bg-card)] rounded-xl shadow-lg border border-[var(--color-text-muted)]/10 overflow-hidden z-50"
              >
                <div className="p-1">
                  <div className="px-3 py-2 text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider">
                    Theme
                  </div>
                  {themeOptions.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => {
                        setTheme(option.value);
                        setMenuOpen(false);
                      }}
                      className={clsx(
                        'w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors',
                        theme === option.value
                          ? 'bg-[var(--color-accent)]/10 text-[var(--color-accent)]'
                          : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)]'
                      )}
                    >
                      {option.icon}
                      <span className="text-sm">{option.label}</span>
                      {theme === option.value && (
                        <svg className="w-4 h-4 ml-auto" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Input row */}
      <motion.div
        className="px-4 pb-3"
        animate={{
          height: isCompact ? 0 : 'auto',
          opacity: isCompact ? 0 : 1,
          marginTop: isCompact ? 0 : 0,
        }}
        transition={{ duration: 0.2 }}
      >
        <form onSubmit={onInputSubmit} className="flex gap-2 items-center">
          {/* Meal Mode Toggle */}
          <motion.button
            type="button"
            onClick={onMealModeToggle}
            disabled={inputDisabled}
            className={clsx(
              'relative flex-shrink-0 w-11 h-11 rounded-xl',
              'flex items-center justify-center',
              'transition-all duration-200',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              mealMode
                ? 'bg-[var(--color-accent)] text-white shadow-sm'
                : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)] hover:text-[var(--color-accent)]'
            )}
            whileTap={{ scale: 0.95 }}
            aria-label={mealMode ? "Recipe mode on" : "Recipe mode off"}
          >
            <motion.svg
              className="w-5 h-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
              animate={{ rotate: mealMode ? [0, -5, 5, 0] : 0 }}
              transition={{ duration: 0.3 }}
            >
              {/* Steam lines */}
              {mealMode && (
                <>
                  <motion.path
                    d="M8 5c0-1 .5-2 2-2"
                    initial={{ opacity: 0, y: 2 }}
                    animate={{ opacity: [0, 0.7, 0], y: [2, -1, 2] }}
                    transition={{ duration: 1.2, repeat: Infinity, delay: 0 }}
                  />
                  <motion.path
                    d="M12 4c0-1.5.5-2.5 2-2.5"
                    initial={{ opacity: 0, y: 2 }}
                    animate={{ opacity: [0, 0.7, 0], y: [2, -1, 2] }}
                    transition={{ duration: 1.2, repeat: Infinity, delay: 0.2 }}
                  />
                  <motion.path
                    d="M16 5c0-1 .5-2 2-2"
                    initial={{ opacity: 0, y: 2 }}
                    animate={{ opacity: [0, 0.7, 0], y: [2, -1, 2] }}
                    transition={{ duration: 1.2, repeat: Infinity, delay: 0.4 }}
                  />
                </>
              )}
              <path d="M3 12h18" />
              <path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />
              <path d="M5 12a2 2 0 0 1-2-2 2 2 0 0 1 2-2" />
              <path d="M19 12a2 2 0 0 0 2-2 2 2 0 0 0-2-2" />
            </motion.svg>
          </motion.button>

          {/* Input field */}
          <div className="flex-1 relative">
            <input
              ref={inputRef}
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
                mealMode && 'border-[var(--color-accent)]/30 bg-[var(--color-accent)]/5'
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
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              )}
            </div>
          </div>
        </form>

        {/* Meal mode hint */}
        <AnimatePresence>
          {mealMode && !inputDisabled && (
            <motion.p
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-2 text-xs text-[var(--color-accent)] flex items-center gap-1.5 overflow-hidden"
            >
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-[var(--color-accent)] animate-pulse" />
              AI will suggest ingredients for your dish
            </motion.p>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Compact input (shown when scrolled) */}
      <AnimatePresence>
        {isCompact && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="px-4 pb-2 overflow-hidden"
          >
            <button
              onClick={() => {
                setIsCompact(false);
                setTimeout(() => inputRef.current?.focus(), 100);
              }}
              className="w-full h-10 flex items-center gap-2 px-4 rounded-xl bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)] text-sm"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Add item...
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tabs */}
      <div className="flex border-t border-[var(--color-text-muted)]/10">
        <button
          onClick={() => onTabChange('todo')}
          className={clsx(
            'relative flex-1 py-2.5 text-sm font-medium transition-colors',
            activeTab === 'todo'
              ? 'text-[var(--color-text-primary)]'
              : 'text-[var(--color-text-muted)]'
          )}
        >
          <span className="flex items-center justify-center gap-1.5">
            To Do
            <span className={clsx(
              'text-xs px-1.5 py-0.5 rounded-full',
              activeTab === 'todo'
                ? 'bg-[var(--color-accent)]/15 text-[var(--color-accent)]'
                : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)]'
            )}>
              {uncheckedCount}
            </span>
          </span>
          {activeTab === 'todo' && (
            <motion.div
              layoutId="tab-underline"
              className="absolute bottom-0 left-2 right-2 h-0.5 bg-[var(--color-accent)] rounded-full"
            />
          )}
        </button>
        <button
          onClick={() => onTabChange('done')}
          className={clsx(
            'relative flex-1 py-2.5 text-sm font-medium transition-colors',
            activeTab === 'done'
              ? 'text-[var(--color-text-primary)]'
              : 'text-[var(--color-text-muted)]'
          )}
        >
          <span className="flex items-center justify-center gap-1.5">
            Done
            <span className={clsx(
              'text-xs px-1.5 py-0.5 rounded-full',
              activeTab === 'done'
                ? 'bg-[var(--color-checked)]/15 text-[var(--color-checked)]'
                : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)]'
            )}>
              {checkedCount}
            </span>
          </span>
          {activeTab === 'done' && (
            <motion.div
              layoutId="tab-underline"
              className="absolute bottom-0 left-2 right-2 h-0.5 bg-[var(--color-checked)] rounded-full"
            />
          )}
        </button>
      </div>
    </header>
  );
}
