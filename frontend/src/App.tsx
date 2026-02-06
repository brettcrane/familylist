import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  SignedIn,
  SignedOut,
  useAuth as useClerkAuth,
} from '@clerk/clerk-react';
import { HomePage, ListPage, SignInPage, SignUpPage } from './pages';
import { ErrorBoundary } from './components/ui';
import { ToastContainer } from './components/ui/Toast';
import { initializeTheme } from './stores/uiStore';
import { useOfflineSync } from './hooks/useOfflineQueue';
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
      staleTime: 1000 * 60, // 1 minute
      retry: 1,
      refetchOnWindowFocus: true,
    },
    mutations: {
      retry: 1,
    },
  },
});

/** How long to wait for Clerk before falling back to API key mode (ms). */
const CLERK_LOAD_TIMEOUT_MS = 8000;
/** Show "taking longer" hint after this many ms. */
const CLERK_SLOW_THRESHOLD_MS = 3000;

function LoadingScreen({ slow = false }: { slow?: boolean }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg-primary)]">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--color-accent)] mx-auto" />
        <p className="mt-4 text-[var(--color-text-secondary)]">Loading...</p>
        {slow && (
          <p className="mt-2 text-sm text-[var(--color-text-muted)]">
            Taking longer than usual...
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * Gate that waits for Clerk to load, with a timeout fallback.
 *
 * If Clerk's SDK doesn't load within CLERK_LOAD_TIMEOUT_MS (e.g. its CDN
 * is unreachable on certain networks), we fall back to FallbackAppContent
 * so the user can still see their lists via API key auth.
 */
function ClerkGate() {
  const { isLoaded } = useClerkAuth();
  const [phase, setPhase] = useState<'loading' | 'slow' | 'timeout'>('loading');

  useEffect(() => {
    if (isLoaded) return;

    const slowTimer = setTimeout(() => setPhase('slow'), CLERK_SLOW_THRESHOLD_MS);
    const timeoutTimer = setTimeout(() => {
      console.warn(
        '[FamilyList] Clerk failed to load within timeout. ' +
          'Falling back to API key mode. This may happen due to network issues ' +
          '(DNS filtering, router-level blocking, etc.).'
      );
      setPhase('timeout');
    }, CLERK_LOAD_TIMEOUT_MS);

    return () => {
      clearTimeout(slowTimer);
      clearTimeout(timeoutTimer);
    };
  }, [isLoaded]);

  if (isLoaded) return <ClerkAppContent />;
  if (phase === 'timeout') return <FallbackAppContent />;
  return <LoadingScreen slow={phase === 'slow'} />;
}

/**
 * App content with Clerk authentication.
 */
function ClerkAppContent() {
  // Set up auth token injection for API requests
  const { isAuthReady } = useAuthSetup();

  // Initialize offline sync
  useOfflineSync();

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
  // Initialize offline sync
  useOfflineSync();

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
        <QueryClientProvider client={queryClient}>
          <BrowserRouter>
            <ClerkGate />
          </BrowserRouter>
        </QueryClientProvider>
      </ErrorBoundary>
    );
  }

  // Fallback mode without Clerk
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <FallbackAppContent />
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
