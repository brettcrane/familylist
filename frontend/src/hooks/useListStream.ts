import { useEffect, useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { listKeys } from './useLists';

/**
 * Hook to establish an SSE connection for real-time list updates.
 *
 * Automatically connects when viewing a list and disconnects on unmount.
 * When events are received, invalidates the list query to fetch fresh data.
 *
 * @param listId - The list ID to subscribe to
 */
export function useListStream(listId: string) {
  const queryClient = useQueryClient();
  const { getToken } = useAuth();
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const reconnectAttempts = useRef(0);

  const connect = useCallback(async () => {
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

    // Try to get JWT token for auth
    if (getToken) {
      try {
        const token = await getToken();
        if (token) {
          url += `?token=${encodeURIComponent(token)}`;
        }
      } catch (error) {
        console.warn('Failed to get auth token for SSE:', error);
        // Continue without token - will fall back to API key if configured
      }
    }

    // If no token, try API key from env
    if (!url.includes('token=')) {
      const apiKey = import.meta.env.VITE_API_KEY;
      if (apiKey) {
        // API key auth is handled via header, but EventSource doesn't support headers
        // The backend will check X-API-Key header which won't be present
        // For now, we'll rely on the backend allowing disabled API key mode
        console.log('SSE: Using API key fallback mode');
      }
    }

    console.log(`SSE: Connecting to ${listId}...`);
    const eventSource = new EventSource(url);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      console.log(`SSE: Connected to list ${listId}`);
      reconnectAttempts.current = 0;
    };

    eventSource.onerror = (error) => {
      console.error(`SSE: Error for list ${listId}:`, error);

      // Close the connection
      eventSource.close();
      eventSourceRef.current = null;

      // Exponential backoff for reconnection
      const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
      reconnectAttempts.current += 1;

      console.log(`SSE: Reconnecting in ${delay}ms (attempt ${reconnectAttempts.current})`);
      reconnectTimeoutRef.current = window.setTimeout(() => {
        connect();
      }, delay);
    };

    // Handle specific event types
    const handleEvent = (eventType: string) => (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        console.log(`SSE: Received ${eventType} event:`, data);

        // Invalidate the list query to fetch fresh data
        queryClient.invalidateQueries({ queryKey: listKeys.detail(listId) });

        // Also invalidate the lists query for count updates
        queryClient.invalidateQueries({ queryKey: listKeys.lists() });
      } catch (error) {
        console.error('SSE: Failed to parse event data:', error);
      }
    };

    // Listen for all event types
    eventSource.addEventListener('connected', (event: MessageEvent) => {
      console.log('SSE: Connection confirmed:', event.data);
    });

    eventSource.addEventListener('item_checked', handleEvent('item_checked'));
    eventSource.addEventListener('item_unchecked', handleEvent('item_unchecked'));
    eventSource.addEventListener('item_created', handleEvent('item_created'));
    eventSource.addEventListener('item_deleted', handleEvent('item_deleted'));
    eventSource.addEventListener('items_cleared', handleEvent('items_cleared'));
    eventSource.addEventListener('items_restored', handleEvent('items_restored'));

    // Generic message handler for any unhandled events
    eventSource.onmessage = (event) => {
      console.log('SSE: Generic message:', event.data);
    };
  }, [listId, getToken, queryClient]);

  // Connect on mount, disconnect on unmount
  useEffect(() => {
    connect();

    return () => {
      console.log(`SSE: Disconnecting from list ${listId}`);

      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }

      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [connect, listId]);

  // Return connection status for debugging
  return {
    isConnected: eventSourceRef.current?.readyState === EventSource.OPEN,
  };
}
