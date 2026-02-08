import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Bars3Icon } from '@heroicons/react/24/outline';
import type { List } from '../../types/api';
import { ListCard } from './ListCard';

interface SortableListCardProps {
  list: List;
  organizeMode: boolean;
}

export function SortableListCard({ list, organizeMode }: SortableListCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: list.id, disabled: !organizeMode });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
  };

  return (
    <div ref={setNodeRef} style={style} className="relative">
      {organizeMode && (
        <button
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          className="absolute -left-1 top-1/2 -translate-y-1/2 z-10 cursor-grab active:cursor-grabbing p-1.5 rounded-lg bg-[var(--color-bg-card)] shadow-sm border border-[var(--color-text-muted)]/10 touch-manipulation"
          aria-label={`Reorder ${list.name}`}
        >
          <Bars3Icon className="w-4 h-4 text-[var(--color-text-muted)]" />
        </button>
      )}

      <ListCard
        list={list}
        itemCount={list.item_count}
        checkedCount={list.checked_count}
        disableInteraction={organizeMode}
      />
    </div>
  );
}
