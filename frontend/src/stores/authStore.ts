import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface CachedUser {
  id: string;
  email: string | null;
  displayName: string | null;
  imageUrl: string | null;
}

interface AuthStore {
  /** Cached user info for offline display */
  cachedUser: CachedUser | null;

  /** Update cached user (call when user signs in or data changes) */
  setCachedUser: (user: CachedUser | null) => void;

  /** Clear cached user (call on sign out) */
  clearCachedUser: () => void;
}

/**
 * Auth store for caching user info for offline display.
 * Persisted to localStorage so user info is available even when offline.
 */
export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      cachedUser: null,

      setCachedUser: (user) => {
        set({ cachedUser: user });
      },

      clearCachedUser: () => {
        set({ cachedUser: null });
      },
    }),
    {
      name: 'familylists-auth',
    }
  )
);
