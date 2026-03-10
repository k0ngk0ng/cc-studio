import { getDefaultShell } from './platform';
import { randomUUID } from 'crypto';
import fs from 'fs';
import os from 'os';

// node-pty is a native module, import dynamically to handle build issues
let pty: typeof import('node-pty') | null = null;
try {
  pty = require('node-pty');
} catch {
  console.warn('node-pty not available — terminal features disabled');
}

type IPty = import('node-pty').IPty;

interface ManagedTerminal {
  pty: IPty;
  cwd: string;
  listeners: Map<string, (data: string) => void>;
}

class TerminalManager {
  private terminals: Map<string, ManagedTerminal> = new Map();

  create(cwd: string, shell?: string): string | null {
    if (!pty) return null;

    const id = randomUUID();

    // Resolve shell — ensure it's a valid absolute path
    let shellPath = shell || getDefaultShell();
    if (!shellPath.startsWith('/') && process.platform !== 'win32') {
      // Relative shell name — try common absolute paths
      const candidates = [`/bin/${shellPath}`, `/usr/bin/${shellPath}`, `/usr/local/bin/${shellPath}`];
      shellPath = candidates.find(p => { try { return fs.statSync(p).isFile(); } catch { return false; } }) || '/bin/zsh';
    }
    // Verify shell exists (macOS/Linux)
    if (process.platform !== 'win32' && !fs.existsSync(shellPath)) {
      shellPath = '/bin/zsh';
      if (!fs.existsSync(shellPath)) {
        shellPath = '/bin/bash';
        if (!fs.existsSync(shellPath)) {
          shellPath = '/bin/sh';
        }
      }
    }

    // Ensure cwd exists — fallback to home directory
    let safeCwd = cwd;
    try {
      if (!fs.existsSync(safeCwd) || !fs.statSync(safeCwd).isDirectory()) {
        safeCwd = os.homedir();
      }
    } catch {
      safeCwd = os.homedir();
    }

    const isWindows = process.platform === 'win32';
    const shellArgs = isWindows ? [] : ['-l'];

    console.log(`[terminal] spawning: shell=${shellPath}, cwd=${safeCwd}`);

    let terminal: IPty;
    try {
      terminal = pty.spawn(shellPath, shellArgs, {
        name: 'xterm-256color',
        cols: 80,
        rows: 24,
        cwd: safeCwd,
        env: process.env as Record<string, string>,
        ...(isWindows ? { useConpty: true } : {}),
      });
    } catch (err) {
      console.error(`[terminal] posix_spawnp failed: shell=${shellPath}, cwd=${safeCwd}`, err);
      return null;
    }

    const managed: ManagedTerminal = {
      pty: terminal,
      cwd: safeCwd,
      listeners: new Map(),
    };

    this.terminals.set(id, managed);

    terminal.onExit(() => {
      this.terminals.delete(id);
    });

    return id;
  }

  onExit(id: string, callback: () => void): void {
    const managed = this.terminals.get(id);
    if (!managed) return;
    managed.pty.onExit(() => {
      callback();
    });
  }

  write(id: string, data: string): boolean {
    const managed = this.terminals.get(id);
    if (!managed) return false;
    managed.pty.write(data);
    return true;
  }

  resize(id: string, cols: number, rows: number): boolean {
    const managed = this.terminals.get(id);
    if (!managed) return false;
    try {
      managed.pty.resize(cols, rows);
      return true;
    } catch {
      return false;
    }
  }

  onData(id: string, callback: (data: string) => void): string | null {
    const managed = this.terminals.get(id);
    if (!managed) return null;

    const listenerId = randomUUID();
    managed.listeners.set(listenerId, callback);

    const disposable = managed.pty.onData((data) => {
      callback(data);
    });

    // Store disposable for cleanup
    const originalCallback = managed.listeners.get(listenerId);
    if (originalCallback) {
      managed.listeners.set(listenerId, (data: string) => {
        originalCallback(data);
      });
    }

    return listenerId;
  }

  kill(id: string): boolean {
    const managed = this.terminals.get(id);
    if (!managed) return false;

    managed.pty.kill();
    managed.listeners.clear();
    this.terminals.delete(id);
    return true;
  }

  killAll(): void {
    for (const [id] of this.terminals) {
      this.kill(id);
    }
  }

  isAvailable(): boolean {
    return pty !== null;
  }
}

export const terminalManager = new TerminalManager();
