import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Detects when a new service worker has taken control (via skipWaiting +
 * clientsClaim), meaning updated assets are cached but the running page
 * still references stale JS/CSS bundles. Shows a reload prompt so the
 * user can load the new assets at a convenient time.
 *
 * Also nudges the browser to check for SW updates when the app is
 * foregrounded (mobile browsers are unreliable about automatic checks).
 */
export function useServiceWorkerUpdate() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const hadControllerRef = useRef(false);

  const applyUpdate = useCallback(() => {
    window.location.reload();
  }, []);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    try {
      // Record whether we already had a controlling SW (null on first
      // install or hard refresh)
      hadControllerRef.current = !!navigator.serviceWorker.controller;

      const onControllerChange = () => {
        // Only show banner if we had a controller before — on first install
        // the page was loaded from the network (not a stale SW cache), so
        // there's no version mismatch to resolve.
        if (hadControllerRef.current) {
          console.info('[SW] New service worker took control — update available');
          setUpdateAvailable(true);
        }
      };

      // Nudge browser to check for SW updates when the app is foregrounded
      const onVisibilityChange = () => {
        if (document.visibilityState === 'visible') {
          navigator.serviceWorker.getRegistration().then((reg) => {
            reg?.update().catch(() => {
              // Network error or no SW registered — ignore
            });
          }).catch(() => {
            // getRegistration failed — ignore
          });
        }
      };

      navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);
      document.addEventListener('visibilitychange', onVisibilityChange);

      return () => {
        navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
        document.removeEventListener('visibilitychange', onVisibilityChange);
      };
    } catch (err) {
      console.warn('[useServiceWorkerUpdate] Failed to set up SW update listener:', err);
    }
  }, []);

  return { updateAvailable, applyUpdate };
}
