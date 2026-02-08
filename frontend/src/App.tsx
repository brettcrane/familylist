import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, onlineManager, useQueryClient } from '@tanstack/react-query';
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

// Check if Clerk is configured
const isClerkConfigured = !!import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,        // 5 min — list data is fine slightly stale
      gcTime: 24 * 60 * 60 * 1000,      // 24h — keep for offline across sessions
      retry: 1,
      refetchOnWindowFocus: true,
      networkMode: 'offlineFirst',       // Serve cached data immediately, refetch in bg
    },
    mutations: {
      retry: 1,
    },
  },
});

// IndexedDB-backed persister for React Query cache
const persister = createAsyncStoragePersister({
  storage: {
    getItem: (key) => get(key),
    setItem: (key, value) => set(key, value),
    removeItem: (key) => del(key),
  },
  key: 'familylists-query-cache',
  throttleTime: 1000,
});

const persistOptions = {
  persister,
  maxAge: 24 * 60 * 60 * 1000, // 24h
  dehydrateOptions: {
    shouldDehydrateQuery: (query: { state: { status: string }; queryKey: readonly unknown[] }) =>
      query.state.status === 'success' &&
      query.queryKey[0] === 'lists',
  },
};

// Wire React Query's online manager to browser events
onlineManager.setEventListener((setOnline) => {
  const handleOnline = () => setOnline(true);
  const handleOffline = () => setOnline(false);
  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);
  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
  };
});

/** Invalidate all queries when reconnecting */
function useReconnectRefresh() {
  const qc = useQueryClient();
  useEffect(() => {
    return onlineManager.subscribe((online) => {
      if (online) {
        qc.resumePausedMutations().then(() => {
          qc.invalidateQueries();
        });
      }
    });
  }, [qc]);
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

  useReconnectRefresh();

  // Initialize theme on mount
  useEffect(() => {
    initializeTheme();
  }, []);

  return (
    <AuthProvider isAuthReady={isAuthReady}>
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
  useReconnectRefresh();

  // Initialize theme on mount
  useEffect(() => {
    initializeTheme();
  }, []);

  return (
    <FallbackAuthProvider>
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
