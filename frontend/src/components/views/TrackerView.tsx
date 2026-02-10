import clsx from 'clsx';
import { useTrackerStats } from '../../hooks/useTrackerStats';
import { TrackerChart } from './TrackerChart';
import { ItemRow } from '../items/ItemRow';
import type { Item, ListType } from '../../types/api';

interface TrackerViewProps {
  listId: string;
  items: Item[];
  listType: ListType;
  isShared: boolean;
  onCheckItem: (itemId: string) => void;
  onEditItem: (item: Item) => void;
}

const STAT_CARDS: {
  key: keyof ReturnType<typeof useTrackerStats>['stats'];
  label: string;
  colorClass: string;
}[] = [
  { key: 'overdue', label: 'Overdue', colorClass: 'text-red-500' },
  { key: 'dueThisWeek', label: 'This Week', colorClass: 'text-[var(--color-accent)]' },
  { key: 'dueThisMonth', label: 'This Month', colorClass: 'text-[var(--color-pending)]' },
  { key: 'undated', label: 'No Date', colorClass: 'text-[var(--color-text-muted)]' },
];

export function TrackerView({
  listId: _listId,
  items,
  listType,
  isShared: _isShared,
  onCheckItem,
  onEditItem,
}: TrackerViewProps) {
  const { stats, timeline, overdueItems, people } = useTrackerStats(items);

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center">
        <div className="text-4xl mb-3">&#x1F4CA;</div>
        <h3 className="font-display text-lg font-semibold text-[var(--color-text-primary)]">
          No tasks to track
        </h3>
        <p className="mt-2 text-sm text-[var(--color-text-muted)]">
          Add items to see stats and timeline
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Stat Cards — 2x2 grid */}
      <div className="grid grid-cols-2 gap-3 px-4 py-3">
        {STAT_CARDS.map(({ key, label, colorClass }) => (
          <div
            key={key}
            className="bg-[var(--color-bg-card)] rounded-xl border border-[var(--color-text-muted)]/10 p-3"
          >
            <span className={clsx('text-2xl font-bold tabular-nums', colorClass)}>
              {stats[key]}
            </span>
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Timeline Chart */}
      <TrackerChart timeline={timeline} people={people} />

      {/* Overdue Items List */}
      {overdueItems.length > 0 && (
        <div className="mt-1">
          <div className="px-4 py-2">
            <h3 className="text-xs font-medium text-red-500 uppercase tracking-wide">
              Overdue Items
            </h3>
          </div>
          {overdueItems.map(({ item, daysOverdue: days }) => (
            <div key={item.id} className="relative">
              <ItemRow
                item={item}
                listType={listType}
                onCheck={() => onCheckItem(item.id)}
                onEdit={() => onEditItem(item)}
              />
              <span
                className={clsx(
                  'absolute right-12 top-1/2 -translate-y-1/2',
                  'text-[10px] font-medium px-1.5 py-0.5 rounded-full',
                  'text-red-600 bg-red-100 dark:text-red-400 dark:bg-red-900/30'
                )}
              >
                {days}d
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
