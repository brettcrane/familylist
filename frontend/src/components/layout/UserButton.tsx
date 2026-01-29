import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../contexts/AuthContext';

export function UserButton() {
  const { user, signOut, isSignedIn } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

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
            className="absolute right-0 top-full mt-2 w-64 bg-[var(--color-bg-secondary)] rounded-lg shadow-lg border border-[var(--color-text-muted)]/10 overflow-hidden z-50"
          >
            {/* User info section */}
            <div className="p-4 border-b border-[var(--color-text-muted)]/10">
              <div className="flex items-center gap-3">
                {user.imageUrl ? (
                  <img
                    src={user.imageUrl}
                    alt={user.displayName ?? 'User avatar'}
                    className="w-10 h-10 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-[var(--color-accent)] flex items-center justify-center text-white font-medium">
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

            {/* Actions */}
            <div className="p-2">
              <button
                onClick={handleSignOut}
                className="w-full flex items-center gap-3 px-3 py-2 text-left rounded-md hover:bg-[var(--color-bg-primary)] transition-colors text-[var(--color-text-primary)]"
              >
                <svg
                  className="w-5 h-5 text-[var(--color-text-secondary)]"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
                Sign out
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
