import { useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { PencilSquareIcon, UserGroupIcon, DocumentDuplicateIcon, TrashIcon } from '@heroicons/react/24/outline';
import { IconFolder } from '@tabler/icons-react';
import { useUIStore } from '../../stores/uiStore';
import { useDuplicateList } from '../../hooks/useLists';
import { getErrorMessage } from '../../api/client';
import type { List } from '../../types/api';

interface ListCardMenuProps {
  list: List;
  open: boolean;
  onClose: () => void;
  anchorRect?: DOMRect | null;
}

export function ListCardMenu({ list, open, onClose, anchorRect }: ListCardMenuProps) {
  const navigate = useNavigate();
  const menuRef = useRef<HTMLDivElement>(null);

  const openEditListModal = useUIStore((state) => state.openEditListModal);
  const openDeleteListDialog = useUIStore((state) => state.openDeleteListDialog);
  const openShareListModal = useUIStore((state) => state.openShareListModal);
  const showToast = useUIStore((state) => state.showToast);
  const openMoveToFolderModal = useUIStore((state) => state.openMoveToFolderModal);

  const duplicateList = useDuplicateList();

  // Close menu on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    if (open) {
      // Delay adding listener to avoid immediate close
      const timer = setTimeout(() => {
        document.addEventListener('mousedown', handleClickOutside);
      }, 0);
      return () => {
        clearTimeout(timer);
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [open, onClose]);

  // Close on escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (open) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [open, onClose]);

  const handleRename = () => {
    openEditListModal(list.id);
    onClose();
  };

  const handleShare = () => {
    openShareListModal(list.id);
    onClose();
  };

  const handleDuplicate = async () => {
    onClose();
    try {
      const newList = await duplicateList.mutateAsync({
        id: list.id,
        data: { name: `${list.name} (Copy)` },
      });
      navigate(`/lists/${newList.id}`);
    } catch (err: unknown) {
      console.error('Failed to duplicate list:', { listId: list.id, error: err });
      showToast(getErrorMessage(err, 'Failed to duplicate list'), 'error');
    }
  };

  const handleMoveToFolder = () => {
    openMoveToFolderModal(list.id);
    onClose();
  };

  const handleDelete = () => {
    const itemCount = list.item_count || 0;
    openDeleteListDialog(list.id, list.name, itemCount);
    onClose();
  };

  // Calculate position based on anchor
  const menuStyle: React.CSSProperties = {};
  if (anchorRect) {
    const menuWidth = 192; // w-48 = 12rem = 192px
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // Center horizontally over the card
    let left = anchorRect.left + anchorRect.width / 2 - menuWidth / 2;

    // Keep within viewport bounds
    if (left < 8) left = 8;
    if (left + menuWidth > viewportWidth - 8) left = viewportWidth - menuWidth - 8;

    // Position vertically - prefer above the center of the card
    let top = anchorRect.top + anchorRect.height / 2 - 100;
    if (top < 8) top = anchorRect.bottom + 8;
    if (top > viewportHeight - 200) top = viewportHeight - 200;

    menuStyle.position = 'fixed';
    menuStyle.left = left;
    menuStyle.top = top;
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/30"
            onClick={onClose}
          />

          {/* Menu */}
          <motion.div
            ref={menuRef}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.15 }}
            style={menuStyle}
            className="z-50 w-48 bg-[var(--color-bg-card)] rounded-xl shadow-lg border border-[var(--color-text-muted)]/10 overflow-hidden"
          >
            <div className="p-1">
              <button
                onClick={handleRename}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)] transition-colors"
              >
                <PencilSquareIcon className="w-4 h-4" />
                <span className="text-sm">Rename...</span>
              </button>

              <button
                onClick={handleShare}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)] transition-colors"
              >
                <UserGroupIcon className="w-4 h-4" />
                <span className="text-sm">Share...</span>
              </button>

              <button
                onClick={handleDuplicate}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)] transition-colors"
              >
                <DocumentDuplicateIcon className="w-4 h-4" />
                <span className="text-sm">Duplicate</span>
              </button>

              <button
                onClick={handleMoveToFolder}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)] transition-colors"
              >
                <IconFolder className="w-4 h-4" stroke={1.5} />
                <span className="text-sm">Move to folder...</span>
              </button>

              {/* Divider */}
              <div className="h-px bg-[var(--color-text-muted)]/10 my-1" />

              <button
                onClick={handleDelete}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-[var(--color-destructive)] hover:bg-[var(--color-destructive)]/10 transition-colors"
              >
                <TrashIcon className="w-4 h-4" />
                <span className="text-sm">Delete</span>
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
