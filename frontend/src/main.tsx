import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ClerkProvider } from '@clerk/clerk-react';
import './index.css';
import App from './App.tsx';

/**
 * Pre-React version gate: if we're running a stale build, reload
 * immediately before mounting React. This catches the common case
 * where the SW serves cached old JS after a deploy. Feels like a
 * slightly slow page load rather than showing stale UI.
 *
 * Loop protection via sessionStorage prevents infinite reloads if
 * version.json is somehow stale after reload.
 */
async function checkVersionAndBoot() {
  if (!import.meta.env.DEV) {
    try {
      const lastReload = sessionStorage.getItem('fl-version-reload');
      const reloadedRecently = lastReload && Date.now() - Number(lastReload) < 60_000;

      if (!reloadedRecently) {
        const res = await fetch(`/version.json?_t=${Date.now()}`, { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          if (data.buildId && data.buildId !== __BUILD_ID__) {
            console.info('[VersionGate] Stale build detected, reloading...', {
              current: __BUILD_ID__,
              server: data.buildId,
            });
            sessionStorage.setItem('fl-version-reload', Date.now().toString());
            window.location.reload();
            return; // Don't mount React
          }
        }
      }
    } catch {
      // Offline or fetch failed — proceed with cached version
    }
  }

  mountApp();
}

function mountApp() {
  // Get Clerk publishable key from environment
  const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

  // Conditionally wrap with ClerkProvider only if key is available
  const Root = clerkPubKey ? (
    <StrictMode>
      <ClerkProvider
        publishableKey={clerkPubKey}
        afterSignOutUrl="/"
        appearance={{
          // Place Clerk styles in the 'clerk' CSS layer for Tailwind v4 compatibility
          cssLayerName: 'clerk',
        }}
      >
        <App />
      </ClerkProvider>
    </StrictMode>
  ) : (
    <StrictMode>
      <App />
    </StrictMode>
  );

  createRoot(document.getElementById('root')!).render(Root);
}

checkVersionAndBoot();
