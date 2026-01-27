import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import { ItemRow } from './ItemRow';
import { useUIStore } from '../../stores/uiStore';
import type { Item, Category } from '../../types/api';
import { CATEGORY_COLORS } from '../../types/api';

interface CategorySectionProps {
  listId: string;
  category: Category;
  items: Item[];
  onCheckItem: (itemId: string) => void;
  onDeleteItem: (itemId: string) => void;
}

export function CategorySection({
  listId,
  category,
  items,
  onCheckItem,
  onDeleteItem,
}: CategorySectionProps) {
  const isCollapsed = useUIStore((state) =>
    state.isCategoryCollapsed(listId, category.id)
  );
  const toggleCategory = useUIStore((state) => state.toggleCategory);

  const categoryColor = CATEGORY_COLORS[category.name] || 'var(--color-text-muted)';
  const uncheckedCount = items.filter((item) => !item.is_checked).length;

  return (
    <div className="mb-2">
      {/* Category header */}
      <button
        onClick={() => toggleCategory(listId, category.id)}
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
          <span
            className="font-medium text-[var(--color-text-primary)]"
            style={{ color: categoryColor }}
          >
            {category.name}
          </span>
        </div>
        <span className="text-sm text-[var(--color-text-muted)]">
          {uncheckedCount}
        </span>
      </button>

      {/* Items */}
      <AnimatePresence initial={false}>
        {!isCollapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            {items
              .filter((item) => !item.is_checked)
              .map((item, index) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ delay: index * 0.03 }}
                >
                  <ItemRow
                    item={item}
                    onCheck={() => onCheckItem(item.id)}
                    onDelete={() => onDeleteItem(item.id)}
                  />
                </motion.div>
              ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
