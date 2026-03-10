import { create } from 'zustand';
import type { User, AuthResult } from '../types';
import { pullFromServer } from './settingsStore';
import { useRemoteStore } from './remoteStore';

/** Auto-connect relay server after auth is established */
function autoConnectRelay() {
  // Small delay to ensure everything is initialized
  setTimeout(() => {
    const remote = useRemoteStore.getState();
    if (!remote.relayConnected) {
      remote.connect().catch(() => {});
    }
  }, 500);
}

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  showLoginModal: boolean;

  // Actions
  login: (emailOrUsername: string, password: string) => Promise<AuthResult>;
  register: (email: string, username: string, password: string) => Promise<AuthResult>;
  logout: () => Promise<void>;
  validateSession: () => Promise<void>;
  updateProfile: (updates: { username?: string; avatarUrl?: string }) => Promise<AuthResult>;
  changePassword: (oldPassword: string, newPassword: string) => Promise<{ success: boolean; error?: string }>;
  setShowLoginModal: (show: boolean) => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  isLoading: true,
  showLoginModal: false,

  login: async (emailOrUsername: string, password: string) => {
    const result = await window.api.auth.login(emailOrUsername, password);
    if (result.success && result.user && result.token) {
      await window.api.auth.saveToken(result.token);
      set({ user: result.user as User, token: result.token, showLoginModal: false });
      pullFromServer();
      autoConnectRelay();
    }
    return result;
  },

  register: async (email: string, username: string, password: string) => {
    const result = await window.api.auth.register(email, username, password);
    if (result.success && result.user && result.token) {
      await window.api.auth.saveToken(result.token);
      set({ user: result.user as User, token: result.token, showLoginModal: false });
      pullFromServer();
      autoConnectRelay();
    }
    return result;
  },

  logout: async () => {
    const { token } = get();
    if (token) {
      await window.api.auth.logout(token).catch(() => {});
      await window.api.auth.clearToken();
    }
    set({ user: null, token: null });
  },

  validateSession: async () => {
    const savedToken = await window.api.auth.loadToken();
    if (!savedToken) {
      set({ isLoading: false });
      return;
    }
    try {
      const result = await window.api.auth.validate(savedToken);
      if (result.success && result.user) {
        set({ user: result.user as User, token: savedToken, isLoading: false });
        autoConnectRelay();
      } else if (result.error === 'Server unavailable' || result.error === 'Failed to fetch') {
        // Server is temporarily unavailable — keep the token, don't log out.
        set({ isLoading: false, token: savedToken });
        autoConnectRelay();
      } else {
        // Token is actually invalid (expired, revoked, etc.) — clear it
        await window.api.auth.clearToken();
        set({ isLoading: false });
      }
    } catch {
      // Network error — keep the token for retry
      set({ isLoading: false, token: savedToken });
      autoConnectRelay();
    }
  },

  updateProfile: async (updates) => {
    const { token } = get();
    if (!token) return { success: false, error: 'Not logged in' };
    const result = await window.api.auth.updateProfile(token, updates);
    if (result.success && result.user) {
      set({ user: result.user as User });
    }
    return result;
  },

  changePassword: async (oldPassword: string, newPassword: string) => {
    const { token } = get();
    if (!token) return { success: false, error: 'Not logged in' };
    return await window.api.auth.changePassword(token, oldPassword, newPassword);
  },

  setShowLoginModal: (show: boolean) => set({ showLoginModal: show }),
}));
