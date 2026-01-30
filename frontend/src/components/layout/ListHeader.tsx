import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import { useUIStore, type Theme } from '../../stores/uiStore';
import { useDuplicateList } from '../../hooks/useLists';
import type { ListWithItems } from '../../types/api';

interface ListHeaderProps {
  title: string;
  list: ListWithItems;
  uncheckedCount: number;
  checkedCount: number;
  activeTab: 'todo' | 'done';
  onTabChange: (tab: 'todo' | 'done') => void;
}

export function ListHeader({
  title,
  list,
  uncheckedCount,
  checkedCount,
  activeTab,
  onTabChange,
}: ListHeaderProps) {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const theme = useUIStore((state) => state.theme);
  const setTheme = useUIStore((state) => state.setTheme);
  const openEditListModal = useUIStore((state) => state.openEditListModal);
  const openDeleteListDialog = useUIStore((state) => state.openDeleteListDialog);
  const openShareListModal = useUIStore((state) => state.openShareListModal);

  const duplicateList = useDuplicateList();

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
                className="absolute right-0 top-full mt-1 w-48 bg-[var(--color-bg-card)] rounded-xl shadow-lg border border-[var(--color-text-muted)]/10 overflow-hidden z-50"
              >
                <div className="p-1">
                  {/* Theme section */}
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

                  {/* Divider */}
                  <div className="h-px bg-[var(--color-text-muted)]/10 my-1" />

                  {/* List section */}
                  <div className="px-3 py-2 text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider">
                    List
                  </div>

                  <button
                    onClick={() => {
                      openEditListModal(list.id);
                      setMenuOpen(false);
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)] transition-colors"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                    <span className="text-sm">Rename...</span>
                  </button>

                  <button
                    onClick={() => {
                      openShareListModal(list.id);
                      setMenuOpen(false);
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)] transition-colors"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                      <circle cx="9" cy="7" r="4" />
                      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                    </svg>
                    <span className="text-sm">Share...</span>
                  </button>

                  <button
                    onClick={async () => {
                      setMenuOpen(false);
                      try {
                        const newList = await duplicateList.mutateAsync({
                          id: list.id,
                          data: { name: `${list.name} (Copy)` },
                        });
                        navigate(`/lists/${newList.id}`);
                      } catch (err: unknown) {
                        const apiError = err as { message?: string; data?: { detail?: string } };
                        const errorMessage = apiError.data?.detail || apiError.message || 'Failed to duplicate list';
                        console.error('Failed to duplicate list:', { listId: list.id, error: err, errorMessage });
                        // Show error to user since menu is already closed
                        alert(errorMessage);
                      }
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)] transition-colors"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                    </svg>
                    <span className="text-sm">Duplicate</span>
                  </button>

                  {/* Divider */}
                  <div className="h-px bg-[var(--color-text-muted)]/10 my-1" />

                  <button
                    onClick={() => {
                      const itemCount = list.items.length;
                      openDeleteListDialog(list.id, list.name, itemCount);
                      setMenuOpen(false);
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-[var(--color-destructive)] hover:bg-[var(--color-destructive)]/10 transition-colors"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                    <span className="text-sm">Delete</span>
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

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
