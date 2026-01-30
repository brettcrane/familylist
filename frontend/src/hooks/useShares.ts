import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as api from '../api';
import type { ShareByEmailRequest, ShareUpdateRequest } from '../types/api';
import { listKeys } from './useLists';
import { useAuth } from '../contexts/AuthContext';

/** Query keys for shares */
export const shareKeys = {
  all: ['shares'] as const,
  list: (listId: string) => [...shareKeys.all, 'list', listId] as const,
  currentUser: ['currentUser'] as const,
};

/**
 * Hook to fetch shares for a list
 */
export function useListShares(listId: string | undefined) {
  return useQuery({
    queryKey: shareKeys.list(listId ?? ''),
    queryFn: ({ signal }) => {
      if (!listId) {
        return Promise.reject(new Error('listId is required'));
      }
      return api.getListShares(listId, signal);
    },
    enabled: !!listId,
  });
}

/**
 * Hook to share a list by email
 */
export function useShareList(listId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: ShareByEmailRequest) => {
      if (!listId) {
        return Promise.reject(new Error('listId is required to share a list'));
      }
      return api.shareListByEmail(listId, data);
    },
    onSuccess: () => {
      if (listId) {
        // Invalidate shares for this list
        queryClient.invalidateQueries({ queryKey: shareKeys.list(listId) });
        // Invalidate lists to update share_count
        queryClient.invalidateQueries({ queryKey: listKeys.lists() });
      }
    },
    onError: (error) => {
      console.error('useShareList mutation failed:', { listId, error });
    },
  });
}

/**
 * Hook to update a share's permission
 */
export function useUpdateShare(listId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ shareId, data }: { shareId: string; data: ShareUpdateRequest }) => {
      if (!listId) {
        return Promise.reject(new Error('listId is required to update a share'));
      }
      return api.updateShare(listId, shareId, data);
    },
    onSuccess: () => {
      if (listId) {
        queryClient.invalidateQueries({ queryKey: shareKeys.list(listId) });
      }
    },
    onError: (error) => {
      console.error('useUpdateShare mutation failed:', { listId, error });
    },
  });
}

/**
 * Hook to revoke a share
 */
export function useRevokeShare(listId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (shareId: string) => {
      if (!listId) {
        return Promise.reject(new Error('listId is required to revoke a share'));
      }
      return api.revokeShare(listId, shareId);
    },
    onSuccess: () => {
      if (listId) {
        // Invalidate shares for this list
        queryClient.invalidateQueries({ queryKey: shareKeys.list(listId) });
        // Invalidate lists to update share_count
        queryClient.invalidateQueries({ queryKey: listKeys.lists() });
      }
    },
    onError: (error) => {
      console.error('useRevokeShare mutation failed:', { listId, error });
    },
  });
}

/**
 * Hook to get the current authenticated user's info from the backend.
 * Only fetches when user is signed in via Clerk - API key auth doesn't have a "current user".
 */
export function useCurrentUser() {
  const { isSignedIn, isLoaded } = useAuth();

  return useQuery({
    queryKey: shareKeys.currentUser,
    queryFn: ({ signal }) => api.getCurrentUser(signal),
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    // Only fetch when signed in via Clerk - API key mode doesn't have user identity
    enabled: isLoaded && isSignedIn,
    // Don't retry on auth errors - 401 means the endpoint requires Clerk auth
    retry: (failureCount, error) => {
      // Don't retry on 401/403 - these are authorization failures, not transient
      if (error && typeof error === 'object' && 'status' in error) {
        const status = (error as { status: number }).status;
        if (status === 401 || status === 403) {
          return false;
        }
      }
      return failureCount < 3;
    },
  });
}
