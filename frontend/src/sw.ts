/// <reference lib="webworker" />
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching';
import { clientsClaim } from 'workbox-core';
import { registerRoute } from 'workbox-routing';
import { NetworkFirst, NetworkOnly } from 'workbox-strategies';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';
import { ExpirationPlugin } from 'workbox-expiration';

declare let self: ServiceWorkerGlobalScope;

// Claim clients immediately
self.skipWaiting();
clientsClaim();

// Precache and route assets
cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

// ============================================================================
// version.json — always bypass cache (used for update detection)
// ============================================================================

registerRoute(
  ({ url }) => url.pathname === '/version.json',
  new NetworkOnly()
);

// ============================================================================
// API Caching — Network-First for offline reads (3s network timeout before cache fallback)
// ============================================================================

registerRoute(
  ({ url, request }) =>
    url.pathname.startsWith('/api/') &&
    !url.pathname.includes('/stream') &&
    request.method === 'GET',
  new NetworkFirst({
    cacheName: 'familylists-api-cache',
    networkTimeoutSeconds: 3,
    plugins: [
      new CacheableResponsePlugin({ statuses: [200] }),
      new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 86400 }),
    ],
  })
);

// Allow the app to clear the API cache (e.g. on logout)
self.addEventListener('message', (event) => {
  if (event.data?.type === 'CLEAR_API_CACHE') {
    event.waitUntil(
      caches.delete('familylists-api-cache').catch((e) => {
        console.error('Service worker failed to delete API cache:', e);
      })
    );
  }
});

// ============================================================================
// Push Notification Handling
// ============================================================================

interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  renotify?: boolean;
  data?: {
    list_id?: string;
    [key: string]: unknown;
  };
}

self.addEventListener('push', (event: PushEvent) => {
  // Fallback notification for when data is missing or malformed
  const showFallbackNotification = () => {
    return self.registration.showNotification('FamilyList', {
      body: 'A list was updated',
      icon: '/icons/icon-192.png',
      badge: '/icons/badge-72.png',
      tag: 'familylist-fallback',
    });
  };

  if (!event.data) {
    console.log('Push event received but no data');
    event.waitUntil(showFallbackNotification());
    return;
  }

  let payload: PushPayload;
  try {
    payload = event.data.json() as PushPayload;
  } catch (e) {
    console.error('Failed to parse push data:', e);
    event.waitUntil(showFallbackNotification());
    return;
  }

  const options = {
    body: payload.body,
    icon: payload.icon || '/icons/icon-192.png',
    badge: payload.badge || '/icons/badge-72.png',
    tag: payload.tag || 'familylist',
    renotify: payload.renotify !== false,
    data: payload.data || {},
    // Action buttons (not supported everywhere but degrades gracefully)
    actions: [
      { action: 'open', title: 'Open List' },
      { action: 'dismiss', title: 'Dismiss' },
    ],
  } as NotificationOptions;

  event.waitUntil(
    self.registration.showNotification(payload.title, options).catch((e) => {
      console.error('Failed to show notification:', e);
      // Attempt minimal fallback notification
      return self.registration.showNotification('FamilyList', {
        body: payload.body || 'A list was updated',
        tag: 'familylist-error-fallback',
      });
    })
  );
});

self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close();

  // Handle dismiss action
  if (event.action === 'dismiss') {
    return;
  }

  // Get the list ID from notification data
  const listId = event.notification.data?.list_id;
  const url = listId ? `/lists/${listId}` : '/';

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Try to focus an existing window
        for (const client of clientList) {
          if (client.url.includes(url) && 'focus' in client) {
            return client.focus();
          }
        }
        // Open new window
        if (self.clients.openWindow) {
          return self.clients.openWindow(url);
        }
      })
      .catch((e) => {
        console.error('Failed to handle notification click:', e);
      })
  );
});

// Handle notification close (for analytics/debugging)
self.addEventListener('notificationclose', (event: NotificationEvent) => {
  console.log('Notification closed:', event.notification.tag);
});
