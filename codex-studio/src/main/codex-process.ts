import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';
import { spawn, ChildProcess } from 'child_process';
import readline from 'readline';
import { BrowserWindow } from 'electron';
import { getCodexBinary } from './platform';

function debugLog(message: string, detail?: unknown, level: 'info' | 'warn' | 'error' = 'info') {
  const detailStr = detail !== undefined
    ? (typeof detail === 'object' ? JSON.stringify(detail, null, 2) : String(detail))
    : undefined;

  console.log('[codex-process]', message, detailStr ?? '');

  try {
    const windows = BrowserWindow.getAllWindows();
    if (windows.length > 0) {
      windows[0].webContents.send('debug-log', {
        category: 'codex',
        message,
        detail: detailStr,
        level,
      });
    }
  } catch {
    // Ignore renderer delivery issues.
  }
}

export interface PermissionRequest {
  processId: string;
  requestId: string;
  toolName: string;
  input: Record<string, unknown>;
}

export interface PermissionResponse {
  behavior: 'allow' | 'deny';
  updatedInput?: Record<string, unknown>;
  message?: string;
}

interface ManagedSession {
  cwd: string;
  sessionId?: string;
  permissionMode?: string;
  language?: string;
  envVars?: Array<{ key: string; value: string; enabled: boolean }>;
  includeCoAuthoredBy?: boolean;
  childProcess?: ChildProcess;
  messageCount: number;
}

function extractEnvValue(
  envVars: Array<{ key: string; value: string; enabled: boolean }> | undefined,
  key: string,
): string | undefined {
  return envVars?.find((envVar) => envVar.enabled && envVar.key === key)?.value;
}

function toCliOverride(key: string, value: string): string {
  return `${key}=${JSON.stringify(value)}`;
}

function buildArgs(session: ManagedSession, promptFromStdin: boolean): string[] {
  const args: string[] = [];
  const model = extractEnvValue(session.envVars, 'CODEX_MODEL') || extractEnvValue(session.envVars, 'OPENAI_MODEL');
  const reasoningEffort = extractEnvValue(session.envVars, 'CODEX_REASONING_EFFORT');
  const profile = extractEnvValue(session.envVars, 'CODEX_PROFILE');
  const localProvider = extractEnvValue(session.envVars, 'CODEX_LOCAL_PROVIDER');
  const useOss = extractEnvValue(session.envVars, 'CODEX_OSS');
  const ephemeral = extractEnvValue(session.envVars, 'CODEX_EPHEMERAL');

  if (session.sessionId) {
    args.push('exec', 'resume', '--json', '--skip-git-repo-check');
  } else {
    args.push('exec', '--json', '--skip-git-repo-check', '--cd', session.cwd);
  }

  switch (session.permissionMode) {
    case 'readOnly':
    case 'plan':
      args.push('--sandbox', 'read-only');
      break;
    case 'fullAuto':
    case 'dontAsk':
      args.push('--full-auto');
      break;
    case 'dangerFullAccess':
    case 'bypassPermissions':
      args.push('--sandbox', 'danger-full-access');
      break;
    case 'workspaceWrite':
    case 'acceptEdits':
    case 'default':
    default:
      args.push('--sandbox', 'workspace-write');
      break;
  }

  if (model) {
    args.push('--model', model);
  }
  if (profile) {
    args.push('--profile', profile);
  }
  if (useOss === '1' || useOss === 'true') {
    args.push('--oss');
  }
  if (localProvider) {
    args.push('--local-provider', localProvider);
  }
  if (reasoningEffort) {
    args.push('-c', toCliOverride('model_reasoning_effort', reasoningEffort));
  }
  if (ephemeral === '1' || ephemeral === 'true') {
    args.push('--ephemeral');
  }

  if (session.sessionId) {
    args.push(session.sessionId);
  }

  if (promptFromStdin) {
    args.push('-');
  }

  return args;
}

class CodexProcessManager extends EventEmitter {
  private sessions = new Map<string, ManagedSession>();

