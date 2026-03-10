import { useCallback, useEffect, useRef } from 'react';
import { useAppStore, type ToolActivity } from '../stores/appStore';
import { usePermissionStore } from '../stores/permissionStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useTabStore } from '../stores/tabStore';
import { debugLog } from '../stores/debugLogStore';
import type { Message, ToolUseInfo, PermissionRequestEvent } from '../types';

interface CodexItem {
  id: string;
  type: string;
  text?: string;
  command?: string;
  aggregated_output?: string;
  exit_code?: number | null;
  status?: string;
}

interface CodexStreamEvent {
  type: string;
  thread_id?: string;
  turn_id?: string;
  item?: CodexItem;
  usage?: {
    input_tokens?: number;
    cached_input_tokens?: number;
    output_tokens?: number;
  };
  message?: string;
  code?: number;
  signal?: string | null;
}

function truncateOutput(text: string | undefined, limit = 1200): string | undefined {
  if (!text) return undefined;
  return text.length > limit ? `${text.slice(0, limit)}\n…(truncated)` : text;
}

function toolInputForActivity(activity: ToolActivity): Record<string, unknown> {
  if (!activity.inputFull) {
    return activity.input ? { input: activity.input } : {};
  }

  if (activity.inputFull.trim().startsWith('{')) {
    try {
      return JSON.parse(activity.inputFull);
    } catch {
      return { input: activity.inputFull };
    }
  }

  return { command: activity.inputFull };
}

function commitCurrentTurn(
  streamingText: string,
  tools: ToolActivity[],
): Message | null {
  const content = streamingText.trim();
  if (!content && tools.length === 0) return null;

  const toolUse: ToolUseInfo[] = tools.map((tool) => ({
    name: tool.name,
    input: toolInputForActivity(tool),
    result: tool.output,
  }));

  return {
    id: crypto.randomUUID(),
    role: 'assistant',
    content,
    timestamp: new Date().toISOString(),
    toolUse: toolUse.length > 0 ? toolUse : undefined,
  };
}

function rekeyCurrentSession(threadId: string) {
  const tabState = useTabStore.getState();
  const activeTab = tabState.getActiveTab();
  if (activeTab && activeTab.id !== threadId && activeTab.isNew) {
    const oldId = activeTab.id;
    tabState.replaceTabId(oldId, threadId);

    const appState = useAppStore.getState();
    const oldRuntime = appState.sessionRuntimes.get(oldId);
    if (oldRuntime) {
      const runtimes = new Map(appState.sessionRuntimes);
      runtimes.delete(oldId);
      runtimes.set(threadId, oldRuntime);
      useAppStore.setState({ sessionRuntimes: runtimes });
    }
  }

  useAppStore.getState().setCurrentSession({ id: threadId });
}

function appendStreamingText(existing: string, next: string): string {
  if (!next.trim()) return existing;
  return existing ? `${existing}\n\n${next}` : next;
}

