import { useSortable } from '@dnd-kit/sortable';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Bars3Icon } from '@heroicons/react/24/outline';
import { CategorySection } from './CategorySection';
import { SortableItemRow } from './SortableItemRow';
import type { Item, Category, ListType } from '../../types/api';

export const CATEGORY_DND_PREFIX = 'category-';

interface SortableCategorySectionProps {
  listId: string;
  listType?: ListType;
  category: Category;
  items: Item[];
  onCheckItem: (itemId: string) => void;
  onEditItem?: (item: Item) => void;
  onNameChange?: (itemId: string, newName: string) => void;
}

export function SortableCategorySection({
  listId,
  listType,
  category,
  items,
  onCheckItem,
  onEditItem,
  onNameChange,
}: SortableCategorySectionProps) {
  const sortableId = `${CATEGORY_DND_PREFIX}${category.id}`;
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: sortableId });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
    touchAction: 'none',
  };

  const uncheckedItems = items.filter((item) => !item.is_checked);
  const itemIds = uncheckedItems.map((item) => item.id);

  const categoryDragHandle = (
    <button
      ref={setActivatorNodeRef}
      {...attributes}
      {...listeners}
      className="cursor-grab active:cursor-grabbing p-1 -ml-1 rounded touch-manipulation"
      aria-label={`Reorder ${category.name} category`}
    >
      <Bars3Icon className="w-4 h-4 text-[var(--color-text-muted)]" />
    </button>
  );

  return (
    <div ref={setNodeRef} style={style}>
      <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
        <CategorySection
          listId={listId}
          listType={listType}
          category={category}
          items={items}
          onCheckItem={onCheckItem}
          onEditItem={onEditItem}
          onNameChange={onNameChange}
          dragHandleSlot={categoryDragHandle}
          renderItem={(item) => (
            <SortableItemRow
              key={item.id}
              item={item}
              listType={listType}
              onCheck={() => onCheckItem(item.id)}
              onEdit={onEditItem ? () => onEditItem(item) : undefined}
              onNameChange={onNameChange ? (newName) => onNameChange(item.id, newName) : undefined}
            />
          )}
        />
      </SortableContext>
    </div>
  );
}
