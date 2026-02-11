import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Bars3Icon } from '@heroicons/react/24/outline';
import { ItemRow } from './ItemRow';
import type { Item, ListType } from '../../types/api';

interface SortableItemRowProps {
  item: Item;
  listType?: ListType;
  onCheck: () => void;
  onEdit?: () => void;
  onNameChange?: (newName: string) => void;
}

export function SortableItemRow({
  item,
  listType,
  onCheck,
  onEdit,
  onNameChange,
}: SortableItemRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
    touchAction: 'none',
  };

  const dragHandle = (
    <button
      ref={setActivatorNodeRef}
      {...attributes}
      {...listeners}
      className="cursor-grab active:cursor-grabbing p-1 -ml-1 rounded touch-manipulation"
      aria-label={`Reorder ${item.name}`}
    >
      <Bars3Icon className="w-4 h-4 text-[var(--color-text-muted)]" />
    </button>
  );

  return (
    <div ref={setNodeRef} style={style}>
      <ItemRow
        item={item}
        listType={listType}
        onCheck={onCheck}
        onEdit={onEdit}
        onNameChange={onNameChange}
        dragHandleSlot={dragHandle}
      />
    </div>
  );
}
