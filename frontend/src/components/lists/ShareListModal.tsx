import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { useUIStore } from '../../stores/uiStore';
import { useList } from '../../hooks/useLists';
import {
  useListShares,
  useShareList,
  useUpdateShare,
  useRevokeShare,
  useCurrentUser,
} from '../../hooks/useShares';
import type { SharePermission, ListShare } from '../../types/api';

const PERMISSION_OPTIONS: { value: SharePermission; label: string }[] = [
  { value: 'view', label: 'View' },
  { value: 'edit', label: 'Edit' },
  { value: 'admin', label: 'Admin' },
];

function getInitials(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return '??';
  const parts = trimmed.split(/\s+/);
  if (parts.length >= 2 && parts[0] && parts[1]) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return trimmed.slice(0, 2).toUpperCase();
}

interface ShareRowProps {
  share: ListShare;
  isOwner: boolean;
  onUpdatePermission: (shareId: string, permission: SharePermission) => void;
  onRevoke: (shareId: string) => void;
  isUpdating: boolean;
  updateError: string | null;
}

function ShareRow({
  share,
  isOwner,
  onUpdatePermission,
  onRevoke,
  isUpdating,
  updateError,
}: ShareRowProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="flex items-center gap-3 p-3 bg-[var(--color-bg-secondary)] rounded-xl">
      {/* Avatar */}
      {share.user.avatar_url ? (
        <img
          src={share.user.avatar_url}
          alt={share.user.display_name}
          className="w-10 h-10 rounded-full object-cover"
        />
      ) : (
        <div className="w-10 h-10 bg-[var(--color-accent)]/20 text-[var(--color-accent)] rounded-full flex items-center justify-center font-semibold text-sm">
          {getInitials(share.user.display_name)}
        </div>
      )}

      {/* User info */}
      <div className="flex-1 min-w-0">
        <p className="font-medium text-[var(--color-text-primary)] truncate">
          {share.user.display_name}
        </p>
        <p className="text-xs text-[var(--color-text-muted)] truncate">
          {share.user.email}
        </p>
        {updateError && (
          <p className="text-xs text-[var(--color-destructive)] mt-0.5">{updateError}</p>
        )}
      </div>

      {/* Permission dropdown */}
      <div className="relative">
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          disabled={!isOwner || isUpdating}
          className={clsx(
            'px-3 py-1.5 text-sm rounded-lg flex items-center gap-1 transition-colors',
            isOwner
              ? 'bg-[var(--color-bg-card)] hover:bg-[var(--color-bg-primary)] border border-[var(--color-text-muted)]/20'
              : 'bg-transparent',
            'text-[var(--color-text-secondary)]'
          )}
        >
          <span className="capitalize">{share.permission}</span>
          {isOwner && (
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          )}
        </button>

        <AnimatePresence>
          {menuOpen && isOwner && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setMenuOpen(false)}
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: -4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -4 }}
                transition={{ duration: 0.1 }}
                className="absolute right-0 top-full mt-1 z-50 w-32 bg-[var(--color-bg-card)] rounded-lg shadow-lg border border-[var(--color-text-muted)]/10 overflow-hidden"
              >
                {PERMISSION_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => {
                      onUpdatePermission(share.id, option.value);
                      setMenuOpen(false);
                    }}
                    className={clsx(
                      'w-full px-3 py-2 text-sm text-left transition-colors',
                      share.permission === option.value
                        ? 'bg-[var(--color-accent)]/10 text-[var(--color-accent)]'
                        : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)]'
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>

      {/* Remove button */}
      {isOwner && (
        <button
          onClick={() => onRevoke(share.id)}
          disabled={isUpdating}
          className="p-1.5 text-[var(--color-text-muted)] hover:text-[var(--color-destructive)] hover:bg-[var(--color-destructive)]/10 rounded-lg transition-colors"
          aria-label="Remove share"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      )}
    </div>
  );
}

