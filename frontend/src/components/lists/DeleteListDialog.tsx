import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '../ui/Button';
import { useDeleteList } from '../../hooks/useLists';
import { useUIStore } from '../../stores/uiStore';

export function DeleteListDialog() {
  const navigate = useNavigate();
  const { open, listId, listName, itemCount } = useUIStore(
    (state) => state.deleteListDialog
  );
  const closeDialog = useUIStore((state) => state.closeDeleteListDialog);
  const deleteList = useDeleteList();

  const handleDelete = async () => {
    if (!listId) return;

    try {
      await deleteList.mutateAsync(listId);
      closeDialog();
      navigate('/');
    } catch {
      // Error handling - could add toast here
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
            onClick={closeDialog}
            className="fixed inset-0 z-[var(--z-modal)] bg-black/50"
          />

          {/* Dialog */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center p-4"
          >
            <div className="bg-[var(--color-bg-card)] rounded-2xl shadow-lg max-w-sm w-full p-6">
              {/* Trash icon with animated scale-in */}
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.1, type: 'spring', damping: 15, stiffness: 300 }}
                className="w-12 h-12 mx-auto mb-4 bg-[var(--color-destructive)]/10 rounded-full flex items-center justify-center"
              >
                <svg
                  className="w-6 h-6 text-[var(--color-destructive)]"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  <line x1="10" y1="11" x2="10" y2="17" />
                  <line x1="14" y1="11" x2="14" y2="17" />
                </svg>
              </motion.div>

              <h2 className="text-lg font-semibold text-[var(--color-text-primary)] text-center mb-2">
                Delete "{listName}"?
              </h2>

              <p className="text-sm text-[var(--color-text-muted)] text-center mb-2">
                This will permanently delete this list
                {itemCount > 0 && ` and all ${itemCount} item${itemCount !== 1 ? 's' : ''}`}.
              </p>

              <p className="text-sm font-medium text-[var(--color-destructive)] text-center mb-6">
                This cannot be undone.
              </p>

              {/* Actions */}
              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={closeDialog}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={handleDelete}
                  isLoading={deleteList.isPending}
                  className="flex-1"
                >
                  Delete
                </Button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
