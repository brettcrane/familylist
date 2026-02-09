import { useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useOrganizationStore } from '../stores/organizationStore';
import type { Folder } from '../stores/organizationStore';
import type { List } from '../types/api';

const DEFAULT_USER = '_default';

// Stable empty defaults for referential equality when user has no org data
const EMPTY_FOLDERS: Record<string, Folder> = {};
const EMPTY_MAP: Record<string, string> = {};
const EMPTY_ARRAY: string[] = [];

/** Section of lists — either unfiled or under a folder. */
export type ListSection =
  | { type: 'unfiled'; lists: List[] }
  | { type: 'folder'; folder: Folder; lists: List[] };

/**
 * Hook providing organization state scoped to the current user.
 * In API-key mode (no Clerk user), uses a shared '_default' key.
 */
export function useOrganization() {
  const { userId } = useAuth();
  const uid = userId ?? DEFAULT_USER;

  const organizeMode = useOrganizationStore((s) => s.organizeMode);
  const setOrganizeMode = useOrganizationStore((s) => s.setOrganizeMode);
  const folders = useOrganizationStore((s) => s.users[uid]?.folders ?? EMPTY_FOLDERS);
  const listToFolder = useOrganizationStore((s) => s.users[uid]?.listToFolder ?? EMPTY_MAP);
  const sortOrder = useOrganizationStore((s) => s.users[uid]?.sortOrder ?? EMPTY_ARRAY);

  // Stable action references (Zustand action functions are created once)
  const storeCreateFolder = useOrganizationStore((s) => s.createFolder);
  const storeRenameFolder = useOrganizationStore((s) => s.renameFolder);
  const storeDeleteFolder = useOrganizationStore((s) => s.deleteFolder);
  const storeToggleFolderCollapse = useOrganizationStore((s) => s.toggleFolderCollapse);
  const storeMoveListToFolder = useOrganizationStore((s) => s.moveListToFolder);
  const storeSetSortOrder = useOrganizationStore((s) => s.setSortOrder);

  const hasFolders = Object.keys(folders).length > 0;

  /** Organize lists into sorted sections: unfiled (if any remain or no folders exist), then folders, all ordered by sortOrder. */
  const organizeLists = useCallback(
    (lists: List[]): ListSection[] => {
      const unfiled: List[] = [];
      const folderBuckets: Record<string, List[]> = {};
      for (const f of Object.keys(folders)) {
        folderBuckets[f] = [];
      }

      for (const list of lists) {
        const fId = listToFolder[list.id];
        if (fId && folders[fId]) {
          folderBuckets[fId].push(list);
        } else {
          unfiled.push(list);
        }
      }

      const posMap = new Map(sortOrder.map((id, i) => [id, i]));
      const byPos = (a: { id: string }, b: { id: string }) => {
        const pa = posMap.get(a.id) ?? Infinity;
        const pb = posMap.get(b.id) ?? Infinity;
        return pa - pb;
      };

      unfiled.sort(byPos);

      const sortedFolderIds = Object.keys(folders).sort((a, b) => {
        const pa = posMap.get(a) ?? Infinity;
        const pb = posMap.get(b) ?? Infinity;
        return pa - pb;
      });

      const sections: ListSection[] = [];

      if (unfiled.length > 0 || !hasFolders) {
        sections.push({ type: 'unfiled', lists: unfiled });
      }

      for (const fId of sortedFolderIds) {
        const folderLists = folderBuckets[fId] ?? [];
        folderLists.sort(byPos);
        sections.push({
          type: 'folder',
          folder: folders[fId],
          lists: folderLists,
        });
      }

      return sections;
    },
    [folders, listToFolder, sortOrder, hasFolders]
  );

  /**
   * Reconcile sortOrder with current lists and folders:
   * removes IDs for deleted lists/folders and appends newly created ones.
   */
  const ensureSortOrder = useCallback(
    (lists: List[]) => {
      // Read current state at call time to avoid stale closures
      const currentOrg = useOrganizationStore.getState().getOrg(uid);
      const { sortOrder: currentSortOrder, folders: currentFolders } = currentOrg;
      const existingSet = new Set(currentSortOrder);
      const allIds = new Set<string>();

      for (const l of lists) allIds.add(l.id);
      for (const fId of Object.keys(currentFolders)) allIds.add(fId);

      const cleaned = currentSortOrder.filter((id) => allIds.has(id));
      const missingLists = lists.filter((l) => !existingSet.has(l.id)).map((l) => l.id);
      const missingFolders = Object.keys(currentFolders).filter((fId) => !existingSet.has(fId));
      const missing = [...missingLists, ...missingFolders];

      if (missing.length > 0 || cleaned.length !== currentSortOrder.length) {
        storeSetSortOrder(uid, [...cleaned, ...missing]);
      }
    },
    [uid, storeSetSortOrder]
  );

  const createFolder = useCallback((name: string) => storeCreateFolder(uid, name), [storeCreateFolder, uid]);
  const renameFolder = useCallback((folderId: string, name: string) => storeRenameFolder(uid, folderId, name), [storeRenameFolder, uid]);
  const deleteFolder = useCallback((folderId: string) => storeDeleteFolder(uid, folderId), [storeDeleteFolder, uid]);
  const toggleFolderCollapse = useCallback((folderId: string) => storeToggleFolderCollapse(uid, folderId), [storeToggleFolderCollapse, uid]);
  const moveListToFolder = useCallback((listId: string, folderId: string | null) => storeMoveListToFolder(uid, listId, folderId), [storeMoveListToFolder, uid]);
  const setSortOrder = useCallback((order: string[]) => storeSetSortOrder(uid, order), [storeSetSortOrder, uid]);

  return {
    organizeMode,
    setOrganizeMode,
    folders,
    hasFolders,
    listToFolder,
    sortOrder,
    organizeLists,
    ensureSortOrder,
    createFolder,
    renameFolder,
    deleteFolder,
    toggleFolderCollapse,
    moveListToFolder,
    setSortOrder,
  };
}
