import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import clsx from 'clsx';
import type { List } from '../../types/api';
import { LIST_TYPE_ICONS } from '../../types/api';

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
  const uncheckedCount = itemCount - checkedCount;
  const icon = list.icon || LIST_TYPE_ICONS[list.type];

  return (
    <Link to={`/lists/${list.id}`}>
      <motion.div
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className={clsx(
          'p-4 rounded-xl',
          'bg-[var(--color-bg-card)]',
          'shadow-[var(--shadow-card)]',
          'border border-[var(--color-text-muted)]/10',
          'transition-shadow hover:shadow-[var(--shadow-md)]'
        )}
      >
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{icon}</span>
            <div>
              <h3 className="font-semibold text-[var(--color-text-primary)]">
                {list.name}
              </h3>
              <p className="text-sm text-[var(--color-text-muted)]">
                {uncheckedCount} item{uncheckedCount !== 1 ? 's' : ''} to do
              </p>
            </div>
          </div>
          {list.color && (
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: list.color }}
            />
          )}
        </div>

        <div className="mt-4 flex items-center justify-between text-sm text-[var(--color-text-muted)]">
          <span className="capitalize">{list.type}</span>
          <span>{formatRelativeTime(list.updated_at)}</span>
        </div>

        {itemCount > 0 && (
          <div className="mt-3">
            <div className="h-1.5 bg-[var(--color-bg-secondary)] rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-[var(--color-checked)] rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${(checkedCount / itemCount) * 100}%` }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
              />
            </div>
          </div>
        )}
      </motion.div>
    </Link>
  );
}
