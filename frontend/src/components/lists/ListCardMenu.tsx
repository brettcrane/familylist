import { useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useUIStore } from '../../stores/uiStore';
import { useDuplicateList } from '../../hooks/useLists';
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
    } catch {
      // Error handling
    }
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
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
                <span className="text-sm">Rename...</span>
              </button>

              <button
                onClick={handleShare}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)] transition-colors"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
                <span className="text-sm">Share...</span>
              </button>

              <button
                onClick={handleDuplicate}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)] transition-colors"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
                <span className="text-sm">Duplicate</span>
              </button>

              {/* Divider */}
              <div className="h-px bg-[var(--color-text-muted)]/10 my-1" />

              <button
                onClick={handleDelete}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-[var(--color-destructive)] hover:bg-[var(--color-destructive)]/10 transition-colors"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
                <span className="text-sm">Delete</span>
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
