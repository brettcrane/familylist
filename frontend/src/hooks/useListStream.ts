import { useEffect, useRef, useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { listKeys } from './useLists';

/** Maximum reconnection attempts before giving up */
const MAX_RECONNECT_ATTEMPTS = 10;

/** Base delay for exponential backoff (ms) */
const BASE_RECONNECT_DELAY = 1000;

/** Maximum delay between reconnection attempts (ms) */
const MAX_RECONNECT_DELAY = 30000;

/** Debounce delay for query invalidation (ms) */
const INVALIDATION_DEBOUNCE = 500;

export interface UseListStreamOptions {
  /** Whether SSE should be enabled (e.g., only when auth is ready) */
  enabled?: boolean;
}

export interface UseListStreamResult {
  /** Whether the SSE connection is currently open */
  isConnected: boolean;
  /** Whether reconnection attempts have been exhausted */
  isFailed: boolean;
  /** Number of reconnection attempts made */
  reconnectAttempts: number;
  /** Manually retry the connection */
  retry: () => void;
}

/**
 * Hook to establish an SSE connection for real-time list updates.
 *
 * Automatically connects when viewing a list and disconnects on unmount.
 * When events are received, invalidates the list query to fetch fresh data.
 *
 * @param listId - The list ID to subscribe to (null to disable)
 * @param options - Configuration options
 */
export function useListStream(
  listId: string | null,
  options: UseListStreamOptions = {}
): UseListStreamResult {
  const { enabled = true } = options;
  const queryClient = useQueryClient();
  const { getToken } = useAuth();

  const [isConnected, setIsConnected] = useState(false);
  const [isFailed, setIsFailed] = useState(false);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);

  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const invalidationTimeoutRef = useRef<number | null>(null);

  /**
   * Debounced query invalidation to avoid excessive HTTP requests
   * when multiple events arrive in quick succession.
   */
  const invalidateQueries = useCallback(
    (targetListId: string) => {
      // Clear any pending invalidation
      if (invalidationTimeoutRef.current) {
        clearTimeout(invalidationTimeoutRef.current);
      }

      // Debounce the invalidation
      invalidationTimeoutRef.current = window.setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: listKeys.detail(targetListId) });
        queryClient.invalidateQueries({ queryKey: listKeys.lists() });
      }, INVALIDATION_DEBOUNCE);
    },
    [queryClient]
  );

  const connect = useCallback(async () => {
    if (!listId || !enabled) {
      return;
    }

    // Don't reconnect if already connected
    if (eventSourceRef.current?.readyState === EventSource.OPEN) {
      return;
    }

    // Close any existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    // Build URL with auth token
    let url = `/api/lists/${listId}/stream`;

    // Get JWT token for auth
    if (getToken) {
      try {
        const token = await getToken();
        if (token) {
          url += `?token=${encodeURIComponent(token)}`;
        } else {
          // No token available - SSE may fail with 401 unless API key is disabled
          console.warn('SSE: No auth token available, connection may fail');
        }
      } catch (error) {
        console.error('SSE: Failed to get auth token:', error);
        // Continue without token - will fail with 401 and trigger reconnect
      }
    }

    console.log(`SSE: Connecting to list ${listId}...`);
    const eventSource = new EventSource(url);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      console.log(`SSE: Connected to list ${listId}`);
      setIsConnected(true);
      setIsFailed(false);
      setReconnectAttempts(0);
    };

    eventSource.onerror = () => {
      console.error(`SSE: Connection error for list ${listId}`);
      setIsConnected(false);

      // Close the connection
      eventSource.close();
      eventSourceRef.current = null;

      setReconnectAttempts((prev) => {
        const attempts = prev + 1;

        if (attempts >= MAX_RECONNECT_ATTEMPTS) {
          console.error(
            `SSE: Max reconnection attempts (${MAX_RECONNECT_ATTEMPTS}) reached for list ${listId}`
          );
          setIsFailed(true);
          return attempts;
        }

        // Exponential backoff with jitter to prevent thundering herd
        const baseDelay = Math.min(
          BASE_RECONNECT_DELAY * Math.pow(2, attempts - 1),
          MAX_RECONNECT_DELAY
        );
        const jitter = Math.random() * 1000; // 0-1000ms random jitter
        const delay = baseDelay + jitter;

        console.log(`SSE: Reconnecting in ${Math.round(delay)}ms (attempt ${attempts})`);
        reconnectTimeoutRef.current = window.setTimeout(() => {
          connect();
        }, delay);

        return attempts;
      });
    };

    // Handle specific event types
    const handleEvent = (eventType: string) => (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        console.log(`SSE: Received ${eventType} event:`, data);

        // Debounced invalidation to avoid hammering the server
        invalidateQueries(listId);
      } catch (error) {
        console.error('SSE: Failed to parse event data:', {
          error,
          eventType,
          rawData: event.data,
        });
      }
    };

    // Listen for connection confirmation
    eventSource.addEventListener('connected', (event: MessageEvent) => {
      console.log('SSE: Connection confirmed:', event.data);
    });

    // Listen for all event types
    eventSource.addEventListener('item_checked', handleEvent('item_checked'));
    eventSource.addEventListener('item_unchecked', handleEvent('item_unchecked'));
    eventSource.addEventListener('item_created', handleEvent('item_created'));
    eventSource.addEventListener('item_updated', handleEvent('item_updated'));
    eventSource.addEventListener('item_deleted', handleEvent('item_deleted'));
    eventSource.addEventListener('items_cleared', handleEvent('items_cleared'));
    eventSource.addEventListener('items_restored', handleEvent('items_restored'));
  }, [listId, enabled, getToken, invalidateQueries]);

  const retry = useCallback(() => {
    setIsFailed(false);
    setReconnectAttempts(0);
    connect();
  }, [connect]);

  // Connect on mount/change, disconnect on unmount
  useEffect(() => {
    if (listId && enabled) {
      connect();
    }

    return () => {
      console.log(`SSE: Cleaning up connection for list ${listId}`);

      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }

      if (invalidationTimeoutRef.current) {
        clearTimeout(invalidationTimeoutRef.current);
        invalidationTimeoutRef.current = null;
      }

      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }

      setIsConnected(false);
    };
  }, [connect, listId, enabled]);

  return {
    isConnected,
    isFailed,
    reconnectAttempts,
    retry,
  };
}
