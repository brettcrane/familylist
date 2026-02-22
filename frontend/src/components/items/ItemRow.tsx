import { useState, useRef, useEffect } from 'react';
import clsx from 'clsx';
import { EllipsisHorizontalIcon } from '@heroicons/react/24/outline';
import { Checkbox } from '../ui/Checkbox';
import { MAGNITUDE_CONFIG, PRIORITY_CONFIG, CLAUDE_SYSTEM_USER_ID, formatQuantityUnit } from '../../types/api';
import { getUserColor } from '../../utils/colors';
import { getInitials } from '../../utils/strings';
import { isOverdue, formatDueDate } from '../../utils/dates';
import type { Item, ListType, Magnitude, Priority } from '../../types/api';

interface ItemRowProps {
  item: Item;
  listType?: ListType;
  onCheck: () => void;
  onEdit?: () => void;
  onNameChange?: (newName: string) => void;
  dragHandleSlot?: React.ReactNode;
}

export function ItemRow({ item, listType, onCheck, onEdit, onNameChange, dragHandleSlot }: ItemRowProps) {
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
        'flex items-center gap-2 px-4 py-1.5 bg-[var(--color-bg-card)]',
        'border-b border-[var(--color-text-muted)]/10'
      )}
    >
      {dragHandleSlot}
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
          <div className="flex items-center gap-1.5">
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
            {(() => {
              const qtyDisplay = formatQuantityUnit(item.quantity, item.unit);
              return qtyDisplay ? (
                <span className="font-mono text-xs text-[var(--color-text-muted)] bg-[var(--color-bg-secondary)] px-1.5 py-0.5 rounded flex-shrink-0">
                  {qtyDisplay}
                </span>
              ) : null;
            })()}
            {item.created_by === CLAUDE_SYSTEM_USER_ID && (
              <span
                className="w-4 h-4 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center flex-shrink-0"
                title="Created by Claude"
              >
                <span className="text-purple-600 dark:text-purple-400 font-bold" style={{ fontSize: '7px' }}>AI</span>
              </span>
            )}
          </div>
        )}
        {item.notes && !isEditing && (
          <p className="text-sm text-[var(--color-text-muted)] truncate mt-0.5">
            {item.notes}
          </p>
        )}
      </div>

      {/* Task metadata — fixed-width column slots for vertical alignment */}
      {!isEditing && listType === 'tasks' && (
        <div className="flex items-center flex-shrink-0">
          {/* Priority */}
          <div className="w-[22px] flex items-center justify-center">
            {item.priority && item.priority in PRIORITY_CONFIG && (
              <span
                className={clsx(
                  'w-[18px] h-[18px] rounded-full font-bold flex items-center justify-center',
                  PRIORITY_CONFIG[item.priority as Priority].textClass,
                  PRIORITY_CONFIG[item.priority as Priority].bgClass,
                )}
                style={{ fontSize: '9px' }}
              >
                {PRIORITY_CONFIG[item.priority as Priority].label.charAt(0)}
              </span>
            )}
          </div>

          {/* Magnitude */}
          <div className="w-[22px] flex items-center justify-center">
            {item.magnitude && item.magnitude in MAGNITUDE_CONFIG && (
              <span
                className={clsx(
                  'w-[18px] h-[18px] rounded-full font-bold flex items-center justify-center',
                  MAGNITUDE_CONFIG[item.magnitude as Magnitude].textClass,
                  MAGNITUDE_CONFIG[item.magnitude as Magnitude].bgClass,
                )}
                style={{ fontSize: '9px' }}
              >
                {item.magnitude}
              </span>
            )}
          </div>

          {/* Assigned-to avatar */}
          <div className="w-[26px] flex items-center justify-center">
            {item.assigned_to && item.assigned_to_name && (
              <span
                className="w-[22px] h-[22px] rounded-full flex items-center justify-center"
                style={{ backgroundColor: getUserColor(item.assigned_to) }}
                title={`Assigned to ${item.assigned_to_name}`}
              >
                <span className="text-white font-bold" style={{ fontSize: '9px' }}>
                  {getInitials(item.assigned_to_name)}
                </span>
              </span>
            )}
          </div>

          {/* Due date — last column before ellipsis */}
          <div className="w-12 flex items-center justify-end">
            {item.due_date && (
              <span
                className={clsx(
                  'font-medium whitespace-nowrap',
                  isOverdue(item.due_date)
                    ? 'text-red-600 bg-red-100 dark:text-red-400 dark:bg-red-900/30 px-1.5 py-0.5 rounded-full'
                    : 'text-[var(--color-text-muted)]'
                )}
                style={{ fontSize: '10px' }}
                title={`Due ${item.due_date}`}
              >
                {formatDueDate(item.due_date)}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Assigned-to avatar — non-task lists only (task lists render it inside the fixed-width container above) */}
      {!isEditing && listType !== 'tasks' && item.assigned_to && item.assigned_to_name && (
        <span
          className="w-[22px] h-[22px] rounded-full flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: getUserColor(item.assigned_to) }}
          title={`Assigned to ${item.assigned_to_name}`}
        >
          <span className="text-white font-bold" style={{ fontSize: '9px' }}>
            {getInitials(item.assigned_to_name)}
          </span>
        </span>
      )}

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
          title="Edit item details"
        >
          <EllipsisHorizontalIcon className="w-5 h-5" />
        </button>
      )}

    </div>
  );
}
