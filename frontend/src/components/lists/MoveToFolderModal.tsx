import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import { PlusIcon, CheckIcon } from '@heroicons/react/24/outline';
import { IconFolder } from '@tabler/icons-react';
import { useUIStore } from '../../stores/uiStore';
import { useOrganization } from '../../hooks/useOrganization';
import { InlineFolderInput } from './InlineFolderInput';

export function MoveToFolderModal() {
  const moveToFolderModal = useUIStore((s) => s.moveToFolderModal);
  const closeMoveToFolderModal = useUIStore((s) => s.closeMoveToFolderModal);
  const {
    folders,
    listToFolder,
    moveListToFolder,
    createFolder,
  } = useOrganization();

  const [creatingNew, setCreatingNew] = useState(false);

  const { open, listId } = moveToFolderModal;
  const currentFolderId = listId ? listToFolder[listId] ?? null : null;
  const folderList = Object.values(folders);

  const handleSelect = (folderId: string | null) => {
    if (listId) {
      moveListToFolder(listId, folderId);
    }
    setCreatingNew(false);
    closeMoveToFolderModal();
  };

  const handleClose = () => {
    setCreatingNew(false);
    closeMoveToFolderModal();
  };

  const handleCreateAndMove = (name: string) => {
    if (!listId) return;
    const folder = createFolder(name);
    moveListToFolder(listId, folder.id);
    handleClose();
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
            className="fixed inset-0 z-50 bg-black/40"
            onClick={handleClose}
          />

          {/* Bottom sheet */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 350 }}
            className="fixed inset-x-0 bottom-0 z-50 bg-[var(--color-bg-primary)] rounded-t-2xl safe-bottom max-h-[70vh] flex flex-col"
          >
            {/* Drag handle */}
            <div className="flex justify-center py-3">
              <div className="w-10 h-1 rounded-full bg-[var(--color-text-muted)]/30" />
            </div>

            <div className="px-4 pb-2">
              <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
                Move to folder
              </h2>
            </div>

            <div className="flex-1 overflow-y-auto px-4 pb-4">
              {/* Unfiled option */}
              <button
                onClick={() => handleSelect(null)}
                className={clsx(
                  'w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-colors',
                  currentFolderId === null
                    ? 'bg-[var(--color-accent)]/10 text-[var(--color-accent)]'
                    : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)]'
                )}
              >
                <span className="text-sm font-medium flex-1 text-left">No folder</span>
                {currentFolderId === null && (
                  <CheckIcon className="w-4 h-4" />
                )}
              </button>

              {/* Folder list */}
              {folderList.map((folder) => (
                <button
                  key={folder.id}
                  onClick={() => handleSelect(folder.id)}
                  className={clsx(
                    'w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-colors',
                    currentFolderId === folder.id
                      ? 'bg-[var(--color-accent)]/10 text-[var(--color-accent)]'
                      : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)]'
                  )}
                >
                  <IconFolder className="w-4 h-4" stroke={1.5} />
                  <span className="text-sm font-medium flex-1 text-left truncate">
                    {folder.name}
                  </span>
                  {currentFolderId === folder.id && (
                    <CheckIcon className="w-4 h-4" />
                  )}
                </button>
              ))}

              {!creatingNew ? (
                <button
                  onClick={() => setCreatingNew(true)}
                  className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-[var(--color-accent)] hover:bg-[var(--color-accent)]/10 transition-colors"
                >
                  <PlusIcon className="w-4 h-4" />
                  <span className="text-sm font-medium">New folder</span>
                </button>
              ) : (
                <InlineFolderInput
                  onConfirm={handleCreateAndMove}
                  onCancel={() => setCreatingNew(false)}
                  showSubmitButton
                  className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[var(--color-bg-secondary)]"
                />
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
