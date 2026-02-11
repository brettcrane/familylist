import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as api from '../api';
import type { Item, ItemCreate, ItemUpdate, ItemCheckRequest, ListWithItems, List, Category } from '../types/api';
import { listKeys } from './useLists';

/**
 * Helper to update item counts in the lists cache
 */
function updateListCounts(
  queryClient: ReturnType<typeof useQueryClient>,
  listId: string,
  countDelta: { items?: number; checked?: number }
) {
  queryClient.setQueryData<List[]>(listKeys.lists(), (oldLists) => {
    if (!oldLists) return oldLists;
    return oldLists.map((list) =>
      list.id === listId
        ? {
            ...list,
            item_count: list.item_count + (countDelta.items ?? 0),
            checked_count: list.checked_count + (countDelta.checked ?? 0),
          }
        : list
    );
  });
}

/**
 * Hook to create a new item
 */
export function useCreateItem(listId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: ItemCreate) => api.createItem(listId, data),
    onSuccess: (newItem: Item) => {
      queryClient.setQueryData<ListWithItems>(
        listKeys.detail(listId),
        (old) => {
          if (!old) return old;
          return {
            ...old,
            items: [...old.items, newItem],
          };
        }
      );
      // Update counts in lists cache
      updateListCounts(queryClient, listId, { items: 1 });
    },
  });
}

/**
 * Hook to create multiple items at once
 */
export function useCreateItems(listId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (items: ItemCreate[]) => api.createItems(listId, { items }),
    onSuccess: (newItems: Item[]) => {
      queryClient.setQueryData<ListWithItems>(
        listKeys.detail(listId),
        (old) => {
          if (!old) return old;
          return {
            ...old,
            items: [...old.items, ...newItems],
          };
        }
      );
      // Update counts in lists cache
      updateListCounts(queryClient, listId, { items: newItems.length });
    },
  });
}

/**
 * Hook to update an item
 */
export function useUpdateItem(listId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: ItemUpdate }) =>
      api.updateItem(id, data),
    onMutate: async ({ id, data }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: listKeys.detail(listId) });

      // Snapshot the previous value
      const previousData = queryClient.getQueryData<ListWithItems>(
        listKeys.detail(listId)
      );

      // Optimistically update the item
      queryClient.setQueryData<ListWithItems>(
        listKeys.detail(listId),
        (old) => {
          if (!old) return old;
          return {
            ...old,
            items: old.items.map((item) =>
              item.id === id ? { ...item, ...data } : item
            ),
          };
        }
      );

      return { previousData };
    },
    onError: (_err, _vars, context) => {
      // Rollback on error
      if (context?.previousData) {
        queryClient.setQueryData(
          listKeys.detail(listId),
          context.previousData
        );
      }
    },
    onSuccess: (updatedItem: Item) => {
      // Replace optimistic update with server response
      queryClient.setQueryData<ListWithItems>(
        listKeys.detail(listId),
        (old) => {
          if (!old) return old;
          return {
            ...old,
            items: old.items.map((item) =>
              item.id === updatedItem.id ? updatedItem : item
            ),
          };
        }
      );
    },
  });
}

/**
 * Hook to delete an item
 */
export function useDeleteItem(listId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.deleteItem(id),
    onMutate: async (id) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: listKeys.detail(listId) });

      // Snapshot the previous value
      const previousData = queryClient.getQueryData<ListWithItems>(
        listKeys.detail(listId)
      );

      // Find if the item was checked (for count updates)
      const deletedItem = previousData?.items.find((item) => item.id === id);
      const wasChecked = deletedItem?.is_checked ?? false;

      // Optimistically remove the item
      queryClient.setQueryData<ListWithItems>(
        listKeys.detail(listId),
        (old) => {
          if (!old) return old;
          return {
            ...old,
            items: old.items.filter((item) => item.id !== id),
          };
        }
      );

      // Update counts in lists cache
      updateListCounts(queryClient, listId, {
        items: -1,
        checked: wasChecked ? -1 : 0,
      });

      return { previousData, wasChecked };
    },
    onError: (_err, _id, context) => {
      // Rollback on error
      if (context?.previousData) {
        queryClient.setQueryData(
          listKeys.detail(listId),
          context.previousData
        );
        // Rollback list counts
        updateListCounts(queryClient, listId, {
          items: 1,
          checked: context.wasChecked ? 1 : 0,
        });
      }
    },
  });
}

/**
 * Hook to check an item
 */
export function useCheckItem(listId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data?: ItemCheckRequest }) =>
      api.checkItem(id, data),
    onMutate: async ({ id }) => {
      await queryClient.cancelQueries({ queryKey: listKeys.detail(listId) });

      const previousData = queryClient.getQueryData<ListWithItems>(
        listKeys.detail(listId)
      );

      // Optimistically mark as checked
      queryClient.setQueryData<ListWithItems>(
        listKeys.detail(listId),
        (old) => {
          if (!old) return old;
          return {
            ...old,
            items: old.items.map((item) =>
              item.id === id
                ? {
                    ...item,
                    is_checked: true,
                    checked_at: new Date().toISOString(),
                  }
                : item
            ),
          };
        }
      );

      // Update checked count in lists cache
      updateListCounts(queryClient, listId, { checked: 1 });

      return { previousData };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(
          listKeys.detail(listId),
          context.previousData
        );
        // Rollback list counts
        updateListCounts(queryClient, listId, { checked: -1 });
      }
    },
    onSuccess: (updatedItem: Item) => {
      queryClient.setQueryData<ListWithItems>(
        listKeys.detail(listId),
        (old) => {
          if (!old) return old;
          return {
            ...old,
            items: old.items.map((item) =>
              item.id === updatedItem.id ? updatedItem : item
            ),
          };
        }
      );
    },
  });
}

