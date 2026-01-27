import { get, post, put, del } from './client';
import type { Item, ItemCreate, ItemBatchCreate, ItemUpdate, ItemCheckRequest } from '../types/api';

/**
 * Get all items for a list
 */
export function getItems(
  listId: string,
  status?: 'all' | 'checked' | 'unchecked',
  signal?: AbortSignal
): Promise<Item[]> {
  const params = status ? `?status=${status}` : '';
  return get<Item[]>(`/lists/${listId}/items${params}`, signal);
}

/**
 * Create a single item
 */
export function createItem(listId: string, data: ItemCreate): Promise<Item> {
  return post<Item>(`/lists/${listId}/items`, data);
}

/**
 * Create multiple items at once
 */
export function createItems(
  listId: string,
  data: ItemBatchCreate
): Promise<Item[]> {
  return post<Item[]>(`/lists/${listId}/items/batch`, data);
}

/**
 * Update an item
 */
export function updateItem(id: string, data: ItemUpdate): Promise<Item> {
  return put<Item>(`/items/${id}`, data);
}

/**
 * Delete an item
 */
export function deleteItem(id: string): Promise<void> {
  return del<void>(`/items/${id}`);
}

/**
 * Check an item (mark as done)
 */
export function checkItem(id: string, data?: ItemCheckRequest): Promise<Item> {
  return post<Item>(`/items/${id}/check`, data);
}

/**
 * Uncheck an item (mark as not done)
 */
export function uncheckItem(id: string): Promise<Item> {
  return post<Item>(`/items/${id}/uncheck`);
}

/**
 * Clear all completed items from a list
 */
export function clearCompleted(listId: string): Promise<void> {
  return post<void>(`/lists/${listId}/clear`);
}

/**
 * Reorder items within a list/category
 */
export function reorderItems(
  listId: string,
  itemIds: string[]
): Promise<void> {
  return post<void>(`/lists/${listId}/items/reorder`, { item_ids: itemIds });
}
