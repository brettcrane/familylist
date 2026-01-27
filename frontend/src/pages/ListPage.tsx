import { useMemo, useState, useRef, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { Layout, Main } from '../components/layout';
import { ListHeader } from '../components/layout/ListHeader';
import { CategorySection } from '../components/items';
import { BottomInputBar } from '../components/items/BottomInputBar';
import { NLParseModal } from '../components/items/NLParseModal';
import { DoneList } from '../components/done';
import { useList } from '../hooks/useLists';
import {
  useCreateItem,
  useCheckItem,
  useUncheckItem,
  useDeleteItem,
  useClearCompleted,
} from '../hooks/useItems';
import { useUIStore } from '../stores/uiStore';
import { categorizeItem, parseNaturalLanguage, submitFeedback } from '../api/ai';
import type { Item, ParsedItem } from '../types/api';

const AUTO_ACCEPT_DELAY = 2000;

interface CategorySuggestionState {
  itemName: string;
  categoryName: string;
  categoryId: string | null;
  confidence: number;
}

export function ListPage() {
  const { id } = useParams<{ id: string }>();
  const { data: list, isLoading, error } = useList(id!);

  const activeTab = useUIStore((state) => state.activeTab);
  const setActiveTab = useUIStore((state) => state.setActiveTab);

  const createItem = useCreateItem(id!);
  const checkItem = useCheckItem(id!);
  const uncheckItem = useUncheckItem(id!);
  const deleteItem = useDeleteItem(id!);
  const clearCompleted = useClearCompleted(id!);

  // Input state
  const [inputValue, setInputValue] = useState('');
  const [mealMode, setMealMode] = useState(false);
  const [isInputLoading, setIsInputLoading] = useState(false);
  const [suggestion, setSuggestion] = useState<CategorySuggestionState | null>(null);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [nlModalOpen, setNlModalOpen] = useState(false);
  const [parsedItems, setParsedItems] = useState<ParsedItem[]>([]);
  const [originalInput, setOriginalInput] = useState('');

  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLElement>(null);
  const timerRef = useRef<number | null>(null);

  // Clear timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  // Group items by category
  const { categorizedItems, uncategorizedItems, checkedItems } = useMemo(() => {
    if (!list) {
      return { categorizedItems: new Map(), uncategorizedItems: [], checkedItems: [] };
    }

    const categorized = new Map<string, Item[]>();
    const uncategorized: Item[] = [];
    const checked: Item[] = [];

    list.items.forEach((item) => {
      if (item.is_checked) {
        checked.push(item);
      } else if (item.category_id) {
        const existing = categorized.get(item.category_id) || [];
        categorized.set(item.category_id, [...existing, item]);
      } else {
        uncategorized.push(item);
      }
    });

    return {
      categorizedItems: categorized,
      uncategorizedItems: uncategorized,
      checkedItems: checked,
    };
  }, [list]);

  const uncheckedCount = list
    ? list.items.filter((item) => !item.is_checked).length
    : 0;
  const checkedCount = checkedItems.length;
  const totalItems = list?.items.length || 0;

  // Handlers
  const handleAddItem = (name: string, categoryId: string | null) => {
    if (!name) return;
    createItem.mutate({
      name,
      category_id: categoryId,
    });
  };

  const handleCheckItem = (itemId: string) => {
    checkItem.mutate({ id: itemId });
  };

  const handleUncheckItem = (itemId: string) => {
    uncheckItem.mutate(itemId);
  };

  const handleDeleteItem = (itemId: string) => {
    deleteItem.mutate(itemId);
  };

  const handleClearAll = () => {
    clearCompleted.mutate();
  };

  // Input submission
  const handleInputSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedValue = inputValue.trim();
    if (!trimmedValue || !list) return;

    // If meal mode is active, parse as recipe
    if (mealMode) {
      setIsInputLoading(true);
      try {
        const result = await parseNaturalLanguage({
          input: trimmedValue,
          list_type: list.type,
        });

        if (result.items.length > 0) {
          setParsedItems(result.items);
          setOriginalInput(result.original_input);
          setNlModalOpen(true);
          setIsInputLoading(false);
          return;
        }
      } catch {
        // Fall through to single item
      }
      setIsInputLoading(false);
    }

    // Single item flow
    await handleSingleItem(trimmedValue);
  };

  const handleSingleItem = async (itemName: string) => {
    if (!list) return;

    try {
      setIsInputLoading(true);
      const result = await categorizeItem({
        item_name: itemName,
        list_type: list.type,
      });

      const matchedCategory = list.categories.find(
        (cat) => cat.name.toLowerCase() === result.category.toLowerCase()
      );

      setSuggestion({
        itemName,
        categoryName: result.category,
        categoryId: matchedCategory?.id || null,
        confidence: result.confidence,
      });

      // Start auto-accept timer
      timerRef.current = window.setTimeout(() => {
        acceptSuggestion(itemName, matchedCategory?.id || null);
      }, AUTO_ACCEPT_DELAY);
    } catch {
      handleAddItem(itemName, null);
      setInputValue('');
    } finally {
      setIsInputLoading(false);
    }
  };

  const acceptSuggestion = (itemName: string, categoryId: string | null) => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    if (!itemName) return;
    handleAddItem(itemName, categoryId);
    setInputValue('');
    setSuggestion(null);
  };

  const handleAcceptSuggestion = () => {
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
    if (suggestion && list) {
      const selectedCategory = list.categories.find((c) => c.id === categoryId);
      const selectedCategoryName = selectedCategory?.name || 'Uncategorized';

      if (selectedCategoryName !== suggestion.categoryName) {
        submitFeedback({
          item_name: suggestion.itemName,
          list_type: list.type,
          correct_category: selectedCategoryName,
        }).catch(() => {});
      }

      acceptSuggestion(suggestion.itemName, categoryId);
    }
    setShowCategoryPicker(false);
  };

  const handleDismissSuggestion = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    setSuggestion(null);
    setShowCategoryPicker(false);
  };

  const handleNlConfirm = (items: ParsedItem[]) => {
    if (!list) return;

    items.forEach((item) => {
      const matchedCategory = list.categories.find(
        (cat) => cat.name.toLowerCase() === item.category.toLowerCase()
      );
      handleAddItem(item.name, matchedCategory?.id || null);
    });

    setNlModalOpen(false);
    setParsedItems([]);
    setOriginalInput('');
    setInputValue('');
    setMealMode(false);
  };

  const handleNlCancel = () => {
    setNlModalOpen(false);
    setParsedItems([]);
    setOriginalInput('');
  };

  // Loading state
  if (error) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center min-h-screen p-8">
          <div className="text-5xl mb-4">😕</div>
          <h2 className="font-semibold text-[var(--color-text-primary)]">
            Couldn't load list
          </h2>
          <p className="mt-2 text-sm text-[var(--color-text-muted)]">
            Please check your connection and try again
          </p>
        </div>
      </Layout>
    );
  }

  if (isLoading || !list) {
    return (
      <Layout>
        <div className="sticky top-0 z-40 safe-top bg-[var(--color-bg-primary)] border-b border-[var(--color-text-muted)]/10 p-4">
          <div className="h-8 w-32 bg-[var(--color-bg-secondary)] rounded-lg animate-pulse" />
        </div>
        <Main className="p-4">
          <div className="animate-pulse space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-14 bg-[var(--color-bg-secondary)] rounded-xl" />
            ))}
          </div>
        </Main>
      </Layout>
    );
  }

  const sortedCategories = [...list.categories].sort(
    (a, b) => a.sort_order - b.sort_order
  );

  return (
    <Layout>
      <ListHeader
        title={list.name}
        uncheckedCount={uncheckedCount}
        checkedCount={checkedCount}
        activeTab={activeTab}
        onTabChange={(tab) => setActiveTab(tab as 'todo' | 'done')}
      />

      <Main ref={scrollRef} className="flex-1 overflow-y-auto">
        <AnimatePresence mode="wait">
          {activeTab === 'todo' ? (
            <div key="todo" className="pb-24">
              {uncheckedCount === 0 ? (
                <div className="flex flex-col items-center justify-center p-12 text-center">
                  <div className="text-5xl mb-4">✨</div>
                  <h3 className="font-display text-lg font-semibold text-[var(--color-text-primary)]">
                    All caught up!
                  </h3>
                  <p className="mt-2 text-sm text-[var(--color-text-muted)]">
                    Add items using the field below
                  </p>
                </div>
              ) : (
                <>
                  {uncategorizedItems.length > 0 && (
                    <CategorySection
                      listId={id!}
                      category={{ id: 'uncategorized', list_id: id!, name: 'Uncategorized', sort_order: -1 }}
                      items={uncategorizedItems}
                      onCheckItem={handleCheckItem}
                      onDeleteItem={handleDeleteItem}
                    />
                  )}

                  {sortedCategories.map((category) => {
                    const items = categorizedItems.get(category.id) || [];
                    if (items.length === 0) return null;
                    return (
                      <CategorySection
                        key={category.id}
                        listId={id!}
                        category={category}
                        items={items}
                        onCheckItem={handleCheckItem}
                        onDeleteItem={handleDeleteItem}
                      />
                    );
                  })}
                </>
              )}
            </div>
          ) : (
            <DoneList
              key="done"
              items={checkedItems}
              totalItems={totalItems}
              onUncheckItem={handleUncheckItem}
              onClearAll={handleClearAll}
              isClearingAll={clearCompleted.isPending}
            />
          )}
        </AnimatePresence>
      </Main>

      {/* Bottom input bar - always visible, thumb-friendly */}
      <BottomInputBar
        ref={inputRef}
        inputValue={inputValue}
        onInputChange={setInputValue}
        onInputSubmit={handleInputSubmit}
        isLoading={isInputLoading}
        mealMode={mealMode}
        onMealModeToggle={() => setMealMode(!mealMode)}
        inputDisabled={!!suggestion || isInputLoading}
        suggestion={suggestion}
        showCategoryPicker={showCategoryPicker}
        categories={list.categories}
        autoAcceptDelay={AUTO_ACCEPT_DELAY}
        onAcceptSuggestion={handleAcceptSuggestion}
        onChangeCategory={handleChangeCategory}
        onSelectCategory={handleSelectCategory}
        onDismissSuggestion={handleDismissSuggestion}
      />

      {/* Natural language parse modal */}
      <NLParseModal
        isOpen={nlModalOpen}
        originalInput={originalInput}
        items={parsedItems}
        categories={list.categories}
        listType={list.type}
        onConfirm={handleNlConfirm}
        onCancel={handleNlCancel}
      />
    </Layout>
  );
}
