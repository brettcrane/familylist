import { useState, useEffect, useRef, useCallback } from 'react';

const THROTTLE_MS = 60_000; // min 60s between checks
const POLL_INTERVAL_MS = 10 * 60_000; // poll every 10 min

/**
 * Polls /version.json to detect when a new build has been deployed.
 * Works independently of the service worker lifecycle — reliable on
 * mobile where SW update checks are inconsistent.
 */
export function useVersionCheck() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const lastCheckRef = useRef(0);
  const updateDetectedRef = useRef(false);

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
      const data = await res.json() as { buildId?: string };
      if (data.buildId && data.buildId !== __BUILD_ID__) {
        updateDetectedRef.current = true;
        setUpdateAvailable(true);
      }
    } catch {
      // Offline, 404, network error — silently ignore
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
