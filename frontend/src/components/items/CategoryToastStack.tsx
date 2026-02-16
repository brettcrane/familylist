import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import { XMarkIcon, PencilSquareIcon, ExclamationTriangleIcon, TrashIcon } from '@heroicons/react/24/outline';
import type { Category, Item } from '../../types/api';
import { CATEGORY_COLORS } from '../../types/api';
import { CategoryIcon } from '../icons/CategoryIcons';

export interface RecentItemEntry {
  id: string;
  itemName: string;
  createdItemId: string | null;
  suggestedCategoryName: string | null;
  suggestedCategoryId: string | null;
  status: 'categorizing' | 'created' | 'duplicate';
  duplicateOfItem: Item | null;
}

interface CategoryToastStackProps {
  entries: RecentItemEntry[];
  categories: Category[];
  pickerForEntryId: string | null;
  onDismiss: (entryId: string) => void;
  onChangeCategory: (entryId: string) => void;
  onSelectCategory: (entryId: string, categoryId: string | null) => void;
  onClosePicker: () => void;
  onUndoDuplicate: (entryId: string) => void;
  onMergeQuantity: (entryId: string) => void;
}

const AUTO_DISMISS_DELAY = 4000;
const DUPLICATE_DISMISS_DELAY = 5000;
const MAX_VISIBLE = 3;

export function CategoryToastStack({
  entries,
  categories,
  pickerForEntryId,
  onDismiss,
  onChangeCategory,
  onSelectCategory,
  onClosePicker,
  onUndoDuplicate,
  onMergeQuantity,
}: CategoryToastStackProps) {
  const timersRef = useRef<Map<string, number>>(new Map());

  // Manage auto-dismiss timers
  useEffect(() => {
    const timers = timersRef.current;

    entries.forEach((entry) => {
      // Only auto-dismiss 'created' and 'duplicate' entries
      if (entry.status !== 'created' && entry.status !== 'duplicate') return;
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

      const delay = entry.status === 'duplicate' ? DUPLICATE_DISMISS_DELAY : AUTO_DISMISS_DELAY;
      const timer = window.setTimeout(() => {
        timers.delete(entry.id);
        onDismiss(entry.id);
      }, delay);
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
    <div className="px-4 pt-2 pb-1 flex flex-col gap-2">
      <AnimatePresence mode="popLayout">
        {visibleEntries.map((entry) => {
          const isDuplicate = entry.status === 'duplicate';
          const categoryColor = entry.suggestedCategoryName
            ? CATEGORY_COLORS[entry.suggestedCategoryName] || 'var(--color-accent)'
            : 'var(--color-text-muted)';
          const showPicker = entry.id === pickerForEntryId;

          const dupItem = entry.duplicateOfItem;

          return (
            <motion.div
              key={entry.id}
              layout
              initial={{ opacity: 0, y: 50, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.9 }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
            >
              {/* Duplicate toast */}
              {isDuplicate ? (
                <div
                  className="flex flex-col gap-2 px-4 py-3 rounded-xl shadow-lg bg-[var(--color-bg-card)]"
                  style={{
                    border: '1px solid color-mix(in srgb, var(--color-text-muted) 20%, transparent)',
                    borderLeft: '3px solid var(--color-warning, #f59e0b)',
                  }}
                >
                  <div className="flex items-center gap-2">
                    <ExclamationTriangleIcon className="w-4 h-4 flex-shrink-0 text-amber-500" />
                    <p className="text-sm font-medium text-[var(--color-text-primary)] flex-1 min-w-0 truncate">
                      &ldquo;{entry.itemName}&rdquo; is already on your list
                      {dupItem && dupItem.quantity > 1 && (
                        <span className="text-[var(--color-text-muted)]"> ({'\u00d7'}{dupItem.quantity})</span>
                      )}
                      {dupItem?.assigned_to_name && (
                        <span className="text-[var(--color-text-muted)]"> — {dupItem.assigned_to_name}</span>
                      )}
                    </p>
                    <button
                      onClick={() => onDismiss(entry.id)}
                      className="p-1 -mr-1 rounded-lg hover:bg-[var(--color-bg-secondary)] transition-colors flex-shrink-0"
                      aria-label="Dismiss"
                    >
                      <XMarkIcon className="w-4 h-4 text-[var(--color-text-muted)]" />
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onUndoDuplicate(entry.id)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-500/20 transition-colors"
                    >
                      <TrashIcon className="w-3.5 h-3.5" />
                      Don&apos;t Add
                    </button>
                    <button
                      onClick={() => onMergeQuantity(entry.id)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium bg-[var(--color-accent)]/10 text-[var(--color-accent)] hover:bg-[var(--color-accent)]/20 transition-colors"
                    >
                      Add +1
                    </button>
                  </div>
                </div>
              ) : (
              /* Category toast card */
              <div
                className="flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg bg-[var(--color-bg-card)]"
                style={{
                  border: '1px solid color-mix(in srgb, var(--color-text-muted) 20%, transparent)',
                  borderLeft: `3px solid ${categoryColor}`,
                }}
              >
                {/* Icon */}
                {entry.status === 'categorizing' ? (
                  <motion.svg
                    className="w-5 h-5 flex-shrink-0 text-[var(--color-text-muted)]"
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
                    className="w-5 h-5 flex-shrink-0"
                    style={{ color: categoryColor }}
                  />
                )}

                {/* Text */}
                <div className="flex-1 min-w-0">
                  {entry.status === 'categorizing' ? (
                    <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">
                      Adding {entry.itemName}...
                    </p>
                  ) : (
                    <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">
                      <span>{entry.itemName}</span>
                      <span className="text-[var(--color-text-muted)]"> in </span>
                      <span style={{ color: categoryColor }}>
                        {entry.suggestedCategoryName || 'Uncategorized'}
                      </span>
                    </p>
                  )}
                </div>

                {/* Actions */}
                {entry.status === 'created' && (
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => onChangeCategory(entry.id)}
                      className="p-1 -mr-0.5 rounded-lg hover:bg-[var(--color-bg-secondary)] transition-colors"
                      aria-label={`Change category for ${entry.itemName}`}
                    >
                      <PencilSquareIcon className="w-4 h-4 text-[var(--color-text-muted)]" />
                    </button>
                    <button
                      onClick={() => onDismiss(entry.id)}
                      className="p-1 -mr-1 rounded-lg hover:bg-[var(--color-bg-secondary)] transition-colors"
                      aria-label={`Dismiss ${entry.itemName}`}
                    >
                      <XMarkIcon className="w-4 h-4 text-[var(--color-text-muted)]" />
                    </button>
                  </div>
                )}
              </div>
              )}

              {/* Inline category picker */}
              <AnimatePresence>
                {showPicker && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="mt-1.5 bg-[var(--color-bg-card)] rounded-xl border border-[var(--color-text-muted)]/20 shadow-lg overflow-hidden">
                      <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--color-text-muted)]/10">
                        <span className="text-sm font-medium text-[var(--color-text-secondary)]">
                          Category for &ldquo;{entry.itemName}&rdquo;
                        </span>
                        <button
                          onClick={onClosePicker}
                          className="p-1 rounded-lg hover:bg-[var(--color-bg-secondary)] transition-colors"
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
