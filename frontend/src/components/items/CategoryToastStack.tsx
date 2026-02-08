import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import { XMarkIcon } from '@heroicons/react/24/outline';
import type { Category, ListType } from '../../types/api';
import { CATEGORY_COLORS } from '../../types/api';
import { CategoryIcon } from '../icons/CategoryIcons';

export interface RecentItemEntry {
  id: string;
  itemName: string;
  createdItemId: string | null;
  suggestedCategoryName: string | null;
  suggestedCategoryId: string | null;
  status: 'categorizing' | 'created' | 'error';
  timestamp: number;
}

interface CategoryToastStackProps {
  entries: RecentItemEntry[];
  categories: Category[];
  listType: ListType;
  pickerForEntryId: string | null;
  onDismiss: (entryId: string) => void;
  onChangeCategory: (entryId: string) => void;
  onSelectCategory: (entryId: string, categoryId: string | null) => void;
  onClosePicker: () => void;
}

const AUTO_DISMISS_DELAY = 4000;
const MAX_VISIBLE = 3;

export function CategoryToastStack({
  entries,
  categories,
  pickerForEntryId,
  onDismiss,
  onChangeCategory,
  onSelectCategory,
  onClosePicker,
}: CategoryToastStackProps) {
  const timersRef = useRef<Map<string, number>>(new Map());

  // Manage auto-dismiss timers
  useEffect(() => {
    const timers = timersRef.current;

    entries.forEach((entry) => {
      // Only auto-dismiss 'created' entries that don't have picker open
      if (entry.status !== 'created') return;
      if (entry.id === pickerForEntryId) {
        // Pause timer if picker is open
        const existing = timers.get(entry.id);
        if (existing) {
          clearTimeout(existing);
          timers.delete(entry.id);
        }
        return;
      }
      // Already has a timer
      if (timers.has(entry.id)) return;

      const timer = window.setTimeout(() => {
        timers.delete(entry.id);
        onDismiss(entry.id);
      }, AUTO_DISMISS_DELAY);
      timers.set(entry.id, timer);
    });

    // Cleanup timers for entries that no longer exist
    for (const [id, timer] of timers) {
      if (!entries.find((e) => e.id === id)) {
        clearTimeout(timer);
        timers.delete(id);
      }
    }
  }, [entries, pickerForEntryId, onDismiss]);

  // Cleanup all timers on unmount
  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      for (const timer of timers.values()) {
        clearTimeout(timer);
      }
      timers.clear();
    };
  }, []);

  const visibleEntries = entries.slice(0, MAX_VISIBLE);

  if (visibleEntries.length === 0) return null;

  return (
    <div className="px-4 pt-2 pb-1 flex flex-col gap-1.5">
      <AnimatePresence mode="popLayout">
        {visibleEntries.map((entry) => {
          const categoryColor = entry.suggestedCategoryName
            ? CATEGORY_COLORS[entry.suggestedCategoryName] || 'var(--color-accent)'
            : 'var(--color-text-muted)';
          const showPicker = entry.id === pickerForEntryId;

          return (
            <motion.div
              key={entry.id}
              layout
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.15 } }}
              className="overflow-hidden"
            >
              {/* Toast pill */}
              <div
                className="flex items-center justify-between px-3 py-2 rounded-xl"
                style={{ backgroundColor: `${categoryColor}15` }}
              >
                <div className="flex items-center gap-2 min-w-0">
                  {entry.status === 'categorizing' ? (
                    <motion.svg
                      className="w-4 h-4 flex-shrink-0 text-[var(--color-text-muted)]"
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
                    <CategoryIcon
                      category={entry.suggestedCategoryName || 'Uncategorized'}
                      className="w-4 h-4 flex-shrink-0"
                      style={{ color: categoryColor }}
                    />
                  )}
                  <span className="text-sm font-medium text-[var(--color-text-primary)] truncate">
                    {entry.itemName}
                  </span>
                  {entry.status === 'categorizing' ? (
                    <span className="text-xs text-[var(--color-text-muted)] flex-shrink-0">
                      Adding...
                    </span>
                  ) : (
                    <span className="text-xs flex-shrink-0" style={{ color: categoryColor }}>
                      in {entry.suggestedCategoryName || 'Uncategorized'}
                    </span>
                  )}
                </div>

                {entry.status === 'created' && (
                  <div className="flex items-center gap-0.5 flex-shrink-0 ml-2">
                    <button
                      onClick={() => onChangeCategory(entry.id)}
                      className="px-2 py-1 text-xs font-medium rounded-md hover:bg-black/5 dark:hover:bg-white/5 transition-colors text-[var(--color-text-secondary)]"
                      aria-label={`Change category for ${entry.itemName}`}
                    >
                      Change
                    </button>
                    <button
                      onClick={() => onDismiss(entry.id)}
                      className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                      aria-label={`Dismiss ${entry.itemName}`}
                    >
                      <XMarkIcon className="w-3.5 h-3.5 text-[var(--color-text-muted)]" />
                    </button>
                  </div>
                )}
              </div>

              {/* Inline category picker */}
              <AnimatePresence>
                {showPicker && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="mt-1 bg-[var(--color-bg-card)] rounded-xl border border-[var(--color-text-muted)]/15 shadow-sm overflow-hidden">
                      <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--color-text-muted)]/10">
                        <span className="text-sm font-medium text-[var(--color-text-secondary)]">
                          Category for &ldquo;{entry.itemName}&rdquo;
                        </span>
                        <button
                          onClick={onClosePicker}
                          className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-[var(--color-bg-secondary)]"
                        >
                          <XMarkIcon className="w-4 h-4 text-[var(--color-text-muted)]" />
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-0.5 p-1.5 max-h-52 overflow-y-auto">
                        {categories.map((category) => {
                          const color = CATEGORY_COLORS[category.name] || 'var(--color-text-muted)';
                          const isSelected = category.id === entry.suggestedCategoryId;
                          return (
                            <button
                              key={category.id}
                              onClick={() => onSelectCategory(entry.id, category.id)}
                              className={clsx(
                                'flex items-center gap-2 px-3 py-2.5 rounded-lg text-left transition-colors',
                                isSelected
                                  ? 'bg-[var(--color-accent)]/10'
                                  : 'hover:bg-[var(--color-bg-secondary)]'
                              )}
                            >
                              <CategoryIcon category={category.name} className="w-4 h-4" style={{ color }} />
                              <span
                                className="text-sm font-medium truncate"
                                style={{ color: isSelected ? 'var(--color-accent)' : color }}
                              >
                                {category.name}
                              </span>
                            </button>
                          );
                        })}
                        <button
                          onClick={() => onSelectCategory(entry.id, null)}
                          className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-left hover:bg-[var(--color-bg-secondary)] transition-colors"
                        >
                          <CategoryIcon category="Uncategorized" className="w-4 h-4 text-[var(--color-text-muted)]" />
                          <span className="text-sm font-medium text-[var(--color-text-muted)]">
                            Uncategorized
                          </span>
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
