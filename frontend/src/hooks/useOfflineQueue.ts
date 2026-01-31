import { useEffect, useCallback, useRef } from 'react';
import { useQueryClient, onlineManager } from '@tanstack/react-query';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { apiRequest } from '../api/client';

/** Pending mutation type */
export interface PendingMutation {
  id: string;
  type: 'create' | 'update' | 'delete' | 'check' | 'uncheck';
  endpoint: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  timestamp: number;
  listId?: string;
  itemId?: string;
}

/** Offline queue store */
interface OfflineQueueStore {
  pendingMutations: PendingMutation[];
  addMutation: (mutation: Omit<PendingMutation, 'id' | 'timestamp'>) => string;
  removeMutation: (id: string) => void;
  clearMutations: () => void;
  getMutationsForItem: (itemId: string) => PendingMutation[];
  /** Track if sync is paused due to auth issues */
  syncPaused: boolean;
  setSyncPaused: (paused: boolean) => void;
}

/**
 * Zustand store for offline mutation queue
 * Persisted to localStorage for offline resilience
 */
export const useOfflineQueueStore = create<OfflineQueueStore>()(
  persist(
    (set, get) => ({
      pendingMutations: [],
      syncPaused: false,

      addMutation: (mutation) => {
        const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const newMutation: PendingMutation = {
          ...mutation,
          id,
          timestamp: Date.now(),
        };
        set((state) => ({
          pendingMutations: [...state.pendingMutations, newMutation],
        }));
        return id;
      },

      removeMutation: (id) => {
        set((state) => ({
          pendingMutations: state.pendingMutations.filter((m) => m.id !== id),
        }));
      },

      clearMutations: () => {
        set({ pendingMutations: [] });
      },

      getMutationsForItem: (itemId) => {
        return get().pendingMutations.filter((m) => m.itemId === itemId);
      },

      setSyncPaused: (paused) => {
        set({ syncPaused: paused });
      },
    }),
    {
      name: 'familylists-offline-queue',
      partialize: (state) => ({
        pendingMutations: state.pendingMutations,
      }),
    }
  )
);

/**
 * Hook to check if an item has pending mutations
 */
export function useHasPendingMutation(itemId: string): boolean {
  return useOfflineQueueStore(
    (state) => state.pendingMutations.some((m) => m.itemId === itemId)
  );
}

/**
 * Hook to manage offline queue synchronization
 */
export function useOfflineSync() {
  const queryClient = useQueryClient();
  const { pendingMutations, removeMutation, syncPaused, setSyncPaused } =
    useOfflineQueueStore();
  const isSyncing = useRef(false);

  const syncMutations = useCallback(async () => {
    if (isSyncing.current || pendingMutations.length === 0) return;
    if (!navigator.onLine) return;
    if (syncPaused) return;

    isSyncing.current = true;

    for (const mutation of pendingMutations) {
      try {
        // Use apiRequest which handles auth tokens automatically
        // This ensures we get a fresh token for each sync attempt
        await apiRequest(mutation.endpoint, {
          method: mutation.method,
          body: mutation.body,
        });

        removeMutation(mutation.id);

        // Invalidate relevant queries
        if (mutation.listId) {
          queryClient.invalidateQueries({
            queryKey: ['lists', 'list', mutation.listId],
          });
        }
      } catch (error) {
        console.error('Failed to sync mutation:', mutation.id, error);

        // Check if it's an auth error (401)
        if (error && typeof error === 'object' && 'status' in error) {
          const apiError = error as { status: number };
          if (apiError.status === 401) {
            // Auth failed - pause sync until user re-authenticates
            console.warn('Auth token expired during sync. Pausing queue.');
            setSyncPaused(true);
            break;
          }
        }

        // For other errors, stop syncing and retry later
        break;
      }
    }

    isSyncing.current = false;
  }, [pendingMutations, removeMutation, queryClient, syncPaused, setSyncPaused]);

  // Sync when coming back online
  useEffect(() => {
    const handleOnline = () => {
      syncMutations();
    };

    window.addEventListener('online', handleOnline);

    // Also sync on mount if online
    if (navigator.onLine) {
      syncMutations();
    }

    return () => {
      window.removeEventListener('online', handleOnline);
    };
  }, [syncMutations]);

  // Configure TanStack Query online manager
  useEffect(() => {
    onlineManager.setEventListener((setOnline) => {
      const handleOnline = () => setOnline(true);
      const handleOffline = () => setOnline(false);

      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);

      return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      };
    });
  }, []);

  // Resume sync when auth is restored (syncPaused becomes false)
  useEffect(() => {
    if (!syncPaused && pendingMutations.length > 0 && navigator.onLine) {
      syncMutations();
    }
  }, [syncPaused, pendingMutations.length, syncMutations]);

  /* eslint-disable react-hooks/refs -- isSyncing.current is intentional: snapshot for status display */
  return {
    pendingCount: pendingMutations.length,
    isSyncing: isSyncing.current,
    syncPaused,
    syncNow: syncMutations,
    resumeSync: () => setSyncPaused(false),
  };
  /* eslint-enable react-hooks/refs */
}

/**
 * Hook to check online status
 */
export function useOnlineStatus() {
  const queryClient = useQueryClient();
  const isOnline = onlineManager.isOnline();

  useEffect(() => {
    return onlineManager.subscribe((online) => {
      if (online) {
        // Refetch queries when coming back online
        queryClient.resumePausedMutations().then(() => {
          queryClient.invalidateQueries();
        });
      }
    });
  }, [queryClient]);

  return isOnline;
}
