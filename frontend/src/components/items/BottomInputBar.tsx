import { forwardRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import { CheckIcon, PencilSquareIcon, XMarkIcon, PlusIcon } from '@heroicons/react/24/outline';
import type { Category, ListType } from '../../types/api';
import { CATEGORY_COLORS } from '../../types/api';
import { getCategoryEmoji } from '../icons/CategoryIcons';

interface CategorySuggestionState {
  itemName: string;
  categoryName: string;
  categoryId: string | null;
  confidence: number;
}

interface BottomInputBarProps {
  listType: ListType;
  inputValue: string;
  onInputChange: (value: string) => void;
  onInputSubmit: (e: React.FormEvent) => void;
  isLoading: boolean;
  mealMode: boolean;
  onMealModeToggle: () => void;
  inputDisabled: boolean;
  // Category suggestion props
  suggestion: CategorySuggestionState | null;
  showCategoryPicker: boolean;
  categories: Category[];
  autoAcceptDelay: number;
  onAcceptSuggestion: () => void;
  onChangeCategory: () => void;
  onSelectCategory: (categoryId: string | null) => void;
  onDismissSuggestion: () => void;
}

export const BottomInputBar = forwardRef<HTMLInputElement, BottomInputBarProps>(
  function BottomInputBar(
    {
      listType,
      inputValue,
      onInputChange,
      onInputSubmit,
      isLoading,
      mealMode,
      onMealModeToggle,
      inputDisabled,
      suggestion,
      showCategoryPicker,
      categories,
      autoAcceptDelay,
      onAcceptSuggestion,
      onChangeCategory,
      onSelectCategory,
      onDismissSuggestion,
    },
    ref
  ) {
    const showMealMode = listType === 'grocery';
    const placeholder = mealMode
      ? "What's cooking? (e.g., tacos)"
      : 'Add item...';

    const categoryColor = suggestion
      ? CATEGORY_COLORS[suggestion.categoryName] || 'var(--color-accent)'
      : 'var(--color-accent)';

    return (
      <div className="sticky bottom-0 z-40 safe-bottom bg-[var(--color-bg-primary)] border-t border-[var(--color-text-muted)]/10">
        {/* Category suggestion - appears above input */}
        <AnimatePresence>
          {suggestion && !showCategoryPicker && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="px-4 pt-3">
                <div
                  className="flex items-center justify-between p-3 rounded-xl"
                  style={{ backgroundColor: `${categoryColor}15` }}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-lg">{getCategoryEmoji(suggestion.categoryName)}</span>
                    <div>
                      <p className="text-sm font-medium text-[var(--color-text-primary)]">
                        {suggestion.itemName}
                      </p>
                      <p className="text-xs" style={{ color: categoryColor }}>
                        {suggestion.categoryName}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {/* Countdown ring with checkmark */}
                    <button
                      onClick={onAcceptSuggestion}
                      className="relative w-9 h-9 flex items-center justify-center"
                      aria-label="Accept category"
                    >
                      <svg className="w-9 h-9 -rotate-90 absolute" viewBox="0 0 36 36">
                        <circle
                          cx="18"
                          cy="18"
                          r="16"
                          fill="none"
                          stroke={categoryColor}
                          strokeWidth="2"
                          strokeOpacity="0.2"
                        />
                        <motion.circle
                          cx="18"
                          cy="18"
                          r="16"
                          fill="none"
                          stroke={categoryColor}
                          strokeWidth="2"
                          strokeDasharray="100.5"
                          initial={{ strokeDashoffset: 0 }}
                          animate={{ strokeDashoffset: 100.5 }}
                          transition={{ duration: autoAcceptDelay / 1000, ease: 'linear' }}
                        />
                      </svg>
                      <CheckIcon className="w-4 h-4 relative z-10" style={{ color: categoryColor }} />
                    </button>

                    {/* Change button */}
                    <button
                      onClick={onChangeCategory}
                      className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                      aria-label="Change category"
                    >
                      <PencilSquareIcon className="w-4 h-4 text-[var(--color-text-muted)]" />
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Category picker - appears above input */}
        <AnimatePresence>
          {showCategoryPicker && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="px-4 pt-3">
                <div className="bg-[var(--color-bg-card)] rounded-xl border border-[var(--color-text-muted)]/15 shadow-sm overflow-hidden">
                  <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--color-text-muted)]/10">
                    <span className="text-sm font-medium text-[var(--color-text-secondary)]">
                      Category for "{suggestion?.itemName}"
                    </span>
                    <button
                      onClick={onDismissSuggestion}
                      className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-[var(--color-bg-secondary)]"
                    >
                      <XMarkIcon className="w-4 h-4 text-[var(--color-text-muted)]" />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-0.5 p-1.5 max-h-52 overflow-y-auto">
                    {categories.map((category) => {
                      const color = CATEGORY_COLORS[category.name] || 'var(--color-text-muted)';
                      const isSelected = category.id === suggestion?.categoryId;
                      return (
                        <button
                          key={category.id}
                          onClick={() => onSelectCategory(category.id)}
                          className={clsx(
                            'flex items-center gap-2 px-3 py-2.5 rounded-lg text-left transition-colors',
                            isSelected
                              ? 'bg-[var(--color-accent)]/10'
                              : 'hover:bg-[var(--color-bg-secondary)]'
                          )}
                        >
                          <span className="text-base">{getCategoryEmoji(category.name)}</span>
                          <span
                            className="text-sm font-medium truncate"
                            style={{ color: isSelected ? 'var(--color-accent)' : color }}
                          >
                            {category.name}
                          </span>
                        </button>
                      );
                    })}
                    <button
                      onClick={() => onSelectCategory(null)}
                      className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-left hover:bg-[var(--color-bg-secondary)] transition-colors"
                    >
                      <span className="text-base">{getCategoryEmoji('Uncategorized')}</span>
                      <span className="text-sm font-medium text-[var(--color-text-muted)]">
                        Uncategorized
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Input row */}
        <div className="px-4 py-3">
          <form onSubmit={onInputSubmit} className="flex gap-2 items-center">
            {/* Meal Mode Toggle - only shown for grocery lists */}
            {showMealMode && (
              <motion.button
                type="button"
                onClick={onMealModeToggle}
                disabled={inputDisabled}
                className={clsx(
                  'relative flex-shrink-0 w-11 h-11 rounded-xl',
                  'flex items-center justify-center',
                  'transition-all duration-200',
                  'disabled:opacity-50 disabled:cursor-not-allowed',
                  mealMode
                    ? 'bg-[var(--color-accent)] text-white shadow-sm'
                    : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)] hover:text-[var(--color-accent)]'
                )}
                whileTap={{ scale: 0.95 }}
                aria-label={mealMode ? 'Recipe mode on' : 'Recipe mode off'}
              >
                <motion.svg
                  className="w-5 h-5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  animate={{ rotate: mealMode ? [0, -5, 5, 0] : 0 }}
                  transition={{ duration: 0.3 }}
                >
                  {/* Steam lines */}
                  {mealMode && (
                    <>
                      <motion.path
                        d="M8 5c0-1 .5-2 2-2"
                        initial={{ opacity: 0, y: 2 }}
                        animate={{ opacity: [0, 0.7, 0], y: [2, -1, 2] }}
                        transition={{ duration: 1.2, repeat: Infinity, delay: 0 }}
                      />
                      <motion.path
                        d="M12 4c0-1.5.5-2.5 2-2.5"
                        initial={{ opacity: 0, y: 2 }}
                        animate={{ opacity: [0, 0.7, 0], y: [2, -1, 2] }}
                        transition={{ duration: 1.2, repeat: Infinity, delay: 0.2 }}
                      />
                      <motion.path
                        d="M16 5c0-1 .5-2 2-2"
                        initial={{ opacity: 0, y: 2 }}
                        animate={{ opacity: [0, 0.7, 0], y: [2, -1, 2] }}
                        transition={{ duration: 1.2, repeat: Infinity, delay: 0.4 }}
                      />
                    </>
                  )}
                  <path d="M3 12h18" />
                  <path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />
                  <path d="M5 12a2 2 0 0 1-2-2 2 2 0 0 1 2-2" />
                  <path d="M19 12a2 2 0 0 0 2-2 2 2 0 0 0-2-2" />
                </motion.svg>
              </motion.button>
            )}

            {/* Input field */}
            <div className="flex-1 relative">
              <input
                ref={ref}
                type="text"
                value={inputValue}
                onChange={(e) => onInputChange(e.target.value)}
                placeholder={placeholder}
                disabled={inputDisabled}
                className={clsx(
                  'w-full h-11 pl-4 pr-10 rounded-xl',
                  'bg-[var(--color-bg-secondary)] border-2 border-transparent',
                  'text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]',
                  'focus:outline-none focus:border-[var(--color-accent)]/40',
                  'transition-all duration-200',
                  'disabled:opacity-50 disabled:cursor-not-allowed',
                  mealMode && 'border-[var(--color-accent)]/30 bg-[var(--color-accent)]/5'
                )}
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]">
                {isLoading ? (
                  <motion.svg
                    className="w-5 h-5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  >
                    <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
                    <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
                  </motion.svg>
                ) : (
                  <PlusIcon className="w-5 h-5" />
                )}
              </div>
            </div>
          </form>

          {/* Meal mode hint - only shown for grocery lists */}
          <AnimatePresence>
            {showMealMode && mealMode && !inputDisabled && (
              <motion.p
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-2 text-xs text-[var(--color-accent)] flex items-center gap-1.5 overflow-hidden"
              >
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-[var(--color-accent)] animate-pulse" />
                AI will suggest ingredients for your dish
              </motion.p>
            )}
          </AnimatePresence>
        </div>
      </div>
    );
  }
);
