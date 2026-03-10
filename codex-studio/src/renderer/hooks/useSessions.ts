import { useCallback } from 'react';
import { useAppStore } from '../stores/appStore';
import { useTabStore } from '../stores/tabStore';
import { debugLog } from '../stores/debugLogStore';
import type { SessionInfo, Message, ToolUseInfo } from '../types';

function cleanFunctionOutput(output: string | undefined): string {
  if (!output) return '';

  const normalized = output.replace(/\r\n/g, '\n').trim();
  const match = normalized.match(/\nOutput:\n([\s\S]*)$/);
  if (match) {
    return match[1].trim();
  }
  return normalized;
}

function toolNameForFunction(name: string): string {
  if (name === 'exec_command') return 'Shell';
  if (name === 'write_stdin') return 'Write Stdin';
  if (name === 'apply_patch') return 'Apply Patch';
  return name;
}

function parseFunctionArguments(rawArguments: string | undefined): Record<string, unknown> {
  if (!rawArguments) return {};
  try {
    return JSON.parse(rawArguments);
  } catch {
    return { input: rawArguments };
  }
}

function parseRawMessages(rawMessages: any[]): Message[] {
  const messages: Message[] = [];
  let currentAssistant: {
    id: string;
    timestamp: string;
    texts: string[];
    tools: ToolUseInfo[];
    toolByCallId: Map<string, ToolUseInfo>;
  } | null = null;

  const flushAssistant = () => {
    if (!currentAssistant) return;
    const content = currentAssistant.texts.join('\n\n').trim();
    if (content || currentAssistant.tools.length > 0) {
      messages.push({
        id: currentAssistant.id,
        role: 'assistant',
        content,
        toolUse: currentAssistant.tools.length > 0 ? currentAssistant.tools : undefined,
        timestamp: currentAssistant.timestamp,
      });
    }
    currentAssistant = null;
  };

  const ensureAssistant = (timestamp: string) => {
    if (!currentAssistant) {
      currentAssistant = {
        id: crypto.randomUUID(),
        timestamp,
        texts: [],
        tools: [],
        toolByCallId: new Map(),
      };
    }
    return currentAssistant;
  };

  for (const raw of rawMessages) {
    if (!raw || typeof raw !== 'object') continue;

    if (raw.type === 'event_msg' && raw.payload?.type === 'user_message') {
      flushAssistant();
      const content = String(raw.payload.message || '').trim();
      if (!content) continue;
      messages.push({
        id: crypto.randomUUID(),
        role: 'user',
        content,
        timestamp: raw.timestamp || new Date().toISOString(),
      });
      continue;
    }

    if (raw.type === 'event_msg' && raw.payload?.type === 'agent_message') {
      const assistant = ensureAssistant(raw.timestamp || new Date().toISOString());
      const text = String(raw.payload.message || '').trim();
      if (text) {
        assistant.texts.push(text);
      }
      continue;
    }

    if (raw.type === 'response_item' && raw.payload?.type === 'function_call') {
      const assistant = ensureAssistant(raw.timestamp || new Date().toISOString());
      const tool: ToolUseInfo = {
        name: toolNameForFunction(String(raw.payload.name || 'tool')),
        input: parseFunctionArguments(raw.payload.arguments),
      };
      assistant.tools.push(tool);
      if (raw.payload.call_id) {
        assistant.toolByCallId.set(String(raw.payload.call_id), tool);
      }
      continue;
    }

    if (raw.type === 'response_item' && raw.payload?.type === 'function_call_output') {
      const assistant = ensureAssistant(raw.timestamp || new Date().toISOString());
      const callId = String(raw.payload.call_id || '');
      const tool = assistant.toolByCallId.get(callId);
      if (tool) {
        tool.result = cleanFunctionOutput(String(raw.payload.output || ''));
      }
    }
  }

  flushAssistant();
  return messages;
}

