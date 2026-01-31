import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import clsx from 'clsx';
import type { List } from '../../types/api';
import { useLongPress } from '../../hooks/useLongPress';
import { ListCardMenu } from './ListCardMenu';
import { ListTypeIcon } from '../icons/CategoryIcons';

interface ListCardProps {
  list: List;
  itemCount?: number;
  checkedCount?: number;
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

export function ListCard({ list, itemCount = 0, checkedCount = 0 }: ListCardProps) {
  const navigate = useNavigate();
  const cardRef = useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);

  const shareCount = list.share_count || 0;

  const longPressHandlers = useLongPress({
    onLongPress: () => {
      if (cardRef.current) {
        setAnchorRect(cardRef.current.getBoundingClientRect());
      }
      setMenuOpen(true);
    },
    onClick: () => {
      navigate(`/lists/${list.id}`);
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

          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={list.color ? {
                  backgroundColor: `${list.color}20`,
                  color: list.color,
                } : undefined}
              >
                {list.icon ? (
                  <span className="text-xl">{list.icon}</span>
                ) : (
                  <div className={clsx(
                    'w-full h-full rounded-xl flex items-center justify-center',
                    !list.color && 'bg-[var(--color-accent)]/10 text-[var(--color-accent)]'
                  )}>
                    <ListTypeIcon type={list.type} className="w-5 h-5" />
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold text-[var(--color-text-primary)] truncate">
                  {list.name}
                </h3>
                {/* Inline progress row - bar first for consistent alignment */}
                <div className="flex items-center gap-2 mt-0.5">
                  {/* Fixed-width progress bar container */}
                  <div className="w-16 h-1.5 bg-[var(--color-bg-secondary)] rounded-full overflow-hidden flex-shrink-0">
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
                  <span className="text-sm text-[var(--color-text-muted)] whitespace-nowrap tabular-nums">
                    {itemCount === 0 ? (
                      'No items'
                    ) : (
                      <>{checkedCount} of {itemCount}</>
                    )}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between text-sm text-[var(--color-text-muted)]">
            <div className="flex items-center gap-2">
              <span className="capitalize">{list.type}</span>
              {shareCount > 0 && (
                <div className="flex items-center gap-1.5">
                  <span className="text-[var(--color-text-muted)]/50">·</span>
                  <div className="flex items-center gap-1">
                    <svg
                      className="w-3.5 h-3.5 text-[var(--color-text-muted)]"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                      <circle cx="9" cy="7" r="4" />
                      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                    </svg>
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
