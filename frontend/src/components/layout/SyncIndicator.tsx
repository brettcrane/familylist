import clsx from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';
import { useOnlineStatus, useOfflineQueueStore } from '../../hooks/useOfflineQueue';

export function SyncIndicator() {
  const isOnline = useOnlineStatus();
  const pendingCount = useOfflineQueueStore((state) => state.pendingMutations.length);

  const showIndicator = !isOnline || pendingCount > 0;

  return (
    <AnimatePresence>
      {showIndicator && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          className={clsx(
            'flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium',
            !isOnline
              ? 'bg-[var(--color-pending)]/20 text-[var(--color-pending)]'
              : 'bg-[var(--color-accent)]/20 text-[var(--color-accent)]'
          )}
        >
          {!isOnline ? (
            <>
              <svg
                className="w-4 h-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="1" y1="1" x2="23" y2="23" />
                <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" />
                <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39" />
                <path d="M10.71 5.05A16 16 0 0 1 22.58 9" />
                <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88" />
                <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
                <line x1="12" y1="20" x2="12.01" y2="20" />
              </svg>
              <span>Offline</span>
            </>
          ) : (
            <>
              <motion.svg
                className="w-4 h-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              >
                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
              </motion.svg>
              <span>Syncing {pendingCount}...</span>
            </>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