export function ShareListModal() {
  const { open, listId } = useUIStore((state) => state.shareListModal);
  const closeModal = useUIStore((state) => state.closeShareListModal);

  const { data: list } = useList(listId ?? '');
  const { data: currentUser } = useCurrentUser();
  const { data: shares, isLoading: sharesLoading, isError: sharesError } = useListShares(listId ?? undefined);

  const [email, setEmail] = useState('');
  const [permission, setPermission] = useState<SharePermission>('edit');
  const [error, setError] = useState('');
  const [updateError, setUpdateError] = useState<string | null>(null);

  const shareList = useShareList(listId ?? undefined);
  const updateShare = useUpdateShare(listId ?? undefined);
  const revokeShare = useRevokeShare(listId ?? undefined);

  const handleClose = () => {
    closeModal();
    setEmail('');
    setPermission('edit');
    setError('');
    setUpdateError(null);
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email.trim()) {
      setError('Please enter an email address');
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setError('Please enter a valid email address');
      return;
    }

    try {
      await shareList.mutateAsync({
        email: email.trim(),
        permission,
      });
      setEmail('');
      setError('');
    } catch (err: unknown) {
      const apiError = err as { message?: string; data?: { detail?: string } };
      setError(apiError.data?.detail || apiError.message || 'Failed to share list');
    }
  };

  const handleUpdatePermission = async (shareId: string, newPermission: SharePermission) => {
    setUpdateError(null);
    try {
      await updateShare.mutateAsync({
        shareId,
        data: { permission: newPermission },
      });
    } catch (err: unknown) {
      const apiError = err as { message?: string; data?: { detail?: string } };
      const errorMessage = apiError.data?.detail || apiError.message || 'Failed to update permission';
      console.error('Failed to update share permission:', { shareId, newPermission, error: err });
      setUpdateError(errorMessage);
    }
  };

  const handleRevoke = async (shareId: string) => {
    setUpdateError(null);
    try {
      await revokeShare.mutateAsync(shareId);
    } catch (err: unknown) {
      const apiError = err as { message?: string; data?: { detail?: string } };
      const errorMessage = apiError.data?.detail || apiError.message || 'Failed to remove user';
      console.error('Failed to revoke share:', { shareId, error: err });
      setUpdateError(errorMessage);
    }
  };

  // Check if current user is the owner
  const isOwner = currentUser && list ? currentUser.id === list.owner_id : false;
  const isUpdating = shareList.isPending || updateShare.isPending || revokeShare.isPending;

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="fixed inset-0 z-[var(--z-modal)] bg-black/50"
          />

          {/* Modal - full screen on mobile, centered on desktop */}
          <motion.div
            initial={{ opacity: 0, y: '100%' }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed inset-0 z-[var(--z-modal)] bg-[var(--color-bg-primary)] sm:inset-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl sm:w-[min(28rem,calc(100vw-2rem))] sm:max-h-[90vh] sm:shadow-xl"
          >
            <div className="flex flex-col h-full sm:max-h-[90vh]">
              {/* Header */}
              <div className="flex items-center gap-3 p-4 border-b border-[var(--color-text-muted)]/10">
                <button
                  onClick={handleClose}
                  className="p-2 -ml-2 rounded-lg hover:bg-[var(--color-bg-secondary)] transition-colors"
                  aria-label="Close"
                >
                  <svg className="w-5 h-5 text-[var(--color-text-primary)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M19 12H5M12 19l-7-7 7-7" />
                  </svg>
                </button>
                <h2 className="text-lg font-semibold text-[var(--color-text-primary)] truncate">
                  Share "{list?.name}"
                </h2>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-4 space-y-6">
                {/* Invite form - only show for owner */}
                {isOwner && (
                  <form onSubmit={handleInvite} className="space-y-4">
                    <div>
                      <label
                        htmlFor="share-email"
                        className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2"
                      >
                        Invite by Email
                      </label>
                      <Input
                        id="share-email"
                        type="email"
                        value={email}
                        onChange={(e) => {
                          setEmail(e.target.value);
                          setError('');
                        }}
                        placeholder="email@example.com"
                        error={error}
                        icon={
                          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                            <polyline points="22,6 12,13 2,6" />
                          </svg>
                        }
                      />
                    </div>

                    {/* Permission selector */}
                    <div>
                      <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
                        Permission
                      </label>
                      <div className="flex gap-1 p-1 bg-[var(--color-bg-secondary)] rounded-xl">
                        {PERMISSION_OPTIONS.map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => setPermission(option.value)}
                            className={clsx(
                              'flex-1 px-4 py-2 text-sm font-medium rounded-lg transition-colors',
                              permission === option.value
                                ? 'bg-[var(--color-accent)] text-white'
                                : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
                            )}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <Button
                      type="submit"
                      variant="primary"
                      isLoading={shareList.isPending}
                      className="w-full"
                    >
                      Send Invite
                    </Button>
                  </form>
                )}

                {/* Non-owner message */}
                {!isOwner && currentUser && (
                  <div className="text-sm text-[var(--color-text-muted)] bg-[var(--color-bg-secondary)] rounded-lg p-3">
                    Only the list owner can invite new users.
                  </div>
                )}

                {/* Divider */}
                <div className="h-px bg-[var(--color-text-muted)]/10" />

                {/* Current shares */}
                <div>
                  <h3 className="text-sm font-medium text-[var(--color-text-secondary)] mb-3">
                    Shared With {shares && shares.length > 0 && `(${shares.length})`}
                  </h3>

                  {/* Update error banner */}
                  {updateError && (
                    <div className="mb-3 p-3 bg-[var(--color-destructive)]/10 border border-[var(--color-destructive)]/20 rounded-lg">
                      <p className="text-sm text-[var(--color-destructive)]">{updateError}</p>
                    </div>
                  )}

                  {sharesLoading ? (
                    <div className="space-y-3">
                      {[1, 2].map((i) => (
                        <div
                          key={i}
                          className="h-16 bg-[var(--color-bg-secondary)] rounded-xl animate-pulse"
                        />
                      ))}
                    </div>
                  ) : sharesError ? (
                    <div className="text-sm text-[var(--color-destructive)] bg-[var(--color-destructive)]/10 rounded-lg p-3">
                      Failed to load shares. Please try again.
                    </div>
                  ) : shares && shares.length > 0 ? (
                    <div className="space-y-2">
                      {shares.map((share) => (
                        <ShareRow
                          key={share.id}
                          share={share}
                          isOwner={isOwner}
                          onUpdatePermission={handleUpdatePermission}
                          onRevoke={handleRevoke}
                          isUpdating={isUpdating}
                          updateError={null}
                        />
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-[var(--color-text-muted)] text-center py-6">
                      Not shared with anyone yet
                    </p>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
