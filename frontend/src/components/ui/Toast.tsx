import { motion, AnimatePresence } from 'framer-motion';
import { XMarkIcon, ExclamationCircleIcon, CheckCircleIcon, InformationCircleIcon } from '@heroicons/react/24/outline';
import { useUIStore, type Toast as ToastType } from '../../stores/uiStore';
import clsx from 'clsx';

const icons = {
  error: ExclamationCircleIcon,
  success: CheckCircleIcon,
  info: InformationCircleIcon,
};

const colors = {
  error: {
    color: 'var(--color-destructive)',
    icon: 'text-[var(--color-destructive)]',
    text: 'text-[var(--color-destructive)]',
  },
  success: {
    color: 'var(--color-checked)',
    icon: 'text-[var(--color-checked)]',
    text: 'text-[var(--color-text-primary)]',
  },
  info: {
    color: 'var(--color-accent)',
    icon: 'text-[var(--color-accent)]',
    text: 'text-[var(--color-text-primary)]',
  },
};

function ToastItem({ toast }: { toast: ToastType }) {
  const dismissToast = useUIStore((state) => state.dismissToast);
  const Icon = icons[toast.type];
  const colorClasses = colors[toast.type];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 50, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20, scale: 0.9 }}
      transition={{ type: 'spring', damping: 25, stiffness: 350 }}
      className="flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg bg-[var(--color-bg-card)] border border-[var(--color-text-muted)]/20 overflow-hidden"
      style={{ borderLeftColor: colorClasses.color, borderLeftWidth: 3 }}
    >
      <Icon className={clsx('w-5 h-5 flex-shrink-0', colorClasses.icon)} />
      <p className={clsx('text-sm font-medium flex-1', colorClasses.text)}>
        {toast.message}
      </p>
      <button
        onClick={() => dismissToast(toast.id)}
        className="p-1 -mr-1 rounded-lg hover:bg-[var(--color-bg-secondary)] transition-colors"
        aria-label="Dismiss"
      >
        <XMarkIcon className="w-4 h-4 text-[var(--color-text-muted)]" />
      </button>
    </motion.div>
  );
}

export function ToastContainer() {
  const toasts = useUIStore((state) => state.toasts);

  return (
    <div className="fixed bottom-20 inset-x-0 z-[var(--z-toast)] flex flex-col items-center gap-2 px-4 pointer-events-none">
      <AnimatePresence mode="popLayout">
        {toasts.map((toast) => (
          <div key={toast.id} className="pointer-events-auto w-full max-w-sm">
            <ToastItem toast={toast} />
          </div>
        ))}
      </AnimatePresence>
    </div>
  );
}
