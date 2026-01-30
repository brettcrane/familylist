import { SignIn, SignUp } from '@clerk/clerk-react';

/**
 * Minimal Sign In Page
 *
 * Keep it simple: center the Clerk component, add subtle branding.
 * Per Clerk docs: just render <SignIn /> with routing props.
 */
export function SignInPage() {
  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)] flex flex-col items-center justify-center p-4">
      {/* Simple branding */}
      <div className="text-center mb-8">
        <h1 className="font-display text-3xl font-bold text-[var(--color-text-primary)]">
          FamilyList
        </h1>
        <p className="text-[var(--color-text-secondary)] mt-2">
          Sign in to manage your lists
        </p>
      </div>

      {/* Clerk SignIn - let Clerk handle the complexity */}
      <SignIn
        routing="path"
        path="/sign-in"
        signUpUrl="/sign-up"
        fallbackRedirectUrl="/"
      />
    </div>
  );
}

/**
 * Minimal Sign Up Page
 */
export function SignUpPage() {
  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)] flex flex-col items-center justify-center p-4">
      {/* Simple branding */}
      <div className="text-center mb-8">
        <h1 className="font-display text-3xl font-bold text-[var(--color-text-primary)]">
          FamilyList
        </h1>
        <p className="text-[var(--color-text-secondary)] mt-2">
          Create an account to get started
        </p>
      </div>

      {/* Clerk SignUp - let Clerk handle the complexity */}
      <SignUp
        routing="path"
        path="/sign-up"
        signInUrl="/sign-in"
        fallbackRedirectUrl="/"
      />
    </div>
  );
}
