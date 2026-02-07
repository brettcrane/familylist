import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import { IconClipboardList, IconCircleCheck } from '@tabler/icons-react';
import { CheckIcon } from '@heroicons/react/24/outline';
import { Button } from '../ui/Button';
import type { Item, Category } from '../../types/api';
import { CATEGORY_COLORS } from '../../types/api';

interface DoneListProps {
  items: Item[];
  categories: Category[];
  totalItems: number;
  onUncheckItem: (itemId: string) => void;
  onClearAll: () => void;
  onRestoreAll: () => void;
  isClearingAll?: boolean;
  isRestoringAll?: boolean;
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;

  // Check if yesterday
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) {
    return 'Yesterday';
  }

  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

interface GroupedItems {
  label: string;
  items: Item[];
}

function groupItemsByTime(items: Item[]): GroupedItems[] {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const groups: { [key: string]: Item[] } = {
    'Just now': [],
    'Earlier today': [],
    Yesterday: [],
    Earlier: [],
  };

  items.forEach((item) => {
    if (!item.checked_at) return;
    const date = new Date(item.checked_at);
    const diffMins = Math.floor((now.getTime() - date.getTime()) / 60000);

    if (diffMins < 5) {
      groups['Just now'].push(item);
    } else if (date >= today) {
      groups['Earlier today'].push(item);
    } else if (date >= yesterday) {
      groups['Yesterday'].push(item);
    } else {
      groups['Earlier'].push(item);
    }
  });

  return Object.entries(groups)
    .filter(([, items]) => items.length > 0)
    .map(([label, items]) => ({ label, items }));
}

export function DoneList({
  items,
  categories,
  totalItems,
  onUncheckItem,
  onClearAll,
  onRestoreAll,
  isClearingAll = false,
  isRestoringAll = false,
}: DoneListProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Reset confirmation dialog when items change (e.g., via SSE or restore)
  useEffect(() => {
    setShowDeleteConfirm(false);
  }, [items.length]);

  // Build category lookup map
  const categoryMap = useMemo(() => {
    const map: Record<string, Category> = {};
    categories.forEach((cat) => {
      map[cat.id] = cat;
    });
    return map;
  }, [categories]);
  const sortedItems = useMemo(() => {
    return [...items].sort((a, b) => {
      const dateA = a.checked_at ? new Date(a.checked_at).getTime() : 0;
      const dateB = b.checked_at ? new Date(b.checked_at).getTime() : 0;
      return dateB - dateA;
    });
  }, [items]);

  const groupedItems = useMemo(() => groupItemsByTime(sortedItems), [sortedItems]);

  const progress = totalItems > 0 ? (items.length / totalItems) * 100 : 0;
  const allDone = items.length === totalItems && totalItems > 0;

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 pb-24 text-center">
        <IconClipboardList className="w-12 h-12 mb-4 text-[var(--color-text-muted)]" stroke={1.5} />
        <h3 className="font-display text-lg font-semibold text-[var(--color-text-primary)]">
          Nothing done yet
        </h3>
        <p className="mt-2 text-sm text-[var(--color-text-muted)]">
          Tap the checkbox to mark items as done
        </p>
      </div>
    );
  }

  return (
    <div className="pb-24">
      {/* Progress bar */}
      <div className="px-4 py-3 bg-[var(--color-bg-secondary)]">
        {allDone ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center py-2"
          >
            <IconCircleCheck className="w-5 h-5 text-[var(--color-checked)] inline-block" stroke={1.5} />
            <span className="ml-2 font-semibold text-[var(--color-checked)]">
              All done!
            </span>
          </motion.div>
        ) : (
          <>
            <div className="h-2 bg-[var(--color-bg-card)] rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-[var(--color-checked)] rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
              />
            </div>
            <p className="mt-2 text-sm text-[var(--color-text-muted)] text-center">
              {items.length} of {totalItems} items done
            </p>
          </>
        )}
      </div>

      {/* Action buttons */}
      {items.length > 0 && (
        <div className="px-4 py-3 border-b border-[var(--color-text-muted)]/10">
          <AnimatePresence mode="wait">
            {showDeleteConfirm ? (
              <motion.div
                key="confirm"
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.15 }}
                className="flex flex-col gap-2 p-3 bg-[var(--color-bg-secondary)] rounded-lg"
              >
                <p className="text-sm text-[var(--color-text-primary)] text-center">
                  Delete {items.length} {items.length === 1 ? 'item' : 'items'} permanently?
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowDeleteConfirm(false)}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onClearAll}
                    isLoading={isClearingAll}
                    disabled={isClearingAll}
                    className="flex-1 text-[var(--color-destructive)]"
                  >
                    Delete
                  </Button>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="actions"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="flex gap-2"
              >
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onRestoreAll}
                  isLoading={isRestoringAll}
                  className="flex-1 text-[var(--color-accent)]"
                >
                  Restore All
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="flex-1 text-[var(--color-destructive)]"
                >
                  Delete All
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Grouped items */}
      <AnimatePresence>
        {groupedItems.map((group) => (
          <div key={group.label}>
            <div className="px-4 py-2 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide bg-[var(--color-bg-secondary)]/50">
              {group.label}
            </div>
            {group.items.map((item) => (
              <motion.button
                key={item.id}
                onClick={() => onUncheckItem(item.id)}
                className={clsx(
                  'w-full flex items-center gap-3 px-4 py-2',
                  'bg-[var(--color-bg-card)]',
                  'border-b border-[var(--color-text-muted)]/10',
                  'hover:bg-[var(--color-bg-secondary)]/50 transition-colors',
                  'text-left'
                )}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20, height: 0 }}
                whileTap={{ scale: 0.98 }}
              >
                <div className="w-6 h-6 rounded-md bg-[var(--color-checked)] flex items-center justify-center flex-shrink-0">
                  <CheckIcon className="w-4 h-4 text-white" strokeWidth={2.5} />
                </div>

                <div className="flex-1 min-w-0">
                  <span className="text-[var(--color-text-secondary)] line-through">
                    {item.name}
                  </span>
                  {item.category_id && categoryMap[item.category_id] && (
                    <span
                      className="ml-2 inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium rounded opacity-50"
                      style={{
                        color: CATEGORY_COLORS[categoryMap[item.category_id].name] || 'var(--color-text-muted)',
                        backgroundColor: 'var(--color-bg-secondary)',
                      }}
                    >
                      {categoryMap[item.category_id].name}
                    </span>
                  )}
                </div>

                <div className="text-right flex-shrink-0">
                  <p className="text-xs text-[var(--color-text-muted)]">
                    {item.checked_at && formatRelativeTime(item.checked_at)}
                  </p>
                </div>
              </motion.button>
            ))}
          </div>
        ))}
      </AnimatePresence>

      {/* Hint */}
      <div className="px-4 py-6 text-center">
        <p className="text-sm text-[var(--color-text-muted)]">
          Tap an item to move it back to To Do
        </p>
      </div>
    </div>
  );
}
