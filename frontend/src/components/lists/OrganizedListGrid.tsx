import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
  DragOverlay,
} from '@dnd-kit/core';
import {
  SortableContext,
  rectSortingStrategy,
} from '@dnd-kit/sortable';
import { motion } from 'framer-motion';
import { PlusIcon } from '@heroicons/react/24/outline';
import { IconFolder } from '@tabler/icons-react';
import type { List } from '../../types/api';
import { useOrganization } from '../../hooks/useOrganization';
import { ListGrid } from './ListGrid';
import { SortableListCard } from './SortableListCard';
import { FolderSection } from './FolderSection';
import { ListCard } from './ListCard';

interface OrganizedListGridProps {
  lists: List[];
  isLoading?: boolean;
}

export function OrganizedListGrid({ lists, isLoading }: OrganizedListGridProps) {
  const {
    organizeMode,
    hasFolders,
    organizeLists,
    ensureSortOrder,
    createFolder,
    moveListToFolder,
    setSortOrder,
    sortOrder,
    folders,
    toggleFolderCollapse,
  } = useOrganization();

  const [creatingFolder, setCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [activeId, setActiveId] = useState<string | null>(null);

  // Sync sort order whenever list data changes
  useEffect(() => {
    if (lists.length > 0) ensureSortOrder(lists);
  }, [lists, ensureSortOrder]);

  const sections = useMemo(() => organizeLists(lists), [lists, organizeLists]);
  const listMap = useMemo(() => new Map(lists.map((l) => [l.id, l])), [lists]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } })
  );

  const handleDragStart = useCallback(
    (event: DragStartEvent) => setActiveId(String(event.active.id)),
    []
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveId(null);
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const activeIdStr = String(active.id);
      const overIdStr = String(over.id);

      // Check if dropped on a folder drop zone
      const overData = over.data?.current;
      if (overData?.type === 'folder' && overData.folderId) {
        if (!folders[activeIdStr]) {
          moveListToFolder(activeIdStr, overData.folderId);
          // Auto-expand collapsed folder so user sees the result
          if (folders[overData.folderId]?.collapsed) {
            toggleFolderCollapse(overData.folderId);
          }
          return;
        }
      }

      // Reorder within sort order
      const oldIndex = sortOrder.indexOf(activeIdStr);
      const newIndex = sortOrder.indexOf(overIdStr);
      if (oldIndex === -1 || newIndex === -1) return;

      const newOrder = [...sortOrder];
      newOrder.splice(oldIndex, 1);
      newOrder.splice(newIndex, 0, activeIdStr);
      setSortOrder(newOrder);
    },
    [sortOrder, setSortOrder, moveListToFolder, folders, toggleFolderCollapse]
  );

  // If not organizing and no folders, use plain grid
  if (!organizeMode && !hasFolders) {
    return <ListGrid lists={lists} isLoading={isLoading} />;
  }

  if (isLoading) {
    return <ListGrid lists={[]} isLoading />;
  }

  const handleCreateFolder = () => {
    const trimmed = newFolderName.trim();
    if (trimmed) {
      createFolder(trimmed);
      setNewFolderName('');
      setCreatingFolder(false);
    }
  };

  // Collect all sortable IDs
  const allSortableIds = [
    ...lists.map((l) => l.id),
    ...Object.keys(folders),
  ];

  const activeList = activeId ? listMap.get(activeId) : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={allSortableIds} strategy={rectSortingStrategy}>
        <div className="p-4 space-y-2">
          {sections.map((section) => {
            if (section.type === 'unfiled') {
              return (
                <div key="unfiled" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {section.lists.map((list) => (
                    <SortableListCard
                      key={list.id}
                      list={list}
                      organizeMode={organizeMode}
                    />
                  ))}
                </div>
              );
            }

            return (
              <FolderSection
                key={section.folder!.id}
                folder={section.folder!}
                lists={section.lists}
                organizeMode={organizeMode}
              />
            );
          })}

          {/* Create folder button — organize mode only */}
          {organizeMode && !creatingFolder && (
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              onClick={() => setCreatingFolder(true)}
              className="flex items-center gap-2 py-2.5 px-4 w-full rounded-lg border border-dashed border-[var(--color-text-muted)]/30 text-[var(--color-text-muted)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] transition-colors"
            >
              <IconFolder className="w-4 h-4" stroke={1.5} />
              <PlusIcon className="w-3.5 h-3.5" />
              <span className="text-sm">New folder</span>
            </motion.button>
          )}

          {/* Inline folder creation */}
          {organizeMode && creatingFolder && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-2 py-2 px-4 rounded-lg bg-[var(--color-bg-card)] border border-[var(--color-accent)]/30"
            >
              <IconFolder className="w-4 h-4 text-[var(--color-accent)]" stroke={1.5} />
              <input
                autoFocus
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateFolder();
                  if (e.key === 'Escape') {
                    setCreatingFolder(false);
                    setNewFolderName('');
                  }
                }}
                onBlur={() => {
                  if (newFolderName.trim()) {
                    handleCreateFolder();
                  } else {
                    setCreatingFolder(false);
                  }
                }}
                placeholder="Folder name..."
                className="flex-1 min-w-0 bg-transparent text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] outline-none"
              />
            </motion.div>
          )}
        </div>
      </SortableContext>

      {/* Drag overlay — shows a ghost of the card being dragged */}
      <DragOverlay>
        {activeList && (
          <div className="opacity-80 rotate-2 scale-105">
            <ListCard
              list={activeList}
              itemCount={activeList.item_count}
              checkedCount={activeList.checked_count}
              disableInteraction
            />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
