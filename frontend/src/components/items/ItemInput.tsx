import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import { Input } from '../ui/Input';
import { categorizeItem } from '../../api/ai';
import type { ListType, Category } from '../../types/api';
import { CATEGORY_COLORS } from '../../types/api';

interface ItemInputProps {
  listType: ListType;
  categories: Category[];
  onAddItem: (name: string, categoryId: string | null) => void;
}

interface CategorySuggestion {
  itemName: string;
  categoryName: string;
  categoryId: string | null;
  confidence: number;
}

const AUTO_ACCEPT_DELAY = 2000; // 2 seconds

export function ItemInput({ listType, categories, onAddItem }: ItemInputProps) {
  const [value, setValue] = useState('');
  const [suggestion, setSuggestion] = useState<CategorySuggestion | null>(null);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const timerRef = useRef<number | null>(null);

  // Clear timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedValue = value.trim();
    if (!trimmedValue) return;

    // Get AI category suggestion
    try {
      const result = await categorizeItem({
        item_name: trimmedValue,
        list_type: listType,
      });

      // Find matching category
      const matchedCategory = categories.find(
        (cat) => cat.name.toLowerCase() === result.category.toLowerCase()
      );

      setSuggestion({
        itemName: trimmedValue,
        categoryName: result.category,
        categoryId: matchedCategory?.id || null,
        confidence: result.confidence,
      });

      // Start auto-accept timer - pass itemName directly to avoid stale closure
      timerRef.current = window.setTimeout(() => {
        acceptSuggestion(trimmedValue, matchedCategory?.id || null);
      }, AUTO_ACCEPT_DELAY);
    } catch {
      // On error, add without category
      onAddItem(trimmedValue, null);
      setValue('');
    }
  };

  const acceptSuggestion = (itemName: string, categoryId: string | null) => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    if (!itemName) return;
    onAddItem(itemName, categoryId);
    setValue('');
    setSuggestion(null);
  };

  const handleAccept = () => {
    if (suggestion) {
      acceptSuggestion(suggestion.itemName, suggestion.categoryId);
    }
  };

  const handleChangeCategory = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    setShowCategoryPicker(true);
  };

  const handleSelectCategory = (categoryId: string | null) => {
    if (suggestion) {
      acceptSuggestion(suggestion.itemName, categoryId);
    }
    setShowCategoryPicker(false);
  };

  const handleDismiss = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    setSuggestion(null);
    setShowCategoryPicker(false);
  };

  const categoryColor = suggestion
    ? CATEGORY_COLORS[suggestion.categoryName] || 'var(--color-accent)'
    : 'var(--color-accent)';

  return (
    <div className="sticky bottom-0 safe-bottom bg-[var(--color-bg-primary)] border-t border-[var(--color-text-muted)]/10 p-4">
      <form onSubmit={handleSubmit}>
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Add item..."
          disabled={!!suggestion}
          icon={
            <svg
              className="w-5 h-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          }
        />
      </form>

      {/* Category suggestion toast */}
      <AnimatePresence>
        {suggestion && !showCategoryPicker && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="mt-3"
          >
            <div
              className="flex items-center justify-between p-3 rounded-xl"
              style={{ backgroundColor: `${categoryColor}20` }}
            >
              <div className="flex items-center gap-2">
                <span className="text-lg">
                  {getCategoryEmoji(suggestion.categoryName)}
                </span>
                <span
                  className="font-medium"
                  style={{ color: categoryColor }}
                >
                  {suggestion.categoryName}
                </span>
              </div>

              <div className="flex items-center gap-2">
                {/* Countdown ring */}
                <div className="relative w-8 h-8">
                  <svg className="w-8 h-8 -rotate-90" viewBox="0 0 32 32">
                    <circle
                      cx="16"
                      cy="16"
                      r="14"
                      fill="none"
                      stroke={categoryColor}
                      strokeWidth="2"
                      strokeOpacity="0.3"
                    />
                    <motion.circle
                      cx="16"
                      cy="16"
                      r="14"
                      fill="none"
                      stroke={categoryColor}
                      strokeWidth="2"
                      strokeDasharray="88"
                      initial={{ strokeDashoffset: 0 }}
                      animate={{ strokeDashoffset: 88 }}
                      transition={{ duration: AUTO_ACCEPT_DELAY / 1000, ease: 'linear' }}
                    />
                  </svg>
                  <button
                    onClick={handleAccept}
                    className="absolute inset-0 flex items-center justify-center"
                    aria-label="Accept category"
                  >
                    <svg
                      className="w-4 h-4"
                      style={{ color: categoryColor }}
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </button>
                </div>

                <button
                  onClick={handleChangeCategory}
                  className="p-1.5 rounded-full hover:bg-black/10 transition-colors"
                  aria-label="Change category"
                >
                  <svg
                    className="w-5 h-5 text-[var(--color-text-muted)]"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Category picker */}
      <AnimatePresence>
        {showCategoryPicker && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="mt-3"
          >
            <div className="bg-[var(--color-bg-card)] rounded-xl border border-[var(--color-text-muted)]/20 p-2">
              <div className="flex items-center justify-between px-2 py-1 mb-2">
                <span className="text-sm font-medium text-[var(--color-text-secondary)]">
                  Select category
                </span>
                <button
                  onClick={handleDismiss}
                  className="p-1 rounded hover:bg-[var(--color-bg-secondary)]"
                >
                  <svg
                    className="w-4 h-4 text-[var(--color-text-muted)]"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
              <div className="grid grid-cols-2 gap-1 max-h-48 overflow-y-auto">
                {categories.map((category) => {
                  const color = CATEGORY_COLORS[category.name] || 'var(--color-text-muted)';
                  return (
                    <button
                      key={category.id}
                      onClick={() => handleSelectCategory(category.id)}
                      className={clsx(
                        'flex items-center gap-2 px-3 py-2 rounded-lg text-left',
                        'hover:bg-[var(--color-bg-secondary)] transition-colors'
                      )}
                    >
                      <span>{getCategoryEmoji(category.name)}</span>
                      <span
                        className="text-sm font-medium truncate"
                        style={{ color }}
                      >
                        {category.name}
                      </span>
                    </button>
                  );
                })}
                <button
                  onClick={() => handleSelectCategory(null)}
                  className={clsx(
                    'flex items-center gap-2 px-3 py-2 rounded-lg text-left',
                    'hover:bg-[var(--color-bg-secondary)] transition-colors'
                  )}
                >
                  <span>❓</span>
                  <span className="text-sm font-medium text-[var(--color-text-muted)]">
                    Uncategorized
                  </span>
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function getCategoryEmoji(category: string): string {
  const emojiMap: Record<string, string> = {
    Produce: '🥬',
    Dairy: '🥛',
    'Meat & Seafood': '🥩',
    Bakery: '🍞',
    Pantry: '🥫',
    Frozen: '🧊',
    Beverages: '🥤',
    Snacks: '🍪',
    Household: '🧹',
    'Personal Care': '🧴',
    Clothing: '👕',
    Toiletries: '🧼',
    Electronics: '📱',
    Documents: '📄',
    "Kids' Items": '🧸',
    Miscellaneous: '📦',
    Today: '📅',
    'This Week': '📆',
    Later: '⏰',
  };
  return emojiMap[category] || '📝';
}
