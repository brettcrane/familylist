import { motion } from 'framer-motion';
import clsx from 'clsx';
import { Checkbox } from '../ui/Checkbox';
import { useSwipe } from '../../hooks/useSwipe';
import { useHasPendingMutation } from '../../hooks/useOfflineQueue';
import type { Item } from '../../types/api';

interface ItemRowProps {
  item: Item;
  onCheck: () => void;
  onDelete: () => void;
  showCategory?: boolean;
}

export function ItemRow({ item, onCheck, onDelete, showCategory }: ItemRowProps) {
  const hasPending = useHasPendingMutation(item.id);

  const { state, handlers } = useSwipe({
    onSwipeLeft: onCheck,
    onSwipeRight: onDelete,
  });

  const { offsetX, direction, isOverThreshold, isDragging } = state;

  // Calculate background reveal
  const leftReveal = direction === 'left' && offsetX < 0;
  const rightReveal = direction === 'right' && offsetX > 0;

  return (
    <div className="relative overflow-hidden">
      {/* Left reveal (check) */}
      <div
        className={clsx(
          'absolute inset-y-0 left-0 flex items-center justify-end px-4',
          'bg-[var(--color-checked)] text-white transition-opacity',
          leftReveal && isOverThreshold ? 'opacity-100' : 'opacity-0'
        )}
        style={{ width: Math.abs(offsetX) }}
      >
        <svg
          className="w-6 h-6"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>

      {/* Right reveal (delete) */}
      <div
        className={clsx(
          'absolute inset-y-0 right-0 flex items-center justify-start px-4',
          'bg-[var(--color-destructive)] text-white transition-opacity',
          rightReveal && isOverThreshold ? 'opacity-100' : 'opacity-0'
        )}
        style={{ width: Math.abs(offsetX) }}
      >
        <svg
          className="w-6 h-6"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="3 6 5 6 21 6" />
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        </svg>
      </div>

      {/* Item content */}
      <motion.div
        className={clsx(
          'flex items-center gap-3 px-4 py-3 bg-[var(--color-bg-card)]',
          'border-b border-[var(--color-text-muted)]/10',
          isDragging && 'cursor-grabbing'
        )}
        style={{ transform: `translateX(${offsetX}px)` }}
        animate={!isDragging ? { x: 0 } : undefined}
        transition={{ type: 'spring', damping: 20, stiffness: 300 }}
        {...handlers}
      >
        <Checkbox
          checked={item.is_checked}
          onCheckedChange={onCheck}
          aria-label={`Mark ${item.name} as ${item.is_checked ? 'incomplete' : 'complete'}`}
        />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span
              className={clsx(
                'font-medium truncate',
                item.is_checked
                  ? 'text-[var(--color-text-muted)] line-through'
                  : 'text-[var(--color-text-primary)]'
              )}
            >
              {item.name}
            </span>
            {item.quantity > 1 && (
              <span className="font-mono text-xs text-[var(--color-text-muted)] bg-[var(--color-bg-secondary)] px-1.5 py-0.5 rounded">
                ×{item.quantity}
              </span>
            )}
            {hasPending && (
              <span className="w-2 h-2 rounded-full bg-[var(--color-pending)] animate-pulse" />
            )}
          </div>
          {item.notes && (
            <p className="text-sm text-[var(--color-text-muted)] truncate mt-0.5">
              {item.notes}
            </p>
          )}
        </div>

        {showCategory && item.category_id && (
          <span className="text-xs text-[var(--color-text-muted)] bg-[var(--color-bg-secondary)] px-2 py-1 rounded-full">
            {/* Category name would come from context */}
          </span>
        )}
      </motion.div>
    </div>
  );
}