export function useSessions() {
  const {
    setSessions,
    setCurrentSession,
    resetCurrentSession,
    setCurrentProject,
    saveCurrentRuntime,
    restoreRuntime,
    sessions,
    currentSession,
  } = useAppStore();

  const loadSessions = useCallback(async () => {
    try {
      const allSessions = await window.api.sessions.list();
      debugLog('session', `loaded ${allSessions.length} Codex sessions`);
      setSessions(allSessions);
      return allSessions;
    } catch (err) {
      debugLog('session', 'failed to load sessions', err, 'error');
      return [];
    }
  }, [setSessions]);

  const loadSessionMessages = useCallback(
    async (_projectPath: string, sessionId: string): Promise<Message[]> => {
      try {
        const rawMessages = await window.api.sessions.getMessages('', sessionId);
        const messages = parseRawMessages(rawMessages);
        debugLog('session', `parsed ${messages.length} messages from rollout ${sessionId}`);
        return messages;
      } catch (err) {
        debugLog('session', `failed to load rollout: ${sessionId}`, err, 'error');
        return [];
      }
    },
    [],
  );

  const selectSession = useCallback(
    async (session: SessionInfo) => {
      debugLog('session', `switching to session: ${session.id} (${session.projectName})`);

      useTabStore.getState().openTab({
        id: session.id,
        title: session.title || session.lastMessage || 'Thread',
        isNew: false,
        projectPath: session.projectPath,
      });

      saveCurrentRuntime();
      const restored = restoreRuntime(session.id);

      if (!restored) {
        useAppStore.getState().setIsLoadingSession(true);

        setCurrentSession({
          id: session.id,
          projectPath: session.projectPath,
          title: session.title || session.lastMessage || '',
          messages: [],
          isStreaming: false,
          processId: null,
        });

        useAppStore.getState().clearStreamingContent();
        useAppStore.getState().clearToolActivities();

        try {
          const messages = await loadSessionMessages(session.projectPath, session.id);
          setCurrentSession({
            id: session.id,
            projectPath: session.projectPath,
            title: session.title || session.lastMessage || '',
            messages,
            isStreaming: false,
            processId: null,
          });
        } finally {
          useAppStore.getState().setIsLoadingSession(false);
        }
      }

      const projectName = session.projectPath.replace(/[\\/]+$/, '').split(/[\\/]/).pop() || session.projectName;
      setCurrentProject({ path: session.projectPath, name: projectName });

      try {
        const branch = await window.api.git.branch(session.projectPath);
        setCurrentProject({ path: session.projectPath, name: projectName, branch });
      } catch {
        // Ignore non-git folders.
      }
    },
    [loadSessionMessages, restoreRuntime, saveCurrentRuntime, setCurrentProject, setCurrentSession],
  );

  const createNewSession = useCallback(
    (projectPath: string) => {
      saveCurrentRuntime();

      const tempId = `new-${Date.now()}`;
      resetCurrentSession();
      setCurrentSession({
        projectPath,
        messages: [],
        id: tempId,
        processId: null,
        isStreaming: false,
      });

      useTabStore.getState().openTab({
        id: tempId,
        title: 'New Thread',
        isNew: true,
        projectPath,
      });
    },
    [resetCurrentSession, saveCurrentRuntime, setCurrentSession],
  );

  const forkSession = useCallback(
    async (cutoffMessageId: string) => {
      const state = useAppStore.getState();
      const { id: sessionId, projectPath } = state.currentSession;
      const effectivePath = projectPath || state.currentProject.path;

      if (!sessionId) {
        debugLog('session', 'fork: no session id — cannot fork unsaved session', undefined, 'warn');
        return;
      }

      debugLog('session', `fork requested for ${sessionId} at ${cutoffMessageId}`);
      const newSessionId = await window.api.sessions.fork(effectivePath, sessionId, cutoffMessageId);
      if (!newSessionId) {
        debugLog('session', 'fork is not currently available for Codex rollouts', undefined, 'warn');
      }
    },
    [],
  );

  const listProjects = useCallback(async () => {
    try {
      return await window.api.sessions.listProjects();
    } catch (err) {
      debugLog('session', 'failed to list projects', err, 'error');
      return [];
    }
  }, []);

  return {
    sessions,
    currentSession,
    loadSessions,
    loadSessionMessages,
    selectSession,
    createNewSession,
    forkSession,
    listProjects,
  };
}
