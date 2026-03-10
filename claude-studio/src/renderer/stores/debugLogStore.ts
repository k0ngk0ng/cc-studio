import { create } from 'zustand';

export type LogCategory = 'claude' | 'session' | 'git' | 'app' | 'error';

export interface LogEntry {
  id: number;
  timestamp: number;
  category: LogCategory;
  message: string;
  detail?: string; // JSON or long text, expandable
  level: 'info' | 'warn' | 'error';
}

interface DebugLogStore {
  logs: LogEntry[];
  maxLogs: number;
  filter: LogCategory | 'all';
  debugEnabled: boolean;

  addLog: (entry: Omit<LogEntry, 'id' | 'timestamp'>) => void;
  clearLogs: () => void;
  setFilter: (filter: LogCategory | 'all') => void;
  setDebugEnabled: (enabled: boolean) => void;
}

let nextId = 1;

export const useDebugLogStore = create<DebugLogStore>((set) => ({
  logs: [],
  maxLogs: 2000,
  filter: 'all',
  debugEnabled: false,

  addLog: (entry) => {
    set((state) => {
      const newLog: LogEntry = {
        ...entry,
        id: nextId++,
        timestamp: Date.now(),
      };
      const logs = [...state.logs, newLog];
      // Trim to maxLogs
      if (logs.length > state.maxLogs) {
        return { logs: logs.slice(logs.length - state.maxLogs) };
      }
      return { logs };
    });
  },

  clearLogs: () => set({ logs: [] }),

  setFilter: (filter) => set({ filter }),

  setDebugEnabled: (enabled) => set({ debugEnabled: enabled }),
}));

/**
 * Global debug logger — call from anywhere.
 * Only logs when debug mode is enabled.
 * Debug mode is pushed from settingsStore via setDebugEnabled().
 */
export function debugLog(
  category: LogCategory,
  message: string,
  detail?: unknown,
  level: 'info' | 'warn' | 'error' = 'info'
) {
  const store = useDebugLogStore.getState();
  if (!store.debugEnabled) return;

  const detailStr = detail !== undefined
    ? (typeof detail === 'string' ? detail : JSON.stringify(detail, null, 2))
    : undefined;

  store.addLog({
    category,
    message,
    detail: detailStr,
    level,
  });

  // Also log to browser console
  const prefix = `[debug:${category}]`;
  if (level === 'error') {
    console.error(prefix, message, detail ?? '');
  } else if (level === 'warn') {
    console.warn(prefix, message, detail ?? '');
  } else {
    console.log(prefix, message, detail ?? '');
  }
}
