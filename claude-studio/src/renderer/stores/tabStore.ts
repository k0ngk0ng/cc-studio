import { create } from 'zustand';

export interface TabInfo {
  id: string;          // session ID or a temp ID for new tabs
  title: string;
  isNew: boolean;      // true = unsaved new thread (no session ID yet)
  projectPath: string;
}

interface TabStore {
  openTabs: TabInfo[];
  activeTabId: string | null;
  /** Per-tab scroll position cache */
  scrollPositions: Map<string, number>;

  openTab: (tab: TabInfo) => void;
  closeTab: (tabId: string) => string | null; // returns new activeTabId
  setActiveTab: (tabId: string) => void;
  updateTab: (tabId: string, updates: Partial<TabInfo>) => void;
  /** Replace a temp tab ID with a real session ID (after first message) */
  replaceTabId: (oldId: string, newId: string) => void;
  getActiveTab: () => TabInfo | undefined;
  hasTab: (tabId: string) => boolean;
  saveScrollPosition: (tabId: string, scrollTop: number) => void;
  getScrollPosition: (tabId: string) => number | undefined;
}

export const useTabStore = create<TabStore>((set, get) => ({
  openTabs: [],
  activeTabId: null,
  scrollPositions: new Map(),

  openTab: (tab) => {
    const state = get();
    // Don't open duplicate — activate existing
    const existing = state.openTabs.find((t) => t.id === tab.id);
    if (existing) {
      set({ activeTabId: tab.id });
      return;
    }
    set({
      openTabs: [...state.openTabs, tab],
      activeTabId: tab.id,
    });
  },

  closeTab: (tabId) => {
    const state = get();
    const idx = state.openTabs.findIndex((t) => t.id === tabId);
    if (idx === -1) return state.activeTabId;

    const newTabs = state.openTabs.filter((t) => t.id !== tabId);
    let newActiveId: string | null = state.activeTabId;

    // If closing the active tab, pick an adjacent one
    if (state.activeTabId === tabId) {
      if (newTabs.length === 0) {
        newActiveId = null;
      } else if (idx >= newTabs.length) {
        newActiveId = newTabs[newTabs.length - 1].id;
      } else {
        newActiveId = newTabs[idx].id;
      }
    }

    // Clean up scroll position
    const scrollPositions = new Map(state.scrollPositions);
    scrollPositions.delete(tabId);

    set({ openTabs: newTabs, activeTabId: newActiveId, scrollPositions });
    return newActiveId;
  },

  setActiveTab: (tabId) => {
    set({ activeTabId: tabId });
  },

  updateTab: (tabId, updates) => {
    set((state) => ({
      openTabs: state.openTabs.map((t) =>
        t.id === tabId ? { ...t, ...updates } : t
      ),
    }));
  },

  replaceTabId: (oldId, newId) => {
    const state = get();
    const scrollPositions = new Map(state.scrollPositions);
    const oldScroll = scrollPositions.get(oldId);
    scrollPositions.delete(oldId);
    if (oldScroll !== undefined) scrollPositions.set(newId, oldScroll);

    // Check if newId already exists (shouldn't happen, but guard)
    if (state.openTabs.some((t) => t.id === newId)) {
      // Remove the old tab, activate the existing one
      set({
        openTabs: state.openTabs.filter((t) => t.id !== oldId),
        activeTabId: state.activeTabId === oldId ? newId : state.activeTabId,
        scrollPositions,
      });
      return;
    }
    set({
      openTabs: state.openTabs.map((t) =>
        t.id === oldId ? { ...t, id: newId, isNew: false } : t
      ),
      activeTabId: state.activeTabId === oldId ? newId : state.activeTabId,
      scrollPositions,
    });
  },

  getActiveTab: () => {
    const state = get();
    return state.openTabs.find((t) => t.id === state.activeTabId);
  },

  hasTab: (tabId) => {
    return get().openTabs.some((t) => t.id === tabId);
  },

  saveScrollPosition: (tabId, scrollTop) => {
    const scrollPositions = new Map(get().scrollPositions);
    scrollPositions.set(tabId, scrollTop);
    set({ scrollPositions });
  },

  getScrollPosition: (tabId) => {
    return get().scrollPositions.get(tabId);
  },
}));
