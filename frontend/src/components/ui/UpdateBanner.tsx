import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { XMarkIcon } from '@heroicons/react/24/outline';

interface UpdateBannerProps {
  onReload: () => void;
}

export function UpdateBanner({ onReload }: UpdateBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  return (
    <AnimatePresence>
      {!dismissed && (
        <motion.div
          initial={{ y: -60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -60, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 350 }}
          className="fixed top-0 inset-x-0 z-[var(--z-toast)] bg-[var(--color-accent)] text-white"
        >
          {/* Pad below the iOS notch / dynamic island in standalone PWA mode */}
          <div className="flex items-center justify-between gap-2 px-4 py-2 pt-[max(0.5rem,env(safe-area-inset-top))]">
            <p className="text-sm font-medium">A new version is available</p>
            <div className="flex items-center gap-1">
              <button
                onClick={onReload}
                className="text-sm font-semibold px-3 py-1 rounded-lg bg-white/20 hover:bg-white/30 transition-colors"
              >
                Reload
              </button>
              <button
                onClick={() => setDismissed(true)}
                className="p-1 rounded-lg hover:bg-white/20 transition-colors"
                aria-label="Dismiss"
              >
                <XMarkIcon className="w-4 h-4" />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
