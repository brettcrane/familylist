import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import { Button } from '../ui/Button';
import { getCategoryEmoji } from '../icons/CategoryIcons';
import type { Item, Category, ItemUpdate } from '../../types/api';

interface EditItemModalProps {
  item: Item | null;
  categories: Category[];
  onSave: (itemId: string, data: ItemUpdate) => void;
  onClose: () => void;
  isSaving?: boolean;
}

export function EditItemModal({
  item,
  categories,
  onSave,
  onClose,
  isSaving = false,
}: EditItemModalProps) {
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState('');
  const [hasChanges, setHasChanges] = useState(false);

  // Reset state when item changes
  useEffect(() => {
    if (item) {
      setSelectedCategoryId(item.category_id);
      setQuantity(item.quantity);
      setNotes(item.notes || '');
      setHasChanges(false);
    }
  }, [item]);

  // Track changes
  useEffect(() => {
    if (item) {
      const categoryChanged = selectedCategoryId !== item.category_id;
      const quantityChanged = quantity !== item.quantity;
      const notesChanged = (notes || '') !== (item.notes || '');
      setHasChanges(categoryChanged || quantityChanged || notesChanged);
    }
  }, [item, selectedCategoryId, quantity, notes]);

  const handleSave = () => {
    if (!item || !hasChanges) return;

    const updates: ItemUpdate = {};
    if (selectedCategoryId !== item.category_id) {
      updates.category_id = selectedCategoryId;
    }
    if (quantity !== item.quantity) {
      updates.quantity = quantity;
    }
    if ((notes || '') !== (item.notes || '')) {
      updates.notes = notes || null;
    }

    onSave(item.id, updates);
  };

  const handleQuantityChange = (delta: number) => {
    setQuantity((prev) => Math.max(1, Math.min(99, prev + delta)));
  };

  // Sort categories, putting "Uncategorized" option first
  const sortedCategories = [...categories].sort((a, b) => a.sort_order - b.sort_order);

  return (
    <AnimatePresence>
      {item && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[var(--z-modal)] bg-black/50 backdrop-blur-sm"
          />

          {/* Bottom Sheet */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 350 }}
            className="fixed inset-x-0 bottom-0 z-[var(--z-modal)] bg-[var(--color-bg-primary)] rounded-t-3xl shadow-2xl max-h-[85vh] overflow-hidden"
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-10 h-1 bg-[var(--color-text-muted)]/30 rounded-full" />
            </div>

            {/* Header */}
            <div className="px-5 pb-4 border-b border-[var(--color-text-muted)]/10">
              <h2 className="font-display text-xl font-semibold text-[var(--color-text-primary)]">
                Edit Item
              </h2>
              <p className="mt-1 text-[var(--color-text-secondary)] font-medium truncate">
                {item.name}
              </p>
            </div>

            {/* Content */}
            <div className="overflow-y-auto p-5 space-y-6" style={{ maxHeight: 'calc(85vh - 160px)' }}>
              {/* Category Selection */}
              <div>
                <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-3">
                  Category
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {/* Uncategorized option */}
                  <button
                    type="button"
                    onClick={() => setSelectedCategoryId(null)}
                    className={clsx(
                      'flex items-center gap-2.5 px-3 py-2.5 rounded-xl transition-all',
                      'border-2',
                      selectedCategoryId === null
                        ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/10'
                        : 'border-transparent bg-[var(--color-bg-secondary)] hover:bg-[var(--color-bg-card)]'
                    )}
                  >
                    <span className="text-lg">{getCategoryEmoji('Uncategorized')}</span>
                    <span
                      className={clsx(
                        'text-sm font-medium truncate',
                        selectedCategoryId === null
                          ? 'text-[var(--color-accent)]'
                          : 'text-[var(--color-text-primary)]'
                      )}
                    >
                      Uncategorized
                    </span>
                  </button>

                  {sortedCategories.map((category) => (
                    <button
                      key={category.id}
                      type="button"
                      onClick={() => setSelectedCategoryId(category.id)}
                      className={clsx(
                        'flex items-center gap-2.5 px-3 py-2.5 rounded-xl transition-all',
                        'border-2',
                        selectedCategoryId === category.id
                          ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/10'
                          : 'border-transparent bg-[var(--color-bg-secondary)] hover:bg-[var(--color-bg-card)]'
                      )}
                    >
                      <span className="text-lg">{getCategoryEmoji(category.name)}</span>
                      <span
                        className={clsx(
                          'text-sm font-medium truncate',
                          selectedCategoryId === category.id
                            ? 'text-[var(--color-accent)]'
                            : 'text-[var(--color-text-primary)]'
                        )}
                      >
                        {category.name}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Quantity */}
              <div>
                <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-3">
                  Quantity
                </label>
                <div className="flex items-center justify-center gap-4">
                  <button
                    type="button"
                    onClick={() => handleQuantityChange(-1)}
                    disabled={quantity <= 1}
                    className={clsx(
                      'w-12 h-12 rounded-full flex items-center justify-center transition-all',
                      'bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)]',
                      'hover:bg-[var(--color-bg-card)] active:scale-95',
                      'disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100'
                    )}
                  >
                    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                  </button>

                  <div className="w-20 text-center">
                    <span className="font-display text-4xl font-bold text-[var(--color-text-primary)]">
                      {quantity}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleQuantityChange(1)}
                    disabled={quantity >= 99}
                    className={clsx(
                      'w-12 h-12 rounded-full flex items-center justify-center transition-all',
                      'bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)]',
                      'hover:bg-[var(--color-bg-card)] active:scale-95',
                      'disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100'
                    )}
                  >
                    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <line x1="12" y1="5" x2="12" y2="19" />
                      <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label
                  htmlFor="item-notes"
                  className="block text-sm font-medium text-[var(--color-text-secondary)] mb-3"
                >
                  Notes
                </label>
                <textarea
                  id="item-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add a note..."
                  rows={3}
                  className={clsx(
                    'w-full px-4 py-3 rounded-xl resize-none',
                    'bg-[var(--color-bg-card)] border border-[var(--color-text-muted)]/20',
                    'text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]',
                    'transition-all duration-200',
                    'focus:outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent)]/20'
                  )}
                />
              </div>
            </div>

            {/* Footer */}
            <div className="p-5 pt-4 border-t border-[var(--color-text-muted)]/10 safe-bottom">
              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={onClose}
                  className="flex-1"
                  disabled={isSaving}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  onClick={handleSave}
                  disabled={!hasChanges || isSaving}
                  isLoading={isSaving}
                  className="flex-1"
                >
                  Save Changes
                </Button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
