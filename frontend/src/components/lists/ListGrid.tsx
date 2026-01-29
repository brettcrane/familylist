import { motion } from 'framer-motion';
import type { List } from '../../types/api';
import { ListCard } from './ListCard';

interface ListGridProps {
  lists: List[];
  isLoading?: boolean;
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.3,
    },
  },
};

function ListCardSkeleton() {
  return (
    <div className="p-4 rounded-xl bg-[var(--color-bg-card)] shadow-[var(--shadow-card)] border border-[var(--color-text-muted)]/10 animate-pulse">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 bg-[var(--color-bg-secondary)] rounded-lg" />
        <div className="flex-1">
          <div className="h-5 w-24 bg-[var(--color-bg-secondary)] rounded" />
          <div className="h-4 w-16 bg-[var(--color-bg-secondary)] rounded mt-2" />
        </div>
      </div>
      <div className="mt-4 flex justify-between">
        <div className="h-4 w-12 bg-[var(--color-bg-secondary)] rounded" />
        <div className="h-4 w-16 bg-[var(--color-bg-secondary)] rounded" />
      </div>
      <div className="mt-3 h-1.5 bg-[var(--color-bg-secondary)] rounded-full" />
    </div>
  );
}

export function ListGrid({ lists, isLoading }: ListGridProps) {
  if (isLoading) {
    return (
      <div className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <ListCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (lists.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center">
        <div className="text-6xl mb-4">📝</div>
        <h2 className="font-display text-xl font-semibold text-[var(--color-text-primary)]">
          No lists yet
        </h2>
        <p className="mt-2 text-[var(--color-text-muted)]">
          Create your first list to get started
        </p>
      </div>
    );
  }

  return (
    <motion.div
      className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {lists.map((list) => (
        <motion.div key={list.id} variants={itemVariants}>
          <ListCard
            list={list}
            itemCount={list.item_count}
            checkedCount={list.checked_count}
          />
        </motion.div>
      ))}
    </motion.div>
  );
}
