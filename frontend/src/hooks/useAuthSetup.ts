import { useEffect, useState } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { setTokenGetter, clearTokenGetter } from '../api/client';

/**
 * Hook to connect Clerk authentication to the API client.
 * Call this once in the app root to set up token injection.
 *
 * Returns isAuthReady: true when the token getter has been configured.
 * Queries that require auth should wait for this before firing.
 */
export function useAuthSetup(): { isAuthReady: boolean } {
  const { getToken, isSignedIn } = useAuth();
  const [isAuthReady, setIsAuthReady] = useState(false);

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
      setIsAuthReady(true);
    } else {
      // Clear token getter when signed out
      clearTokenGetter();
      // Still mark as ready - queries will work in API key mode
      setIsAuthReady(true);
    }

    return () => {
      clearTokenGetter();
    };
  }, [getToken, isSignedIn]);

  return { isAuthReady };
}
