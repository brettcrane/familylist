import { get, post, put, del } from './client';
import type { Category, CategoryCreate, CategoryUpdate } from '../types/api';

/**
 * Get all categories for a list
 */
export function getCategories(
  listId: string,
  signal?: AbortSignal
): Promise<Category[]> {
  return get<Category[]>(`/lists/${listId}/categories`, signal);
}

/**
 * Create a new category
 */
export function createCategory(
  listId: string,
  data: CategoryCreate
): Promise<Category> {
  return post<Category>(`/lists/${listId}/categories`, data);
}

/**
 * Update a category
 */
export function updateCategory(
  id: string,
  data: CategoryUpdate
): Promise<Category> {
  return put<Category>(`/categories/${id}`, data);
}

/**
 * Delete a category
 */
export function deleteCategory(id: string): Promise<void> {
  return del<void>(`/categories/${id}`);
}

/**
 * Reorder categories within a list
 */
export function reorderCategories(
  listId: string,
  categoryIds: string[]
): Promise<void> {
  return post<void>(`/lists/${listId}/categories/reorder`, {
    category_ids: categoryIds,
  });
}
