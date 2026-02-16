import { createPortal } from 'react-dom';
import { XMarkIcon, ExclamationCircleIcon, CheckCircleIcon, InformationCircleIcon } from '@heroicons/react/24/outline';
import { useUIStore, type Toast as ToastType } from '../../stores/uiStore';

const icons = {
  error: ExclamationCircleIcon,
  success: CheckCircleIcon,
  info: InformationCircleIcon,
};

const accentColors = {
  error: 'var(--color-destructive)',
  success: 'var(--color-checked)',
  info: 'var(--color-accent)',
};

function ToastItem({ toast }: { toast: ToastType }) {
  const dismissToast = useUIStore((state) => state.dismissToast);
  const Icon = icons[toast.type];
  const accent = accentColors[toast.type];
  const isError = toast.type === 'error';

  return (
    <div
      className="animate-slide-up"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '12px 16px',
        borderRadius: '12px',
        backgroundColor: 'var(--color-bg-card)',
        boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
        border: '1px solid color-mix(in srgb, var(--color-text-muted) 20%, transparent)',
        borderLeft: `3px solid ${accent}`,
      }}
    >
      <Icon
        style={{ width: 20, height: 20, flexShrink: 0, color: accent }}
      />
      <p
        style={{
          margin: 0,
          flex: 1,
          fontSize: '14px',
          fontWeight: 500,
          color: isError ? accent : 'var(--color-text-primary)',
        }}
      >
        {toast.message}
      </p>
      <button
        onClick={() => dismissToast(toast.id)}
        style={{
          padding: 4,
          marginRight: -4,
          borderRadius: 8,
          border: 'none',
          background: 'transparent',
          cursor: 'pointer',
          display: 'flex',
        }}
        aria-label="Dismiss"
      >
        <XMarkIcon style={{ width: 16, height: 16, color: 'var(--color-text-muted)' }} />
      </button>
    </div>
  );
}

export function ToastContainer() {
  const toasts = useUIStore((state) => state.toasts);

  return createPortal(
    <div
      style={{
        position: 'fixed',
        bottom: 80,
        left: 0,
        right: 0,
        zIndex: 150,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 8,
        padding: '0 16px',
        pointerEvents: 'none',
      }}
    >
      {toasts.map((toast) => (
        <div key={toast.id} style={{ pointerEvents: 'auto', width: '100%', maxWidth: 384 }}>
          <ToastItem toast={toast} />
        </div>
      ))}
    </div>,
    document.body
  );
}
