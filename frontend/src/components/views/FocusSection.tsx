import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import { useUIStore } from '../../stores/uiStore';
import { ItemRow } from '../items/ItemRow';
import type { PersonGroup as PersonGroupType } from '../../hooks/useFocusItems';
import { PersonGroup } from './PersonGroup';
import type { Item, ListType } from '../../types/api';

interface FocusSectionProps {
  listId: string;
  sectionId: string;
  label: string;
  personGroups: PersonGroupType[];
  defaultCollapsed: boolean;
  isShared: boolean;
  listType: ListType;
  onCheckItem: (itemId: string) => void;
  onEditItem: (item: Item) => void;
  onNameChange: (itemId: string, newName: string) => void;
  /** If true, render items flat (no person headers) — used for Blocked section */
  flat?: boolean;
}

const SECTION_COLORS: Record<string, string> = {
  'focus-today': 'var(--color-accent)',
  'focus-week': 'var(--color-pending)',
  'focus-coming': 'var(--color-text-muted)',
  'focus-later': 'var(--color-text-muted)',
  'focus-blocked': 'var(--color-destructive)',
};

export function FocusSection({
  listId,
  sectionId,
  label,
  personGroups,
  defaultCollapsed,
  isShared,
  listType,
  onCheckItem,
  onEditItem,
  onNameChange,
  flat = false,
}: FocusSectionProps) {
  const isCollapsed = useUIStore((s) => s.isCategoryCollapsed(listId, sectionId));
  const toggleCategory = useUIStore((s) => s.toggleCategory);

  // Apply default collapse state on first mount
  const initializedRef = useRef(false);
  useEffect(() => {
    if (!initializedRef.current && defaultCollapsed && !isCollapsed) {
      toggleCategory(listId, sectionId);
    }
    initializedRef.current = true;
    // Only run on mount — defaultCollapsed is static per section
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totalItems = personGroups.reduce((sum, g) => sum + g.items.length, 0);
  const accentColor = SECTION_COLORS[sectionId] ?? 'var(--color-text-muted)';

  return (
    <div className="mb-1">
      <button
        onClick={() => toggleCategory(listId, sectionId)}
        className={clsx(
          'w-full flex items-center justify-between px-4 py-2.5',
          'bg-[var(--color-bg-secondary)]',
          'hover:bg-[var(--color-bg-secondary)]/80 transition-colors'
        )}
      >
        <div className="flex items-center gap-2">
          <motion.svg
            className="w-4 h-4 text-[var(--color-text-muted)]"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            animate={{ rotate: isCollapsed ? -90 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <polyline points="6 9 12 15 18 9" />
          </motion.svg>
          <span className="font-medium" style={{ color: accentColor }}>
            {label}
          </span>
        </div>
        <span
          className="text-xs font-medium px-2 py-0.5 rounded-full"
          style={{
            color: accentColor,
            backgroundColor: `color-mix(in srgb, ${accentColor} 15%, transparent)`,
          }}
        >
          {totalItems}
        </span>
      </button>

      <AnimatePresence initial={false}>
        {!isCollapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            {flat ? (
              personGroups.flatMap((group) =>
                group.items.map((item) => (
                  <ItemRow
                    key={item.id}
                    item={item}
                    listType={listType}
                    onCheck={() => onCheckItem(item.id)}
                    onEdit={() => onEditItem(item)}
                    onNameChange={(newName) => onNameChange(item.id, newName)}
                  />
                ))
              )
            ) : (
              personGroups.map((group) => (
                <PersonGroup
                  key={group.userId ?? 'unassigned'}
                  group={group}
                  isShared={isShared}
                  listType={listType}
                  sectionId={sectionId}
                  onCheckItem={onCheckItem}
                  onEditItem={onEditItem}
                  onNameChange={onNameChange}
                />
              ))
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
