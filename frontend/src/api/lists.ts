import { get, post, put, del } from './client';
import type {
  List,
  ListWithItems,
  ListCreate,
  ListUpdate,
  ListDuplicateRequest,
} from '../types/api';

/**
 * Get all lists
 */
export function getLists(signal?: AbortSignal): Promise<List[]> {
  return get<List[]>('/lists', signal);
}

/**
 * Get a single list with its items and categories
 */
export function getList(id: string, signal?: AbortSignal): Promise<ListWithItems> {
  return get<ListWithItems>(`/lists/${id}`, signal);
}

/**
 * Create a new list
 */
export function createList(data: ListCreate): Promise<List> {
  return post<List>('/lists', data);
}

/**
 * Update a list
 */
export function updateList(id: string, data: ListUpdate): Promise<List> {
  return put<List>(`/lists/${id}`, data);
}

/**
 * Delete a list
 */
export function deleteList(id: string): Promise<void> {
  return del<void>(`/lists/${id}`);
}

/**
 * Duplicate a list
 */
export function duplicateList(
  id: string,
  data: ListDuplicateRequest
): Promise<List> {
  return post<List>(`/lists/${id}/duplicate`, data);
}
