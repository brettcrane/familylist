import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import { Input } from '../ui/Input';
import { NLParseModal } from './NLParseModal';
import { categorizeItem, parseNaturalLanguage, submitFeedback } from '../../api/ai';
import type { ListType, Category, ParsedItem } from '../../types/api';
import { CATEGORY_COLORS } from '../../types/api';
import { getCategoryEmoji } from '../icons/CategoryIcons';

interface ItemInputProps {
  listType: ListType;
  categories: Category[];
  onAddItem: (name: string, categoryId: string | null) => void;
  onAddItems?: (items: Array<{ name: string; categoryId: string | null; quantity?: number }>) => void;
}

interface CategorySuggestion {
  itemName: string;
  categoryName: string;
  categoryId: string | null;
  confidence: number;
}

const AUTO_ACCEPT_DELAY = 2000; // 2 seconds

export function ItemInput({ listType, categories, onAddItem, onAddItems }: ItemInputProps) {
  const [value, setValue] = useState('');
  const [suggestion, setSuggestion] = useState<CategorySuggestion | null>(null);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [nlModalOpen, setNlModalOpen] = useState(false);
  const [parsedItems, setParsedItems] = useState<ParsedItem[]>([]);
  const [originalInput, setOriginalInput] = useState('');
  const [mealMode, setMealMode] = useState(false);
  const timerRef = useRef<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Clear timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  // Focus input when meal mode changes
  useEffect(() => {
    if (inputRef.current && !suggestion && !isLoading) {
      inputRef.current.focus();
    }
  }, [mealMode, suggestion, isLoading]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedValue = value.trim();
    if (!trimmedValue) return;

    // If meal mode is active, always parse as recipe
    if (mealMode) {
      setIsLoading(true);
      try {
        const result = await parseNaturalLanguage({
          input: trimmedValue,
          list_type: listType,
        });

        if (result.items.length > 0) {
          // Show confirmation modal with parsed ingredients
          setParsedItems(result.items);
          setOriginalInput(result.original_input);
          setNlModalOpen(true);
          setIsLoading(false);
          return;
        }
        // No items parsed - fall through to normal single item flow
      } catch {
        // NL parsing failed - fall through to single item
      }
      setIsLoading(false);
    }

    // Single item flow - get AI category suggestion
    await handleSingleItem(trimmedValue);
  };

  const handleSingleItem = async (itemName: string) => {
    try {
      setIsLoading(true);
      const result = await categorizeItem({
        item_name: itemName,
        list_type: listType,
      });

      // Find matching category
      const matchedCategory = categories.find(
        (cat) => cat.name.toLowerCase() === result.category.toLowerCase()
      );

      setSuggestion({
        itemName: itemName,
        categoryName: result.category,
        categoryId: matchedCategory?.id || null,
        confidence: result.confidence,
      });

      // Start auto-accept timer - pass itemName directly to avoid stale closure
      timerRef.current = window.setTimeout(() => {
        acceptSuggestion(itemName, matchedCategory?.id || null);
      }, AUTO_ACCEPT_DELAY);
    } catch {
      // On error, add without category
      onAddItem(itemName, null);
      setValue('');
    } finally {
      setIsLoading(false);
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
      // Find the selected category name for feedback
      const selectedCategory = categories.find((c) => c.id === categoryId);
      const selectedCategoryName = selectedCategory?.name || 'Uncategorized';

      // Submit feedback if category differs from AI suggestion
      if (selectedCategoryName !== suggestion.categoryName) {
        submitFeedback({
          item_name: suggestion.itemName,
          list_type: listType,
          correct_category: selectedCategoryName,
        }).catch(() => {
          // Silently ignore feedback errors - non-critical
        });
      }

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

  const handleNlConfirm = (items: ParsedItem[]) => {
    // Find category IDs for each item
    const itemsWithCategoryIds = items.map((item) => {
      const matchedCategory = categories.find(
        (cat) => cat.name.toLowerCase() === item.category.toLowerCase()
      );
      return {
        name: item.name,
        categoryId: matchedCategory?.id || null,
        quantity: item.quantity,
      };
    });

    // Use batch add if available, otherwise add one by one
    if (onAddItems) {
      onAddItems(itemsWithCategoryIds);
    } else {
      itemsWithCategoryIds.forEach((item) => {
        onAddItem(item.name, item.categoryId);
      });
    }

    // Reset state and turn off meal mode
    setNlModalOpen(false);
    setParsedItems([]);
    setOriginalInput('');
    setValue('');
    setMealMode(false);
  };

  const handleNlCancel = () => {
    setNlModalOpen(false);
    setParsedItems([]);
    setOriginalInput('');
  };

  const toggleMealMode = () => {
    setMealMode(!mealMode);
  };

  const categoryColor = suggestion
    ? CATEGORY_COLORS[suggestion.categoryName] || 'var(--color-accent)'
    : 'var(--color-accent)';

  const placeholder = mealMode
    ? "What are you making? (e.g., tacos, chili)"
    : "Add item...";

  return (
    <div className="sticky bottom-0 safe-bottom bg-[var(--color-bg-primary)] border-t border-[var(--color-text-muted)]/10 p-4">
      <form onSubmit={handleSubmit} className="flex gap-2 items-center">
        {/* Meal Mode Toggle */}
        <motion.button
          type="button"
          onClick={toggleMealMode}
          disabled={!!suggestion || isLoading}
          className={clsx(
            'relative flex-shrink-0 w-12 h-12 rounded-xl',
            'flex items-center justify-center',
            'transition-all duration-200',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            mealMode
              ? 'bg-[var(--color-accent)] text-white shadow-md'
              : 'bg-[var(--color-bg-card)] border border-[var(--color-text-muted)]/20 text-[var(--color-text-muted)] hover:border-[var(--color-accent)]/50 hover:text-[var(--color-accent)]'
          )}
          whileTap={{ scale: 0.95 }}
          aria-label={mealMode ? "Recipe mode on" : "Recipe mode off"}
          title={mealMode ? "Recipe mode: ON - Type a dish name to get ingredients" : "Recipe mode: OFF - Click to add ingredients for a dish"}
        >
          {/* Chef hat / cooking icon */}
          <motion.div
            animate={{
              rotate: mealMode ? [0, -10, 10, -5, 5, 0] : 0,
              scale: mealMode ? [1, 1.1, 1] : 1
            }}
            transition={{ duration: 0.4 }}
          >
            <svg
              className="w-6 h-6"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              {/* Steam lines */}
              <motion.path
                d="M8 5c0-1 .5-2 2-2"
                initial={{ opacity: 0, y: 2 }}
                animate={{
                  opacity: mealMode ? [0, 1, 0] : 0,
                  y: mealMode ? [2, -2, 2] : 2
                }}
                transition={{
                  duration: 1.5,
                  repeat: mealMode ? Infinity : 0,
                  delay: 0
                }}
              />
              <motion.path
                d="M12 4c0-1.5.5-2.5 2-2.5"
                initial={{ opacity: 0, y: 2 }}
                animate={{
                  opacity: mealMode ? [0, 1, 0] : 0,
                  y: mealMode ? [2, -2, 2] : 2
                }}
                transition={{
                  duration: 1.5,
                  repeat: mealMode ? Infinity : 0,
                  delay: 0.3
                }}
              />
              <motion.path
                d="M16 5c0-1 .5-2 2-2"
                initial={{ opacity: 0, y: 2 }}
                animate={{
                  opacity: mealMode ? [0, 1, 0] : 0,
                  y: mealMode ? [2, -2, 2] : 2
                }}
                transition={{
                  duration: 1.5,
                  repeat: mealMode ? Infinity : 0,
                  delay: 0.6
                }}
              />
              {/* Pot */}
              <path d="M3 12h18" />
              <path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />
              <path d="M5 12a2 2 0 0 1-2-2 2 2 0 0 1 2-2" />
              <path d="M19 12a2 2 0 0 0 2-2 2 2 0 0 0-2-2" />
            </svg>
          </motion.div>

          {/* Active indicator dot */}
          <AnimatePresence>
            {mealMode && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                className="absolute -top-1 -right-1 w-3 h-3 bg-white rounded-full border-2 border-[var(--color-accent)]"
              />
            )}
          </AnimatePresence>
        </motion.button>

        {/* Input field */}
        <div className="flex-1">
          <Input
            ref={inputRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={placeholder}
            disabled={!!suggestion || isLoading}
            className={clsx(
              mealMode && 'border-[var(--color-accent)]/30 bg-[var(--color-accent)]/5'
            )}
            icon={
              isLoading ? (
                <svg
                  className="w-5 h-5 animate-spin"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
                  <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
                </svg>
              ) : (
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
              )
            }
          />
        </div>
      </form>

      {/* Meal mode hint */}
      <AnimatePresence>
        {mealMode && !suggestion && !isLoading && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <p className="mt-2 text-xs text-[var(--color-accent)] flex items-center gap-1.5">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-[var(--color-accent)] animate-pulse" />
              AI will suggest ingredients for your dish
            </p>
          </motion.div>
        )}
      </AnimatePresence>

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

      {/* Natural language parse modal */}
      <NLParseModal
        isOpen={nlModalOpen}
        originalInput={originalInput}
        items={parsedItems}
        categories={categories}
        listType={listType}
        onConfirm={handleNlConfirm}
        onCancel={handleNlCancel}
      />
    </div>
  );
}

