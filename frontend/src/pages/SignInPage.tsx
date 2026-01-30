import { SignIn, SignUp } from '@clerk/clerk-react';
import { motion } from 'framer-motion';
import clsx from 'clsx';

// Shared appearance configuration for Clerk components
const clerkAppearance = {
  elements: {
    rootBox: 'w-full',
    card: clsx(
      'bg-[var(--color-bg-card)]',
      'shadow-[var(--shadow-card)]',
      'border border-[var(--color-text-muted)]/10',
      'rounded-xl'
    ),
    headerTitle: 'font-display text-[var(--color-text-primary)]',
    headerSubtitle: 'text-[var(--color-text-secondary)]',
    socialButtonsBlockButton: clsx(
      'border border-[var(--color-text-muted)]/20',
      'hover:bg-[var(--color-bg-secondary)]',
      'transition-colors rounded-xl'
    ),
    socialButtonsBlockButtonText: 'text-[var(--color-text-primary)] font-medium',
    dividerLine: 'bg-[var(--color-text-muted)]/20',
    dividerText: 'text-[var(--color-text-muted)]',
    formFieldLabel: 'text-[var(--color-text-primary)] font-medium',
    formFieldInput: clsx(
      'bg-[var(--color-bg-card)]',
      'border border-[var(--color-text-muted)]/20',
      'text-[var(--color-text-primary)]',
      'rounded-xl',
      'focus:border-[var(--color-accent)]',
      'focus:ring-2 focus:ring-[var(--color-accent)]/20'
    ),
    formButtonPrimary: clsx(
      'bg-[var(--color-accent)]',
      'hover:bg-[var(--color-accent)]/90',
      'rounded-xl font-semibold',
      'transition-all'
    ),
    footerActionLink: 'text-[var(--color-accent)] hover:text-[var(--color-accent)]/80',
    identityPreview: 'bg-[var(--color-bg-secondary)] rounded-xl',
    identityPreviewText: 'text-[var(--color-text-primary)]',
    identityPreviewEditButton: 'text-[var(--color-accent)]',
    formFieldInputShowPasswordButton: 'text-[var(--color-text-muted)]',
    alert: 'bg-[var(--color-destructive)]/10 text-[var(--color-destructive)] rounded-lg',
    alertText: 'text-[var(--color-destructive)]',
  },
  layout: {
    socialButtonsPlacement: 'top' as const,
    socialButtonsVariant: 'blockButton' as const,
  },
};

// Animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring' as const, damping: 25, stiffness: 300 },
  },
};

// Feature item component
function FeatureItem({ emoji, text }: { emoji: string; text: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-xl">{emoji}</span>
      <span className="text-sm lg:text-base">{text}</span>
    </div>
  );
}

// Hero section component (left side on desktop)
function HeroSection({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <motion.div
      className="flex flex-col justify-center items-center lg:items-start text-center lg:text-left p-8 lg:p-12"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Logo / App Icon */}
      <motion.div variants={itemVariants} className="mb-6">
        <div className="w-16 h-16 lg:w-20 lg:h-20 rounded-2xl bg-[var(--color-accent)] flex items-center justify-center shadow-lg">
          <span className="text-3xl lg:text-4xl">📝</span>
        </div>
      </motion.div>

      {/* App Name */}
      <motion.h1
        variants={itemVariants}
        className="font-display text-3xl lg:text-4xl font-bold text-[var(--color-text-primary)] mb-3"
      >
        FamilyList
      </motion.h1>

      {/* Tagline */}
      <motion.p
        variants={itemVariants}
        className="text-lg lg:text-xl text-[var(--color-text-secondary)] mb-8 max-w-md"
      >
        {title}
      </motion.p>

      {/* Feature highlights */}
      <motion.div
        variants={itemVariants}
        className="space-y-3 text-[var(--color-text-secondary)]"
      >
        <FeatureItem emoji="🛒" text="Grocery lists with AI categorization" />
        <FeatureItem emoji="🧳" text="Packing lists for travel" />
        <FeatureItem emoji="✅" text="Task lists to stay organized" />
        <FeatureItem emoji="👨‍👩‍👧‍👦" text="Share lists with family" />
      </motion.div>

      {/* Subtitle / CTA hint */}
      <motion.p
        variants={itemVariants}
        className="mt-8 text-sm text-[var(--color-text-muted)]"
      >
        {subtitle}
      </motion.p>
    </motion.div>
  );
}

// Main Sign In Page
export function SignInPage() {
  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)] flex flex-col lg:flex-row">
      {/* Hero section - hidden on mobile, shown on desktop left side */}
      <div className="hidden lg:flex lg:w-1/2 bg-[var(--color-bg-secondary)]">
        <HeroSection
          title="Keep your family organized with smart, shareable lists."
          subtitle="Sign in to access your lists"
        />
      </div>

      {/* Form section */}
      <div className="flex-1 flex flex-col justify-center items-center p-6 lg:p-12">
        {/* Mobile hero (condensed) */}
        <motion.div
          className="lg:hidden text-center mb-8"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        >
          <div className="w-14 h-14 rounded-xl bg-[var(--color-accent)] flex items-center justify-center shadow-md mx-auto mb-4">
            <span className="text-2xl">📝</span>
          </div>
          <h1 className="font-display text-2xl font-bold text-[var(--color-text-primary)]">
            FamilyList
          </h1>
          <p className="text-[var(--color-text-secondary)] mt-2">
            Sign in to manage your lists
          </p>
        </motion.div>

        {/* Sign In Form */}
        <motion.div
          className="w-full max-w-md"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300, delay: 0.1 }}
        >
          <SignIn
            appearance={clerkAppearance}
            routing="path"
            path="/sign-in"
            signUpUrl="/sign-up"
            fallbackRedirectUrl="/"
          />
        </motion.div>
      </div>
    </div>
  );
}

// Main Sign Up Page
export function SignUpPage() {
  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)] flex flex-col lg:flex-row">
      {/* Hero section - hidden on mobile, shown on desktop left side */}
      <div className="hidden lg:flex lg:w-1/2 bg-[var(--color-bg-secondary)]">
        <HeroSection
          title="Join your family in staying organized."
          subtitle="Create a free account to get started"
        />
      </div>

      {/* Form section */}
      <div className="flex-1 flex flex-col justify-center items-center p-6 lg:p-12">
        {/* Mobile hero (condensed) */}
        <motion.div
          className="lg:hidden text-center mb-8"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        >
          <div className="w-14 h-14 rounded-xl bg-[var(--color-accent)] flex items-center justify-center shadow-md mx-auto mb-4">
            <span className="text-2xl">📝</span>
          </div>
          <h1 className="font-display text-2xl font-bold text-[var(--color-text-primary)]">
            FamilyList
          </h1>
          <p className="text-[var(--color-text-secondary)] mt-2">
            Create an account to get started
          </p>
        </motion.div>

        {/* Sign Up Form */}
        <motion.div
          className="w-full max-w-md"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300, delay: 0.1 }}
        >
          <SignUp
            appearance={clerkAppearance}
            routing="path"
            path="/sign-up"
            signInUrl="/sign-in"
            fallbackRedirectUrl="/"
          />
        </motion.div>
      </div>
    </div>
  );
}
