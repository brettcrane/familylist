/**
 * Hook for managing push notification subscriptions.
 */

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  getVapidPublicKey,
  subscribePush,
  getNotificationPreferences,
  updateNotificationPreferences,
  type NotificationPreferences,
  type NotificationPreferencesUpdate,
} from '../api/push';

export interface UsePushNotificationsResult {
  /** Whether push notifications are supported in this browser */
  isSupported: boolean;
  /** Whether push is enabled on the server */
  isEnabled: boolean;
  /** Whether the user has an active push subscription */
  isSubscribed: boolean;
  /** Whether an operation is in progress */
  isLoading: boolean;
  /** Current notification preferences */
  preferences: NotificationPreferences | null;
  /** Error message if something failed */
  error: string | null;
  /** Subscribe to push notifications */
  subscribe: () => Promise<void>;
  /** Unsubscribe from push notifications */
  unsubscribe: () => Promise<void>;
  /** Update notification preferences */
  updatePreferences: (prefs: NotificationPreferencesUpdate) => Promise<void>;
  /** Refresh subscription status */
  refresh: () => Promise<void>;
}

/**
 * Convert a base64 URL-safe string to a Uint8Array.
 * Used for VAPID public key conversion.
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Check if the app is running as an installed PWA (for iOS detection).
 */
function isInstalledPWA(): boolean {
  // Check for standalone display mode
  if (window.matchMedia('(display-mode: standalone)').matches) {
    return true;
  }
  // Check iOS standalone property
  if ((navigator as unknown as { standalone?: boolean }).standalone === true) {
    return true;
  }
  return false;
}

/**
 * Check if we're on iOS without PWA installation.
 */
function isIOSWithoutInstall(): boolean {
  const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
  return isIOS && !isInstalledPWA();
}

export function usePushNotifications(): UsePushNotificationsResult {
  const { isAuthenticated } = useAuth();

  const [isSupported, setIsSupported] = useState(false);
  const [isEnabled, setIsEnabled] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [vapidPublicKey, setVapidPublicKey] = useState<string | null>(null);

  // Check browser support and server configuration
  useEffect(() => {
    const checkSupport = async () => {
      // Check browser support
      const browserSupported =
        'serviceWorker' in navigator &&
        'PushManager' in window &&
        'Notification' in window;

      setIsSupported(browserSupported);

      if (!browserSupported) {
        setIsLoading(false);
        return;
      }

      // Check if iOS requires installation
      if (isIOSWithoutInstall()) {
        setError('Install FamilyLists to your home screen to enable notifications');
        setIsLoading(false);
        return;
      }

      try {
        // Check server configuration
        const vapidResponse = await getVapidPublicKey();
        setIsEnabled(vapidResponse.enabled);
        setVapidPublicKey(vapidResponse.public_key);

        if (!vapidResponse.enabled) {
          setIsLoading(false);
          return;
        }

        // Check existing subscription
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        setIsSubscribed(!!subscription);
      } catch (err) {
        console.error('Failed to check push support:', err);
        setError('Failed to check notification support');
      } finally {
        setIsLoading(false);
      }
    };

    checkSupport();
  }, []);

  // Load preferences when authenticated
  useEffect(() => {
    if (!isAuthenticated || !isEnabled) {
      return;
    }

    const loadPreferences = async () => {
      try {
        const prefs = await getNotificationPreferences();
        setPreferences(prefs);
      } catch (err) {
        console.error('Failed to load notification preferences:', err);
      }
    };

    loadPreferences();
  }, [isAuthenticated, isEnabled]);

  const subscribe = useCallback(async () => {
    if (!isSupported || !isEnabled || !vapidPublicKey) {
      throw new Error('Push notifications not available');
    }

    setIsLoading(true);
    setError(null);

    try {
      // Request notification permission
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        throw new Error('Notification permission denied');
      }

      // Get service worker registration
      const registration = await navigator.serviceWorker.ready;

      // Subscribe to push
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      });

      // Send subscription to server
      const subscriptionJson = subscription.toJSON();
      await subscribePush(subscriptionJson);

      setIsSubscribed(true);
    } catch (err) {
      console.error('Push subscription failed:', err);
      const message = err instanceof Error ? err.message : 'Failed to enable notifications';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [isSupported, isEnabled, vapidPublicKey]);

  const unsubscribe = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        await subscription.unsubscribe();
        // Note: We don't need to call the server - the subscription is now invalid
        // The server will clean it up on the next push attempt (410 Gone response)
      }

      setIsSubscribed(false);
    } catch (err) {
      console.error('Push unsubscription failed:', err);
      const message = err instanceof Error ? err.message : 'Failed to disable notifications';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const updatePrefs = useCallback(async (prefs: NotificationPreferencesUpdate) => {
    setIsLoading(true);
    setError(null);

    try {
      const updated = await updateNotificationPreferences(prefs);
      setPreferences(updated);
    } catch (err) {
      console.error('Failed to update preferences:', err);
      const message = err instanceof Error ? err.message : 'Failed to update preferences';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const refresh = useCallback(async () => {
    if (!isSupported || !isEnabled) {
      return;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      setIsSubscribed(!!subscription);

      if (isAuthenticated) {
        const prefs = await getNotificationPreferences();
        setPreferences(prefs);
      }
    } catch (err) {
      console.error('Failed to refresh push status:', err);
    }
  }, [isSupported, isEnabled, isAuthenticated]);

  return {
    isSupported,
    isEnabled,
    isSubscribed,
    isLoading,
    preferences,
    error,
    subscribe,
    unsubscribe,
    updatePreferences: updatePrefs,
    refresh,
  };
}
