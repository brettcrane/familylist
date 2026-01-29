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
import { useAuthStore } from '../stores/authStore';
import { useOfflineQueueStore } from '../hooks/useOfflineQueue';

interface AuthContextValue {
  isLoaded: boolean;
  isSignedIn: boolean;
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
}

/**
 * Auth provider that wraps Clerk hooks for consistent API.
 * Only use this inside ClerkProvider.
 */
export function AuthProvider({ children }: AuthProviderProps) {
  const { isLoaded, isSignedIn, userId, getToken, signOut } = useClerkAuth();
  const { user } = useClerkUser();
  const { setCachedUser, clearCachedUser, cachedUser } = useAuthStore();
  const { setSyncPaused } = useOfflineQueueStore();

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
      // Resume sync when user is authenticated
      setSyncPaused(false);
    } else if (isLoaded && !isSignedIn) {
      clearCachedUser();
    }
  }, [isLoaded, isSignedIn, user, setCachedUser, clearCachedUser, setSyncPaused]);

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
    userId: userId ?? null,
    user: currentUser,
    getToken: async () => {
      try {
        return await getToken();
      } catch {
        return null;
      }
    },
    signOut: async () => {
      clearCachedUser();
      await signOut();
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Hook to access auth context.
 * Must be used within AuthProvider (which must be within ClerkProvider).
 */
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}

/**
 * Fallback auth context for when Clerk is not configured.
 * Provides a consistent API but with no authentication.
 */
export function FallbackAuthProvider({ children }: AuthProviderProps) {
  const value: AuthContextValue = {
    isLoaded: true,
    isSignedIn: false,
    userId: null,
    user: null,
    getToken: async () => null,
    signOut: async () => {},
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
