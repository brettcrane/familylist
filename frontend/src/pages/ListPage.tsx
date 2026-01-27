import { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { Layout, Main, Header } from '../components/layout';
import { Tabs, TabList, TabTrigger, TabContent } from '../components/ui';
import { CategorySection, ItemInput } from '../components/items';
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
import type { Item } from '../types/api';

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

  if (error) {
    return (
      <Layout>
        <Header title="Error" showBack />
        <Main className="flex flex-col items-center justify-center p-8">
          <div className="text-4xl mb-4">😕</div>
          <h2 className="font-semibold text-[var(--color-text-primary)]">
            Couldn't load list
          </h2>
          <p className="mt-2 text-sm text-[var(--color-text-muted)]">
            Please check your connection and try again
          </p>
        </Main>
      </Layout>
    );
  }

  if (isLoading || !list) {
    return (
      <Layout>
        <Header title="Loading..." showBack />
        <Main className="p-4">
          <div className="animate-pulse space-y-4">
            <div className="h-10 bg-[var(--color-bg-secondary)] rounded-lg" />
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-16 bg-[var(--color-bg-secondary)] rounded-lg" />
            ))}
          </div>
        </Main>
      </Layout>
    );
  }

  // Sort categories by sort_order
  const sortedCategories = [...list.categories].sort(
    (a, b) => a.sort_order - b.sort_order
  );

  return (
    <Layout>
      <Header title={list.name} showBack />

      <Tabs value={activeTab} onChange={(value) => setActiveTab(value as 'todo' | 'done')}>
        <TabList>
          <TabTrigger value="todo" count={uncheckedCount}>
            To Do
          </TabTrigger>
          <TabTrigger value="done" count={checkedCount}>
            Done
          </TabTrigger>
        </TabList>

        <Main className="flex flex-col">
          <TabContent value="todo" className="flex-1">
            {uncheckedCount === 0 ? (
              <div className="flex flex-col items-center justify-center p-8 text-center">
                <div className="text-5xl mb-4">✨</div>
                <h3 className="font-display text-lg font-semibold text-[var(--color-text-primary)]">
                  All caught up!
                </h3>
                <p className="mt-2 text-sm text-[var(--color-text-muted)]">
                  Add items below to get started
                </p>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto pb-32">
                {/* Uncategorized items first */}
                {uncategorizedItems.length > 0 && (
                  <CategorySection
                    listId={id!}
                    category={{ id: 'uncategorized', list_id: id!, name: 'Uncategorized', sort_order: -1 }}
                    items={uncategorizedItems}
                    onCheckItem={handleCheckItem}
                    onDeleteItem={handleDeleteItem}
                  />
                )}

                {/* Categorized items */}
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
              </div>
            )}

            <ItemInput
              listType={list.type}
              categories={list.categories}
              onAddItem={handleAddItem}
            />
          </TabContent>

          <TabContent value="done" className="flex-1">
            <DoneList
              items={checkedItems}
              totalItems={totalItems}
              onUncheckItem={handleUncheckItem}
              onClearAll={handleClearAll}
              isClearingAll={clearCompleted.isPending}
            />
          </TabContent>
        </Main>
      </Tabs>
    </Layout>
  );
}
