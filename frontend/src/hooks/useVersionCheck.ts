import { useState, useEffect, useRef, useCallback } from 'react';

const THROTTLE_MS = 15_000; // min 15s between checks
const POLL_INTERVAL_MS = 2 * 60_000; // poll every 2 min

/**
 * Polls /version.json to detect when a new build has been deployed.
 * Works independently of the service worker lifecycle — reliable on
 * mobile where SW update checks are inconsistent.
 */
export function useVersionCheck() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const lastCheckRef = useRef(0);
  const updateDetectedRef = useRef(false);
  const loggedRef = useRef(false);

  const checkVersion = useCallback(async () => {
    // version.json only exists in production builds
    if (import.meta.env.DEV) return;
    // Already detected — no need to keep polling
    if (updateDetectedRef.current) return;
    // Throttle: skip if we checked recently
    const now = Date.now();
    if (now - lastCheckRef.current < THROTTLE_MS) return;
    lastCheckRef.current = now;

    try {
      const res = await fetch(`/version.json?_t=${now}`, { cache: 'no-store' });
      if (!res.ok) return;
      let data: { buildId?: string };
      try {
        data = await res.json();
      } catch (parseErr) {
        console.warn('[VersionCheck] Failed to parse version.json response:', parseErr);
        return;
      }
      if (data.buildId && data.buildId !== __BUILD_ID__) {
        updateDetectedRef.current = true;
        if (!loggedRef.current) {
          console.info('[VersionCheck] New build detected:', data.buildId, '(current:', __BUILD_ID__ + ')');
          loggedRef.current = true;
        }
        setUpdateAvailable(true);
      }
    } catch {
      // Network error or offline — expected, silently ignore
    }
  }, []);

  useEffect(() => {
    // Check when app is foregrounded
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkVersion();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    // Initial check after a short delay (avoids synchronous setState in effect body)
    const mountTimeout = setTimeout(checkVersion, 1000);

    // Periodic poll
    const interval = setInterval(checkVersion, POLL_INTERVAL_MS);

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      clearTimeout(mountTimeout);
      clearInterval(interval);
    };
  }, [checkVersion]);

  return { updateAvailable };
}
