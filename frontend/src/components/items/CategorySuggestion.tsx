import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import { CheckIcon, PencilSquareIcon, XMarkIcon } from '@heroicons/react/24/outline';
import type { Category } from '../../types/api';
import { CATEGORY_COLORS } from '../../types/api';
import { getCategoryEmoji } from '../icons/CategoryIcons';

interface CategorySuggestionProps {
  suggestion: {
    itemName: string;
    categoryName: string;
    categoryId: string | null;
    confidence: number;
  } | null;
  showPicker: boolean;
  categories: Category[];
  autoAcceptDelay: number;
  onAccept: () => void;
  onChangeCategory: () => void;
  onSelectCategory: (categoryId: string | null) => void;
  onDismiss: () => void;
}

export function CategorySuggestion({
  suggestion,
  showPicker,
  categories,
  autoAcceptDelay,
  onAccept,
  onChangeCategory,
  onSelectCategory,
  onDismiss,
}: CategorySuggestionProps) {
  if (!suggestion) return null;

  const categoryColor = CATEGORY_COLORS[suggestion.categoryName] || 'var(--color-accent)';

  return (
    <div className="px-4 pb-3">
      <AnimatePresence mode="wait">
        {!showPicker ? (
          <motion.div
            key="suggestion"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
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
                onClick={onAccept}
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
                className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-black/5 transition-colors"
                aria-label="Change category"
              >
                <PencilSquareIcon className="w-4 h-4 text-[var(--color-text-muted)]" />
              </button>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="picker"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="bg-[var(--color-bg-card)] rounded-xl border border-[var(--color-text-muted)]/15 shadow-sm overflow-hidden"
          >
            <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--color-text-muted)]/10">
              <span className="text-sm font-medium text-[var(--color-text-secondary)]">
                Category for "{suggestion.itemName}"
              </span>
              <button
                onClick={onDismiss}
                className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-[var(--color-bg-secondary)]"
              >
                <XMarkIcon className="w-4 h-4 text-[var(--color-text-muted)]" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-0.5 p-1.5 max-h-52 overflow-y-auto">
              {categories.map((category) => {
                const color = CATEGORY_COLORS[category.name] || 'var(--color-text-muted)';
                const isSelected = category.id === suggestion.categoryId;
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
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
