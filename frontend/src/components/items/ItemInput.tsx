import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import { Input } from '../ui/Input';
import { NLParseModal } from './NLParseModal';
import { categorizeItem, parseNaturalLanguage, submitFeedback } from '../../api/ai';
import type { ListType, Category, ParsedItem } from '../../types/api';
import { CATEGORY_COLORS, AI_MODE_PLACEHOLDERS, AI_MODE_HINTS } from '../../types/api';
import { SparklesIcon, PlusIcon, XMarkIcon, CheckIcon } from '@heroicons/react/24/outline';
import { CategoryIcon } from '../icons/CategoryIcons';

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
  const [aiMode, setAiMode] = useState(false);
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

  // Focus input when AI mode changes
  useEffect(() => {
    if (inputRef.current && !suggestion && !isLoading) {
      inputRef.current.focus();
    }
  }, [aiMode, suggestion, isLoading]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedValue = value.trim();
    if (!trimmedValue) return;

    // If AI mode is active, parse with LLM
    if (aiMode) {
      setIsLoading(true);
      try {
        const result = await parseNaturalLanguage({
          input: trimmedValue,
          list_type: listType,
        });

        if (result.items.length > 0) {
          // Show confirmation modal with parsed items
          setParsedItems(result.items);
          setOriginalInput(result.original_input);
          setNlModalOpen(true);
          setIsLoading(false);
          return;
        }
        // No items parsed - fall through to normal single item flow
      } catch (err) {
        console.error('AI parsing failed:', err);
        // Fall through to single item
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
        }).catch((err) => {
          // Non-critical: user action succeeds regardless, but log for debugging
          console.warn('Category feedback submission failed:', {
            itemName: suggestion.itemName,
            category: selectedCategoryName,
            error: err
          });
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

    // Reset state and turn off AI mode
    setNlModalOpen(false);
    setParsedItems([]);
    setOriginalInput('');
    setValue('');
    setAiMode(false);
  };

  const handleNlCancel = () => {
    setNlModalOpen(false);
    setParsedItems([]);
    setOriginalInput('');
  };

  const toggleAiMode = () => {
    setAiMode(!aiMode);
  };

  const categoryColor = suggestion
    ? CATEGORY_COLORS[suggestion.categoryName] || 'var(--color-accent)'
    : 'var(--color-accent)';

  const placeholder = aiMode ? AI_MODE_PLACEHOLDERS[listType] : 'Add item...';

  return (
    <div className="sticky bottom-0 safe-bottom bg-[var(--color-bg-primary)] border-t border-[var(--color-text-muted)]/10 p-4">
      <form onSubmit={handleSubmit} className="flex gap-2 items-center">
        {/* AI Mode Toggle */}
        <motion.button
          type="button"
          onClick={toggleAiMode}
          disabled={!!suggestion || isLoading}
          className={clsx(
            'relative flex-shrink-0 w-12 h-12 rounded-xl',
            'flex items-center justify-center',
            'transition-all duration-200',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            aiMode
              ? 'bg-[var(--color-accent)] text-white shadow-md'
              : 'bg-[var(--color-bg-card)] border border-[var(--color-text-muted)]/20 text-[var(--color-text-muted)] hover:border-[var(--color-accent)]/50 hover:text-[var(--color-accent)]'
          )}
          whileTap={{ scale: 0.95 }}
          aria-label={aiMode ? 'AI mode on' : 'AI mode off'}
          title={aiMode ? 'AI mode: ON - Describe what you need' : 'AI mode: OFF - Click to use AI suggestions'}
        >
          <motion.div
            animate={aiMode ? {
              scale: [1, 1.2, 1],
              rotate: [0, -8, 8, 0],
            } : { scale: 1, rotate: 0 }}
            transition={aiMode ? {
              duration: 2,
              repeat: Infinity,
              ease: 'easeInOut',
            } : { duration: 0.2 }}
          >
            <SparklesIcon className="w-6 h-6" />
          </motion.div>
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
              aiMode && 'border-[var(--color-accent)]/30 bg-[var(--color-accent)]/5'
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
                <PlusIcon className="w-5 h-5" strokeWidth={2} />
              )
            }
          />
        </div>
      </form>

      {/* AI mode hint */}
      <AnimatePresence>
        {aiMode && !suggestion && !isLoading && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <p className="mt-2 text-xs text-[var(--color-accent)] flex items-center gap-1.5">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-[var(--color-accent)] animate-pulse" />
              {AI_MODE_HINTS[listType]}
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
                <CategoryIcon category={suggestion.categoryName} className="w-5 h-5" style={{ color: categoryColor }} />
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
                    <CheckIcon className="w-4 h-4" style={{ color: categoryColor }} strokeWidth={2.5} />
                  </button>
                </div>

                <button
                  onClick={handleChangeCategory}
                  className="p-1.5 rounded-full hover:bg-black/10 transition-colors"
                  aria-label="Change category"
                >
                  <XMarkIcon className="w-5 h-5 text-[var(--color-text-muted)]" strokeWidth={2} />
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
                  <XMarkIcon className="w-4 h-4 text-[var(--color-text-muted)]" strokeWidth={2} />
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
                      <CategoryIcon category={category.name} className="w-4 h-4" style={{ color }} />
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
                  <CategoryIcon category="Uncategorized" className="w-4 h-4 text-[var(--color-text-muted)]" />
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

