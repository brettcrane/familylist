import { motion } from 'framer-motion';

interface UpdateBannerProps {
  onReload: () => void;
}

export function UpdateBanner({ onReload }: UpdateBannerProps) {
  return (
    <motion.div
      initial={{ y: -60, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: 'spring', damping: 25, stiffness: 350 }}
      className="fixed top-0 inset-x-0 z-[var(--z-toast)] bg-[var(--color-accent)] text-white"
    >
      {/* Pad below the iOS notch / dynamic island in standalone PWA mode */}
      <div className="flex items-center justify-between gap-2 px-4 py-2 pt-[max(0.5rem,env(safe-area-inset-top))]">
        <p className="text-sm font-medium">New version available</p>
        <button
          onClick={onReload}
          className="text-sm font-semibold px-3 py-1 rounded-lg bg-white/20 hover:bg-white/30 transition-colors"
        >
          Reload now
        </button>
      </div>
    </motion.div>
  );
}
