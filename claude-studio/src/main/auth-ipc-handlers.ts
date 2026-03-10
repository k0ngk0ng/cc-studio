import { ipcMain } from 'electron';
import fs from 'fs';
import path from 'path';
import os from 'os';

const DEFAULT_SERVER_URL = 'http://localhost:3456';
const AUTH_TOKEN_PATH = path.join(os.homedir(), '.claude-studio', 'auth-token.json');

// Priority: settings.json > build-time env > default
function getServerUrl(): string {
  // 1. Try reading from settings file (user-configurable)
  try {
    const settingsPath = path.join(os.homedir(), '.claude-studio', 'settings.json');
    if (fs.existsSync(settingsPath)) {
      const data = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
      if (data?.server?.serverUrl) return data.server.serverUrl.replace(/\/+$/, '');
    }
  } catch { /* ignore */ }

  // 2. Build-time injected value (via CI / GitHub Actions)
  const buildTime = process.env.CLAUDE_STUDIO_SERVER_URL;
  if (buildTime) return buildTime.replace(/\/+$/, '');

  // 3. Default
  return DEFAULT_SERVER_URL;
}

async function serverFetch(path: string, options: RequestInit = {}): Promise<any> {
  const url = `${getServerUrl()}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  return res.json();
}

function authHeaders(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}

export function registerAuthIpcHandlers(): void {
  // Expose the effective server URL to renderer (for Settings display)
  ipcMain.handle('auth:getServerUrl', async () => {
    return getServerUrl();
  });

  // ─── Token persistence (file-based, survives dev server restarts) ───

  ipcMain.handle('auth:saveToken', async (_event, token: string) => {
    try {
      const dir = path.dirname(AUTH_TOKEN_PATH);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(AUTH_TOKEN_PATH, JSON.stringify({ token }), 'utf-8');
      return true;
    } catch {
      return false;
    }
  });

  ipcMain.handle('auth:loadToken', async () => {
    try {
      if (!fs.existsSync(AUTH_TOKEN_PATH)) return null;
      const data = JSON.parse(fs.readFileSync(AUTH_TOKEN_PATH, 'utf-8'));
      return data?.token || null;
    } catch {
      return null;
    }
  });

  ipcMain.handle('auth:clearToken', async () => {
    try {
      if (fs.existsSync(AUTH_TOKEN_PATH)) fs.unlinkSync(AUTH_TOKEN_PATH);
      return true;
    } catch {
      return false;
    }
  });

  // Expose the build-time default (so renderer knows what the "default" is)
  ipcMain.handle('auth:getDefaultServerUrl', async () => {
    return process.env.CLAUDE_STUDIO_SERVER_URL || DEFAULT_SERVER_URL;
  });

  ipcMain.handle('auth:register', async (_event, email: string, username: string, password: string) => {
    try {
      if (!email || !username || !password) {
        return { success: false, error: 'All fields are required' };
      }
      if (password.length < 6) {
        return { success: false, error: 'Password must be at least 6 characters' };
      }
      return await serverFetch('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim().toLowerCase(), username: username.trim(), password }),
      });
    } catch (err: any) {
      return { success: false, error: err.message || 'Server unavailable' };
    }
  });

  ipcMain.handle('auth:login', async (_event, emailOrUsername: string, password: string) => {
    try {
      if (!emailOrUsername || !password) {
        return { success: false, error: 'All fields are required' };
      }
      return await serverFetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ emailOrUsername: emailOrUsername.trim(), password }),
      });
    } catch (err: any) {
      return { success: false, error: err.message || 'Server unavailable' };
    }
  });

  ipcMain.handle('auth:logout', async (_event, token: string) => {
    try {
      if (!token) return false;
      const result = await serverFetch('/api/auth/logout', {
        method: 'POST',
        headers: authHeaders(token),
      });
      return result.success ?? false;
    } catch {
      return false;
    }
  });

  ipcMain.handle('auth:validate', async (_event, token: string) => {
    try {
      if (!token) return { success: false, error: 'No token provided' };
      return await serverFetch('/api/auth/validate', {
        method: 'GET',
        headers: authHeaders(token),
      });
    } catch (err: any) {
      return { success: false, error: err.message || 'Server unavailable' };
    }
  });

  ipcMain.handle('auth:updateProfile', async (_event, token: string, updates: { username?: string; avatarUrl?: string }) => {
    try {
      if (!token) return { success: false, error: 'Unauthorized' };
      return await serverFetch('/api/auth/profile', {
        method: 'PUT',
        headers: authHeaders(token),
        body: JSON.stringify(updates),
      });
    } catch (err: any) {
      return { success: false, error: err.message || 'Server unavailable' };
    }
  });

  ipcMain.handle('auth:changePassword', async (_event, token: string, oldPassword: string, newPassword: string) => {
    try {
      if (!token) return { success: false, error: 'Unauthorized' };
      return await serverFetch('/api/auth/password', {
        method: 'PUT',
        headers: authHeaders(token),
        body: JSON.stringify({ oldPassword, newPassword }),
      });
    } catch (err: any) {
      return { success: false, error: err.message || 'Server unavailable' };
    }
  });

  ipcMain.handle('auth:getSettings', async (_event, token: string) => {
    try {
      if (!token) return {};
      return await serverFetch('/api/settings', {
        method: 'GET',
        headers: authHeaders(token),
      });
    } catch {
      return {};
    }
  });

  ipcMain.handle('auth:setSettings', async (_event, token: string, key: string, value: unknown) => {
    try {
      if (!token) return false;
      const result = await serverFetch('/api/settings', {
        method: 'PUT',
        headers: authHeaders(token),
        body: JSON.stringify({ key, value }),
      });
      return result.success ?? false;
    } catch {
      return false;
    }
  });
}
