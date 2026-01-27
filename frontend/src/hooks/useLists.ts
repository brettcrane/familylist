import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as api from '../api';
import type { List, ListCreate, ListUpdate, ListDuplicateRequest } from '../types/api';

/** Query keys */
export const listKeys = {
  all: ['lists'] as const,
  lists: () => [...listKeys.all, 'list'] as const,
  list: (id: string) => [...listKeys.lists(), id] as const,
  detail: (id: string) => [...listKeys.list(id), 'detail'] as const,
};

/**
 * Hook to fetch all lists
 */
export function useLists() {
  return useQuery({
    queryKey: listKeys.lists(),
    queryFn: ({ signal }) => api.getLists(signal),
  });
}

/**
 * Hook to fetch a single list with items
 */
export function useList(id: string) {
  return useQuery({
    queryKey: listKeys.detail(id),
    queryFn: ({ signal }) => api.getList(id, signal),
    enabled: !!id,
  });
}

/**
 * Hook to create a new list
 */
export function useCreateList() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: ListCreate) => api.createList(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: listKeys.lists() });
    },
  });
}

/**
 * Hook to update a list
 */
export function useUpdateList() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: ListUpdate }) =>
      api.updateList(id, data),
    onSuccess: (updatedList: List) => {
      queryClient.invalidateQueries({ queryKey: listKeys.lists() });
      queryClient.setQueryData(listKeys.detail(updatedList.id), (old: unknown) =>
        old ? { ...old, ...updatedList } : old
      );
    },
  });
}

/**
 * Hook to delete a list
 */
export function useDeleteList() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.deleteList(id),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: listKeys.lists() });
      queryClient.removeQueries({ queryKey: listKeys.detail(id) });
    },
  });
}

/**
 * Hook to duplicate a list
 */
export function useDuplicateList() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: ListDuplicateRequest }) =>
      api.duplicateList(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: listKeys.lists() });
    },
  });
}
