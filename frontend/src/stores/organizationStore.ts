import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/** Folder definition */
export interface Folder {
  id: string;
  name: string;
  collapsed: boolean;
}

/** Per-user organization data */
export interface UserOrganization {
  folders: Record<string, Folder>;
  listToFolder: Record<string, string>;
  /** Ordered IDs — folder IDs and list IDs interleaved. Lists not present here sort last. */
  sortOrder: string[];
}

const emptyOrganization = (): UserOrganization => ({
  folders: {},
  listToFolder: {},
  sortOrder: [],
});

function generateFolderId(): string {
  return `folder-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/** Organization store — per-user list ordering and folders, persisted to localStorage. */
interface OrganizationState {
  /** Whether organize mode is currently active */
  organizeMode: boolean;
  setOrganizeMode: (enabled: boolean) => void;

  /** Per-user organization keyed by userId. API-key mode uses '_default'. */
  users: Record<string, UserOrganization>;

  getOrg: (userId: string) => UserOrganization;

  createFolder: (userId: string, name: string) => Folder;
  renameFolder: (userId: string, folderId: string, name: string) => void;
  deleteFolder: (userId: string, folderId: string) => void;
  toggleFolderCollapse: (userId: string, folderId: string) => void;

  moveListToFolder: (userId: string, listId: string, folderId: string | null) => void;

  /** Replace the full sort order array (after drag-and-drop). */
  setSortOrder: (userId: string, order: string[]) => void;
}

export const useOrganizationStore = create<OrganizationState>()(
  persist(
    (set, get) => ({
      organizeMode: false,
      setOrganizeMode: (enabled) => set({ organizeMode: enabled }),

      users: {},

      getOrg: (userId) => get().users[userId] ?? emptyOrganization(),

      createFolder: (userId, name) => {
        const id = generateFolderId();
        const folder: Folder = { id, name, collapsed: false };
        set((state) => {
          const org = state.users[userId] ?? emptyOrganization();
          return {
            users: {
              ...state.users,
              [userId]: {
                ...org,
                folders: { ...org.folders, [id]: folder },
                sortOrder: [...org.sortOrder, id],
              },
            },
          };
        });
        return folder;
      },

      renameFolder: (userId, folderId, name) =>
        set((state) => {
          const org = state.users[userId];
          if (!org?.folders[folderId]) return state;
          return {
            users: {
              ...state.users,
              [userId]: {
                ...org,
                folders: {
                  ...org.folders,
                  [folderId]: { ...org.folders[folderId], name },
                },
              },
            },
          };
        }),

      deleteFolder: (userId, folderId) =>
        set((state) => {
          const org = state.users[userId];
          if (!org) return state;
          const { [folderId]: _, ...remainingFolders } = org.folders;
          // Move lists from deleted folder to unfiled
          const updatedMapping = { ...org.listToFolder };
          for (const [listId, fId] of Object.entries(updatedMapping)) {
            if (fId === folderId) delete updatedMapping[listId];
          }
          return {
            users: {
              ...state.users,
              [userId]: {
                ...org,
                folders: remainingFolders,
                listToFolder: updatedMapping,
                sortOrder: org.sortOrder.filter((id) => id !== folderId),
              },
            },
          };
        }),

      toggleFolderCollapse: (userId, folderId) =>
        set((state) => {
          const org = state.users[userId];
          if (!org?.folders[folderId]) return state;
          const folder = org.folders[folderId];
          return {
            users: {
              ...state.users,
              [userId]: {
                ...org,
                folders: {
                  ...org.folders,
                  [folderId]: { ...folder, collapsed: !folder.collapsed },
                },
              },
            },
          };
        }),

      moveListToFolder: (userId, listId, folderId) =>
        set((state) => {
          const org = state.users[userId] ?? emptyOrganization();
          const updatedMapping = { ...org.listToFolder };
          if (folderId === null) {
            delete updatedMapping[listId];
          } else {
            updatedMapping[listId] = folderId;
          }
          return {
            users: {
              ...state.users,
              [userId]: { ...org, listToFolder: updatedMapping },
            },
          };
        }),

      setSortOrder: (userId, order) =>
        set((state) => {
          const org = state.users[userId] ?? emptyOrganization();
          return {
            users: {
              ...state.users,
              [userId]: { ...org, sortOrder: order },
            },
          };
        }),
    }),
    {
      name: 'familylists-organization',
      partialize: (state) => ({
        users: state.users,
      }),
    }
  )
);
