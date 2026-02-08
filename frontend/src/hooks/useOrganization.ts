import { useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useOrganizationStore } from '../stores/organizationStore';
import type { Folder } from '../stores/organizationStore';
import type { List } from '../types/api';

const DEFAULT_USER = '_default';

/** Section of lists — either unfiled or under a folder. */
export interface ListSection {
  type: 'unfiled' | 'folder';
  folder?: Folder;
  lists: List[];
}

/**
 * Hook providing organization state scoped to the current user.
 * In API-key mode (no Clerk user), uses a shared '_default' key.
 */
export function useOrganization() {
  const { userId } = useAuth();
  const uid = userId ?? DEFAULT_USER;

  const organizeMode = useOrganizationStore((s) => s.organizeMode);
  const setOrganizeMode = useOrganizationStore((s) => s.setOrganizeMode);
  const org = useOrganizationStore((s) => s.getOrg(uid));
  const store = useOrganizationStore();

  const folders = org.folders;
  const hasFolders = Object.keys(folders).length > 0;

  /** Organize lists into sorted sections: unfiled first, then folders in sort order. */
  const organizeLists = useCallback(
    (lists: List[]): ListSection[] => {
      const { listToFolder, sortOrder } = org;

      // Bucket lists into unfiled vs folder
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

      // Build position map from sortOrder for sorting
      const posMap = new Map(sortOrder.map((id, i) => [id, i]));
      const byPos = (a: { id: string }, b: { id: string }) => {
        const pa = posMap.get(a.id) ?? Infinity;
        const pb = posMap.get(b.id) ?? Infinity;
        return pa - pb;
      };

      // Sort unfiled lists
      unfiled.sort(byPos);

      // Sort folders and their contained lists
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
    [org, folders, hasFolders]
  );

  /**
   * Ensure every list ID and folder ID appears in sortOrder exactly once.
   * Removes stale IDs and appends any new lists from API.
   */
  const ensureSortOrder = useCallback(
    (lists: List[]) => {
      const { sortOrder } = org;
      const existingSet = new Set(sortOrder);
      const allIds = new Set<string>();

      for (const l of lists) allIds.add(l.id);
      for (const fId of Object.keys(folders)) allIds.add(fId);

      const cleaned = sortOrder.filter((id) => allIds.has(id));
      const missing = lists
        .filter((l) => !existingSet.has(l.id))
        .map((l) => l.id);

      if (missing.length > 0 || cleaned.length !== sortOrder.length) {
        store.setSortOrder(uid, [...cleaned, ...missing]);
      }
    },
    [org, folders, store, uid]
  );

  // Bind store actions to current user ID
  const createFolder = useCallback((name: string) => store.createFolder(uid, name), [store, uid]);
  const renameFolder = useCallback((folderId: string, name: string) => store.renameFolder(uid, folderId, name), [store, uid]);
  const deleteFolder = useCallback((folderId: string) => store.deleteFolder(uid, folderId), [store, uid]);
  const toggleFolderCollapse = useCallback((folderId: string) => store.toggleFolderCollapse(uid, folderId), [store, uid]);
  const moveListToFolder = useCallback((listId: string, folderId: string | null) => store.moveListToFolder(uid, listId, folderId), [store, uid]);
  const setSortOrder = useCallback((order: string[]) => store.setSortOrder(uid, order), [store, uid]);

  return {
    organizeMode,
    setOrganizeMode,
    folders,
    hasFolders,
    listToFolder: org.listToFolder,
    sortOrder: org.sortOrder,
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
