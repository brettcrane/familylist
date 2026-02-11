import { UserIcon } from '@heroicons/react/24/outline';
import { ItemRow } from '../items/ItemRow';
import { getUserColor } from '../../utils/colors';
import { getInitials } from '../../utils/strings';
import type { PersonGroup as PersonGroupType } from '../../hooks/useFocusItems';
import type { Item, ListType } from '../../types/api';

interface PersonGroupProps {
  group: PersonGroupType;
  isShared: boolean;
  listType: ListType;
  onCheckItem: (itemId: string) => void;
  onEditItem: (item: Item) => void;
  onNameChange: (itemId: string, newName: string) => void;
}

export function PersonGroup({
  group,
  isShared,
  listType,
  onCheckItem,
  onEditItem,
  onNameChange,
}: PersonGroupProps) {
  const showHeader = isShared;

  return (
    <div>
      {showHeader && (
        <div className="flex items-center gap-2 px-4 py-1.5 bg-[var(--color-bg-primary)]">
          {group.userId ? (
            <span
              className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: getUserColor(group.userId) }}
            >
              <span className="text-white font-bold" style={{ fontSize: '8px' }}>
                {getInitials(group.userName)}
              </span>
            </span>
          ) : (
            <span className="w-5 h-5 rounded-full bg-[var(--color-bg-secondary)] flex items-center justify-center flex-shrink-0">
              <UserIcon className="w-3 h-3 text-[var(--color-text-muted)]" />
            </span>
          )}
          <span className="text-xs font-medium text-[var(--color-text-muted)]">
            {group.userName}
          </span>
          <span className="text-xs text-[var(--color-text-muted)]/60">
            {group.items.length}
          </span>
        </div>
      )}

      {group.items.map((item) => (
        <ItemRow
          key={item.id}
          item={item}
          listType={listType}
          onCheck={() => onCheckItem(item.id)}
          onEdit={() => onEditItem(item)}
          onNameChange={(newName) => onNameChange(item.id, newName)}
        />
      ))}
    </div>
  );
}
