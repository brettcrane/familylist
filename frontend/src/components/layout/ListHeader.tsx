import { motion } from 'framer-motion';
import clsx from 'clsx';
import { ArrowLeftIcon, PencilIcon, ShareIcon } from '@heroicons/react/24/outline';
import { useNavigate } from 'react-router-dom';
import { useUIStore } from '../../stores/uiStore';
import { SyncIndicator } from './SyncIndicator';
import { UserButton } from './UserButton';
import { ListIcon } from '../icons/CategoryIcons';
import type { ListWithItems } from '../../types/api';

interface ListHeaderProps {
  title: string;
  list: ListWithItems;
  uncheckedCount: number;
  checkedCount: number;
  activeTab: 'todo' | 'done';
  onTabChange: (tab: 'todo' | 'done') => void;
}

export function ListHeader({
  title,
  list,
  uncheckedCount,
  checkedCount,
  activeTab,
  onTabChange,
}: ListHeaderProps) {
  const navigate = useNavigate();
  const openEditListModal = useUIStore((state) => state.openEditListModal);
  const openShareListModal = useUIStore((state) => state.openShareListModal);

  return (
    <header className="sticky top-0 z-40 safe-top bg-[var(--color-bg-primary)] border-b border-[var(--color-text-muted)]/10">
      {/* Top row: Back, title (clickable), share, user */}
      <div className="flex items-center h-14 px-4 gap-2">
        {/* Back button */}
        <motion.button
          onClick={() => navigate(-1)}
          className="flex items-center justify-center w-10 h-10 -ml-2 rounded-full hover:bg-[var(--color-bg-secondary)] transition-colors"
          aria-label="Go back"
          whileTap={{ scale: 0.95 }}
        >
          <ArrowLeftIcon className="w-5 h-5 text-[var(--color-text-primary)]" />
        </motion.button>

        {/* Clickable title area - opens List Settings */}
        <motion.button
          onClick={() => openEditListModal(list.id)}
          className="flex items-center gap-2 min-w-0 group"
          whileTap={{ scale: 0.98 }}
        >
          {/* List icon */}
          {list.icon && (
            <ListIcon icon={list.icon} className="w-5 h-5 flex-shrink-0 text-[var(--color-text-secondary)]" />
          )}
          {/* List name */}
          <h1 className="text-base font-semibold text-[var(--color-text-primary)] truncate max-w-[160px]">
            {title}
          </h1>
          {/* Pencil affordance */}
          <PencilIcon className="w-4 h-4 text-[var(--color-text-muted)] opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
        </motion.button>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Right actions */}
        <div className="flex items-center gap-1">
          <SyncIndicator />

          {/* Share button */}
          <motion.button
            onClick={() => openShareListModal(list.id)}
            className="flex items-center justify-center w-9 h-9 rounded-full hover:bg-[var(--color-bg-secondary)] transition-colors"
            aria-label="Share list"
            whileTap={{ scale: 0.95 }}
          >
            <ShareIcon className="w-5 h-5 text-[var(--color-text-secondary)]" />
          </motion.button>

          {/* User menu (theme, sign out) */}
          <UserButton />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-t border-[var(--color-text-muted)]/10">
        <button
          onClick={() => onTabChange('todo')}
          className={clsx(
            'relative flex-1 py-2.5 text-sm font-medium transition-colors',
            activeTab === 'todo'
              ? 'text-[var(--color-text-primary)]'
              : 'text-[var(--color-text-muted)]'
          )}
        >
          <span className="flex items-center justify-center gap-1.5">
            To Do
            <span className={clsx(
              'text-xs px-1.5 py-0.5 rounded-full',
              activeTab === 'todo'
                ? 'bg-[var(--color-accent)]/15 text-[var(--color-accent)]'
                : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)]'
            )}>
              {uncheckedCount}
            </span>
          </span>
          {activeTab === 'todo' && (
            <motion.div
              layoutId="tab-underline"
              className="absolute bottom-0 left-2 right-2 h-0.5 bg-[var(--color-accent)] rounded-full"
            />
          )}
        </button>
        <button
          onClick={() => onTabChange('done')}
          className={clsx(
            'relative flex-1 py-2.5 text-sm font-medium transition-colors',
            activeTab === 'done'
              ? 'text-[var(--color-text-primary)]'
              : 'text-[var(--color-text-muted)]'
          )}
        >
          <span className="flex items-center justify-center gap-1.5">
            Done
            <span className={clsx(
              'text-xs px-1.5 py-0.5 rounded-full',
              activeTab === 'done'
                ? 'bg-[var(--color-checked)]/15 text-[var(--color-checked)]'
                : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)]'
            )}>
              {checkedCount}
            </span>
          </span>
          {activeTab === 'done' && (
            <motion.div
              layoutId="tab-underline"
              className="absolute bottom-0 left-2 right-2 h-0.5 bg-[var(--color-checked)] rounded-full"
            />
          )}
        </button>
      </div>
    </header>
  );
}
