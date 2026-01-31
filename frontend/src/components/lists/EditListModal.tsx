import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import { DocumentDuplicateIcon, TrashIcon } from '@heroicons/react/24/outline';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { useUpdateList, useList, useDuplicateList } from '../../hooks/useLists';
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
  const navigate = useNavigate();
  const { open, listId } = useUIStore((state) => state.editListModal);
  const closeModal = useUIStore((state) => state.closeEditListModal);
  const openDeleteListDialog = useUIStore((state) => state.openDeleteListDialog);
  const { isAuthReady } = useAuth();

  const { data: list } = useList(listId || '', { enabled: isAuthReady && !!listId });
  const updateList = useUpdateList();
  const duplicateList = useDuplicateList();

  const [name, setName] = useState('');
  const [icon, setIcon] = useState<string | null>(null);
  const [color, setColor] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [isDuplicating, setIsDuplicating] = useState(false);

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

  const handleDuplicate = async () => {
    if (!list || !listId) return;

    setIsDuplicating(true);
    try {
      const newList = await duplicateList.mutateAsync({
        id: listId,
        data: { name: `${list.name} (Copy)` },
      });
      handleClose();
      navigate(`/lists/${newList.id}`);
    } catch (err: unknown) {
      const apiError = err as { message?: string; data?: { detail?: string } };
      const errorMessage = apiError.data?.detail || apiError.message || 'Failed to duplicate list';
      console.error('Failed to duplicate list:', { listId, error: err, errorMessage });
      setError(errorMessage);
    } finally {
      setIsDuplicating(false);
    }
  };

  const handleDelete = () => {
    if (!list || !listId) return;
    handleClose();
    openDeleteListDialog(listId, list.name, list.items?.length || 0);
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
            <div className="bg-[var(--color-bg-card)] rounded-t-2xl shadow-lg max-h-[85vh] overflow-y-auto">
              {/* Drag handle */}
              <div className="flex justify-center py-3 sticky top-0 bg-[var(--color-bg-card)]">
                <div className="w-10 h-1 bg-[var(--color-text-muted)]/30 rounded-full" />
              </div>

              <form onSubmit={handleSubmit} className="px-6 pb-6">
                <h2 className="text-xl font-semibold text-[var(--color-text-primary)] mb-6">
                  List Settings
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

                {/* Save actions */}
                <div className="flex gap-3 mb-6">
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

                {/* Divider */}
                <div className="h-px bg-[var(--color-text-muted)]/10 my-4" />

                {/* List actions */}
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={handleDuplicate}
                    disabled={isDuplicating}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)] transition-colors disabled:opacity-50"
                  >
                    <DocumentDuplicateIcon className="w-5 h-5" />
                    <span className="text-sm font-medium">
                      {isDuplicating ? 'Duplicating...' : 'Duplicate List'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={handleDelete}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-[var(--color-destructive)] hover:bg-[var(--color-destructive)]/10 transition-colors"
                  >
                    <TrashIcon className="w-5 h-5" />
                    <span className="text-sm font-medium">Delete List</span>
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
