import fs from 'fs';
import path from 'path';
import { getArchivedSessionsDir, getSessionsDir } from './platform';

export interface SessionInfo {
  id: string;
  projectPath: string;
  projectName: string;
  title: string;
  lastMessage: string;
  updatedAt: string;
}

export interface ArchivedSessionInfo {
  id: string;
  projectPath: string;
  projectName: string;
  title: string;
  lastMessage: string;
  archivedAt: string;
  originalProjectPath: string;
  originalSessionId: string;
}

interface RolloutSummary {
  id: string;
  filePath: string;
  projectPath: string;
  projectName: string;
  title: string;
  lastMessage: string;
  updatedAt: string;
  archived: boolean;
}

function safeJsonParse(line: string): any | null {
  try {
    return JSON.parse(line);
  } catch {
    return null;
  }
}

function isoFromMillis(ts: number): string {
  return new Date(ts).toISOString();
}

class SessionManager {
  private sessionsDir: string;
  private archivedSessionsDir: string;

  constructor() {
    this.sessionsDir = getSessionsDir();
    this.archivedSessionsDir = getArchivedSessionsDir();
    fs.mkdirSync(this.sessionsDir, { recursive: true });
    fs.mkdirSync(this.archivedSessionsDir, { recursive: true });
  }

  private walkRollouts(root: string): string[] {
    const files: string[] = [];

    const walk = (dir: string) => {
      let entries: fs.Dirent[];
      try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
      } catch {
        return;
      }

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(fullPath);
          continue;
        }
        if (entry.isFile() && entry.name.startsWith('rollout-') && entry.name.endsWith('.jsonl')) {
          files.push(fullPath);
        }
      }
    };

    walk(root);
    return files;
  }

  private parseSummary(filePath: string, archived: boolean): RolloutSummary | null {
    let content: string;
    let stat: fs.Stats;
    try {
      content = fs.readFileSync(filePath, 'utf-8');
      stat = fs.statSync(filePath);
    } catch {
      return null;
    }

    let sessionId = '';
    let projectPath = '';
    let title = '';
    let lastMessage = '';
    let updatedAt = isoFromMillis(stat.mtimeMs);

    for (const line of content.split(/\r?\n/)) {
      if (!line.trim()) continue;
      const entry = safeJsonParse(line);
      if (!entry) continue;

      if (entry.type === 'session_meta' && entry.payload) {
        sessionId = entry.payload.id || sessionId;
        projectPath = entry.payload.cwd || projectPath;
        if (entry.timestamp) {
          updatedAt = entry.timestamp;
        }
        continue;
      }

      if (entry.type === 'event_msg' && entry.payload?.type === 'user_message') {
        const prompt = String(entry.payload.message || '').trim();
        if (prompt && !title) {
          title = prompt;
        }
        continue;
      }

      if (entry.type === 'event_msg' && entry.payload?.type === 'task_complete') {
        const finalMessage = String(entry.payload.last_agent_message || '').trim();
        if (finalMessage) {
          lastMessage = finalMessage;
        }
      }

      if (entry.timestamp) {
        updatedAt = entry.timestamp;
      }
    }

    if (!sessionId) {
      const match = filePath.match(/([0-9a-f]{8,}-[0-9a-f-]+)\.jsonl$/i);
      if (match) {
        sessionId = match[1];
      }
    }

    if (!sessionId) return null;

    const normalizedProjectPath = projectPath || path.dirname(filePath);
    const projectName = path.basename(normalizedProjectPath) || normalizedProjectPath;

    return {
      id: sessionId,
      filePath,
      projectPath: normalizedProjectPath,
      projectName,
      title: title || lastMessage || projectName,
      lastMessage: lastMessage || title || '',
      updatedAt,
      archived,
    };
  }

  private collectSummaries(archived: boolean): RolloutSummary[] {
    const root = archived ? this.archivedSessionsDir : this.sessionsDir;
    return this.walkRollouts(root)
      .map((filePath) => this.parseSummary(filePath, archived))
      .filter((summary): summary is RolloutSummary => !!summary)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }

  private findSummary(sessionId: string, archived: boolean): RolloutSummary | null {
    const summaries = this.collectSummaries(archived);
    return summaries.find((summary) => summary.id === sessionId) || null;
  }

  getAllSessions(): SessionInfo[] {
    return this.collectSummaries(false).map((summary) => ({
      id: summary.id,
      projectPath: summary.projectPath,
      projectName: summary.projectName,
      title: summary.title,
      lastMessage: summary.lastMessage,
      updatedAt: summary.updatedAt,
    }));
  }

  getSessionMessages(_projectPath: string, sessionId: string): any[] {
    const summary = this.findSummary(sessionId, false) || this.findSummary(sessionId, true);
    if (!summary) return [];

    try {
      const content = fs.readFileSync(summary.filePath, 'utf-8');
      return content
        .split(/\r?\n/)
        .filter((line) => line.trim())
        .map((line) => safeJsonParse(line))
        .filter((entry) => !!entry);
    } catch {
      return [];
    }
  }

  listAllProjects(): { name: string; path: string; encodedPath: string }[] {
    const seen = new Set<string>();
    const projects: Array<{ name: string; path: string; encodedPath: string }> = [];

    for (const session of this.getAllSessions()) {
      if (seen.has(session.projectPath)) continue;
      seen.add(session.projectPath);
      projects.push({
        name: session.projectName,
        path: session.projectPath,
        encodedPath: session.projectPath,
      });
    }

    return projects.sort((a, b) => a.name.localeCompare(b.name));
  }

  forkSession(_projectPath: string, _sessionId: string, _cutoffUuid: string): string | null {
    return null;
  }

  archiveSession(_projectPath: string, sessionId: string): boolean {
    const summary = this.findSummary(sessionId, false);
    if (!summary) return false;

    try {
      fs.mkdirSync(this.archivedSessionsDir, { recursive: true });
      const targetPath = path.join(this.archivedSessionsDir, path.basename(summary.filePath));
      fs.renameSync(summary.filePath, targetPath);
      return true;
    } catch {
      return false;
    }
  }

  unarchiveSession(archivedSessionId: string): boolean {
    const summary = this.findSummary(archivedSessionId, true);
    if (!summary) return false;

    const match = path.basename(summary.filePath).match(/^rollout-(\d{4})-(\d{2})-(\d{2})T/i);
    const targetDir = match
      ? path.join(this.sessionsDir, match[1], match[2], match[3])
      : this.sessionsDir;

    try {
      fs.mkdirSync(targetDir, { recursive: true });
      const targetPath = path.join(targetDir, path.basename(summary.filePath));
      fs.renameSync(summary.filePath, targetPath);
      return true;
    } catch {
      return false;
    }
  }

  listArchivedSessions(): ArchivedSessionInfo[] {
    return this.collectSummaries(true).map((summary) => ({
      id: summary.id,
      projectPath: summary.projectPath,
      projectName: summary.projectName,
      title: summary.title,
      lastMessage: summary.lastMessage,
      archivedAt: summary.updatedAt,
      originalProjectPath: summary.projectPath,
      originalSessionId: summary.id,
    }));
  }

  watchForChanges(callback: () => void): fs.FSWatcher | null {
    const watchers: fs.FSWatcher[] = [];

    const watchDir = (dir: string) => {
      try {
        const watcher = fs.watch(dir, { recursive: true }, () => callback());
        watchers.push(watcher);
      } catch {
        try {
          const watcher = fs.watch(dir, () => callback());
          watchers.push(watcher);
        } catch {
          // Ignore watch failures.
        }
      }
    };

    watchDir(this.sessionsDir);
    watchDir(this.archivedSessionsDir);

    return watchers[0] || null;
  }
}

export const sessionManager = new SessionManager();
