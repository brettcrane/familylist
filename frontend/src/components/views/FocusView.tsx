import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDownIcon } from '@heroicons/react/24/outline';
import { useFocusItems } from '../../hooks/useFocusItems';
import { useCurrentUser } from '../../hooks/useShares';
import { FocusSection } from './FocusSection';
import { ItemRow } from '../items/ItemRow';
import type { Item, Category, ListType } from '../../types/api';

interface FocusViewProps {
  listId: string;
  items: Item[];
  listType: ListType;
  isShared: boolean;
  categories: Category[];
  onCheckItem: (itemId: string) => void;
  onEditItem: (item: Item) => void;
  onNameChange: (itemId: string, newName: string) => void;
}

export function FocusView({
  listId,
  items,
  listType,
  isShared,
  categories: _categories,
  onCheckItem,
  onEditItem,
  onNameChange,
}: FocusViewProps) {
  const { data: currentUser } = useCurrentUser();
  const { sections, noDueDateItems } = useFocusItems(items, currentUser?.id ?? null);
  const [noDueDateExpanded, setNoDueDateExpanded] = useState(false);

  // All items either have no due date or are beyond 30 days
  if (sections.length === 0 && noDueDateItems.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center">
        <div className="text-4xl mb-3">&#x2728;</div>
        <h3 className="font-display text-lg font-semibold text-[var(--color-text-primary)]">
          All caught up!
        </h3>
        <p className="mt-2 text-sm text-[var(--color-text-muted)]">
          Nothing scheduled. Enjoy the calm.
        </p>
      </div>
    );
  }

  if (sections.length === 0 && noDueDateItems.length > 0) {
    return (
      <div>
        <div className="flex flex-col items-center justify-center p-8 text-center">
          <h3 className="font-display text-base font-semibold text-[var(--color-text-primary)]">
            Nothing due today. Nice.
          </h3>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">
            Add due dates to see items in the timeline.
          </p>
        </div>
        <NoDueDateBar
          items={noDueDateItems}
          expanded={noDueDateExpanded}
          onToggle={() => setNoDueDateExpanded(!noDueDateExpanded)}
          listType={listType}
          onCheckItem={onCheckItem}
          onEditItem={onEditItem}
          onNameChange={onNameChange}
        />
      </div>
    );
  }

  return (
    <div>
      {sections.map((section) => (
        <FocusSection
          key={section.id}
          listId={listId}
          sectionId={section.id}
          label={section.label}
          personGroups={section.personGroups}
          defaultCollapsed={section.defaultCollapsed}
          isShared={isShared}
          listType={listType}
          onCheckItem={onCheckItem}
          onEditItem={onEditItem}
          onNameChange={onNameChange}
          flat={section.id === 'focus-blocked'}
        />
      ))}

      {noDueDateItems.length > 0 && (
        <NoDueDateBar
          items={noDueDateItems}
          expanded={noDueDateExpanded}
          onToggle={() => setNoDueDateExpanded(!noDueDateExpanded)}
          listType={listType}
          onCheckItem={onCheckItem}
          onEditItem={onEditItem}
          onNameChange={onNameChange}
        />
      )}
    </div>
  );
}

function NoDueDateBar({
  items,
  expanded,
  onToggle,
  listType,
  onCheckItem,
  onEditItem,
  onNameChange,
}: {
  items: Item[];
  expanded: boolean;
  onToggle: () => void;
  listType: ListType;
  onCheckItem: (itemId: string) => void;
  onEditItem: (item: Item) => void;
  onNameChange: (itemId: string, newName: string) => void;
}) {
  return (
    <div className="mt-2 border-t border-[var(--color-text-muted)]/10">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-2 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
      >
        <span>
          {items.length} item{items.length !== 1 ? 's' : ''} without due dates
        </span>
        <motion.div
          animate={{ rotate: expanded ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronDownIcon className="w-4 h-4" />
        </motion.div>
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            {items.map((item) => (
              <ItemRow
                key={item.id}
                item={item}
                listType={listType}
                onCheck={() => onCheckItem(item.id)}
                onEdit={() => onEditItem(item)}
                onNameChange={(newName) => onNameChange(item.id, newName)}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
