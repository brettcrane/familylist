import { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence, type PanInfo } from 'framer-motion';
import clsx from 'clsx';
import { ChevronDownIcon, CheckIcon, PlusIcon, MinusIcon, TrashIcon, ChevronUpIcon } from '@heroicons/react/24/outline';
import { Button } from '../ui/Button';
import { CategoryIcon } from '../icons/CategoryIcons';
import { useCreateCategory } from '../../hooks/useCategories';
import { useListShares, useCurrentUser } from '../../hooks/useShares';
import { useUIStore } from '../../stores/uiStore';
import { getErrorMessage } from '../../api/client';
import { MAGNITUDE_CONFIG, MAGNITUDE_OPTIONS } from '../../types/api';
import { getUserColor } from '../../utils/colors';
import { getInitials } from '../../utils/strings';
import type { Item, Category, ItemUpdate, Magnitude } from '../../types/api';

interface EditItemModalProps {
  item: Item | null;
  listId: string;
  categories: Category[];
  onSave: (itemId: string, data: ItemUpdate) => void;
  onDelete: (itemId: string) => void;
  onClose: () => void;
  isSaving?: boolean;
  isShared?: boolean;
  ownerId?: string | null;
  ownerName?: string | null;
}

export function EditItemModal({
  item,
  listId,
  categories,
  onSave,
  onDelete,
  onClose,
  isSaving = false,
  isShared = false,
  ownerId,
  ownerName,
}: EditItemModalProps) {
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState('');
  const [magnitude, setMagnitude] = useState<Magnitude | null>(null);
  const [assignedTo, setAssignedTo] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false);
  const [effortDropdownOpen, setEffortDropdownOpen] = useState(false);
  const [assignedDropdownOpen, setAssignedDropdownOpen] = useState(false);
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newlyCreatedCategory, setNewlyCreatedCategory] = useState<{ id: string; name: string } | null>(null);
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const categoryDropdownRef = useRef<HTMLDivElement>(null);
  const effortDropdownRef = useRef<HTMLDivElement>(null);
  const assignedDropdownRef = useRef<HTMLDivElement>(null);
  const newCategoryInputRef = useRef<HTMLInputElement>(null);

  const showToast = useUIStore((state) => state.showToast);
  const createCategory = useCreateCategory(listId);

  // Fetch shares and current user for assigned-to dropdown
  const { data: shares, isError: sharesError, isLoading: sharesLoading } = useListShares(isShared ? listId : undefined);
  const { data: currentUser } = useCurrentUser();

  // Reset state when item changes
  useEffect(() => {
    if (item) {
      setSelectedCategoryId(item.category_id);
      setQuantity(item.quantity);
      setNotes(item.notes || '');
      setMagnitude(item.magnitude);
      setAssignedTo(item.assigned_to);
      setHasChanges(false);
      setCategoryDropdownOpen(false);
      setEffortDropdownOpen(false);
      setAssignedDropdownOpen(false);
      setIsCreatingCategory(false);
      setNewCategoryName('');
      setNewlyCreatedCategory(null);
      setCategoryError(null);
    }
  }, [item]);

  // Focus new category input when creating
  useEffect(() => {
    if (isCreatingCategory && newCategoryInputRef.current) {
      newCategoryInputRef.current.focus();
    }
  }, [isCreatingCategory]);

  // Track changes
  useEffect(() => {
    if (item) {
      const categoryChanged = selectedCategoryId !== item.category_id;
      const quantityChanged = quantity !== item.quantity;
      const notesChanged = (notes || '') !== (item.notes || '');
      const magnitudeChanged = magnitude !== item.magnitude;
      const assignedChanged = assignedTo !== item.assigned_to;
      setHasChanges(categoryChanged || quantityChanged || notesChanged || magnitudeChanged || assignedChanged);
    }
  }, [item, selectedCategoryId, quantity, notes, magnitude, assignedTo]);

  // Handle Escape key to close modal (with proper state sequence)
  useEffect(() => {
    if (!item) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (assignedDropdownOpen) {
          setAssignedDropdownOpen(false);
        } else if (effortDropdownOpen) {
          setEffortDropdownOpen(false);
        } else if (isCreatingCategory) {
          setIsCreatingCategory(false);
          setNewCategoryName('');
          setCategoryError(null);
        } else if (categoryDropdownOpen) {
          setCategoryDropdownOpen(false);
        } else {
          onClose();
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [item, onClose, categoryDropdownOpen, isCreatingCategory, effortDropdownOpen, assignedDropdownOpen]);

  // Close category dropdown when clicking outside
  useEffect(() => {
    if (!categoryDropdownOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (categoryDropdownRef.current && !categoryDropdownRef.current.contains(e.target as Node)) {
        setCategoryDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [categoryDropdownOpen]);

  // Close effort dropdown when clicking outside
  useEffect(() => {
    if (!effortDropdownOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (effortDropdownRef.current && !effortDropdownRef.current.contains(e.target as Node)) {
        setEffortDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [effortDropdownOpen]);

  // Close assigned dropdown when clicking outside
  useEffect(() => {
    if (!assignedDropdownOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (assignedDropdownRef.current && !assignedDropdownRef.current.contains(e.target as Node)) {
        setAssignedDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [assignedDropdownOpen]);

  const handleDragEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (info.offset.y > 100 || info.velocity.y > 500) {
      onClose();
    }
  };

  const handleSave = () => {
    if (!item || !hasChanges) return;

    const updates: ItemUpdate = {};
    if (selectedCategoryId !== item.category_id) {
      updates.category_id = selectedCategoryId;
    }
    if (quantity !== item.quantity) {
      updates.quantity = quantity;
    }
    if ((notes || '') !== (item.notes || '')) {
      updates.notes = notes || null;
    }
    if (magnitude !== item.magnitude) {
      updates.magnitude = magnitude;
    }
    if (assignedTo !== item.assigned_to) {
      updates.assigned_to = assignedTo;
    }

    onSave(item.id, updates);
  };

  const handleQuantityChange = (delta: number) => {
    setQuantity((prev) => Math.max(1, Math.min(99, prev + delta)));
  };

  const handleCreateCategory = async () => {
    const trimmedName = newCategoryName.trim();
    if (!trimmedName) return;

    const isDuplicate = categories.some(
      (cat) => cat.name.toLowerCase() === trimmedName.toLowerCase()
    );
    if (isDuplicate) {
      setCategoryError(`Category "${trimmedName}" already exists`);
      return;
    }

    setCategoryError(null);

    try {
      const newCategory = await createCategory.mutateAsync({ name: trimmedName });
      setNewlyCreatedCategory({ id: newCategory.id, name: newCategory.name });
      setSelectedCategoryId(newCategory.id);
      setIsCreatingCategory(false);
      setNewCategoryName('');
      setCategoryDropdownOpen(false);
    } catch (err) {
      console.error('Failed to create category:', err);
      const errorMessage = getErrorMessage(err, 'Failed to create category');
      setCategoryError(errorMessage);
      showToast(errorMessage, 'error');
    }
  };

  // Sort categories by sort_order
  const sortedCategories = useMemo(
    () => [...categories].sort((a, b) => a.sort_order - b.sort_order),
    [categories]
  );
  const selectedCategory = sortedCategories.find(c => c.id === selectedCategoryId)
    || (newlyCreatedCategory?.id === selectedCategoryId ? newlyCreatedCategory as Category : null);

  // Build assigned-to options
  const assignedUserName = useMemo(() => {
    if (!assignedTo) return null;
    if (currentUser && assignedTo === currentUser.id) return currentUser.display_name;
    if (ownerId && assignedTo === ownerId && ownerName) return ownerName;
    const share = shares?.find(s => s.user.id === assignedTo);
    if (share) return share.user.display_name;
    return item?.assigned_to_name || null;
  }, [assignedTo, currentUser, ownerId, ownerName, shares, item]);

  const sortedMembers = useMemo(() => {
    if (!shares) return [];
    return shares
      .filter(s => {
        if (currentUser && s.user.id === currentUser.id) return false;
        if (ownerId && s.user.id === ownerId) return false;
        return true;
      })
      .sort((a, b) => a.user.display_name.localeCompare(b.user.display_name));
  }, [shares, currentUser, ownerId]);

  return (
    <AnimatePresence>
      {item && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[var(--z-modal)] bg-black/50 backdrop-blur-sm"
          />

          {/* Bottom Sheet with drag-to-dismiss */}
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-item-title"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 350 }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={handleDragEnd}
            className="fixed inset-x-0 bottom-0 z-[var(--z-modal)] bg-[var(--color-bg-primary)] rounded-t-3xl shadow-2xl max-h-[70vh] overflow-hidden"
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-2 cursor-grab active:cursor-grabbing touch-none">
              <div className="w-10 h-1.5 bg-[var(--color-text-muted)]/40 rounded-full" />
            </div>

            {/* Header */}
            <div className="px-5 pb-3 border-b border-[var(--color-text-muted)]/10">
              <h2 id="edit-item-title" className="font-display text-lg font-semibold text-[var(--color-text-primary)]">
                Edit Item
              </h2>
              <div className="mt-0.5 flex items-center justify-between gap-3">
                <p className="text-sm text-[var(--color-text-secondary)] font-medium truncate mr-3">
                  {item.name}
                </p>
                {/* Quantity stepper in header */}
                <div className="flex items-center h-9 bg-[var(--color-bg-secondary)] rounded-xl flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => handleQuantityChange(-1)}
                    disabled={quantity <= 1}
                    className={clsx(
                      'w-8 h-full flex items-center justify-center transition-colors rounded-l-xl',
                      'text-[var(--color-text-primary)] hover:bg-[var(--color-bg-card)]',
                      'disabled:opacity-40 disabled:cursor-not-allowed'
                    )}
                  >
                    <MinusIcon className="w-3.5 h-3.5" strokeWidth={2.5} />
                  </button>
                  <div className="w-8 text-center">
                    <span className="font-display text-lg font-bold text-[var(--color-text-primary)]">
                      {quantity}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleQuantityChange(1)}
                    disabled={quantity >= 99}
                    className={clsx(
                      'w-8 h-full flex items-center justify-center transition-colors rounded-r-xl',
                      'text-[var(--color-text-primary)] hover:bg-[var(--color-bg-card)]',
                      'disabled:opacity-40 disabled:cursor-not-allowed'
                    )}
                  >
                    <PlusIcon className="w-3.5 h-3.5" strokeWidth={2.5} />
                  </button>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="overflow-y-auto p-5 space-y-4" style={{ maxHeight: 'calc(70vh - 140px)' }}>
              {/* Category and Effort row - side by side */}
              <div className="flex gap-3 items-start">
                {/* Category Dropdown */}
                <div className="flex-1" ref={categoryDropdownRef}>
                  <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">
                    Category
                  </label>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setCategoryDropdownOpen(!categoryDropdownOpen)}
                      aria-expanded={categoryDropdownOpen}
                      aria-haspopup="listbox"
                      aria-label="Select category"
                      className={clsx(
                        'w-full h-11 px-3 rounded-xl border-2 transition-all',
                        'flex items-center justify-between gap-2',
                        'bg-[var(--color-bg-secondary)]',
                        categoryDropdownOpen
                          ? 'border-[var(--color-accent)]'
                          : 'border-transparent hover:border-[var(--color-text-muted)]/30'
                      )}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <CategoryIcon category={selectedCategory?.name || 'Uncategorized'} className="w-5 h-5 flex-shrink-0 text-[var(--color-text-muted)]" />
                        <span className="text-sm text-[var(--color-text-primary)] truncate">
                          {selectedCategory?.name || 'Uncategorized'}
                        </span>
                      </div>
                      <ChevronDownIcon className={clsx(
                        'w-4 h-4 text-[var(--color-text-muted)] transition-transform flex-shrink-0',
                        categoryDropdownOpen && 'rotate-180'
                      )} />
                    </button>

                    <AnimatePresence>
                      {categoryDropdownOpen && (
                        <motion.div
                          initial={{ opacity: 0, y: -8, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: -8, scale: 0.95 }}
                          transition={{ duration: 0.15 }}
                          role="listbox"
                          aria-label="Category options"
                          className="absolute top-full left-0 right-0 mt-1 z-[calc(var(--z-modal)+10)] bg-[var(--color-bg-card)] rounded-xl shadow-lg border border-[var(--color-text-muted)]/10 overflow-hidden max-h-52 overflow-y-auto"
                        >
                          <button
                            type="button"
                            role="option"
                            aria-selected={selectedCategoryId === null}
                            onClick={() => {
                              setSelectedCategoryId(null);
                              setCategoryDropdownOpen(false);
                            }}
                            className={clsx(
                              'w-full px-3 py-2.5 flex items-center justify-between',
                              'hover:bg-[var(--color-bg-secondary)] transition-colors',
                              selectedCategoryId === null && 'bg-[var(--color-accent)]/5'
                            )}
                          >
                            <div className="flex items-center gap-2">
                              <CategoryIcon category="Uncategorized" className="w-5 h-5 text-[var(--color-text-muted)]" />
                              <span className="text-sm text-[var(--color-text-primary)]">Uncategorized</span>
                            </div>
                            {selectedCategoryId === null && (
                              <CheckIcon className="w-4 h-4 text-[var(--color-accent)]" />
                            )}
                          </button>

                          {sortedCategories.map((category) => (
                            <button
                              key={category.id}
                              type="button"
                              role="option"
                              aria-selected={selectedCategoryId === category.id}
                              onClick={() => {
                                setSelectedCategoryId(category.id);
                                setCategoryDropdownOpen(false);
                              }}
                              className={clsx(
                                'w-full px-3 py-2.5 flex items-center justify-between',
                                'hover:bg-[var(--color-bg-secondary)] transition-colors',
                                selectedCategoryId === category.id && 'bg-[var(--color-accent)]/5'
                              )}
                            >
                              <div className="flex items-center gap-2">
                                <CategoryIcon category={category.name} className="w-5 h-5 text-[var(--color-text-muted)]" />
                                <span className="text-sm text-[var(--color-text-primary)]">{category.name}</span>
                              </div>
                              {selectedCategoryId === category.id && (
                                <CheckIcon className="w-4 h-4 text-[var(--color-accent)]" />
                              )}
                            </button>
                          ))}

                          <div className="h-px bg-[var(--color-text-muted)]/10 my-1" />

                          {isCreatingCategory ? (
                            <div className="p-2">
                              <div className="flex gap-2">
                                <input
                                  ref={newCategoryInputRef}
                                  type="text"
                                  value={newCategoryName}
                                  onChange={(e) => setNewCategoryName(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault();
                                      handleCreateCategory();
                                    } else if (e.key === 'Escape') {
                                      e.stopPropagation();
                                      setIsCreatingCategory(false);
                                      setNewCategoryName('');
                                      setCategoryError(null);
                                    }
                                  }}
                                  placeholder="Category name..."
                                  className={clsx(
                                    'flex-1 px-3 py-2 text-sm rounded-lg',
                                    'bg-[var(--color-bg-secondary)] border border-[var(--color-text-muted)]/20',
                                    'text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]',
                                    'focus:outline-none focus:border-[var(--color-accent)]'
                                  )}
                                />
                                <button
                                  type="button"
                                  onClick={handleCreateCategory}
                                  disabled={!newCategoryName.trim() || createCategory.isPending}
                                  className={clsx(
                                    'px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                                    'bg-[var(--color-accent)] text-white',
                                    'disabled:opacity-50 disabled:cursor-not-allowed'
                                  )}
                                >
                                  {createCategory.isPending ? '...' : 'Add'}
                                </button>
                              </div>
                              {categoryError && (
                                <p className="mt-1 text-xs text-[var(--color-destructive)]">
                                  {categoryError}
                                </p>
                              )}
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setIsCreatingCategory(true)}
                              className={clsx(
                                'w-full px-3 py-2.5 flex items-center gap-2',
                                'hover:bg-[var(--color-bg-secondary)] transition-colors',
                                'text-[var(--color-accent)]'
                              )}
                            >
                              <PlusIcon className="w-5 h-5" />
                              <span className="text-sm font-medium">Add new category</span>
                            </button>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>

                {/* Effort Dropdown */}
                <div className="flex-1" ref={effortDropdownRef}>
                  <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">
                    Effort
                  </label>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setEffortDropdownOpen(!effortDropdownOpen)}
                      aria-expanded={effortDropdownOpen}
                      aria-haspopup="listbox"
                      aria-label="Select effort"
                      className={clsx(
                        'w-full h-11 px-3 rounded-xl border-2 transition-all',
                        'flex items-center justify-between gap-2',
                        'bg-[var(--color-bg-secondary)]',
                        effortDropdownOpen
                          ? 'border-[var(--color-accent)]'
                          : 'border-transparent hover:border-[var(--color-text-muted)]/30'
                      )}
                    >
                      <span className={clsx(
                        'text-sm truncate',
                        magnitude ? 'text-[var(--color-text-primary)]' : 'text-[var(--color-text-muted)]'
                      )}>
                        {magnitude ? MAGNITUDE_CONFIG[magnitude].label : 'None'}
                      </span>
                      <ChevronDownIcon className={clsx(
                        'w-4 h-4 text-[var(--color-text-muted)] transition-transform flex-shrink-0',
                        effortDropdownOpen && 'rotate-180'
                      )} />
                    </button>

                    <AnimatePresence>
                      {effortDropdownOpen && (
                        <motion.div
                          initial={{ opacity: 0, y: -8, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: -8, scale: 0.95 }}
                          transition={{ duration: 0.15 }}
                          role="listbox"
                          aria-label="Effort options"
                          className="absolute top-full left-0 right-0 mt-1 z-[calc(var(--z-modal)+10)] bg-[var(--color-bg-card)] rounded-xl shadow-lg border border-[var(--color-text-muted)]/10 overflow-hidden"
                        >
                          {MAGNITUDE_OPTIONS.map((option) => (
                            <button
                              key={option.label}
                              type="button"
                              role="option"
                              aria-selected={magnitude === option.value}
                              onClick={() => {
                                setMagnitude(option.value);
                                setEffortDropdownOpen(false);
                              }}
                              className={clsx(
                                'w-full px-3 py-2.5 flex items-center justify-between',
                                'hover:bg-[var(--color-bg-secondary)] transition-colors',
                                magnitude === option.value && 'bg-[var(--color-accent)]/5'
                              )}
                            >
                              <div className="flex items-center gap-2">
                                {option.value && (
                                  <span
                                    className={clsx(
                                      'px-1.5 py-0.5 rounded-full font-bold',
                                      MAGNITUDE_CONFIG[option.value].textClass,
                                      MAGNITUDE_CONFIG[option.value].bgClass,
                                    )}
                                    style={{ fontSize: '10px' }}
                                  >
                                    {option.value}
                                  </span>
                                )}
                                <span className="text-sm text-[var(--color-text-primary)]">{option.label}</span>
                              </div>
                              {magnitude === option.value && (
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

              {/* Notes */}
              <div>
                <label
                  htmlFor="item-notes"
                  className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5"
                >
                  Notes
                </label>
                <textarea
                  id="item-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add a note..."
                  rows={2}
                  className={clsx(
                    'w-full px-3 py-2.5 rounded-xl resize-none',
                    'bg-[var(--color-bg-card)] border border-[var(--color-text-muted)]/20',
                    'text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]',
                    'transition-all duration-200 text-sm',
                    'focus:outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent)]/20'
                  )}
                />
              </div>

              {/* Assigned to - only for shared lists */}
              {isShared && (
                <div ref={assignedDropdownRef}>
                  <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">
                    Assigned to
                  </label>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setAssignedDropdownOpen(!assignedDropdownOpen)}
                      aria-expanded={assignedDropdownOpen}
                      aria-haspopup="listbox"
                      aria-label="Assign to user"
                      className={clsx(
                        'w-full h-11 px-3 rounded-xl border-2 transition-all',
                        'flex items-center justify-between gap-2',
                        'bg-[var(--color-bg-secondary)]',
                        assignedDropdownOpen
                          ? 'border-[var(--color-accent)]'
                          : 'border-transparent hover:border-[var(--color-text-muted)]/30'
                      )}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {assignedTo && assignedUserName ? (
                          <>
                            <span
                              className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                              style={{ backgroundColor: getUserColor(assignedTo) }}
                            >
                              <span className="text-white font-bold" style={{ fontSize: '8px' }}>
                                {getInitials(assignedUserName)}
                              </span>
                            </span>
                            <span className="text-sm text-[var(--color-text-primary)] truncate">
                              {currentUser && assignedTo === currentUser.id
                                ? `Me (${assignedUserName})`
                                : assignedUserName}
                            </span>
                          </>
                        ) : (
                          <span className="text-sm text-[var(--color-text-muted)]">Anyone</span>
                        )}
                      </div>
                      <ChevronUpIcon className={clsx(
                        'w-4 h-4 text-[var(--color-text-muted)] transition-transform flex-shrink-0',
                        assignedDropdownOpen && 'rotate-180'
                      )} />
                    </button>

                    <AnimatePresence>
                      {assignedDropdownOpen && (
                        <motion.div
                          initial={{ opacity: 0, y: 8, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: 8, scale: 0.95 }}
                          transition={{ duration: 0.15 }}
                          role="listbox"
                          aria-label="Assignment options"
                          className="absolute bottom-full left-0 right-0 mb-1 z-[calc(var(--z-modal)+10)] bg-[var(--color-bg-card)] rounded-xl shadow-lg border border-[var(--color-text-muted)]/10 overflow-hidden max-h-52 overflow-y-auto"
                        >
                          {/* Anyone option */}
                          <button
                            type="button"
                            role="option"
                            aria-selected={assignedTo === null}
                            onClick={() => {
                              setAssignedTo(null);
                              setAssignedDropdownOpen(false);
                            }}
                            className={clsx(
                              'w-full px-3 py-2.5 flex items-center justify-between',
                              'hover:bg-[var(--color-bg-secondary)] transition-colors',
                              assignedTo === null && 'bg-[var(--color-accent)]/5'
                            )}
                          >
                            <span className="text-sm text-[var(--color-text-primary)]">Anyone</span>
                            {assignedTo === null && (
                              <CheckIcon className="w-4 h-4 text-[var(--color-accent)]" />
                            )}
                          </button>

                          {/* Me option */}
                          {currentUser && (
                            <button
                              type="button"
                              role="option"
                              aria-selected={assignedTo === currentUser.id}
                              onClick={() => {
                                setAssignedTo(currentUser.id);
                                setAssignedDropdownOpen(false);
                              }}
                              className={clsx(
                                'w-full px-3 py-2.5 flex items-center justify-between',
                                'hover:bg-[var(--color-bg-secondary)] transition-colors',
                                assignedTo === currentUser.id && 'bg-[var(--color-accent)]/5'
                              )}
                            >
                              <div className="flex items-center gap-2">
                                <span
                                  className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                                  style={{ backgroundColor: getUserColor(currentUser.id) }}
                                >
                                  <span className="text-white font-bold" style={{ fontSize: '8px' }}>
                                    {getInitials(currentUser.display_name)}
                                  </span>
                                </span>
                                <span className="text-sm text-[var(--color-text-primary)]">
                                  Me ({currentUser.display_name})
                                </span>
                              </div>
                              {assignedTo === currentUser.id && (
                                <CheckIcon className="w-4 h-4 text-[var(--color-accent)]" />
                              )}
                            </button>
                          )}

                          {/* Owner option (if current user is not the owner) */}
                          {ownerId && ownerName && (!currentUser || currentUser.id !== ownerId) && (
                            <button
                              type="button"
                              role="option"
                              aria-selected={assignedTo === ownerId}
                              onClick={() => {
                                setAssignedTo(ownerId);
                                setAssignedDropdownOpen(false);
                              }}
                              className={clsx(
                                'w-full px-3 py-2.5 flex items-center justify-between',
                                'hover:bg-[var(--color-bg-secondary)] transition-colors',
                                assignedTo === ownerId && 'bg-[var(--color-accent)]/5'
                              )}
                            >
                              <div className="flex items-center gap-2">
                                <span
                                  className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                                  style={{ backgroundColor: getUserColor(ownerId) }}
                                >
                                  <span className="text-white font-bold" style={{ fontSize: '8px' }}>
                                    {getInitials(ownerName)}
                                  </span>
                                </span>
                                <span className="text-sm text-[var(--color-text-primary)]">{ownerName}</span>
                              </div>
                              {assignedTo === ownerId && (
                                <CheckIcon className="w-4 h-4 text-[var(--color-accent)]" />
                              )}
                            </button>
                          )}

                          {/* Loading/error states for shares */}
                          {sharesLoading && (
                            <p className="px-3 py-2 text-sm text-[var(--color-text-muted)]">Loading members...</p>
                          )}
                          {sharesError && (
                            <p className="px-3 py-2 text-sm text-[var(--color-destructive)]">Failed to load members</p>
                          )}

                          {/* Shared members */}
                          {sortedMembers.map((share) => (
                            <button
                              key={share.user.id}
                              type="button"
                              role="option"
                              aria-selected={assignedTo === share.user.id}
                              onClick={() => {
                                setAssignedTo(share.user.id);
                                setAssignedDropdownOpen(false);
                              }}
                              className={clsx(
                                'w-full px-3 py-2.5 flex items-center justify-between',
                                'hover:bg-[var(--color-bg-secondary)] transition-colors',
                                assignedTo === share.user.id && 'bg-[var(--color-accent)]/5'
                              )}
                            >
                              <div className="flex items-center gap-2">
                                <span
                                  className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                                  style={{ backgroundColor: getUserColor(share.user.id) }}
                                >
                                  <span className="text-white font-bold" style={{ fontSize: '8px' }}>
                                    {getInitials(share.user.display_name)}
                                  </span>
                                </span>
                                <span className="text-sm text-[var(--color-text-primary)]">{share.user.display_name}</span>
                              </div>
                              {assignedTo === share.user.id && (
                                <CheckIcon className="w-4 h-4 text-[var(--color-accent)]" />
                              )}
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-5 pt-3 border-t border-[var(--color-text-muted)]/10 safe-bottom">
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => onDelete(item.id)}
                  disabled={isSaving}
                  className={clsx(
                    'w-11 h-11 flex items-center justify-center rounded-xl transition-colors',
                    'bg-[var(--color-destructive)]/10 text-[var(--color-destructive)]',
                    'hover:bg-[var(--color-destructive)]/20',
                    'disabled:opacity-50 disabled:cursor-not-allowed'
                  )}
                  aria-label="Delete item"
                  title="Delete item"
                >
                  <TrashIcon className="w-5 h-5" />
                </button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={onClose}
                  className="flex-1"
                  disabled={isSaving}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  onClick={handleSave}
                  disabled={!hasChanges || isSaving}
                  isLoading={isSaving}
                  className="flex-1"
                >
                  Save
                </Button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
