import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/** Theme type */
export type Theme = 'light' | 'dark' | 'system';

/** Collapsed categories state */
export type CollapsedCategories = Record<string, Set<string>>;

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

  // Current list tab
  activeTab: 'todo' | 'done';
  setActiveTab: (tab: 'todo' | 'done') => void;
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

      // Tab state
      activeTab: 'todo',
      setActiveTab: (tab) => set({ activeTab: tab }),
    }),
    {
      name: 'familylists-ui',
      partialize: (state) => ({
        theme: state.theme,
        collapsedCategories: state.collapsedCategories,
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
