import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/** Default toast duration in milliseconds */
const DEFAULT_TOAST_DURATION_MS = 4000;

/** Theme type */
export type Theme = 'light' | 'dark' | 'system';

/** Task view mode (within the To Do tab, tasks lists only) */
export type TaskViewMode = 'categories' | 'focus' | 'tracker';

/** Collapsed categories state */
export type CollapsedCategories = Record<string, Set<string>>;

/** Edit list modal state */
export interface EditListModalState {
  open: boolean;
  listId: string | null;
}

/** Delete list dialog state */
export interface DeleteListDialogState {
  open: boolean;
  listId: string | null;
  listName: string;
  itemCount: number;
}

/** Share list modal state */
export interface ShareListModalState {
  open: boolean;
  listId: string | null;
}

/** Move to folder modal state */
export interface MoveToFolderModalState {
  open: boolean;
  listId: string | null;
}

/** Toast state */
export interface Toast {
  id: string;
  message: string;
  type: 'error' | 'success' | 'info';
  duration?: number;
}

/** UI Store state */
interface UIState {
  // Theme
  theme: Theme;
  setTheme: (theme: Theme) => void;

  // Category collapse state (per list)
  collapsedCategories: Record<string, string[]>;
  toggleCategory: (listId: string, categoryId: string) => void;
  isCategoryCollapsed: (listId: string, categoryId: string) => boolean;

  // Modal state
  isCreateListModalOpen: boolean;
  setCreateListModalOpen: (open: boolean) => void;

  // List management modals
  editListModal: EditListModalState;
  openEditListModal: (listId: string) => void;
  closeEditListModal: () => void;

  deleteListDialog: DeleteListDialogState;
  openDeleteListDialog: (listId: string, listName: string, itemCount: number) => void;
  closeDeleteListDialog: () => void;

  shareListModal: ShareListModalState;
  openShareListModal: (listId: string) => void;
  closeShareListModal: () => void;

  moveToFolderModal: MoveToFolderModalState;
  openMoveToFolderModal: (listId: string) => void;
  closeMoveToFolderModal: () => void;

  // Close all modals at once
  closeAllModals: () => void;

  // Current list tab
  activeTab: 'todo' | 'done';
  setActiveTab: (tab: 'todo' | 'done') => void;

  // Task view mode (within To Do tab, tasks lists only)
  taskViewMode: TaskViewMode;
  setTaskViewMode: (mode: TaskViewMode) => void;

  // Toast notifications
  toasts: Toast[];
  showToast: (message: string, type?: Toast['type'], duration?: number) => void;
  dismissToast: (id: string) => void;
}

/**
 * UI Store for managing UI state across the app
 */
export const useUIStore = create<UIState>()(
  persist(
    (set, get) => ({
      // Theme
      theme: 'system',
      setTheme: (theme) => {
        set({ theme });
        applyTheme(theme);
      },

      // Category collapse state
      collapsedCategories: {},
      toggleCategory: (listId, categoryId) => {
        set((state) => {
          const listCategories = state.collapsedCategories[listId] || [];
          const isCollapsed = listCategories.includes(categoryId);

          return {
            collapsedCategories: {
              ...state.collapsedCategories,
              [listId]: isCollapsed
                ? listCategories.filter((id) => id !== categoryId)
                : [...listCategories, categoryId],
            },
          };
        });
      },
      isCategoryCollapsed: (listId, categoryId) => {
        const state = get();
        return state.collapsedCategories[listId]?.includes(categoryId) ?? false;
      },

      // Modal state
      isCreateListModalOpen: false,
      setCreateListModalOpen: (open) => set({ isCreateListModalOpen: open }),

      // List management modals
      editListModal: { open: false, listId: null },
      openEditListModal: (listId) =>
        set({ editListModal: { open: true, listId } }),
      closeEditListModal: () =>
        set({ editListModal: { open: false, listId: null } }),

      deleteListDialog: { open: false, listId: null, listName: '', itemCount: 0 },
      openDeleteListDialog: (listId, listName, itemCount) =>
        set({ deleteListDialog: { open: true, listId, listName, itemCount } }),
      closeDeleteListDialog: () =>
        set({ deleteListDialog: { open: false, listId: null, listName: '', itemCount: 0 } }),

      shareListModal: { open: false, listId: null },
      openShareListModal: (listId) =>
        set({ shareListModal: { open: true, listId } }),
      closeShareListModal: () =>
        set({ shareListModal: { open: false, listId: null } }),

      moveToFolderModal: { open: false, listId: null },
      openMoveToFolderModal: (listId) =>
        set({ moveToFolderModal: { open: true, listId } }),
      closeMoveToFolderModal: () =>
        set({ moveToFolderModal: { open: false, listId: null } }),

      closeAllModals: () =>
        set({
          isCreateListModalOpen: false,
          editListModal: { open: false, listId: null },
          deleteListDialog: { open: false, listId: null, listName: '', itemCount: 0 },
          shareListModal: { open: false, listId: null },
          moveToFolderModal: { open: false, listId: null },
        }),

      // Tab state
      activeTab: 'todo',
      setActiveTab: (tab) => set({ activeTab: tab }),

      // Task view mode
      taskViewMode: 'categories',
      setTaskViewMode: (mode) => set({ taskViewMode: mode }),

      // Toast notifications
      toasts: [],
      showToast: (message, type = 'error', duration = DEFAULT_TOAST_DURATION_MS) => {
        const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
        set((state) => ({
          toasts: [...state.toasts, { id, message, type, duration }],
        }));
        // Auto-dismiss after duration
        if (duration > 0) {
          setTimeout(() => {
            set((state) => ({
              toasts: state.toasts.filter((t) => t.id !== id),
            }));
          }, duration);
        }
      },
      dismissToast: (id) =>
        set((state) => ({
          toasts: state.toasts.filter((t) => t.id !== id),
        })),
    }),
    {
      name: 'familylists-ui',
      partialize: (state) => ({
        theme: state.theme,
        collapsedCategories: state.collapsedCategories,
        taskViewMode: state.taskViewMode,
      }),
    }
  )
);

/**
 * Apply theme to document
 */
function applyTheme(theme: Theme) {
  const root = document.documentElement;
  const isDark =
    theme === 'dark' ||
    (theme === 'system' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches);

  root.setAttribute('data-theme', isDark ? 'dark' : 'light');
}

/**
 * Initialize theme on app start
 */
export function initializeTheme() {
  const stored = localStorage.getItem('familylists-ui');
  if (stored) {
    try {
      const { state } = JSON.parse(stored);
      if (state?.theme) {
        applyTheme(state.theme);
      }
    } catch {
      applyTheme('system');
    }
  } else {
    applyTheme('system');
  }

  // Listen for system theme changes
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  mediaQuery.addEventListener('change', () => {
    const currentTheme = useUIStore.getState().theme;
    if (currentTheme === 'system') {
      applyTheme('system');
    }
  });
}
