import {
  createContext,
  useContext,
  useEffect,
  type ReactNode,
} from 'react';
import {
  useAuth as useClerkAuth,
  useUser as useClerkUser,
} from '@clerk/clerk-react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../stores/authStore';

interface AuthContextValue {
  isLoaded: boolean;
  isSignedIn: boolean;
  /** True when the auth token getter has been configured and queries can fire */
  isAuthReady: boolean;
  userId: string | null;
  user: {
    id: string;
    email: string | null;
    displayName: string | null;
    imageUrl: string | null;
  } | null;
  getToken: () => Promise<string | null>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

interface AuthProviderProps {
  children: ReactNode;
  /** Whether the auth token getter has been set up */
  isAuthReady?: boolean;
}

/**
 * Auth provider that wraps Clerk hooks for consistent API.
 *
 * Must be rendered inside ClerkProvider - Clerk hooks will throw if used outside.
 * For non-Clerk deployments (API key mode), use FallbackAuthProvider instead.
 */
export function AuthProvider({ children, isAuthReady = false }: AuthProviderProps) {
  const { isLoaded, isSignedIn, userId, getToken, signOut } = useClerkAuth();
  const { user } = useClerkUser();
  const { setCachedUser, clearCachedUser, cachedUser } = useAuthStore();
  const queryClient = useQueryClient();

  // Sync user data to cache for offline access
  useEffect(() => {
    if (isLoaded && isSignedIn && user) {
      const userData = {
        id: user.id,
        email: user.primaryEmailAddress?.emailAddress ?? null,
        displayName:
          user.fullName ??
          user.firstName ??
          user.primaryEmailAddress?.emailAddress ??
          null,
        imageUrl: user.imageUrl ?? null,
      };
      setCachedUser(userData);
    } else if (isLoaded && !isSignedIn) {
      clearCachedUser();
    }
  }, [isLoaded, isSignedIn, user, setCachedUser, clearCachedUser]);

  // Use cached user data when offline or loading
  const currentUser = user
    ? {
        id: user.id,
        email: user.primaryEmailAddress?.emailAddress ?? null,
        displayName:
          user.fullName ??
          user.firstName ??
          user.primaryEmailAddress?.emailAddress ??
          null,
        imageUrl: user.imageUrl ?? null,
      }
    : cachedUser;

  const value: AuthContextValue = {
    isLoaded,
    isSignedIn: isSignedIn ?? false,
    isAuthReady,
    userId: userId ?? null,
    user: currentUser,
    getToken: async () => {
      try {
        return await getToken();
      } catch (error) {
        // Log token acquisition failures for debugging
        console.error('Failed to get authentication token from Clerk:', {
          error,
          errorMessage: error instanceof Error ? error.message : String(error),
          userId,
          isSignedIn,
        });
        return null;
      }
    },
    signOut: async () => {
      clearCachedUser();
      queryClient.clear();
      navigator.serviceWorker?.controller?.postMessage({ type: 'CLEAR_API_CACHE' });
      try { localStorage.removeItem('familylists-offline-queue'); } catch { /* may not exist */ }
      await signOut();
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Hook to access auth context.
 * Must be used within AuthProvider (which must be within ClerkProvider).
 */
// eslint-disable-next-line react-refresh/only-export-components -- Hook must be co-located with context
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}

/**
 * Fallback auth context for when Clerk is not configured.
 *
 * Provides a consistent API but with no authentication capability.
 * Used when VITE_CLERK_PUBLISHABLE_KEY is not set - the app will work
 * in API key mode instead.
 *
 * Note: If you expected Clerk to be configured, check that
 * VITE_CLERK_PUBLISHABLE_KEY is set in your environment.
 */
export function FallbackAuthProvider({ children }: AuthProviderProps) {
  // Log a warning on mount so developers know Clerk is not configured
  useEffect(() => {
    console.warn(
      '[FamilyList Auth] Clerk is not configured - using API key authentication mode. ' +
        'To enable user authentication, set VITE_CLERK_PUBLISHABLE_KEY in your environment.'
    );
  }, []);

  const value: AuthContextValue = {
    isLoaded: true,
    isSignedIn: false,
    isAuthReady: true, // Always ready in API key mode
    userId: null,
    user: null,
    getToken: async () => null,
    signOut: async () => {
      console.warn('signOut called but Clerk is not configured');
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
