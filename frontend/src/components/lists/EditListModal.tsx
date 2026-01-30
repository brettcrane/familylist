import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { useUpdateList, useList } from '../../hooks/useLists';
import { useUIStore } from '../../stores/uiStore';
import { useAuth } from '../../contexts/AuthContext';

const ICON_OPTIONS = [
  '🛒', '🎒', '✅', '📝', '🏠', '🎁',
  '🌟', '❤️', '🎯', '📌', '✏️', '📋',
];

const COLOR_OPTIONS = [
  '#FF6B6B', // Coral
  '#4ECDC4', // Teal
  '#45B7D1', // Sky Blue
  '#96CEB4', // Sage
  '#FFEAA7', // Yellow
  '#DDA0DD', // Plum
  '#98D8C8', // Mint
  '#F7DC6F', // Gold
];

export function EditListModal() {
  const { open, listId } = useUIStore((state) => state.editListModal);
  const closeModal = useUIStore((state) => state.closeEditListModal);
  const { isAuthReady } = useAuth();

  const { data: list } = useList(listId || '', { enabled: isAuthReady && !!listId });
  const updateList = useUpdateList();

  const [name, setName] = useState('');
  const [icon, setIcon] = useState<string | null>(null);
  const [color, setColor] = useState<string | null>(null);
  const [error, setError] = useState('');

  // Sync form with list data when modal opens
  useEffect(() => {
    if (open && list) {
      setName(list.name);
      setIcon(list.icon);
      setColor(list.color);
      setError('');
    }
  }, [open, list]);

  const handleClose = () => {
    closeModal();
    setName('');
    setIcon(null);
    setColor(null);
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      setError('Please enter a list name');
      return;
    }

    if (!listId) return;

    try {
      await updateList.mutateAsync({
        id: listId,
        data: {
          name: name.trim(),
          icon,
          color,
        },
      });
      handleClose();
    } catch (err: unknown) {
      const apiError = err as { message?: string; data?: { detail?: string } };
      const errorMessage = apiError.data?.detail || apiError.message || 'Failed to update list. Please try again.';
      console.error('Failed to update list:', { listId, error: err });
      setError(errorMessage);
    }
  };

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

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 100 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed inset-x-0 bottom-0 z-[var(--z-modal)] safe-bottom"
          >
            <div className="bg-[var(--color-bg-card)] rounded-t-2xl shadow-lg">
              {/* Drag handle */}
              <div className="flex justify-center py-3">
                <div className="w-10 h-1 bg-[var(--color-text-muted)]/30 rounded-full" />
              </div>

              <form onSubmit={handleSubmit} className="px-6 pb-6">
                <h2 className="text-xl font-semibold text-[var(--color-text-primary)] mb-6">
                  Edit List
                </h2>

                {/* Name input */}
                <div className="mb-6">
                  <label
                    htmlFor="edit-list-name"
                    className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2"
                  >
                    List Name
                  </label>
                  <Input
                    id="edit-list-name"
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      setError('');
                    }}
                    placeholder="e.g., Weekly Groceries"
                    error={error}
                    autoFocus
                  />
                </div>

                {/* Icon selection */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-3">
                    Icon (optional)
                  </label>
                  <div className="grid grid-cols-6 gap-2">
                    {ICON_OPTIONS.map((iconOption) => (
                      <button
                        key={iconOption}
                        type="button"
                        onClick={() => setIcon(icon === iconOption ? null : iconOption)}
                        className={clsx(
                          'aspect-square flex items-center justify-center text-2xl rounded-xl border-2 transition-all',
                          icon === iconOption
                            ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/10'
                            : 'border-[var(--color-text-muted)]/20 hover:border-[var(--color-text-muted)]/40'
                        )}
                      >
                        {iconOption}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Color selection */}
                <div className="mb-8">
                  <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-3">
                    Color (optional)
                  </label>
                  <div className="flex gap-3 flex-wrap">
                    {COLOR_OPTIONS.map((colorOption) => (
                      <button
                        key={colorOption}
                        type="button"
                        onClick={() => setColor(color === colorOption ? null : colorOption)}
                        className={clsx(
                          'w-10 h-10 rounded-full transition-all',
                          color === colorOption &&
                            'ring-2 ring-offset-2 ring-[var(--color-text-primary)]'
                        )}
                        style={{ backgroundColor: colorOption }}
                        aria-label={`Select color ${colorOption}`}
                      />
                    ))}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={handleClose}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    isLoading={updateList.isPending}
                    className="flex-1"
                  >
                    Save Changes
                  </Button>
                </div>
              </form>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
