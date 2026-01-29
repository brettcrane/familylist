import { SignIn } from '@clerk/clerk-react';

export function SignInPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg-primary)]">
      <div className="w-full max-w-md px-4">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">
            FamilyList
          </h1>
          <p className="text-[var(--color-text-secondary)] mt-2">
            Sign in to manage your lists
          </p>
        </div>
        <SignIn
          appearance={{
            elements: {
              rootBox: 'w-full',
              card: 'bg-[var(--color-bg-secondary)] shadow-lg border border-[var(--color-text-muted)]/10',
              headerTitle: 'text-[var(--color-text-primary)]',
              headerSubtitle: 'text-[var(--color-text-secondary)]',
              socialButtonsBlockButton:
                'border-[var(--color-text-muted)]/20 hover:bg-[var(--color-bg-primary)]',
              socialButtonsBlockButtonText: 'text-[var(--color-text-primary)]',
              dividerLine: 'bg-[var(--color-text-muted)]/20',
              dividerText: 'text-[var(--color-text-muted)]',
              formFieldLabel: 'text-[var(--color-text-primary)]',
              formFieldInput:
                'bg-[var(--color-bg-primary)] border-[var(--color-text-muted)]/20 text-[var(--color-text-primary)]',
              formButtonPrimary:
                'bg-[var(--color-accent)] hover:bg-[var(--color-accent)]/90',
              footerActionLink: 'text-[var(--color-accent)]',
            },
          }}
          routing="path"
          path="/sign-in"
          signUpUrl="/sign-up"
          fallbackRedirectUrl="/"
        />
      </div>
    </div>
  );
}

export function SignUpPage() {
  // Using SignIn with mode to handle sign-up
  // Clerk handles the redirect to sign-up flow
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg-primary)]">
      <div className="w-full max-w-md px-4">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">
            FamilyList
          </h1>
          <p className="text-[var(--color-text-secondary)] mt-2">
            Create an account to get started
          </p>
        </div>
        <SignIn
          appearance={{
            elements: {
              rootBox: 'w-full',
              card: 'bg-[var(--color-bg-secondary)] shadow-lg border border-[var(--color-text-muted)]/10',
            },
          }}
          routing="path"
          path="/sign-up"
          signInUrl="/sign-in"
          fallbackRedirectUrl="/"
        />
      </div>
    </div>
  );
}