export function useCodex() {
  const store = useAppStore();
  const processIdRef = useRef<string | null>(null);
  const streamingTextRef = useRef('');

  useEffect(() => {
    processIdRef.current = store.currentSession.processId;
  }, [store.currentSession.processId]);

  const handleBackgroundEvent = useCallback((processId: string, event: CodexStreamEvent) => {
    const state = useAppStore.getState();
    let sessionKey = state.findSessionKeyByProcessId(processId);

    if (event.type === 'thread.started' && event.thread_id) {
      if (!sessionKey) {
        sessionKey = event.thread_id;
        const runtimes = new Map(state.sessionRuntimes);
        runtimes.set(sessionKey, {
          processId,
          isStreaming: false,
          streamingContent: '',
          toolActivities: [],
          messages: [],
        });
        useAppStore.setState({ sessionRuntimes: runtimes });
      } else if (sessionKey !== event.thread_id && state.sessionRuntimes.has(sessionKey)) {
        const runtime = state.sessionRuntimes.get(sessionKey)!;
        const runtimes = new Map(state.sessionRuntimes);
        runtimes.delete(sessionKey);
        runtimes.set(event.thread_id, { ...runtime, processId });
        useAppStore.setState({ sessionRuntimes: runtimes });
        sessionKey = event.thread_id;
      }
    }

    if (!sessionKey) return;

    if (event.type === 'turn.started') {
      state.updateBackgroundRuntime(processId, (runtime) => ({
        ...runtime,
        isStreaming: true,
      }));
      return;
    }

    if (event.type === 'item.started' && event.item?.type === 'command_execution') {
      state.updateBackgroundRuntime(processId, (runtime) => ({
        ...runtime,
        toolActivities: [
          ...runtime.toolActivities,
          {
            id: event.item!.id,
            name: 'Shell',
            input: event.item!.command,
            inputFull: event.item!.command,
            status: 'running',
            timestamp: Date.now(),
          },
        ],
      }));
      return;
    }

    if (event.type === 'item.completed' && event.item?.type === 'command_execution') {
      state.updateBackgroundRuntime(processId, (runtime) => ({
        ...runtime,
        toolActivities: runtime.toolActivities.map((tool) =>
          tool.id === event.item!.id
            ? {
                ...tool,
                status: 'done',
                output: truncateOutput(event.item!.aggregated_output) || '(completed)',
              }
            : tool
        ),
      }));
      return;
    }

    if (event.type === 'item.completed' && event.item?.type === 'agent_message' && event.item.text) {
      state.updateBackgroundRuntime(processId, (runtime) => ({
        ...runtime,
        streamingContent: appendStreamingText(runtime.streamingContent, event.item!.text || ''),
        isStreaming: true,
      }));
      return;
    }

    if (event.type === 'turn.completed') {
      state.updateBackgroundRuntime(processId, (runtime) => {
        const committed = commitCurrentTurn(runtime.streamingContent, runtime.toolActivities);
        return {
          ...runtime,
          messages: committed ? [...runtime.messages, committed] : runtime.messages,
          streamingContent: '',
          toolActivities: [],
          isStreaming: false,
        };
      });
      return;
    }

    if (event.type === 'error') {
      state.updateBackgroundRuntime(processId, (runtime) => ({
        ...runtime,
        messages: [
          ...runtime.messages,
          {
            id: crypto.randomUUID(),
            role: 'system',
            content: event.message || 'Codex error',
            timestamp: new Date().toISOString(),
          },
        ],
        streamingContent: '',
        toolActivities: [],
        isStreaming: false,
      }));
      return;
    }

    if (event.type === 'exit') {
      state.updateBackgroundRuntime(processId, (runtime) => ({
        ...runtime,
        isStreaming: false,
      }));
    }
  }, []);

  useEffect(() => {
    const handler = (processId: string, raw: unknown) => {
      const event = raw as CodexStreamEvent;
      const appState = useAppStore.getState();
      const currentProcessId = appState.currentSession.processId;
      const isCurrentSession = currentProcessId !== null && currentProcessId === processId;

      if (!isCurrentSession) {
        handleBackgroundEvent(processId, event);
        return;
      }

      const {
        addMessage,
        setIsStreaming,
        setStreamingContent,
        clearStreamingContent,
        addToolActivity,
        clearToolActivities,
        setCurrentSession,
      } = useAppStore.getState();

      if (event.type === 'thread.started' && event.thread_id) {
        debugLog('codex', `thread started: ${event.thread_id}`);
        rekeyCurrentSession(event.thread_id);
        const projectPath = useAppStore.getState().currentSession.projectPath || useAppStore.getState().currentProject.path;
        if (projectPath) {
          useAppStore.getState().removePendingProject(projectPath);
        }
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('codex:session-updated'));
        }, 250);
        return;
      }

      if (event.type === 'turn.started') {
        setIsStreaming(true);
        return;
      }

      if (event.type === 'item.started' && event.item) {
        if (event.item.type === 'command_execution') {
          debugLog('codex', `command started: ${event.item.command}`);
          addToolActivity({
            id: event.item.id,
            name: 'Shell',
            input: event.item.command,
            inputFull: event.item.command,
            status: 'running',
            timestamp: Date.now(),
          });
        }
        return;
      }

      if (event.type === 'item.completed' && event.item) {
        if (event.item.type === 'agent_message' && event.item.text) {
          streamingTextRef.current = appendStreamingText(streamingTextRef.current, event.item.text);
          setStreamingContent(streamingTextRef.current);
          return;
        }

        if (event.item.type === 'command_execution') {
          debugLog('codex', `command completed: ${event.item.command}`, event.item);
          useAppStore.setState((state) => ({
            toolActivities: state.toolActivities.map((tool) =>
              tool.id === event.item!.id
                ? {
                    ...tool,
                    status: 'done',
                    output: truncateOutput(event.item!.aggregated_output) || '(completed)',
                  }
                : tool
            ),
          }));
          return;
        }

        return;
      }

      if (event.type === 'turn.completed') {
        debugLog('codex', 'turn completed', event.usage);
        setIsStreaming(false);

        const tools = useAppStore.getState().toolActivities;
        const message = commitCurrentTurn(streamingTextRef.current, tools);
        if (message) {
          addMessage(message);
        }

        streamingTextRef.current = '';
        clearStreamingContent();
        clearToolActivities();

        const sessionId = useAppStore.getState().currentSession.id;
        if (sessionId) {
          const messages = useAppStore.getState().currentSession.messages;
          const firstUser = messages.find((messageItem) => messageItem.role === 'user');
          if (firstUser) {
            useTabStore.getState().updateTab(sessionId, {
              title: firstUser.content.slice(0, 80) || 'Thread',
            });
          }
        }

        window.dispatchEvent(new CustomEvent('codex:session-updated'));
        return;
      }

      if (event.type === 'error') {
        debugLog('codex', `error: ${event.message || 'unknown error'}`, event, 'error');
        setIsStreaming(false);
        streamingTextRef.current = '';
        clearStreamingContent();
        clearToolActivities();
        addMessage({
          id: crypto.randomUUID(),
          role: 'system',
          content: event.message || 'Codex error',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      if (event.type === 'exit') {
        debugLog('codex', `process exit: code=${event.code ?? 0} signal=${event.signal ?? ''}`);
        setIsStreaming(false);
        return;
      }

      if (event.thread_id) {
        setCurrentSession({ id: event.thread_id });
      }
    };

    window.api.codex.onMessage(handler);
    return () => {
      window.api.codex.removeMessageListener(handler);
    };
  }, [handleBackgroundEvent]);

  useEffect(() => {
    const handler = (_processId: string, request: PermissionRequestEvent) => {
      usePermissionStore.getState().addRequest({
        id: request.requestId,
        toolName: request.toolName,
        command: JSON.stringify(request.input),
        toolPattern: request.toolName,
        input: request.input,
        timestamp: Date.now(),
        status: 'pending',
      });
    };

    window.api.codex.onPermissionRequest(handler);
    return () => {
      window.api.codex.removePermissionRequestListener(handler);
    };
  }, []);

  const startSession = useCallback(
    async (
      cwd: string,
      sessionId?: string,
      permissionMode?: string,
      mcpServersOverride?: { id: string; name: string; command: string; args: string[]; env: Record<string, string>; enabled: boolean }[],
    ) => {
      const mode = permissionMode || 'workspaceWrite';
      const providerSettings = useSettingsStore.getState().settings.provider;
      const envVars = providerSettings.envVars.filter((envVar) => envVar.enabled && envVar.key);
      const language = useSettingsStore.getState().settings.general.language || 'auto';
      const settingsMcpServers = useSettingsStore.getState().settings.mcpServers;
      const mcpServers = mcpServersOverride ?? settingsMcpServers;
      const activeProfile = useSettingsStore.getState().getActiveProfile();

      if (useAppStore.getState().currentSession.processId) {
        useAppStore.getState().saveCurrentRuntime();
      }

      usePermissionStore.getState().clearRequests();
      streamingTextRef.current = '';

      const pid = await window.api.codex.spawn(
        cwd,
        sessionId,
        mode,
        envVars,
        language,
        mcpServers,
        activeProfile?.includeCoAuthoredBy,
      );

      processIdRef.current = pid;
      useAppStore.getState().setProcessId(pid);
      useAppStore.getState().setIsStreaming(false);
      return pid;
    },
    [],
  );

  const sendMessage = useCallback(async (content: string, options?: { skipAddMessage?: boolean }) => {
    const state = useAppStore.getState();
    const processId = state.currentSession.processId;
    if (!processId) return;

    if (!options?.skipAddMessage) {
      state.addMessage({
        id: crypto.randomUUID(),
        role: 'user',
        content,
        timestamp: new Date().toISOString(),
      });
    }

    state.setIsStreaming(true);
    state.clearStreamingContent();
    state.clearToolActivities();
    streamingTextRef.current = '';

    const sent = await window.api.codex.send(processId, content);
    if (!sent) {
      state.setIsStreaming(false);
      state.addMessage({
        id: crypto.randomUUID(),
        role: 'system',
        content: 'Failed to start Codex turn. A previous turn may still be running.',
        timestamp: new Date().toISOString(),
      });
    }
  }, []);

  const stopSession = useCallback(async () => {
    const processId = useAppStore.getState().currentSession.processId;
    if (processId) {
      await window.api.codex.kill(processId);
    }

    usePermissionStore.getState().clearRequests();
    useAppStore.getState().setProcessId(null);
    useAppStore.getState().setIsStreaming(false);
    useAppStore.getState().clearStreamingContent();
    useAppStore.getState().clearToolActivities();
    streamingTextRef.current = '';
    processIdRef.current = null;
  }, []);

  return {
    startSession,
    sendMessage,
    stopSession,
    isStreaming: store.currentSession.isStreaming,
    processId: store.currentSession.processId,
  };
}
