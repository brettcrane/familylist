import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  SignedIn,
  SignedOut,
  ClerkLoaded,
  ClerkLoading,
} from '@clerk/clerk-react';
import { HomePage, ListPage, SignInPage, SignUpPage } from './pages';
import { ErrorBoundary } from './components/ui';
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
  useAuthSetup();

  // Initialize offline sync
  useOfflineSync();

  // Initialize theme on mount
  useEffect(() => {
    initializeTheme();
  }, []);

  return (
    <AuthProvider>
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
    </FallbackAuthProvider>
  );
}

function App() {
  if (isClerkConfigured) {
    return (
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <BrowserRouter>
            <ClerkLoading>
              <LoadingScreen />
            </ClerkLoading>
            <ClerkLoaded>
              <ClerkAppContent />
            </ClerkLoaded>
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
