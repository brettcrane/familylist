import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ClerkProvider } from '@clerk/clerk-react';
import './index.css';
import App from './App.tsx';

function mountApp() {
  // Get Clerk publishable key from environment
  const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

  // Conditionally wrap with ClerkProvider only if key is available
  const Root = clerkPubKey ? (
    <StrictMode>
      <ClerkProvider
        publishableKey={clerkPubKey}
        afterSignOutUrl="/"
        appearance={{
          // Place Clerk styles in the 'clerk' CSS layer for Tailwind v4 compatibility
          cssLayerName: 'clerk',
        }}
      >
        <App />
      </ClerkProvider>
    </StrictMode>
  ) : (
    <StrictMode>
      <App />
    </StrictMode>
  );

  createRoot(document.getElementById('root')!).render(Root);
}

mountApp();
