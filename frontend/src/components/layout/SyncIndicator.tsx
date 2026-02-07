import clsx from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';
import { IconWifiOff } from '@tabler/icons-react';
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
              <IconWifiOff className="w-4 h-4" stroke={2} />
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
