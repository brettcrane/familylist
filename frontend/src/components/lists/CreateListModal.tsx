import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { useCreateList } from '../../hooks/useLists';
import { useUIStore } from '../../stores/uiStore';
import type { ListType } from '../../types/api';
import { LIST_TYPE_ICONS } from '../../types/api';

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      setError('Please enter a list name');
      return;
    }

    try {
      await createList.mutateAsync({ name: name.trim(), type });
      handleClose();
    } catch (err) {
      setError('Failed to create list. Please try again.');
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
                  Create New List
                </h2>

                {/* Name input */}
                <div className="mb-6">
                  <label
                    htmlFor="list-name"
                    className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2"
                  >
                    List Name
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

                {/* Type selection */}
                <div className="mb-8">
                  <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-3">
                    List Type
                  </label>
                  <div className="grid grid-cols-3 gap-3">
                    {listTypes.map((item) => (
                      <button
                        key={item.type}
                        type="button"
                        onClick={() => setType(item.type)}
                        className={clsx(
                          'flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all',
                          type === item.type
                            ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/10'
                            : 'border-[var(--color-text-muted)]/20 hover:border-[var(--color-text-muted)]/40'
                        )}
                      >
                        <span className="text-2xl">
                          {LIST_TYPE_ICONS[item.type]}
                        </span>
                        <span
                          className={clsx(
                            'text-sm font-medium',
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
                    Create List
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
