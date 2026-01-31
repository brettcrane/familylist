import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, type PanInfo } from 'framer-motion';
import clsx from 'clsx';
import { DocumentDuplicateIcon, TrashIcon, ChevronDownIcon, CheckIcon } from '@heroicons/react/24/outline';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { useUpdateList, useList, useDuplicateList } from '../../hooks/useLists';
import { useUIStore } from '../../stores/uiStore';
import { useAuth } from '../../contexts/AuthContext';

const ICON_OPTIONS = [
  '🛒', '🎒', '✅', '📝', '🏠', '🎁',
  '🌟', '❤️', '🎯', '📌', '✏️', '📋',
];

// 6 distinct colors with good differentiation - warm, cool, and neutral tones
const COLOR_OPTIONS = [
  { hex: '#E85D75', name: 'Rose' },
  { hex: '#F5A623', name: 'Amber' },
  { hex: '#7CB067', name: 'Sage' },
  { hex: '#4A90D9', name: 'Ocean' },
  { hex: '#9B6BC4', name: 'Violet' },
  { hex: '#6B7B8A', name: 'Slate' },
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
  const [iconDropdownOpen, setIconDropdownOpen] = useState(false);
  const [colorDropdownOpen, setColorDropdownOpen] = useState(false);
  const iconDropdownRef = useRef<HTMLDivElement>(null);
  const colorDropdownRef = useRef<HTMLDivElement>(null);

  // Sync form with list data when modal opens
  useEffect(() => {
    if (open && list) {
      setName(list.name);
      setIcon(list.icon);
      setColor(list.color);
      setError('');
      setIconDropdownOpen(false);
      setColorDropdownOpen(false);
    }
  }, [open, list]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    if (!iconDropdownOpen && !colorDropdownOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (iconDropdownOpen && iconDropdownRef.current && !iconDropdownRef.current.contains(e.target as Node)) {
        setIconDropdownOpen(false);
      }
      if (colorDropdownOpen && colorDropdownRef.current && !colorDropdownRef.current.contains(e.target as Node)) {
        setColorDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [iconDropdownOpen, colorDropdownOpen]);

  const handleClose = () => {
    closeModal();
    setName('');
    setIcon(null);
    setColor(null);
    setError('');
    setIconDropdownOpen(false);
    setColorDropdownOpen(false);
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

  const selectedColor = COLOR_OPTIONS.find(c => c.hex === color);

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
            <div className="bg-[var(--color-bg-card)] rounded-t-2xl shadow-lg max-h-[80vh] overflow-hidden flex flex-col">
              {/* Drag handle - larger touch target, touch-none to prevent pull-to-refresh */}
              <div className="flex justify-center pt-3 pb-2 cursor-grab active:cursor-grabbing touch-none">
                <div className="w-10 h-1.5 bg-[var(--color-text-muted)]/40 rounded-full" />
              </div>

              <form onSubmit={handleSubmit} className="px-5 pb-5 overflow-y-auto flex-1">
                <h2 className="font-display text-lg font-semibold text-[var(--color-text-primary)] mb-4">
                  List Settings
                </h2>

                {/* Name input */}
                <div className="mb-4">
                  <label
                    htmlFor="edit-list-name"
                    className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5"
                  >
                    Name
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

                {/* Icon and Color row - compact dropdowns side by side */}
                <div className="flex gap-3 mb-4">
                  {/* Icon dropdown */}
                  <div className="flex-1" ref={iconDropdownRef}>
                    <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">
                      Icon
                    </label>
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => {
                          setIconDropdownOpen(!iconDropdownOpen);
                          setColorDropdownOpen(false);
                        }}
                        aria-expanded={iconDropdownOpen}
                        aria-haspopup="listbox"
                        aria-label="Select icon"
                        className={clsx(
                          'w-full h-10 px-3 rounded-xl border-2 transition-all',
                          'flex items-center justify-between gap-2',
                          'bg-[var(--color-bg-secondary)]',
                          iconDropdownOpen
                            ? 'border-[var(--color-accent)]'
                            : 'border-[var(--color-text-muted)]/20 hover:border-[var(--color-text-muted)]/40'
                        )}
                      >
                        <div className="flex items-center gap-2">
                          {icon ? (
                            <span className="text-xl">{icon}</span>
                          ) : (
                            <span className="text-sm text-[var(--color-text-muted)]">None</span>
                          )}
                        </div>
                        <ChevronDownIcon className={clsx(
                          'w-4 h-4 text-[var(--color-text-muted)] transition-transform',
                          iconDropdownOpen && 'rotate-180'
                        )} />
                      </button>

                      {/* Icon dropdown menu */}
                      <AnimatePresence>
                        {iconDropdownOpen && (
                          <motion.div
                            initial={{ opacity: 0, y: -8, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -8, scale: 0.95 }}
                            transition={{ duration: 0.15 }}
                            role="listbox"
                            aria-label="Icon options"
                            className="absolute top-full left-0 right-0 mt-1 z-[calc(var(--z-modal)+10)] bg-[var(--color-bg-card)] rounded-xl shadow-lg border border-[var(--color-text-muted)]/10 overflow-hidden"
                          >
                            {/* None option */}
                            <button
                              type="button"
                              role="option"
                              aria-selected={icon === null}
                              onClick={() => {
                                setIcon(null);
                                setIconDropdownOpen(false);
                              }}
                              className={clsx(
                                'w-full px-3 py-2.5 flex items-center justify-between',
                                'hover:bg-[var(--color-bg-secondary)] transition-colors',
                                icon === null && 'bg-[var(--color-accent)]/5'
                              )}
                            >
                              <span className="text-sm text-[var(--color-text-secondary)]">None</span>
                              {icon === null && (
                                <CheckIcon className="w-4 h-4 text-[var(--color-accent)]" />
                              )}
                            </button>

                            {/* Icon grid inside dropdown */}
                            <div className="grid grid-cols-4 gap-1 p-2 border-t border-[var(--color-text-muted)]/10">
                              {ICON_OPTIONS.map((iconOption) => (
                                <button
                                  key={iconOption}
                                  type="button"
                                  role="option"
                                  aria-selected={icon === iconOption}
                                  onClick={() => {
                                    setIcon(iconOption);
                                    setIconDropdownOpen(false);
                                  }}
                                  className={clsx(
                                    'aspect-square flex items-center justify-center text-xl rounded-lg transition-all',
                                    icon === iconOption
                                      ? 'bg-[var(--color-accent)]/10 ring-2 ring-[var(--color-accent)]'
                                      : 'hover:bg-[var(--color-bg-secondary)]'
                                  )}
                                >
                                  {iconOption}
                                </button>
                              ))}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>

                  {/* Color dropdown */}
                  <div className="flex-1" ref={colorDropdownRef}>
                    <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">
                      Color
                    </label>
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => {
                          setColorDropdownOpen(!colorDropdownOpen);
                          setIconDropdownOpen(false);
                        }}
                        aria-expanded={colorDropdownOpen}
                        aria-haspopup="listbox"
                        aria-label="Select color"
                        className={clsx(
                          'w-full h-10 px-3 rounded-xl border-2 transition-all',
                          'flex items-center justify-between gap-2',
                          'bg-[var(--color-bg-secondary)]',
                          colorDropdownOpen
                            ? 'border-[var(--color-accent)]'
                            : 'border-[var(--color-text-muted)]/20 hover:border-[var(--color-text-muted)]/40'
                        )}
                      >
                        <div className="flex items-center gap-2">
                          {color ? (
                            <>
                              <div
                                className="w-5 h-5 rounded-full ring-1 ring-black/10"
                                style={{ backgroundColor: color }}
                              />
                              <span className="text-sm text-[var(--color-text-primary)]">
                                {selectedColor?.name}
                              </span>
                            </>
                          ) : (
                            <span className="text-sm text-[var(--color-text-muted)]">None</span>
                          )}
                        </div>
                        <ChevronDownIcon className={clsx(
                          'w-4 h-4 text-[var(--color-text-muted)] transition-transform',
                          colorDropdownOpen && 'rotate-180'
                        )} />
                      </button>

                      {/* Dropdown menu */}
                      <AnimatePresence>
                        {colorDropdownOpen && (
                          <motion.div
                            initial={{ opacity: 0, y: -8, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -8, scale: 0.95 }}
                            transition={{ duration: 0.15 }}
                            role="listbox"
                            aria-label="Color options"
                            className="absolute top-full left-0 right-0 mt-1 z-[calc(var(--z-modal)+10)] bg-[var(--color-bg-card)] rounded-xl shadow-lg border border-[var(--color-text-muted)]/10 overflow-hidden"
                          >
                            {/* None option */}
                            <button
                              type="button"
                              role="option"
                              aria-selected={color === null}
                              onClick={() => {
                                setColor(null);
                                setColorDropdownOpen(false);
                              }}
                              className={clsx(
                                'w-full px-3 py-2.5 flex items-center justify-between',
                                'hover:bg-[var(--color-bg-secondary)] transition-colors',
                                color === null && 'bg-[var(--color-accent)]/5'
                              )}
                            >
                              <span className="text-sm text-[var(--color-text-secondary)]">None</span>
                              {color === null && (
                                <CheckIcon className="w-4 h-4 text-[var(--color-accent)]" />
                              )}
                            </button>

                            {COLOR_OPTIONS.map((colorOption) => (
                              <button
                                key={colorOption.hex}
                                type="button"
                                role="option"
                                aria-selected={color === colorOption.hex}
                                onClick={() => {
                                  setColor(colorOption.hex);
                                  setColorDropdownOpen(false);
                                }}
                                className={clsx(
                                  'w-full px-3 py-2.5 flex items-center justify-between',
                                  'hover:bg-[var(--color-bg-secondary)] transition-colors',
                                  color === colorOption.hex && 'bg-[var(--color-accent)]/5'
                                )}
                              >
                                <div className="flex items-center gap-2">
                                  <div
                                    className="w-5 h-5 rounded-full ring-1 ring-black/10"
                                    style={{ backgroundColor: colorOption.hex }}
                                  />
                                  <span className="text-sm text-[var(--color-text-primary)]">
                                    {colorOption.name}
                                  </span>
                                </div>
                                {color === colorOption.hex && (
                                  <CheckIcon className="w-4 h-4 text-[var(--color-accent)]" />
                                )}
                              </button>
                            ))}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                </div>

                {/* Save actions */}
                <div className="flex gap-3 mb-4">
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
                    Save
                  </Button>
                </div>

                {/* Divider */}
                <div className="h-px bg-[var(--color-text-muted)]/10 my-3" />

                {/* List actions - side by side */}
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={handleDuplicate}
                    disabled={isDuplicating}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)] transition-colors disabled:opacity-50"
                  >
                    <DocumentDuplicateIcon className="w-4 h-4" />
                    <span className="text-sm">
                      {isDuplicating ? 'Duplicating...' : 'Duplicate'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={handleDelete}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-[var(--color-destructive)]/70 hover:text-[var(--color-destructive)] hover:bg-[var(--color-destructive)]/10 transition-colors"
                  >
                    <TrashIcon className="w-4 h-4" />
                    <span className="text-sm">Delete</span>
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
