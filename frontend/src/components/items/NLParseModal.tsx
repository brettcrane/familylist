import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import { ChevronDownIcon } from '@heroicons/react/24/outline';
import { Checkbox } from '../ui/Checkbox';
import { submitFeedback } from '../../api/ai';
import type { ParsedItem, Category, ListType } from '../../types/api';
import { CATEGORY_COLORS } from '../../types/api';
import { getCategoryEmoji } from '../icons/CategoryIcons';

interface NLParseModalProps {
  isOpen: boolean;
  originalInput: string;
  items: ParsedItem[];
  categories: Category[];
  listType: ListType;
  onConfirm: (items: ParsedItem[]) => void;
  onCancel: () => void;
}

interface EditableItem extends ParsedItem {
  selected: boolean;
}

export function NLParseModal({
  isOpen,
  originalInput,
  items,
  categories,
  listType,
  onConfirm,
  onCancel,
}: NLParseModalProps) {
  const [editableItems, setEditableItems] = useState<EditableItem[]>(() =>
    items.map((item) => ({ ...item, selected: true }))
  );
  const [editingCategory, setEditingCategory] = useState<number | null>(null);
  // Track original categories to detect changes for feedback
  const originalCategories = useRef<Map<string, string>>(
    new Map(items.map((item) => [item.name, item.category]))
  );

  // Reset state when items change (new modal open)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Intentional: sync derived state from props
    setEditableItems(items.map((item) => ({ ...item, selected: true })));
    setEditingCategory(null);
    originalCategories.current = new Map(items.map((item) => [item.name, item.category]));
  }, [items]);

  const selectedCount = editableItems.filter((item) => item.selected).length;

  const handleToggleItem = (index: number) => {
    setEditableItems((prev) =>
      prev.map((item, i) =>
        i === index ? { ...item, selected: !item.selected } : item
      )
    );
  };

  const handleChangeCategory = (index: number, category: string) => {
    const item = editableItems[index];
    const originalCategory = originalCategories.current.get(item.name);

    // Submit feedback if category was changed from AI suggestion
    if (originalCategory && originalCategory !== category) {
      submitFeedback({
        item_name: item.name,
        list_type: listType,
        correct_category: category,
      }).catch(() => {
        // Silently ignore feedback errors - non-critical
      });
    }

    setEditableItems((prev) =>
      prev.map((item, i) =>
        i === index ? { ...item, category } : item
      )
    );
    setEditingCategory(null);
  };

  const handleConfirm = () => {
    const selectedItems = editableItems
      .filter((item) => item.selected)
      // eslint-disable-next-line @typescript-eslint/no-unused-vars -- Destructuring to exclude 'selected'
      .map(({ selected, ...item }) => item);
    onConfirm(selectedItems);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-40"
            onClick={onCancel}
          />

          {/* Bottom sheet */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-50 bg-[var(--color-bg-card)] rounded-t-2xl shadow-xl max-h-[80vh] flex flex-col"
          >
            {/* Drag handle */}
            <div className="flex justify-center py-3">
              <div className="w-10 h-1 rounded-full bg-[var(--color-text-muted)]/30" />
            </div>

            {/* Header */}
            <div className="px-4 pb-3">
              <p className="text-sm text-[var(--color-text-muted)]">
                "{originalInput}"
              </p>
            </div>

            {/* Items list */}
            <div className="flex-1 overflow-y-auto px-4">
              {editableItems.map((item, index) => {
                const categoryColor =
                  CATEGORY_COLORS[item.category] || 'var(--color-text-muted)';

                return (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className={clsx(
                      'flex items-center gap-3 py-3 border-b border-[var(--color-text-muted)]/10',
                      !item.selected && 'opacity-50'
                    )}
                  >
                    <Checkbox
                      checked={item.selected}
                      onCheckedChange={() => handleToggleItem(index)}
                    />

                    <div className="flex-1 min-w-0">
                      <span className="font-medium text-[var(--color-text-primary)]">
                        {item.name}
                        {item.quantity > 1 && (
                          <span className="ml-2 font-mono text-xs text-[var(--color-text-muted)]">
                            ×{item.quantity}
                          </span>
                        )}
                      </span>
                    </div>

                    {/* Category chip */}
                    <button
                      onClick={() =>
                        setEditingCategory(editingCategory === index ? null : index)
                      }
                      className="flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium transition-colors"
                      style={{
                        backgroundColor: `${categoryColor}20`,
                        color: categoryColor,
                      }}
                    >
                      <span>{getCategoryEmoji(item.category)}</span>
                      <span>{item.category}</span>
                      <ChevronDownIcon className="w-3 h-3 opacity-60" />
                    </button>
                  </motion.div>
                );
              })}
            </div>

            {/* Category picker dropdown */}
            <AnimatePresence>
              {editingCategory !== null && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="border-t border-[var(--color-text-muted)]/10 bg-[var(--color-bg-secondary)]"
                >
                  <div className="p-2 grid grid-cols-2 gap-1 max-h-40 overflow-y-auto">
                    {categories.map((category) => {
                      const color =
                        CATEGORY_COLORS[category.name] || 'var(--color-text-muted)';
                      return (
                        <button
                          key={category.id}
                          onClick={() =>
                            handleChangeCategory(editingCategory, category.name)
                          }
                          className={clsx(
                            'flex items-center gap-2 px-3 py-2 rounded-lg text-left text-sm',
                            'hover:bg-[var(--color-bg-card)] transition-colors'
                          )}
                        >
                          <span>{getCategoryEmoji(category.name)}</span>
                          <span className="font-medium" style={{ color }}>
                            {category.name}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Footer */}
            <div className="p-4 border-t border-[var(--color-text-muted)]/10 safe-bottom">
              <div className="flex gap-3">
                <button
                  onClick={onCancel}
                  className="flex-1 py-3 rounded-xl font-medium text-[var(--color-text-secondary)] bg-[var(--color-bg-secondary)] transition-colors hover:bg-[var(--color-bg-secondary)]/80"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirm}
                  disabled={selectedCount === 0}
                  className={clsx(
                    'flex-1 py-3 rounded-xl font-medium text-white transition-colors',
                    selectedCount > 0
                      ? 'bg-[var(--color-accent)] hover:bg-[var(--color-accent)]/90'
                      : 'bg-[var(--color-text-muted)] cursor-not-allowed'
                  )}
                >
                  Add {selectedCount} item{selectedCount !== 1 ? 's' : ''}
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