  async spawn(
    cwd: string,
    sessionId?: string,
    permissionMode?: string,
    envVars?: Array<{ key: string; value: string; enabled: boolean }>,
    language?: string,
    _mcpServers?: Array<{ id: string; name: string; command: string; args: string[]; env: Record<string, string>; enabled: boolean }>,
    includeCoAuthoredBy?: boolean,
  ): Promise<string> {
    const processId = randomUUID();
    this.sessions.set(processId, {
      cwd,
      sessionId,
      permissionMode,
      language,
      envVars,
      includeCoAuthoredBy,
      messageCount: 0,
    });

    debugLog('Created Codex session', { processId, cwd, sessionId, permissionMode });
    return processId;
  }

  sendMessage(processId: string, content: string): boolean {
    const managed = this.sessions.get(processId);
    if (!managed) return false;
    if (managed.childProcess) {
      debugLog('sendMessage skipped because a turn is already running', { processId }, 'warn');
      return false;
    }

    const childEnv: NodeJS.ProcessEnv = { ...process.env };
    for (const envVar of managed.envVars || []) {
      if (!envVar.enabled || !envVar.key) continue;
      if (envVar.key.startsWith('CODEX_')) continue;
      childEnv[envVar.key] = envVar.value;
    }

    const args = buildArgs(managed, true);
    const binary = getCodexBinary();

    debugLog('Starting Codex turn', {
      processId,
      binary,
      args,
      cwd: managed.cwd,
      sessionId: managed.sessionId,
    });

    const child = spawn(binary, args, {
      cwd: managed.cwd,
      env: childEnv,
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: process.platform === 'win32',
    });
    managed.childProcess = child;
    managed.messageCount += 1;

    child.stdin.write(content);
    child.stdin.end();

    const stdout = readline.createInterface({ input: child.stdout });
    stdout.on('line', (line) => {
      const message = safeJsonParse(line);
      if (!message) return;

      if (message.type === 'thread.started' && typeof message.thread_id === 'string') {
        managed.sessionId = message.thread_id;
      }

      this.emit('message', processId, message);
    });

    child.stderr.on('data', (chunk: Buffer) => {
      const text = chunk.toString().trim();
      if (!text) return;
      debugLog('stderr', text, 'warn');
    });

    child.on('error', (error) => {
      debugLog('Codex child error', error.message, 'error');
      managed.childProcess = undefined;
      this.emit('error', processId, error.message);
      this.emit('exit', processId, 1, null);
    });

    child.on('close', (code, signal) => {
      debugLog('Codex child exited', { processId, code, signal });
      managed.childProcess = undefined;
      this.emit('exit', processId, code ?? 0, signal);
    });

    return true;
  }

  respondToPermission(processId: string, requestId: string, _response: PermissionResponse): boolean {
    debugLog(
      'Permission response ignored: codex exec --json does not expose an approval-response channel',
      { processId, requestId },
      'warn',
    );
    return false;
  }

  async setPermissionMode(processId: string, mode: string): Promise<boolean> {
    const managed = this.sessions.get(processId);
    if (!managed) return false;
    managed.permissionMode = mode;
    return true;
  }

  kill(processId: string): boolean {
    const managed = this.sessions.get(processId);
    if (!managed) return false;

    if (managed.childProcess) {
      managed.childProcess.kill('SIGTERM');
      managed.childProcess = undefined;
    }

    this.sessions.delete(processId);
    return true;
  }

  killAll(): void {
    for (const processId of this.sessions.keys()) {
      this.kill(processId);
    }
  }

  isRunning(processId: string): boolean {
    const managed = this.sessions.get(processId);
    return !!managed?.childProcess;
  }

  getProcessInfo(processId: string): { cwd: string; sessionId?: string } | null {
    const managed = this.sessions.get(processId);
    if (!managed) return null;
    return {
      cwd: managed.cwd,
      sessionId: managed.sessionId,
    };
  }
}

function safeJsonParse(line: string): any | null {
  try {
    return JSON.parse(line);
  } catch {
    return null;
  }
}

export const codexProcessManager = new CodexProcessManager();
