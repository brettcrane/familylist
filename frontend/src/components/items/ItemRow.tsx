import { useState, useRef, useEffect } from 'react';
import clsx from 'clsx';
import { EllipsisHorizontalIcon } from '@heroicons/react/24/outline';
import { Checkbox } from '../ui/Checkbox';
import { useHasPendingMutation } from '../../hooks/useOfflineQueue';
import type { Item } from '../../types/api';

interface ItemRowProps {
  item: Item;
  onCheck: () => void;
  onEdit?: () => void;
  onNameChange?: (newName: string) => void;
}

export function ItemRow({ item, onCheck, onEdit, onNameChange }: ItemRowProps) {
  const hasPending = useHasPendingMutation(item.id);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(item.name);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when entering edit mode
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  // Update editName if item.name changes externally
  useEffect(() => {
    if (!isEditing) {
      setEditName(item.name);
    }
  }, [item.name, isEditing]);

  const handleNameClick = () => {
    if (onNameChange && !item.is_checked) {
      setIsEditing(true);
    }
  };

  const handleSaveName = () => {
    const trimmedName = editName.trim();
    if (trimmedName && trimmedName !== item.name && onNameChange) {
      onNameChange(trimmedName);
    }
    setIsEditing(false);
    // Let the useEffect sync editName when item.name changes (on success or rollback)
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditName(item.name);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSaveName();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCancelEdit();
    }
  };

  return (
    <div
      className={clsx(
        'flex items-center gap-3 px-4 py-1.5 bg-[var(--color-bg-card)]',
        'border-b border-[var(--color-text-muted)]/10'
      )}
    >
      <Checkbox
        checked={item.is_checked}
        onCheckedChange={onCheck}
        aria-label={`Mark ${item.name} as ${item.is_checked ? 'incomplete' : 'complete'}`}
      />

      {/* Item content area */}
      <div className="flex-1 min-w-0">
        {isEditing ? (
          /* Inline edit input */
          <input
            ref={inputRef}
            type="text"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onBlur={handleSaveName}
            onKeyDown={handleKeyDown}
            className={clsx(
              'w-full px-2 py-1 -mx-2 -my-1 rounded-lg',
              'bg-[var(--color-bg-secondary)] border border-[var(--color-accent)]',
              'text-[var(--color-text-primary)] font-medium',
              'focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/30'
            )}
            aria-label="Edit item name"
          />
        ) : (
          /* Display mode */
          <div className="flex items-center gap-2">
            {onNameChange && !item.is_checked ? (
              <button
                type="button"
                onClick={handleNameClick}
                className={clsx(
                  'font-medium truncate text-left',
                  'hover:text-[var(--color-accent)] transition-colors',
                  'focus:outline-none focus:text-[var(--color-accent)]',
                  item.is_checked
                    ? 'text-[var(--color-text-muted)] line-through'
                    : 'text-[var(--color-text-primary)]'
                )}
                title="Click to edit name"
              >
                {item.name}
              </button>
            ) : (
              <span
                className={clsx(
                  'font-medium truncate',
                  item.is_checked
                    ? 'text-[var(--color-text-muted)] line-through'
                    : 'text-[var(--color-text-primary)]'
                )}
              >
                {item.name}
              </span>
            )}
            {item.quantity > 1 && (
              <span className="font-mono text-xs text-[var(--color-text-muted)] bg-[var(--color-bg-secondary)] px-1.5 py-0.5 rounded flex-shrink-0">
                ×{item.quantity}
              </span>
            )}
            {hasPending && (
              <span className="w-2 h-2 rounded-full bg-[var(--color-pending)] animate-pulse flex-shrink-0" />
            )}
          </div>
        )}
        {item.notes && !isEditing && (
          <p className="text-sm text-[var(--color-text-muted)] truncate mt-0.5">
            {item.notes}
          </p>
        )}
      </div>

      {/* More options button - 44px tap target with negative margin to not inflate row height */}
      {onEdit && !isEditing && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
          className={clsx(
            'w-11 h-11 -mr-2 -my-1.5 rounded-xl flex-shrink-0',
            'flex items-center justify-center',
            'text-[var(--color-text-muted)] hover:text-[var(--color-accent)]',
            'hover:bg-[var(--color-bg-secondary)] active:bg-[var(--color-bg-secondary)]',
            'transition-colors touch-manipulation',
            'focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/30'
          )}
          aria-label={`Edit details for ${item.name}`}
          title="Edit category, quantity, notes"
        >
          <EllipsisHorizontalIcon className="w-5 h-5" />
        </button>
      )}

    </div>
  );
}
