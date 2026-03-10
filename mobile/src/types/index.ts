/**
 * Shared types for CC Studio Mobile.
 */

// ─── Auth ────────────────────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  username: string;
  avatarUrl?: string;
  createdAt: number;
}

export interface AuthResult {
  success: boolean;
  user?: User;
  token?: string;
  error?: string;
}

// ─── Remote ──────────────────────────────────────────────────────────

export interface DesktopInfo {
  desktopId: string;
  deviceName: string;
  online: boolean;
}

export interface PairedDevice {
  deviceId: string;
  deviceName: string;
  deviceType: 'mobile' | 'desktop';
  pairedAt: number;
  lastSeen?: number;
}

// ─── E2EE ────────────────────────────────────────────────────────────

export interface QRPayload {
  s: string;  // server URL
  t: string;  // auth token (shared from desktop)
  p: string;  // pairing code
  k: string;  // desktop ECDH public key (hex)
  d: string;  // desktop device ID
}

// ─── Chat / Session ──────────────────────────────────────────────────

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  costUsd?: number;
  durationMs?: number;
}

export interface SessionInfo {
  id: string;
  title: string;
  lastMessage?: string;
  timestamp: string;
  projectPath: string;
}

// ─── Git ─────────────────────────────────────────────────────────────

export interface GitStatus {
  staged: GitFileChange[];
  unstaged: GitFileChange[];
  untracked: string[];
  branch: string;
  ahead: number;
  behind: number;
}

export interface GitFileChange {
  path: string;
  status: string;
}

export interface GitLogEntry {
  hash: string;
  shortHash: string;
  subject: string;
  author: string;
  date: string;
}

// ─── Remote Command Protocol ─────────────────────────────────────────

export interface RemoteCommand {
  type: 'command';
  id: string;
  channel: string;
  args: unknown[];
}

export interface RemoteResponse {
  type: 'response';
  id: string;
  result?: unknown;
  error?: string;
}

export interface RemoteEvent {
  type: 'event';
  channel: string;
  data: unknown;
}
