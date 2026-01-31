/**
 * Push notification API functions.
 */

import { get, post, del, put } from './client';

export interface VapidPublicKeyResponse {
  public_key: string;
  enabled: boolean;
}

export interface PushSubscriptionResponse {
  id: string;
  endpoint: string;
  created_at: string;
  last_used_at: string | null;
}

export interface NotificationPreferences {
  list_updates: 'always' | 'batched' | 'off';
  list_sharing: 'always' | 'off';
  quiet_start: string | null;
  quiet_end: string | null;
}

export interface NotificationPreferencesUpdate {
  list_updates?: 'always' | 'batched' | 'off';
  list_sharing?: 'always' | 'off';
  quiet_start?: string | null;
  quiet_end?: string | null;
}

/**
 * Get the VAPID public key for Web Push subscription.
 */
export function getVapidPublicKey(): Promise<VapidPublicKeyResponse> {
  return get<VapidPublicKeyResponse>('/push/vapid-public-key');
}

/**
 * Subscribe to push notifications.
 */
export function subscribePush(subscription: PushSubscriptionJSON): Promise<PushSubscriptionResponse> {
  return post<PushSubscriptionResponse>('/push/subscribe', {
    endpoint: subscription.endpoint,
    keys: subscription.keys,
  });
}

/**
 * Unsubscribe from push notifications.
 */
export function unsubscribePush(endpoint: string): Promise<void> {
  return del<void>('/push/unsubscribe');
}

/**
 * List all push subscriptions for the current user.
 */
export function listSubscriptions(): Promise<PushSubscriptionResponse[]> {
  return get<PushSubscriptionResponse[]>('/push/subscriptions');
}

/**
 * Get notification preferences.
 */
export function getNotificationPreferences(): Promise<NotificationPreferences> {
  return get<NotificationPreferences>('/push/preferences');
}

/**
 * Update notification preferences.
 */
export function updateNotificationPreferences(
  prefs: NotificationPreferencesUpdate
): Promise<NotificationPreferences> {
  return put<NotificationPreferences>('/push/preferences', prefs);
}
