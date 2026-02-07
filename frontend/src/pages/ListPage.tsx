import { useMemo, useState, useRef, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { Layout, Main } from '../components/layout';
import { ListHeader } from '../components/layout/ListHeader';
import { CategorySection, EditItemModal } from '../components/items';
import { BottomInputBar } from '../components/items/BottomInputBar';
import { NLParseModal } from '../components/items/NLParseModal';
import { DoneList } from '../components/done';
import { EditListModal } from '../components/lists/EditListModal';
import { DeleteListDialog } from '../components/lists/DeleteListDialog';
import { ShareListModal } from '../components/lists/ShareListModal';
import { useList } from '../hooks/useLists';
import { useListStream } from '../hooks/useListStream';
import { useAuth } from '../contexts/AuthContext';
import {
  useCreateItem,
  useCheckItem,
  useUncheckItem,
  useDeleteItem,
  useUpdateItem,
  useClearCompleted,
  useRestoreCompleted,
} from '../hooks/useItems';
import { useUIStore } from '../stores/uiStore';
import { categorizeItem, parseNaturalLanguage, submitFeedback } from '../api/ai';
import { getErrorMessage } from '../api/client';
import { ErrorState } from '../components/ui';
import type { Item, ParsedItem, ItemUpdate } from '../types/api';

const AUTO_ACCEPT_DELAY = 2000;

interface CategorySuggestionState {
  itemName: string;
  categoryName: string;
  categoryId: string | null;
  confidence: number;
}

export function ListPage() {
  const { id } = useParams<{ id: string }>();
  const { isAuthReady } = useAuth();
  const { data: list, isLoading, error, refetch } = useList(id!, { enabled: isAuthReady });

  // Connect to SSE for real-time updates (only when auth is ready)
  const { isFailed: sseConnectionFailed, retry: retrySSE } = useListStream(id!, {
    enabled: isAuthReady,
  });

  const activeTab = useUIStore((state) => state.activeTab);
  const setActiveTab = useUIStore((state) => state.setActiveTab);
  const showToast = useUIStore((state) => state.showToast);

  const createItem = useCreateItem(id!);
  const checkItem = useCheckItem(id!);
  const uncheckItem = useUncheckItem(id!);
  const deleteItem = useDeleteItem(id!);
  const updateItem = useUpdateItem(id!);
  const clearCompleted = useClearCompleted(id!);
  const restoreCompleted = useRestoreCompleted(id!);

  // Input state
  const [inputValue, setInputValue] = useState('');
  const [aiMode, setAiMode] = useState(false);
  const [isInputLoading, setIsInputLoading] = useState(false);
  const [suggestion, setSuggestion] = useState<CategorySuggestionState | null>(null);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [nlModalOpen, setNlModalOpen] = useState(false);
  const [parsedItems, setParsedItems] = useState<ParsedItem[]>([]);
  const [originalInput, setOriginalInput] = useState('');
  const [editingItem, setEditingItem] = useState<Item | null>(null);

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
    deleteItem.mutate(itemId, {
      onSuccess: () => {
        setEditingItem(null);
      },
      onError: (error) => {
        console.error('Failed to delete item:', error);
        showToast(getErrorMessage(error, 'Failed to delete item. Please try again.'), 'error');
        setEditingItem(null);
      },
    });
  };

  const handleClearAll = () => {
    clearCompleted.mutate(undefined, {
      onError: (error) => {
        console.error('Failed to delete completed items:', error);
        const apiError = error as { message?: string; data?: { detail?: string } };
        const errorMessage = apiError.data?.detail || apiError.message || 'Failed to delete completed items. Please try again.';
        showToast(errorMessage, 'error');
      },
    });
  };

  const handleRestoreAll = () => {
    restoreCompleted.mutate(undefined, {
      onError: (error) => {
        console.error('Failed to restore completed items:', error);
        const apiError = error as { message?: string; data?: { detail?: string } };
        const errorMessage = apiError.data?.detail || apiError.message || 'Failed to restore items. Please try again.';
        showToast(errorMessage, 'error');
      },
    });
  };

  const handleEditItem = (item: Item) => {
    setEditingItem(item);
  };

  const handleSaveItem = (itemId: string, data: ItemUpdate) => {
    updateItem.mutate(
      { id: itemId, data },
      {
        onSuccess: () => {
          setEditingItem(null);
        },
        onError: (error) => {
          console.error('Failed to update item:', error);
          showToast(getErrorMessage(error, 'Failed to save changes. Please try again.'), 'error');
          setEditingItem(null);
        },
      }
    );
  };

  const handleNameChange = (itemId: string, newName: string) => {
    updateItem.mutate(
      { id: itemId, data: { name: newName } },
      {
        onError: (error) => {
          console.error('Failed to update item name:', error);
          showToast(getErrorMessage(error, 'Failed to save item name. Please try again.'), 'error');
        },
      }
    );
  };

  // Input submission
  const handleInputSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedValue = inputValue.trim();
    if (!trimmedValue || !list) return;

    // If AI mode is active, parse with LLM
    if (aiMode) {
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
      } catch (err) {
        console.error('AI parsing failed:', err);
        showToast('AI parsing failed. Adding as single item.', 'error');
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
        }).catch((err) => {
          console.warn('Category feedback submission failed:', {
            itemName: suggestion.itemName,
            category: selectedCategoryName,
            error: err,
          });
        });
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
    setAiMode(false);
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
        <div className="flex items-center justify-center min-h-screen">
          <ErrorState title="Couldn't load list" error={error} onRetry={() => refetch()} />
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
        list={list}
        uncheckedCount={uncheckedCount}
        checkedCount={checkedCount}
        activeTab={activeTab}
        onTabChange={(tab) => setActiveTab(tab as 'todo' | 'done')}
      />

      <Main ref={scrollRef} className="flex-1 overflow-y-auto">
        {/* SSE connection failure banner */}
        {sseConnectionFailed && (
          <div className="bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-700 px-4 py-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-amber-800 dark:text-amber-200">
                Real-time updates unavailable
              </span>
              <button
                onClick={retrySSE}
                className="text-amber-600 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-200 underline font-medium"
              >
                Retry
              </button>
            </div>
          </div>
        )}

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
                      onEditItem={handleEditItem}
                      onNameChange={handleNameChange}
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
                        onEditItem={handleEditItem}
                        onNameChange={handleNameChange}
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
              categories={list.categories}
              totalItems={totalItems}
              onUncheckItem={handleUncheckItem}
              onClearAll={handleClearAll}
              onRestoreAll={handleRestoreAll}
              isClearingAll={clearCompleted.isPending}
              isRestoringAll={restoreCompleted.isPending}
            />
          )}
        </AnimatePresence>
      </Main>

      {/* Bottom input bar - always visible, thumb-friendly */}
      <BottomInputBar
        ref={inputRef}
        listType={list.type}
        inputValue={inputValue}
        onInputChange={setInputValue}
        onInputSubmit={handleInputSubmit}
        isLoading={isInputLoading}
        aiMode={aiMode}
        onAiModeToggle={() => setAiMode(!aiMode)}
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

      {/* List management modals */}
      <EditListModal />
      <DeleteListDialog />
      <ShareListModal />

      {/* Item edit modal */}
      <EditItemModal
        item={editingItem}
        listId={id!}
        categories={list.categories}
        onSave={handleSaveItem}
        onDelete={handleDeleteItem}
        onClose={() => setEditingItem(null)}
        isSaving={updateItem.isPending}
      />
    </Layout>
  );
}
