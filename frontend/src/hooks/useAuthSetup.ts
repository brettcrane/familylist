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
    console.log('[useAuthSetup] isSignedIn:', isSignedIn);

    if (isSignedIn) {
      // Set up token getter for API requests
      // Wrap getToken with logging to debug token issues
      const wrappedGetToken = async () => {
        const token = await getToken();
        console.log('[useAuthSetup] getToken result:', token ? `${token.slice(0, 20)}...` : null);
        return token;
      };
      setTokenGetter(wrappedGetToken);
    } else {
      // Clear token getter when signed out
      clearTokenGetter();
    }

    return () => {
      clearTokenGetter();
    };
  }, [getToken, isSignedIn]);
}
