import { useEffect } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { setTokenGetter, clearTokenGetter } from '../api/client';

/**
 * Hook to connect Clerk authentication to the API client.
 * Call this once in the app root to set up token injection.
 */
export function useAuthSetup(): void {
  const { getToken, isSignedIn } = useAuth();

  useEffect(() => {
    if (isSignedIn) {
      // Set up token getter for API requests
      setTokenGetter(getToken);
    } else {
      // Clear token getter when signed out
      clearTokenGetter();
    }

    return () => {
      clearTokenGetter();
    };
  }, [getToken, isSignedIn]);
}
