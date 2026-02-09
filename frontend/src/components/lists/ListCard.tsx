import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import clsx from 'clsx';
import { EllipsisHorizontalIcon, UserGroupIcon } from '@heroicons/react/24/outline';
import type { List } from '../../types/api';
import { useLongPress } from '../../hooks/useLongPress';
import { ListCardMenu } from './ListCardMenu';
import { ListTypeIcon, ListIcon } from '../icons/CategoryIcons';

interface ListCardProps {
  list: List;
  itemCount?: number;
  checkedCount?: number;
  /** When true, disables click navigation and long-press context menu (used in organize mode). */
  disableInteraction?: boolean;
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

export function ListCard({ list, itemCount = 0, checkedCount = 0, disableInteraction = false }: ListCardProps) {
  const navigate = useNavigate();
  const cardRef = useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);

  const shareCount = list.share_count || 0;

  const openMenu = (rect?: DOMRect) => {
    setAnchorRect(rect ?? cardRef.current?.getBoundingClientRect() ?? null);
    setMenuOpen(true);
  };

  const stopPropagation = (e: React.SyntheticEvent) => e.stopPropagation();

  const longPressHandlers = useLongPress({
    onLongPress: () => {
      if (!disableInteraction) openMenu();
    },
    onClick: () => {
      if (!disableInteraction) navigate(`/lists/${list.id}`);
    },
    threshold: 500,
  });

  return (
    <>
      <div
        ref={cardRef}
        {...longPressHandlers}
        className="cursor-pointer select-none"
      >
        <motion.div
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className={clsx(
            'p-4 rounded-xl',
            'bg-[var(--color-bg-card)]',
            'shadow-[var(--shadow-card)]',
            'border border-[var(--color-text-muted)]/10',
            'transition-shadow hover:shadow-[var(--shadow-md)]',
            'overflow-hidden relative'
          )}
          style={list.color ? {
            background: `linear-gradient(135deg, ${list.color}15 0%, transparent 50%)`,
          } : undefined}
        >
          {/* Color accent bar */}
          {list.color && (
            <div
              className="absolute left-0 top-0 bottom-0 w-1 rounded-l-xl"
              style={{ backgroundColor: list.color }}
            />
          )}

          {/* Header row: Icon + Name + Menu */}
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={list.color ? {
                backgroundColor: `${list.color}20`,
                color: list.color,
              } : undefined}
            >
              {list.icon ? (
                <ListIcon icon={list.icon} className="w-5 h-5" />
              ) : (
                <div className={clsx(
                  'w-full h-full rounded-xl flex items-center justify-center',
                  !list.color && 'bg-[var(--color-accent)]/10 text-[var(--color-accent)]'
                )}>
                  <ListTypeIcon type={list.type} className="w-5 h-5" />
                </div>
              )}
            </div>
            <h3 className="font-semibold text-[var(--color-text-primary)] truncate min-w-0 flex-1">
              {list.name}
            </h3>
            {!disableInteraction && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  openMenu(e.currentTarget.getBoundingClientRect());
                }}
                onMouseDown={stopPropagation}
                onTouchStart={stopPropagation}
                className={clsx(
                  'w-11 h-11 -mr-2 -my-1 rounded-lg flex-shrink-0',
                  'flex items-center justify-center',
                  'text-[var(--color-text-muted)] hover:text-[var(--color-accent)]',
                  'hover:bg-[var(--color-text-muted)]/10 active:bg-[var(--color-text-muted)]/10',
                  'transition-colors touch-manipulation',
                  'focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/30'
                )}
                aria-label={`Options for ${list.name}`}
              >
                <EllipsisHorizontalIcon className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* Progress row: Bar (~2/3) + Count (right-aligned) */}
          <div className="mt-3 flex items-center gap-3">
            {/* Progress bar - takes ~2/3 of space */}
            <div className="flex-[2] h-1.5 bg-[var(--color-bg-secondary)] rounded-full overflow-hidden">
              {itemCount > 0 && (
                <motion.div
                  className="h-full rounded-full"
                  style={{
                    backgroundColor: list.color || 'var(--color-checked)'
                  }}
                  initial={{ width: 0 }}
                  animate={{ width: `${(checkedCount / itemCount) * 100}%` }}
                  transition={{ duration: 0.5, ease: 'easeOut' }}
                />
              )}
            </div>
            {/* Count - right-aligned, fixed min-width for "1000 of 1000" */}
            <span className="flex-1 text-sm text-[var(--color-text-muted)] text-right whitespace-nowrap tabular-nums">
              {itemCount === 0 ? (
                'No items'
              ) : (
                <>{checkedCount} of {itemCount}</>
              )}
            </span>
          </div>

          {/* Footer row: Type/shared + Timestamp */}
          <div className="mt-2 flex items-center justify-between text-sm text-[var(--color-text-muted)]">
            <div className="flex items-center gap-2">
              <span className="capitalize">{list.type}</span>
              {shareCount > 0 && (
                <div className="flex items-center gap-1.5">
                  <span className="text-[var(--color-text-muted)]/50">·</span>
                  <div className="flex items-center gap-1">
                    <UserGroupIcon className="w-3.5 h-3.5 text-[var(--color-text-muted)]" />
                    <span className="text-xs">{shareCount}</span>
                  </div>
                </div>
              )}
            </div>
            <span>{formatRelativeTime(list.updated_at)}</span>
          </div>
        </motion.div>
      </div>

      <ListCardMenu
        list={list}
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        anchorRect={anchorRect}
      />
    </>
  );
}
