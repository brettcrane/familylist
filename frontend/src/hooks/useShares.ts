import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as api from '../api';
import type { ShareByEmailRequest, ShareUpdateRequest } from '../types/api';
import { listKeys } from './useLists';

/** Query keys for shares */
export const shareKeys = {
  all: ['shares'] as const,
  list: (listId: string) => [...shareKeys.all, 'list', listId] as const,
};

/**
 * Hook to fetch shares for a list
 */
export function useListShares(listId: string) {
  return useQuery({
    queryKey: shareKeys.list(listId),
    queryFn: ({ signal }) => api.getListShares(listId, signal),
    enabled: !!listId,
  });
}

/**
 * Hook to share a list by email
 */
export function useShareList(listId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: ShareByEmailRequest) => api.shareListByEmail(listId, data),
    onSuccess: () => {
      // Invalidate shares for this list
      queryClient.invalidateQueries({ queryKey: shareKeys.list(listId) });
      // Invalidate lists to update share_count
      queryClient.invalidateQueries({ queryKey: listKeys.lists() });
    },
  });
}

/**
 * Hook to update a share's permission
 */
export function useUpdateShare(listId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ shareId, data }: { shareId: string; data: ShareUpdateRequest }) =>
      api.updateShare(listId, shareId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: shareKeys.list(listId) });
    },
  });
}

/**
 * Hook to revoke a share
 */
export function useRevokeShare(listId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (shareId: string) => api.revokeShare(listId, shareId),
    onSuccess: () => {
      // Invalidate shares for this list
      queryClient.invalidateQueries({ queryKey: shareKeys.list(listId) });
      // Invalidate lists to update share_count
      queryClient.invalidateQueries({ queryKey: listKeys.lists() });
    },
  });
}

/**
 * Hook to look up a user by email
 */
export function useLookupUser() {
  return useMutation({
    mutationFn: (email: string) => api.lookupUserByEmail(email),
  });
}
