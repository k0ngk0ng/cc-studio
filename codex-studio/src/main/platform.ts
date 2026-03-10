import os from 'os';
import path from 'path';
import fs from 'fs';
import { execSync } from 'child_process';

const isMac = process.platform === 'darwin';
const isWindows = process.platform === 'win32';

function execTrim(command: string): string | null {
  try {
    return execSync(command, {
      encoding: 'utf-8',
      timeout: 5000,
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
  } catch {
    return null;
  }
}

export function getCodexBinary(): string {
  const homeDir = os.homedir();

  if (isWindows) {
    const candidates = [
      path.join(homeDir, '.local', 'bin', 'codex.cmd'),
      path.join(homeDir, 'AppData', 'Roaming', 'npm', 'codex.cmd'),
      path.join(homeDir, 'AppData', 'Local', 'npm-global', 'codex.cmd'),
    ];
    for (const candidate of candidates) {
      try {
        if (fs.statSync(candidate).isFile()) return candidate;
      } catch {
        // Ignore missing paths.
      }
    }
    return execTrim('where codex')?.split('\n')[0] || 'codex';
  }

  const candidates = [
    path.join(homeDir, '.local', 'bin', 'codex'),
    path.join(homeDir, '.nvm', 'versions', 'node'),
  ];

  try {
    if (fs.statSync(candidates[0]).isFile()) {
      return candidates[0];
    }
  } catch {
    // Ignore missing paths.
  }

  return execTrim('which codex') || 'codex';
}

export function getSessionsDir(): string {
  return path.join(getCodexHome(), 'sessions');
}

export function getArchivedSessionsDir(): string {
  return path.join(getCodexHome(), 'archived_sessions');
}

export function getHomePath(): string {
  return os.homedir();
}

export function encodePath(absolutePath: string): string {
  return absolutePath;
}

export function getDefaultShell(): string {
  if (isWindows) {
    return process.env.COMSPEC || 'cmd.exe';
  }
  return process.env.SHELL || '/bin/zsh';
}

export function getPlatform(): 'mac' | 'windows' | 'linux' {
  if (isMac) return 'mac';
  if (isWindows) return 'windows';
  return 'linux';
}

export function getCodexModel(): string {
  const envModel = process.env.CODEX_MODEL || process.env.OPENAI_MODEL;
  if (envModel) return envModel;

  const config = readCodexConfig();
  const fileModel = config.model;
  if (typeof fileModel === 'string' && fileModel) {
    return fileModel;
  }

  return 'gpt-5.4';
}

export function getCodexHome(): string {
  return process.env.CODEX_HOME || path.join(os.homedir(), '.codex');
}

function getCodexConfigPath(): string {
  return path.join(getCodexHome(), 'config.toml');
}

function parseTomlScalar(raw: string): string | number | boolean {
  const trimmed = raw.trim();

  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) return Number(trimmed);

  const quoted = trimmed.match(/^"(.*)"$/);
  if (quoted) {
    return quoted[1].replace(/\\"/g, '"');
  }

  return trimmed;
}

export function readCodexConfig(): Record<string, unknown> {
  const configPath = getCodexConfigPath();
  try {
    const content = fs.readFileSync(configPath, 'utf-8');
    const result: Record<string, unknown> = {};

    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('[')) {
        continue;
      }

      const idx = trimmed.indexOf('=');
      if (idx <= 0) continue;

      const key = trimmed.slice(0, idx).trim();
      const value = trimmed.slice(idx + 1);
      result[key] = parseTomlScalar(value);
    }

    return result;
  } catch {
    return {};
  }
}

function formatTomlValue(value: unknown): string {
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') return String(value);
  return JSON.stringify(String(value));
}

export function writeCodexConfig(updates: Record<string, unknown>): void {
  const configPath = getCodexConfigPath();
  const dir = path.dirname(configPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const existing = readCodexConfig();
  const merged = { ...existing, ...updates };
  const lines = Object.entries(merged).map(([key, value]) => `${key} = ${formatTomlValue(value)}`);
  fs.writeFileSync(configPath, lines.join('\n') + '\n', 'utf-8');
}

export interface DependencyStatus {
  name: string;
  found: boolean;
  path?: string;
  version?: string;
  installHint: string;
  npmAvailable?: boolean;
}

export function isNpmAvailable(): boolean {
  const command = isWindows ? 'where npm.cmd' : 'which npm';
  return !!execTrim(command);
}

export function checkDependencies(): DependencyStatus[] {
  const deps: DependencyStatus[] = [];
  const npmAvailable = isNpmAvailable();

  try {
    const codexPath = getCodexBinary();
    const version = execSync(`"${codexPath}" --version`, {
      encoding: 'utf-8',
      timeout: 5000,
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
    deps.push({
      name: 'Codex CLI',
      found: true,
      path: codexPath,
      version,
      installHint: 'npm install -g @openai/codex',
    });
  } catch {
    const installHint = npmAvailable
      ? 'npm install -g @openai/codex'
      : isWindows
        ? 'Install Node.js from https://nodejs.org first, then run: npm install -g @openai/codex'
        : isMac
          ? 'Install Node.js first (brew install node or https://nodejs.org), then run: npm install -g @openai/codex'
          : 'Install Node.js first (sudo apt install nodejs npm or https://nodejs.org), then run: npm install -g @openai/codex';
    deps.push({
      name: 'Codex CLI',
      found: false,
      npmAvailable,
      installHint,
    });
  }

  try {
    const gitCommand = isWindows ? 'where git' : 'which git';
    const gitPath = execSync(gitCommand, {
      encoding: 'utf-8',
      timeout: 5000,
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim().split('\n')[0];
    const gitVersion = execSync('git --version', {
      encoding: 'utf-8',
      timeout: 5000,
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
    deps.push({
      name: 'Git',
      found: true,
      path: gitPath,
      version: gitVersion.replace('git version ', ''),
      installHint: isWindows
        ? 'https://git-scm.com/download/win'
        : isMac
          ? 'xcode-select --install'
          : 'sudo apt install git',
    });
  } catch {
    deps.push({
      name: 'Git',
      found: false,
      installHint: isWindows
        ? 'https://git-scm.com/download/win'
        : isMac
          ? 'xcode-select --install'
          : 'sudo apt install git',
    });
  }

  return deps;
}
