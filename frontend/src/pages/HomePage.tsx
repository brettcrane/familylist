import { useCallback } from 'react';
import { motion } from 'framer-motion';
import { PlusIcon } from '@heroicons/react/24/outline';
import { Layout, Main, Header } from '../components/layout';
import { PullToRefresh, ErrorState } from '../components/ui';
import { CreateListModal } from '../components/lists';
import { OrganizedListGrid } from '../components/lists/OrganizedListGrid';
import { OrganizeButton } from '../components/lists/OrganizeButton';
import { MoveToFolderModal } from '../components/lists/MoveToFolderModal';
import { EditListModal } from '../components/lists/EditListModal';
import { DeleteListDialog } from '../components/lists/DeleteListDialog';
import { ShareListModal } from '../components/lists/ShareListModal';
import { useLists } from '../hooks/useLists';
import { useUIStore } from '../stores/uiStore';
import { useAuth } from '../contexts/AuthContext';
export function HomePage() {
  const { isAuthReady } = useAuth();
  const { data: lists, isLoading, error, refetch } = useLists({ enabled: isAuthReady });
  const setCreateModalOpen = useUIStore((state) => state.setCreateListModalOpen);

  const handleRefresh = useCallback(async () => {
    await refetch();
  }, [refetch]);

  return (
    <Layout>
      <Header title="FamilyLists" actions={<OrganizeButton />} />

      <Main className="relative">
        <PullToRefresh onRefresh={handleRefresh} className="h-full">
          {error ? (
            <ErrorState title="Couldn't load lists" error={error} onRetry={() => refetch()} />
          ) : (
            <OrganizedListGrid lists={lists || []} isLoading={isLoading} />
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
          <PlusIcon className="w-7 h-7" strokeWidth={2.5} />
        </motion.button>
      </Main>

      <CreateListModal />
      <EditListModal />
      <DeleteListDialog />
      <ShareListModal />
      <MoveToFolderModal />
    </Layout>
  );
}
