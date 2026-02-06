import { forwardRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import { CheckIcon, PencilSquareIcon, XMarkIcon, PlusIcon, SparklesIcon } from '@heroicons/react/24/outline';
import type { Category, ListType } from '../../types/api';
import { CATEGORY_COLORS } from '../../types/api';
import { CategoryIcon } from '../icons/CategoryIcons';

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
  aiMode: boolean;
  onAiModeToggle: () => void;
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
      aiMode,
      onAiModeToggle,
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
    const placeholder = aiMode
      ? listType === 'grocery' ? "What's cooking? (e.g., tacos)"
        : listType === 'packing' ? "Packing for...? (e.g., beach trip)"
        : "What needs doing? (e.g., hang a picture)"
      : 'Add item...';

    const hintText = listType === 'grocery' ? 'AI will suggest ingredients for your dish'
      : listType === 'packing' ? 'AI will suggest items to pack'
      : 'AI will break this into tasks';

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
                    <CategoryIcon category={suggestion.categoryName} className="w-5 h-5" style={{ color: categoryColor }} />
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
                          <CategoryIcon category={category.name} className="w-4 h-4" style={{ color }} />
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
                      <CategoryIcon category="Uncategorized" className="w-4 h-4 text-[var(--color-text-muted)]" />
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
            {/* AI Mode Toggle */}
            <motion.button
              type="button"
              onClick={onAiModeToggle}
              disabled={inputDisabled}
              className={clsx(
                'relative flex-shrink-0 w-11 h-11 rounded-xl',
                'flex items-center justify-center',
                'transition-all duration-200',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                aiMode
                  ? 'bg-[var(--color-accent)] text-white shadow-sm'
                  : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)] hover:text-[var(--color-accent)]'
              )}
              whileTap={{ scale: 0.95 }}
              aria-label={aiMode ? 'AI mode on' : 'AI mode off'}
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
                <SparklesIcon className="w-5 h-5" />
              </motion.div>
            </motion.button>

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
                  aiMode && 'border-[var(--color-accent)]/30 bg-[var(--color-accent)]/5'
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

          {/* AI mode hint */}
          <AnimatePresence>
            {aiMode && !inputDisabled && (
              <motion.p
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-2 text-xs text-[var(--color-accent)] flex items-center gap-1.5 overflow-hidden"
              >
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-[var(--color-accent)] animate-pulse" />
                {hintText}
              </motion.p>
            )}
          </AnimatePresence>
        </div>
      </div>
    );
  }
);
