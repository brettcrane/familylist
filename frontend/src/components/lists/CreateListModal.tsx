import { useState } from 'react';
import { motion, AnimatePresence, type PanInfo } from 'framer-motion';
import clsx from 'clsx';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { useCreateList } from '../../hooks/useLists';
import { useUIStore } from '../../stores/uiStore';
import type { ListType } from '../../types/api';
import { ListTypeIcon } from '../icons/CategoryIcons';

const listTypes: { type: ListType; label: string }[] = [
  { type: 'grocery', label: 'Grocery' },
  { type: 'packing', label: 'Packing' },
  { type: 'tasks', label: 'Tasks' },
];

export function CreateListModal() {
  const isOpen = useUIStore((state) => state.isCreateListModalOpen);
  const setOpen = useUIStore((state) => state.setCreateListModalOpen);

  const [name, setName] = useState('');
  const [type, setType] = useState<ListType>('grocery');
  const [error, setError] = useState('');

  const createList = useCreateList();

  const handleClose = () => {
    setOpen(false);
    setName('');
    setType('grocery');
    setError('');
  };

  const handleDragEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    // Close if dragged down more than 100px or with enough velocity
    if (info.offset.y > 100 || info.velocity.y > 500) {
      handleClose();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      setError('Please enter a list name');
      return;
    }

    try {
      await createList.mutateAsync({ name: name.trim(), type });
      handleClose();
    } catch (err: unknown) {
      const apiError = err as { message?: string; data?: { detail?: string } };
      const errorMessage = apiError.data?.detail || apiError.message || 'Failed to create list. Please try again.';
      console.error('Failed to create list:', { name: name.trim(), type, error: err });
      setError(errorMessage);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="fixed inset-0 z-[var(--z-modal)] bg-black/50"
          />

          {/* Modal with drag-to-dismiss */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 350 }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={handleDragEnd}
            className="fixed inset-x-0 bottom-0 z-[var(--z-modal)] safe-bottom"
          >
            <div className="bg-[var(--color-bg-card)] rounded-t-2xl shadow-lg">
              {/* Drag handle - larger touch target, touch-none to prevent pull-to-refresh */}
              <div className="flex justify-center pt-3 pb-2 cursor-grab active:cursor-grabbing touch-none">
                <div className="w-10 h-1.5 bg-[var(--color-text-muted)]/40 rounded-full" />
              </div>

              <form onSubmit={handleSubmit} className="px-5 pb-5">
                <h2 className="font-display text-lg font-semibold text-[var(--color-text-primary)] mb-4">
                  Create New List
                </h2>

                {/* Name input */}
                <div className="mb-4">
                  <label
                    htmlFor="list-name"
                    className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5"
                  >
                    Name
                  </label>
                  <Input
                    id="list-name"
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

                {/* Type selection - more compact */}
                <div className="mb-5">
                  <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
                    Type
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {listTypes.map((item) => (
                      <button
                        key={item.type}
                        type="button"
                        onClick={() => setType(item.type)}
                        className={clsx(
                          'flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all',
                          type === item.type
                            ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/10'
                            : 'border-[var(--color-text-muted)]/20 hover:border-[var(--color-text-muted)]/40'
                        )}
                      >
                        <ListTypeIcon type={item.type} className="w-6 h-6" />
                        <span
                          className={clsx(
                            'text-xs font-medium',
                            type === item.type
                              ? 'text-[var(--color-accent)]'
                              : 'text-[var(--color-text-secondary)]'
                          )}
                        >
                          {item.label}
                        </span>
                      </button>
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
                    isLoading={createList.isPending}
                    className="flex-1"
                  >
                    Create
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