/**
 * Hook to uncheck an item
 */
export function useUncheckItem(listId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.uncheckItem(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: listKeys.detail(listId) });

      const previousData = queryClient.getQueryData<ListWithItems>(
        listKeys.detail(listId)
      );

      // Optimistically mark as unchecked
      queryClient.setQueryData<ListWithItems>(
        listKeys.detail(listId),
        (old) => {
          if (!old) return old;
          return {
            ...old,
            items: old.items.map((item) =>
              item.id === id
                ? {
                    ...item,
                    is_checked: false,
                    checked_at: null,
                    checked_by: null,
                  }
                : item
            ),
          };
        }
      );

      // Update checked count in lists cache
      updateListCounts(queryClient, listId, { checked: -1 });

      return { previousData };
    },
    onError: (_err, _id, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(
          listKeys.detail(listId),
          context.previousData
        );
        // Rollback list counts
        updateListCounts(queryClient, listId, { checked: 1 });
      }
    },
    onSuccess: (updatedItem: Item) => {
      queryClient.setQueryData<ListWithItems>(
        listKeys.detail(listId),
        (old) => {
          if (!old) return old;
          return {
            ...old,
            items: old.items.map((item) =>
              item.id === updatedItem.id ? updatedItem : item
            ),
          };
        }
      );
    },
  });
}

/**
 * Hook to clear all completed items
 */
export function useClearCompleted(listId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => api.clearCompleted(listId),
    onSuccess: () => {
      // Get current data to count cleared items
      const currentData = queryClient.getQueryData<ListWithItems>(
        listKeys.detail(listId)
      );
      const clearedCount = currentData?.items.filter((item) => item.is_checked).length ?? 0;

      queryClient.setQueryData<ListWithItems>(
        listKeys.detail(listId),
        (old) => {
          if (!old) return old;
          return {
            ...old,
            items: old.items.filter((item) => !item.is_checked),
          };
        }
      );

      // Update counts in lists cache
      updateListCounts(queryClient, listId, {
        items: -clearedCount,
        checked: -clearedCount,
      });
    },
    onError: () => {
      queryClient.invalidateQueries({ queryKey: listKeys.detail(listId) });
      queryClient.invalidateQueries({ queryKey: listKeys.lists() });
    },
  });
}

/**
 * Hook to restore all completed items (uncheck them all)
 */
export function useRestoreCompleted(listId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => api.restoreCompleted(listId),
    onSuccess: () => {
      // Get current data to count restored items
      const currentData = queryClient.getQueryData<ListWithItems>(
        listKeys.detail(listId)
      );
      const restoredCount = currentData?.items.filter((item) => item.is_checked).length ?? 0;

      queryClient.setQueryData<ListWithItems>(
        listKeys.detail(listId),
        (old) => {
          if (!old) return old;
          return {
            ...old,
            items: old.items.map((item) =>
              item.is_checked
                ? { ...item, is_checked: false, checked_at: null, checked_by: null }
                : item
            ),
          };
        }
      );

      // Update counts in lists cache (checked count goes to 0)
      updateListCounts(queryClient, listId, {
        checked: -restoredCount,
      });
    },
    onError: () => {
      queryClient.invalidateQueries({ queryKey: listKeys.detail(listId) });
      queryClient.invalidateQueries({ queryKey: listKeys.lists() });
    },
  });
}

/**
 * Hook to reorder items within a list
 */
export function useReorderItems(listId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (itemIds: string[]) => api.reorderItems(listId, itemIds),
    onMutate: async (itemIds) => {
      await queryClient.cancelQueries({ queryKey: listKeys.detail(listId) });

      const previousData = queryClient.getQueryData<ListWithItems>(
        listKeys.detail(listId)
      );

      // Optimistically update sort_order based on new order
      queryClient.setQueryData<ListWithItems>(
        listKeys.detail(listId),
        (old) => {
          if (!old) return old;
          const orderMap = new Map(itemIds.map((id, idx) => [id, idx]));
          return {
            ...old,
            items: old.items.map((item) => {
              const newOrder = orderMap.get(item.id);
              return newOrder !== undefined ? { ...item, sort_order: newOrder } : item;
            }),
          };
        }
      );

      return { previousData };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(
          listKeys.detail(listId),
          context.previousData
        );
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: listKeys.detail(listId) });
    },
  });
}

/**
 * Hook to reorder categories within a list
 */
export function useReorderCategories(listId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (categoryIds: string[]) => api.reorderCategories(listId, categoryIds),
    onMutate: async (categoryIds) => {
      await queryClient.cancelQueries({ queryKey: listKeys.detail(listId) });

      const previousData = queryClient.getQueryData<ListWithItems>(
        listKeys.detail(listId)
      );

      // Optimistically update sort_order on categories
      queryClient.setQueryData<ListWithItems>(
        listKeys.detail(listId),
        (old) => {
          if (!old) return old;
          const orderMap = new Map(categoryIds.map((id, idx) => [id, idx]));
          return {
            ...old,
            categories: old.categories.map((cat: Category) => {
              const newOrder = orderMap.get(cat.id);
              return newOrder !== undefined ? { ...cat, sort_order: newOrder } : cat;
            }),
          };
        }
      );

      return { previousData };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(
          listKeys.detail(listId),
          context.previousData
        );
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: listKeys.detail(listId) });
    },
  });
}
