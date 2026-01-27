import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as api from '../api';
import type { Item, ItemCreate, ItemUpdate, ItemCheckRequest, ListWithItems } from '../types/api';
import { listKeys } from './useLists';

/**
 * Hook to create a new item
 */
export function useCreateItem(listId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: ItemCreate) => api.createItem(listId, data),
    onSuccess: (response: Item | Item[]) => {
      // API may return single item or array - normalize to single item
      const newItem = Array.isArray(response) ? response[0] : response;
      if (!newItem) return;
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

      return { previousData };
    },
    onError: (_err, _id, context) => {
      // Rollback on error
      if (context?.previousData) {
        queryClient.setQueryData(
          listKeys.detail(listId),
          context.previousData
        );
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

      return { previousData };
    },
    onError: (_err, _id, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(
          listKeys.detail(listId),
          context.previousData
        );
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
    },
  });
}
