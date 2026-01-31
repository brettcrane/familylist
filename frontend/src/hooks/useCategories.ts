import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createCategory, deleteCategory, updateCategory } from '../api/categories';
import type { CategoryCreate, CategoryUpdate } from '../types/api';

/**
 * Hook for creating a new category
 */
export function useCreateCategory(listId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CategoryCreate) => createCategory(listId, data),
    onSuccess: () => {
      // Invalidate list query to refresh categories
      queryClient.invalidateQueries({ queryKey: ['lists', 'list', listId] });
    },
  });
}

/**
 * Hook for updating a category
 */
export function useUpdateCategory(listId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: CategoryUpdate }) =>
      updateCategory(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lists', 'list', listId] });
    },
  });
}

/**
 * Hook for deleting a category
 */
export function useDeleteCategory(listId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (categoryId: string) => deleteCategory(categoryId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lists', 'list', listId] });
    },
  });
}
