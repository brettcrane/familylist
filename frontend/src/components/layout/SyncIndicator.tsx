import { useSyncExternalStore } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { IconWifiOff } from '@tabler/icons-react';
import { onlineManager } from '@tanstack/react-query';

function subscribeOnline(cb: () => void) {
  return onlineManager.subscribe(cb);
}

function getOnlineSnapshot() {
  return onlineManager.isOnline();
}

export function SyncIndicator() {
  const isOnline = useSyncExternalStore(subscribeOnline, getOnlineSnapshot, () => true);

  return (
    <AnimatePresence>
      {!isOnline && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          className="flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium bg-[var(--color-pending)]/20 text-[var(--color-pending)]"
        >
          <IconWifiOff className="w-4 h-4" stroke={2} />
          <span>Offline</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
