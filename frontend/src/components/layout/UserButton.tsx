import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowRightStartOnRectangleIcon,
  SunIcon,
  MoonIcon,
  ComputerDesktopIcon,
  ChevronDownIcon,
  BellIcon,
  BellSlashIcon,
} from '@heroicons/react/24/outline';
import { useAuth } from '../../contexts/AuthContext';
import { useUIStore, type Theme } from '../../stores/uiStore';
import { usePushNotifications } from '../../hooks/usePushNotifications';

const THEME_OPTIONS: { value: Theme; label: string; Icon: typeof SunIcon }[] = [
  { value: 'light', label: 'Light', Icon: SunIcon },
  { value: 'dark', label: 'Dark', Icon: MoonIcon },
  { value: 'system', label: 'System', Icon: ComputerDesktopIcon },
];

export function UserButton() {
  const { user, signOut, isSignedIn } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);
  const [notificationsMenuOpen, setNotificationsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const theme = useUIStore((state) => state.theme);
  const setTheme = useUIStore((state) => state.setTheme);

  const {
    isSupported: pushSupported,
    isEnabled: pushEnabled,
    isSubscribed: pushSubscribed,
    isLoading: pushLoading,
    preferences: notifPrefs,
    error: pushError,
    subscribe: subscribePush,
    unsubscribe: unsubscribePush,
    updatePreferences: updateNotifPrefs,
  } = usePushNotifications();

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setThemeMenuOpen(false);
        setNotificationsMenuOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // Close on escape key
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
        setThemeMenuOpen(false);
        setNotificationsMenuOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen]);

  if (!isSignedIn || !user) {
    return null;
  }

  const initials = user.displayName
    ? user.displayName
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : user.email?.[0]?.toUpperCase() ?? '?';

  const handleSignOut = async () => {
    setIsOpen(false);
    await signOut();
  };

  const currentTheme = THEME_OPTIONS.find((t) => t.value === theme) || THEME_OPTIONS[0];
  const CurrentThemeIcon = currentTheme.Icon;

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-center w-9 h-9 rounded-full overflow-hidden ring-2 ring-transparent hover:ring-[var(--color-accent)]/50 transition-all focus:outline-none focus:ring-[var(--color-accent)]"
        aria-label="User menu"
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        {user.imageUrl ? (
          <img
            src={user.imageUrl}
            alt={user.displayName ?? 'User avatar'}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-[var(--color-accent)] flex items-center justify-center text-white text-sm font-medium">
            {initials}
          </div>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            ref={menuRef}
            initial={{ opacity: 0, scale: 0.95, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -4 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="absolute right-0 top-full mt-2 w-72 bg-[var(--color-bg-card)] rounded-xl shadow-lg border border-[var(--color-text-muted)]/10 overflow-hidden z-50"
          >
            {/* User info section */}
            <div className="p-4 border-b border-[var(--color-text-muted)]/10">
              <div className="flex items-center gap-3">
                {user.imageUrl ? (
                  <img
                    src={user.imageUrl}
                    alt={user.displayName ?? 'User avatar'}
                    className="w-11 h-11 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-11 h-11 rounded-full bg-[var(--color-accent)] flex items-center justify-center text-white text-base font-medium">
                    {initials}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  {user.displayName && (
                    <p className="font-medium text-[var(--color-text-primary)] truncate">
                      {user.displayName}
                    </p>
                  )}
                  {user.email && (
                    <p className="text-sm text-[var(--color-text-secondary)] truncate">
                      {user.email}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Theme selector */}
            <div className="p-2 border-b border-[var(--color-text-muted)]/10">
              <button
                onClick={() => setThemeMenuOpen(!themeMenuOpen)}
                className="w-full flex items-center justify-between gap-3 px-3 py-2.5 text-left rounded-lg hover:bg-[var(--color-bg-secondary)] transition-colors"
              >
                <div className="flex items-center gap-3">
                  <CurrentThemeIcon className="w-5 h-5 text-[var(--color-text-secondary)]" />
                  <span className="text-[var(--color-text-primary)]">Theme</span>
                </div>
                <div className="flex items-center gap-1 text-[var(--color-text-secondary)]">
                  <span className="text-sm">{currentTheme.label}</span>
                  <ChevronDownIcon
                    className={`w-4 h-4 transition-transform ${themeMenuOpen ? 'rotate-180' : ''}`}
                  />
                </div>
              </button>

              <AnimatePresence>
                {themeMenuOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    className="overflow-hidden"
                  >
                    <div className="pt-1 pl-8 space-y-1">
                      {THEME_OPTIONS.map(({ value, label, Icon }) => (
                        <button
                          key={value}
                          onClick={() => {
                            setTheme(value);
                            setThemeMenuOpen(false);
                          }}
                          className={`w-full flex items-center gap-3 px-3 py-2 text-left rounded-lg transition-colors ${
                            theme === value
                              ? 'bg-[var(--color-accent)]/10 text-[var(--color-accent)]'
                              : 'hover:bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)]'
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                          <span className="text-sm">{label}</span>
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Notifications */}
            {pushSupported && pushEnabled && (
              <div className="p-2 border-b border-[var(--color-text-muted)]/10">
                <button
                  onClick={() => setNotificationsMenuOpen(!notificationsMenuOpen)}
                  className="w-full flex items-center justify-between gap-3 px-3 py-2.5 text-left rounded-lg hover:bg-[var(--color-bg-secondary)] transition-colors"
                  disabled={pushLoading}
                >
                  <div className="flex items-center gap-3">
                    {pushSubscribed ? (
                      <BellIcon className="w-5 h-5 text-[var(--color-text-secondary)]" />
                    ) : (
                      <BellSlashIcon className="w-5 h-5 text-[var(--color-text-secondary)]" />
                    )}
                    <span className="text-[var(--color-text-primary)]">Notifications</span>
                  </div>
                  <div className="flex items-center gap-1 text-[var(--color-text-secondary)]">
                    <span className="text-sm">
                      {pushLoading ? 'Loading...' : pushSubscribed ? 'On' : 'Off'}
                    </span>
                    <ChevronDownIcon
                      className={`w-4 h-4 transition-transform ${notificationsMenuOpen ? 'rotate-180' : ''}`}
                    />
                  </div>
                </button>

                <AnimatePresence>
                  {notificationsMenuOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.15 }}
                      className="overflow-hidden"
                    >
                      <div className="pt-1 pl-8 space-y-1">
                        {/* Enable/Disable toggle */}
                        <button
                          onClick={async () => {
                            try {
                              if (pushSubscribed) {
                                await unsubscribePush();
                              } else {
                                await subscribePush();
                              }
                            } catch {
                              // Error is already handled in the hook
                            }
                          }}
                          disabled={pushLoading}
                          className="w-full flex items-center justify-between gap-3 px-3 py-2 text-left rounded-lg hover:bg-[var(--color-bg-secondary)] transition-colors"
                        >
                          <span className="text-sm text-[var(--color-text-primary)]">
                            {pushSubscribed ? 'Disable notifications' : 'Enable notifications'}
                          </span>
                        </button>

                        {/* Preferences (only show if subscribed) */}
                        {pushSubscribed && notifPrefs && (
                          <>
                            <div className="px-3 py-1">
                              <span className="text-xs text-[var(--color-text-secondary)] uppercase tracking-wide">
                                List updates
                              </span>
                            </div>
                            {(['batched', 'always', 'off'] as const).map((mode) => (
                              <button
                                key={mode}
                                onClick={() => updateNotifPrefs({ list_updates: mode })}
                                disabled={pushLoading}
                                className={`w-full flex items-center gap-3 px-3 py-2 text-left rounded-lg transition-colors ${
                                  notifPrefs.list_updates === mode
                                    ? 'bg-[var(--color-accent)]/10 text-[var(--color-accent)]'
                                    : 'hover:bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)]'
                                }`}
                              >
                                <span className="text-sm">
                                  {mode === 'batched'
                                    ? 'Batched (recommended)'
                                    : mode === 'always'
                                      ? 'Every change'
                                      : 'Off'}
                                </span>
                              </button>
                            ))}
                          </>
                        )}

                        {/* Error display */}
                        {pushError && (
                          <div className="px-3 py-2 text-xs text-red-500">{pushError}</div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {/* Sign out */}
            <div className="p-2">
              <button
                onClick={handleSignOut}
                className="w-full flex items-center gap-3 px-3 py-2.5 text-left rounded-lg hover:bg-[var(--color-bg-secondary)] transition-colors text-[var(--color-text-primary)]"
              >
                <ArrowRightStartOnRectangleIcon className="w-5 h-5 text-[var(--color-text-secondary)]" />
                Sign out
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
