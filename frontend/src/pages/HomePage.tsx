import { useCallback } from 'react';
import { motion } from 'framer-motion';
import { Layout, Main, Header } from '../components/layout';
import { PullToRefresh } from '../components/ui';
import { ListGrid, CreateListModal } from '../components/lists';
import { EditListModal } from '../components/lists/EditListModal';
import { DeleteListDialog } from '../components/lists/DeleteListDialog';
import { ShareListModal } from '../components/lists/ShareListModal';
import { useLists } from '../hooks/useLists';
import { useUIStore } from '../stores/uiStore';

export function HomePage() {
  const { data: lists, isLoading, error, refetch } = useLists();
  const setCreateModalOpen = useUIStore((state) => state.setCreateListModalOpen);

  const handleRefresh = useCallback(async () => {
    await refetch();
  }, [refetch]);

  return (
    <Layout>
      <Header title="FamilyLists" />

      <Main className="relative">
        <PullToRefresh onRefresh={handleRefresh} className="h-full">
          {error ? (
            <div className="flex flex-col items-center justify-center p-8 text-center">
              <div className="text-4xl mb-4">😕</div>
              <h2 className="font-semibold text-[var(--color-text-primary)]">
                Couldn't load lists
              </h2>
              <p className="mt-2 text-sm text-[var(--color-text-muted)]">
                Please check your connection and try again
              </p>
            </div>
          ) : (
            <ListGrid lists={lists || []} isLoading={isLoading} />
          )}
        </PullToRefresh>

        {/* FAB to create new list */}
        <motion.button
          onClick={() => setCreateModalOpen(true)}
          className="fixed bottom-6 right-6 safe-bottom w-14 h-14 rounded-full bg-[var(--color-accent)] text-white shadow-lg flex items-center justify-center"
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', damping: 15, stiffness: 300 }}
        >
          <svg
            className="w-7 h-7"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </motion.button>
      </Main>

      <CreateListModal />
      <EditListModal />
      <DeleteListDialog />
      <ShareListModal />
    </Layout>
  );
}
