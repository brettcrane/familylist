import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export interface Folder {
  id: string;
  name: string;
  collapsed: boolean;
}

export interface UserOrganization {
  folders: Record<string, Folder>;
  listToFolder: Record<string, string>;
  /** Flat sequence of folder IDs and unfiled list IDs. Items not present sort last. */
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

function updateUserOrg(
  state: { users: Record<string, UserOrganization> },
  userId: string,
  fn: (org: UserOrganization) => Partial<UserOrganization>
) {
  const org = state.users[userId] ?? emptyOrganization();
  return {
    users: { ...state.users, [userId]: { ...org, ...fn(org) } },
  };
}

/** Graceful localStorage wrapper — logs warnings instead of crashing on quota/security errors. */
const safeLocalStorage = {
  getItem: (name: string) => {
    try {
      return localStorage.getItem(name);
    } catch (e) {
      console.warn('Organization store: failed to read from localStorage:', e);
      return null;
    }
  },
  setItem: (name: string, value: string) => {
    try {
      localStorage.setItem(name, value);
    } catch (e) {
      console.warn('Organization store: failed to persist to localStorage:', e);
    }
  },
  removeItem: (name: string) => {
    try {
      localStorage.removeItem(name);
    } catch (e) {
      console.warn('Organization store: failed to remove from localStorage:', e);
    }
  },
};

/** Organization store — per-user list ordering and folders, persisted to localStorage. */
interface OrganizationState {
  /** Whether organize mode is currently active (not persisted) */
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

  /** Replace the full sort order array. */
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
        set((state) =>
          updateUserOrg(state, userId, (org) => ({
            folders: { ...org.folders, [id]: folder },
            sortOrder: [...org.sortOrder, id],
          }))
        );
        return folder;
      },

      renameFolder: (userId, folderId, name) =>
        set((state) => {
          if (!state.users[userId]?.folders[folderId]) return state;
          return updateUserOrg(state, userId, (org) => ({
            folders: { ...org.folders, [folderId]: { ...org.folders[folderId], name } },
          }));
        }),

      deleteFolder: (userId, folderId) =>
        set((state) => {
          if (!state.users[userId]) return state;
          return updateUserOrg(state, userId, (org) => {
            const { [folderId]: _, ...remainingFolders } = org.folders;
            // Remove folder mappings so lists fall back to unfiled
            const updatedMapping = { ...org.listToFolder };
            for (const [listId, fId] of Object.entries(updatedMapping)) {
              if (fId === folderId) delete updatedMapping[listId];
            }
            return {
              folders: remainingFolders,
              listToFolder: updatedMapping,
              sortOrder: org.sortOrder.filter((id) => id !== folderId),
            };
          });
        }),

      toggleFolderCollapse: (userId, folderId) =>
        set((state) => {
          if (!state.users[userId]?.folders[folderId]) return state;
          return updateUserOrg(state, userId, (org) => ({
            folders: {
              ...org.folders,
              [folderId]: { ...org.folders[folderId], collapsed: !org.folders[folderId].collapsed },
            },
          }));
        }),

      moveListToFolder: (userId, listId, folderId) =>
        set((state) => {
          if (folderId !== null && !state.users[userId]?.folders[folderId]) {
            console.warn('moveListToFolder: target folder does not exist', { folderId });
            return state;
          }
          return updateUserOrg(state, userId, (org) => {
            const updatedMapping = { ...org.listToFolder };
            if (folderId === null) {
              delete updatedMapping[listId];
            } else {
              updatedMapping[listId] = folderId;
            }
            return { listToFolder: updatedMapping };
          });
        }),

      setSortOrder: (userId, order) =>
        set((state) => updateUserOrg(state, userId, () => ({ sortOrder: order }))),
    }),
    {
      name: 'familylists-organization',
      storage: createJSONStorage(() => safeLocalStorage),
      partialize: (state) => ({
        users: state.users,
      }),
      onRehydrateStorage: () => (_state, error) => {
        if (error) {
          console.warn('Organization store: failed to rehydrate:', error);
        }
      },
    }
  )
);
