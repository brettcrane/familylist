import { SignIn, SignUp } from '@clerk/clerk-react';
import { motion } from 'framer-motion';
import clsx from 'clsx';
import {
  ShoppingCartIcon,
  BriefcaseIcon,
  CheckCircleIcon,
  UserGroupIcon,
} from '@heroicons/react/24/outline';
import { ClipboardDocumentListIcon as ClipboardDocumentListIconSolid } from '@heroicons/react/24/solid';

// Shared appearance configuration for Clerk components
const clerkAppearance = {
  elements: {
    rootBox: 'w-full',
    cardBox: 'w-full',
    card: clsx(
      'w-full',
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
      staggerChildren: 0.06,
      delayChildren: 0.05,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring' as const, damping: 28, stiffness: 350 },
  },
};

// Feature data with Heroicons
const features = [
  { icon: ShoppingCartIcon, text: 'Grocery lists with AI categorization' },
  { icon: BriefcaseIcon, text: 'Packing lists for travel' },
  { icon: CheckCircleIcon, text: 'Task lists to stay organized' },
  { icon: UserGroupIcon, text: 'Share lists with family' },
];

// Feature item component
function FeatureItem({ icon: Icon, text }: { icon: React.ComponentType<{ className?: string }>; text: string }) {
  return (
    <div className="flex items-center gap-4">
      <div className="w-10 h-10 rounded-xl bg-[var(--color-accent)]/10 flex items-center justify-center shrink-0">
        <Icon className="w-5 h-5 text-[var(--color-accent)]" />
      </div>
      <span className="text-sm lg:text-base text-[var(--color-text-secondary)]">{text}</span>
    </div>
  );
}

// App logo component
function AppLogo({ size = 'lg' }: { size?: 'sm' | 'lg' }) {
  const sizeClasses = size === 'lg' ? 'w-16 h-16 lg:w-20 lg:h-20' : 'w-14 h-14';
  const iconClasses = size === 'lg' ? 'w-8 h-8 lg:w-10 lg:h-10' : 'w-7 h-7';

  return (
    <div className={clsx(
      sizeClasses,
      'rounded-2xl bg-[var(--color-accent)] flex items-center justify-center',
      'shadow-[var(--shadow-card)]'
    )}>
      <ClipboardDocumentListIconSolid className={clsx(iconClasses, 'text-white')} />
    </div>
  );
}

// Hero section content
function HeroContent({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <motion.div
      className="w-full max-w-xl space-y-6"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      <motion.div variants={itemVariants}>
        <AppLogo size="lg" />
      </motion.div>

      <motion.h1
        variants={itemVariants}
        className="font-display text-3xl lg:text-4xl font-bold text-[var(--color-text-primary)]"
      >
        FamilyList
      </motion.h1>

      <motion.p
        variants={itemVariants}
        className="text-lg lg:text-xl text-[var(--color-text-secondary)]"
      >
        {title}
      </motion.p>

      <motion.div variants={itemVariants} className="space-y-4 pt-4">
        {features.map((feature, index) => (
          <FeatureItem key={index} icon={feature.icon} text={feature.text} />
        ))}
      </motion.div>

      <motion.p
        variants={itemVariants}
        className="text-sm text-[var(--color-text-muted)] pt-4"
      >
        {subtitle}
      </motion.p>
    </motion.div>
  );
}

// Main Sign In Page
export function SignInPage() {
  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)]">
      {/* CSS Grid layout: 12 columns on desktop */}
      <div className="grid lg:grid-cols-12 min-h-screen">
        {/* Hero section - 7 columns on desktop, hidden on mobile */}
        <div className="hidden lg:flex lg:col-span-7 bg-[var(--color-bg-secondary)] relative overflow-hidden">
          {/* Subtle gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-br from-[var(--color-accent)]/5 via-transparent to-[var(--color-cat-bakery)]/5" />

          {/* Subtle dot pattern */}
          <div
            className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage: 'radial-gradient(circle, var(--color-text-primary) 1px, transparent 1px)',
              backgroundSize: '20px 20px'
            }}
          />

          {/* Content - min-w-0 prevents flex child from overflowing */}
          <div className="relative z-10 flex items-center min-w-0 w-full p-8 lg:p-12 xl:p-16">
            <HeroContent
              title="Keep your family organized with smart, shareable lists."
              subtitle="Sign in to access your lists"
            />
          </div>
        </div>

        {/* Form section - 5 columns on desktop, full width on mobile */}
        <div className="lg:col-span-5 flex flex-col justify-center items-center p-6 lg:p-12">
          {/* Mobile hero (condensed) */}
          <motion.div
            className="lg:hidden text-center mb-8"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', damping: 28, stiffness: 350 }}
          >
            <div className="flex justify-center mb-4">
              <AppLogo size="sm" />
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
            transition={{ type: 'spring', damping: 28, stiffness: 350, delay: 0.08 }}
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
    </div>
  );
}

// Main Sign Up Page
export function SignUpPage() {
  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)]">
      {/* CSS Grid layout: 12 columns on desktop */}
      <div className="grid lg:grid-cols-12 min-h-screen">
        {/* Hero section - 7 columns on desktop, hidden on mobile */}
        <div className="hidden lg:flex lg:col-span-7 bg-[var(--color-bg-secondary)] relative overflow-hidden">
          {/* Subtle gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-br from-[var(--color-accent)]/5 via-transparent to-[var(--color-cat-bakery)]/5" />

          {/* Subtle dot pattern */}
          <div
            className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage: 'radial-gradient(circle, var(--color-text-primary) 1px, transparent 1px)',
              backgroundSize: '20px 20px'
            }}
          />

          {/* Content - min-w-0 prevents flex child from overflowing */}
          <div className="relative z-10 flex items-center min-w-0 w-full p-8 lg:p-12 xl:p-16">
            <HeroContent
              title="Join your family in staying organized."
              subtitle="Create a free account to get started"
            />
          </div>
        </div>

        {/* Form section - 5 columns on desktop, full width on mobile */}
        <div className="lg:col-span-5 flex flex-col justify-center items-center p-6 lg:p-12">
          {/* Mobile hero (condensed) */}
          <motion.div
            className="lg:hidden text-center mb-8"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', damping: 28, stiffness: 350 }}
          >
            <div className="flex justify-center mb-4">
              <AppLogo size="sm" />
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
            transition={{ type: 'spring', damping: 28, stiffness: 350, delay: 0.08 }}
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
    </div>
  );
}
