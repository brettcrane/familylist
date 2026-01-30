import { get, post, patch, del } from './client';
import type {
  ListShare,
  ShareByEmailRequest,
  ShareUpdateRequest,
  User,
} from '../types/api';

/**
 * Get all shares for a list
 */
export function getListShares(listId: string, signal?: AbortSignal): Promise<ListShare[]> {
  return get<ListShare[]>(`/lists/${listId}/shares`, signal);
}

/**
 * Share a list with a user by email
 */
export function shareListByEmail(
  listId: string,
  data: ShareByEmailRequest
): Promise<ListShare> {
  return post<ListShare>(`/lists/${listId}/shares`, data);
}

/**
 * Update a share's permission
 */
export function updateShare(
  listId: string,
  shareId: string,
  data: ShareUpdateRequest
): Promise<ListShare> {
  return patch<ListShare>(`/lists/${listId}/shares/${shareId}`, data);
}

/**
 * Revoke a share (remove user's access)
 */
export function revokeShare(listId: string, shareId: string): Promise<void> {
  return del<void>(`/lists/${listId}/shares/${shareId}`);
}

/**
 * Look up a user by email
 */
export function lookupUserByEmail(email: string, signal?: AbortSignal): Promise<User> {
  return get<User>(`/users/lookup?email=${encodeURIComponent(email)}`, signal);
}
