import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, useQueryClient, onlineManager } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { get, set, del } from 'idb-keyval';
import {
  SignedIn,
  SignedOut,
  ClerkLoaded,
  ClerkLoading,
} from '@clerk/clerk-react';
import { HomePage, ListPage, SignInPage, SignUpPage } from './pages';
import { ErrorBoundary } from './components/ui';
import { ToastContainer } from './components/ui/Toast';
import { initializeTheme } from './stores/uiStore';
import { useAuthSetup } from './hooks/useAuthSetup';
import {
  AuthProvider,
  FallbackAuthProvider,
} from './contexts/AuthContext';
import { useServiceWorkerUpdate } from './hooks/useServiceWorkerUpdate';
import { useVersionCheck } from './hooks/useVersionCheck';
import { UpdateBanner } from './components/ui/UpdateBanner';

// Check if Clerk is configured
const isClerkConfigured = !!import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,        // 5 min — list data is fine slightly stale
      gcTime: ONE_DAY_MS,               // 24h — keep for offline across sessions
      retry: 1,
      refetchOnWindowFocus: true,
      networkMode: 'offlineFirst',       // Allow queries to fire even when offline (use cache instead of pausing)
    },
    mutations: {
      retry: 1,
    },
  },
});

// IndexedDB-backed persister for React Query cache
const persister = createAsyncStoragePersister({
  storage: {
    getItem: (key) => get(key).catch((e) => {
      console.warn('IndexedDB read failed, falling back to memory-only cache:', e);
      return null;
    }),
    setItem: (key, value) => set(key, value).catch((e) => {
      console.warn('IndexedDB write failed:', e);
    }),
    removeItem: (key) => del(key).catch((e) => {
      console.warn('IndexedDB delete failed:', e);
    }),
  },
  key: 'familylists-query-cache',
  throttleTime: 1000,
});

const persistOptions = {
  persister,
  maxAge: ONE_DAY_MS,
  dehydrateOptions: {
    // Persist all list-related queries (list index + individual list details with items)
    shouldDehydrateQuery: (query: { state: { status: string }; queryKey: readonly unknown[] }) =>
      query.state.status === 'success' &&
      query.queryKey[0] === 'lists',
  },
};

/**
 * Auto-reload the page when the user backgrounds and foregrounds the app
 * after a new version has been detected. This ensures users always run
 * the latest code without needing to manually click "Reload".
 *
 * Loop protection via sessionStorage prevents infinite reloads if
 * version.json is somehow stale after reload.
 */
function useAutoReloadOnUpdate(updateAvailable: boolean) {
  useEffect(() => {
    if (!updateAvailable) return;

    // Loop protection: don't reload more than once per 60s
    const lastReload = sessionStorage.getItem('fl-auto-reload');
    if (lastReload && Date.now() - parseInt(lastReload) < 60_000) return;

    // Reload on next hidden→visible transition
    let wasHidden = document.visibilityState === 'hidden';
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        wasHidden = true;
      } else if (wasHidden) {
        sessionStorage.setItem('fl-auto-reload', Date.now().toString());
        window.location.reload();
      }
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [updateAvailable]);
}

/** Invalidate all queries when the browser reconnects to the network. */
function useReconnectRefresh(): void {
  const client = useQueryClient();
  useEffect(() => {
    return onlineManager.subscribe((isOnline) => {
      if (isOnline) {
        client.invalidateQueries();
      }
    });
  }, [client]);
}

function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg-primary)]">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--color-accent)] mx-auto" />
        <p className="mt-4 text-[var(--color-text-secondary)]">Loading...</p>
      </div>
    </div>
  );
}

/**
 * App content with Clerk authentication.
 */
function ClerkAppContent() {
  // Set up auth token injection for API requests
  const { isAuthReady } = useAuthSetup();
  const { updateAvailable: swUpdate, applyUpdate } = useServiceWorkerUpdate();
  const { updateAvailable: versionUpdate } = useVersionCheck();
  const updateAvailable = swUpdate || versionUpdate;

  useAutoReloadOnUpdate(updateAvailable);
  useReconnectRefresh();

  // Initialize theme on mount
  useEffect(() => {
    initializeTheme();
  }, []);

  return (
    <AuthProvider isAuthReady={isAuthReady}>
      {updateAvailable && <UpdateBanner onReload={applyUpdate} />}
      <Routes>
        {/* Public routes */}
        <Route path="/sign-in/*" element={<SignInPage />} />
        <Route path="/sign-up/*" element={<SignUpPage />} />

        {/* Protected routes */}
        <Route
          path="/"
          element={
            <>
              <SignedIn>
                <HomePage />
              </SignedIn>
              <SignedOut>
                <Navigate to="/sign-in" replace />
              </SignedOut>
            </>
          }
        />
        <Route
          path="/lists/:id"
          element={
            <>
              <SignedIn>
                <ListPage />
              </SignedIn>
              <SignedOut>
                <Navigate to="/sign-in" replace />
              </SignedOut>
            </>
          }
        />
      </Routes>
      <ToastContainer />
    </AuthProvider>
  );
}

/**
 * App content without Clerk (API key mode).
 */
function FallbackAppContent() {
  const { updateAvailable: swUpdate, applyUpdate } = useServiceWorkerUpdate();
  const { updateAvailable: versionUpdate } = useVersionCheck();
  const updateAvailable = swUpdate || versionUpdate;

  useAutoReloadOnUpdate(updateAvailable);
  useReconnectRefresh();

  // Initialize theme on mount
  useEffect(() => {
    initializeTheme();
  }, []);

  return (
    <FallbackAuthProvider>
      {updateAvailable && <UpdateBanner onReload={applyUpdate} />}
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/lists/:id" element={<ListPage />} />
        {/* Redirect auth routes to home in API key mode */}
        <Route path="/sign-in/*" element={<Navigate to="/" replace />} />
        <Route path="/sign-up/*" element={<Navigate to="/" replace />} />
      </Routes>
      <ToastContainer />
    </FallbackAuthProvider>
  );
}

function App() {
  if (isClerkConfigured) {
    return (
      <ErrorBoundary>
        <PersistQueryClientProvider client={queryClient} persistOptions={persistOptions}>
          <BrowserRouter>
            <ClerkLoading>
              <LoadingScreen />
            </ClerkLoading>
            <ClerkLoaded>
              <ClerkAppContent />
            </ClerkLoaded>
          </BrowserRouter>
        </PersistQueryClientProvider>
      </ErrorBoundary>
    );
  }

  // Fallback mode without Clerk
  return (
    <ErrorBoundary>
      <PersistQueryClientProvider client={queryClient} persistOptions={persistOptions}>
        <BrowserRouter>
          <FallbackAppContent />
        </BrowserRouter>
      </PersistQueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
