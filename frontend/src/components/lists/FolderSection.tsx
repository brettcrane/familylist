import { useState, useRef, useEffect } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useDroppable } from '@dnd-kit/core';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import {
  Bars3Icon,
  ChevronRightIcon,
  EllipsisHorizontalIcon,
  PencilSquareIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import { IconFolder } from '@tabler/icons-react';
import type { List } from '../../types/api';
import type { Folder } from '../../stores/organizationStore';
import { useOrganization } from '../../hooks/useOrganization';
import { SortableListCard } from './SortableListCard';

interface FolderSectionProps {
  folder: Folder;
  lists: List[];
  organizeMode: boolean;
}

export function FolderSection({ folder, lists, organizeMode }: FolderSectionProps) {
  const { toggleFolderCollapse, renameFolder, deleteFolder } = useOrganization();
  const [menuOpen, setMenuOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(folder.name);
  const renameRef = useRef<HTMLInputElement>(null);

  const {
    attributes,
    listeners,
    setNodeRef: setSortableRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: folder.id, disabled: !organizeMode });

  const { setNodeRef: setDroppableRef, isOver } = useDroppable({
    id: `folder-drop-${folder.id}`,
    data: { type: 'folder', folderId: folder.id },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  useEffect(() => {
    if (renaming) renameRef.current?.focus();
  }, [renaming]);

  // Close menu on Escape key
  useEffect(() => {
    if (!menuOpen) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [menuOpen]);

  const commitRename = () => {
    const trimmed = renameValue.trim();
    if (trimmed && trimmed !== folder.name) {
      renameFolder(folder.id, trimmed);
    } else {
      setRenameValue(folder.name);
    }
    setRenaming(false);
  };

  const handleDelete = () => {
    setMenuOpen(false);
    if (window.confirm(`Delete folder "${folder.name}"? Lists will be moved to unfiled.`)) {
      deleteFolder(folder.id);
    }
  };

  return (
    <div
      ref={(node) => {
        setSortableRef(node);
        setDroppableRef(node);
      }}
      style={style}
      className="col-span-full"
    >
      {/* Folder header */}
      <div
        className={clsx(
          'flex items-center gap-2 py-2.5 px-4 rounded-lg transition-colors',
          isOver && 'bg-[var(--color-accent)]/10'
        )}
      >
        {organizeMode && (
          <button
            ref={setActivatorNodeRef}
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing p-1 rounded touch-manipulation"
            aria-label={`Reorder folder ${folder.name}`}
          >
            <Bars3Icon className="w-4 h-4 text-[var(--color-text-muted)]" />
          </button>
        )}

        <button
          onClick={() => toggleFolderCollapse(folder.id)}
          className="p-0.5 rounded transition-colors hover:bg-[var(--color-bg-secondary)]"
          aria-expanded={!folder.collapsed}
          aria-label={folder.collapsed ? `Expand ${folder.name}` : `Collapse ${folder.name}`}
        >
          <ChevronRightIcon
            className={clsx(
              'w-4 h-4 text-[var(--color-text-muted)] transition-transform duration-200',
              !folder.collapsed && 'rotate-90'
            )}
          />
        </button>

        <IconFolder className="w-4 h-4 text-[var(--color-text-muted)]" stroke={1.5} />

        {renaming ? (
          <input
            ref={renameRef}
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitRename();
              if (e.key === 'Escape') {
                setRenameValue(folder.name);
                setRenaming(false);
              }
            }}
            className="flex-1 min-w-0 bg-transparent text-sm font-semibold text-[var(--color-text-primary)] border-b border-[var(--color-accent)] outline-none py-0.5"
          />
        ) : (
          <button
            onClick={() => toggleFolderCollapse(folder.id)}
            className="flex-1 min-w-0 text-left"
          >
            <span className="text-sm font-semibold text-[var(--color-text-primary)] truncate block">
              {folder.name}
            </span>
          </button>
        )}

        <span className="text-xs text-[var(--color-text-muted)] tabular-nums">
          {lists.length}
        </span>

        {organizeMode && (
          <div className="relative">
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="p-1 rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)] transition-colors"
              aria-label={`Options for ${folder.name}`}
            >
              <EllipsisHorizontalIcon className="w-4 h-4" />
            </button>

            <AnimatePresence>
              {menuOpen && (
                <>
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-40"
                    onClick={() => setMenuOpen(false)}
                  />
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 top-full mt-1 z-50 w-40 bg-[var(--color-bg-card)] rounded-xl shadow-lg border border-[var(--color-text-muted)]/10 overflow-hidden"
                  >
                    <div className="p-1">
                      <button
                        onClick={() => {
                          setMenuOpen(false);
                          setRenaming(true);
                        }}
                        className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)] transition-colors"
                      >
                        <PencilSquareIcon className="w-4 h-4" />
                        <span className="text-sm">Rename</span>
                      </button>
                      <div className="h-px bg-[var(--color-text-muted)]/10 my-1" />
                      <button
                        onClick={handleDelete}
                        className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[var(--color-destructive)] hover:bg-[var(--color-destructive)]/10 transition-colors"
                      >
                        <TrashIcon className="w-4 h-4" />
                        <span className="text-sm">Delete</span>
                      </button>
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Folder contents */}
      <AnimatePresence initial={false}>
        {!folder.collapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            {lists.length === 0 ? (
              <p className="text-sm text-[var(--color-text-muted)] text-center py-4 px-4">
                No lists in this folder
              </p>
            ) : (
              <div className="grid gap-4 px-4 pb-2 sm:grid-cols-2 lg:grid-cols-3">
                {lists.map((list) => (
                  <SortableListCard
                    key={list.id}
                    list={list}
                    organizeMode={organizeMode}
                  />
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
