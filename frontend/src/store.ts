// Hermes WebUI — Zustand state store
// Manages sessions, chat streaming, UI state, and settings.

import { create } from 'zustand';
import type {
  Session,
  Message,
  ToolCall,
  Model,
  Workspace,
  Profile,
  UsageStats,
  SSEEvent,
} from './types';
import * as api from './api';

// ── Toast / Notification types ────────────────────────────────────

export interface Toast {
  id: string;
  message: string;
  type: 'info' | 'error' | 'warning' | 'success';
}

// ── Pending approval ──────────────────────────────────────────────

export interface PendingApproval {
  sessionId: string;
  toolName: string;
  description: string;
  options: string[];
}

// ── Active tool call (streaming) ──────────────────────────────────

export interface ActiveToolCall {
  name: string;
  preview: string;
  args: Record<string, string>;
}

// ── Store interface ───────────────────────────────────────────────

export interface AppStore {
  // ── Session slice ─────────────────────────────────────────────
  sessions: Session[];
  currentSessionId: string | null;
  currentSession: Session | null;
  sessionsLoading: boolean;
  sessionsError: string | null;

  loadSessions: () => Promise<void>;
  selectSession: (id: string) => Promise<void>;
  createNewSession: (model?: string, workspace?: string) => Promise<string | null>;
  deleteSessionById: (id: string) => Promise<void>;
  renameSessionById: (id: string, title: string) => Promise<void>;
  pinSessionById: (id: string, pinned: boolean) => Promise<void>;
  archiveSessionById: (id: string, archived: boolean) => Promise<void>;
  clearSessionMessages: (id: string) => Promise<void>;
  searchSessions: (query: string) => Promise<void>;

  // ── Chat slice ────────────────────────────────────────────────
  messages: Message[];
  streamingText: string;
  isStreaming: boolean;
  activeStreamId: string | null;
  activeToolCalls: ActiveToolCall[];
  pendingApproval: PendingApproval | null;
  lastUsage: UsageStats | null;

  sendMessage: (text: string, attachments?: string[]) => Promise<void>;
  cancelCurrentStream: () => Promise<void>;
  respondApproval: (response: string) => Promise<void>;

  // ── UI slice ──────────────────────────────────────────────────
  sidebarCollapsed: boolean;
  rightPanelTab: string;
  theme: string;
  isMobile: boolean;
  toasts: Toast[];

  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setRightPanelTab: (tab: string) => void;
  setTheme: (theme: string) => void;
  setIsMobile: (mobile: boolean) => void;
  addToast: (message: string, type?: Toast['type']) => void;
  removeToast: (id: string) => void;

  // ── Settings slice ────────────────────────────────────────────
  models: Model[];
  currentModel: string;
  workspaces: Workspace[];
  currentWorkspace: string;
  profiles: Profile[];
  activeProfile: string;
  settingsLoading: boolean;

  loadModels: () => Promise<void>;
  loadWorkspaces: () => Promise<void>;
  loadProfiles: () => Promise<void>;
  setCurrentModel: (model: string) => void;
  setCurrentWorkspace: (workspace: string) => void;
  setActiveProfile: (name: string) => Promise<void>;
}

// ── Helpers ───────────────────────────────────────────────────────

let toastCounter = 0;
function makeToastId(): string {
  return `toast-${Date.now()}-${++toastCounter}`;
}

function readThemeFromStorage(): string {
  try {
    return localStorage.getItem('hermes-theme') || 'dark';
  } catch {
    return 'dark';
  }
}

function writeThemeToStorage(theme: string): void {
  try {
    localStorage.setItem('hermes-theme', theme);
  } catch {
    // ignore storage errors
  }
}

// ── Store implementation ──────────────────────────────────────────

export const useAppStore = create<AppStore>((set, get) => ({
  // ── Session slice ─────────────────────────────────────────────
  sessions: [],
  currentSessionId: null,
  currentSession: null,
  sessionsLoading: false,
  sessionsError: null,

  loadSessions: async () => {
    set({ sessionsLoading: true, sessionsError: null });
    try {
      const sessions = await api.fetchSessions();
      set({ sessions, sessionsLoading: false });
    } catch (err: any) {
      set({ sessionsError: err.message, sessionsLoading: false });
    }
  },

  selectSession: async (id: string) => {
    const state = get();
    // If we already have this session loaded with messages, use it
    const existing = state.sessions.find((s) => s.session_id === id);
    if (existing && existing.messages && existing.messages.length > 0) {
      set({
        currentSessionId: id,
        currentSession: existing,
        messages: existing.messages,
      });
      return;
    }
    // Otherwise fetch it from the API
    try {
      const session = await api.fetchSession(id);
      set({
        currentSessionId: id,
        currentSession: session,
        messages: session.messages || [],
      });
      // Also update the session in the list
      const sessions = get().sessions.map((s) =>
        s.session_id === id ? session : s,
      );
      set({ sessions });
    } catch (err: any) {
      get().addToast(`Failed to load session: ${err.message}`, 'error');
    }
  },

  createNewSession: async (model?: string, workspace?: string) => {
    try {
      const resp = await api.createSession(model, workspace);
      // Backend returns { session: { session_id, ... } }
      const sid = resp.session?.session_id || resp.session_id;
      // Reload sessions to include the new one
      await get().loadSessions();
      // Select the new session
      await get().selectSession(sid);
      return sid;
    } catch (err: any) {
      get().addToast(`Failed to create session: ${err.message}`, 'error');
      return null;
    }
  },

  deleteSessionById: async (id: string) => {
    try {
      await api.deleteSession(id);
      const { currentSessionId } = get();
      set((state) => ({
        sessions: state.sessions.filter((s) => s.session_id !== id),
        currentSessionId:
          currentSessionId === id ? null : currentSessionId,
        currentSession:
          currentSessionId === id ? null : state.currentSession,
        messages: currentSessionId === id ? [] : state.messages,
      }));
    } catch (err: any) {
      get().addToast(`Failed to delete session: ${err.message}`, 'error');
    }
  },

  renameSessionById: async (id: string, title: string) => {
    try {
      await api.renameSession(id, title);
      set((state) => ({
        sessions: state.sessions.map((s) =>
          s.session_id === id ? { ...s, title } : s,
        ),
        currentSession:
          state.currentSession?.session_id === id
            ? { ...state.currentSession, title }
            : state.currentSession,
      }));
    } catch (err: any) {
      get().addToast(`Failed to rename session: ${err.message}`, 'error');
    }
  },

  pinSessionById: async (id: string, pinned: boolean) => {
    try {
      await api.pinSession(id, pinned);
      set((state) => ({
        sessions: state.sessions.map((s) =>
          s.session_id === id ? { ...s, pinned } : s,
        ),
        currentSession:
          state.currentSession?.session_id === id
            ? { ...state.currentSession, pinned }
            : state.currentSession,
      }));
    } catch (err: any) {
      get().addToast(`Failed to pin session: ${err.message}`, 'error');
    }
  },

  archiveSessionById: async (id: string, archived: boolean) => {
    try {
      await api.archiveSession(id, archived);
      set((state) => ({
        sessions: state.sessions.map((s) =>
          s.session_id === id ? { ...s, archived } : s,
        ),
        currentSession:
          state.currentSession?.session_id === id
            ? { ...state.currentSession, archived }
            : state.currentSession,
      }));
    } catch (err: any) {
      get().addToast(`Failed to archive session: ${err.message}`, 'error');
    }
  },

  clearSessionMessages: async (id: string) => {
    try {
      await api.clearSession(id);
      set((state) => ({
        currentSession:
          state.currentSession?.session_id === id
            ? { ...state.currentSession, messages: [] }
            : state.currentSession,
        messages:
          state.currentSessionId === id ? [] : state.messages,
      }));
    } catch (err: any) {
      get().addToast(`Failed to clear session: ${err.message}`, 'error');
    }
  },

  searchSessions: async (query: string) => {
    if (!query.trim()) {
      await get().loadSessions();
      return;
    }
    set({ sessionsLoading: true, sessionsError: null });
    try {
      const sessions = await api.searchSessions(query);
      set({ sessions, sessionsLoading: false });
    } catch (err: any) {
      set({ sessionsError: err.message, sessionsLoading: false });
    }
  },

  // ── Chat slice ────────────────────────────────────────────────
  messages: [],
  streamingText: '',
  isStreaming: false,
  activeStreamId: null,
  activeToolCalls: [],
  pendingApproval: null,
  lastUsage: null,

  sendMessage: async (text: string, attachments?: string[]) => {
    const state = get();
    if (state.isStreaming) return;
    if (!state.currentSessionId) {
      get().addToast('No active session', 'warning');
      return;
    }

    const sessionId = state.currentSessionId;
    const model = state.currentModel;
    const workspace = state.currentWorkspace;

    // Add user message immediately to the UI
    const userMessage: Message = {
      role: 'user',
      content: text,
      attachments,
      timestamp: new Date().toISOString(),
    };
    set((s) => ({
      messages: [...s.messages, userMessage],
      isStreaming: true,
      streamingText: '',
      activeToolCalls: [],
      pendingApproval: null,
    }));

    let streamId: string | null = null;
    try {
      // Start the stream
      const { stream_id } = await api.sendMessage(
        sessionId,
        text,
        model,
        workspace,
        attachments,
      );
      streamId = stream_id;
      set({ activeStreamId: stream_id });

      // Process SSE events
      for await (const evt of api.streamChat(stream_id)) {
        // Check if stream was cancelled while iterating
        if (!get().isStreaming && get().activeStreamId !== stream_id) {
          break;
        }

        handleSSEEvent(evt, sessionId, set, get);
      }
    } catch (err: any) {
      get().addToast(`Stream error: ${err.message}`, 'error');
    } finally {
      // Clear streaming state
      set((s) => ({
        isStreaming: false,
        activeStreamId: s.activeStreamId === streamId ? null : s.activeStreamId,
        streamingText: '',
        activeToolCalls: [],
      }));
    }
  },

  cancelCurrentStream: async () => {
    const { activeStreamId } = get();
    if (!activeStreamId) return;
    try {
      await api.cancelStream(activeStreamId);
    } catch (err: any) {
      get().addToast(`Failed to cancel stream: ${err.message}`, 'error');
    }
    set({
      isStreaming: false,
      activeStreamId: null,
      streamingText: '',
      activeToolCalls: [],
    });
  },

  respondApproval: async (response: string) => {
    const { pendingApproval } = get();
    if (!pendingApproval) return;

    const { sessionId, toolName } = pendingApproval;
    set({ pendingApproval: null });

    try {
      await api.respondApproval(sessionId, response, toolName);
      // After responding to approval, the stream should resume.
      // The resumed stream events will continue to be processed
      // by the ongoing sendMessage generator loop.
    } catch (err: any) {
      get().addToast(`Approval response failed: ${err.message}`, 'error');
    }
  },

  // ── UI slice ──────────────────────────────────────────────────
  sidebarCollapsed: false,
  rightPanelTab: 'files',
  theme: readThemeFromStorage(),
  isMobile: false,
  toasts: [],

  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  setSidebarCollapsed: (collapsed: boolean) => set({ sidebarCollapsed: collapsed }),
  setRightPanelTab: (tab: string) => set({ rightPanelTab: tab }),

  setTheme: (theme: string) => {
    writeThemeToStorage(theme);
    set({ theme });
  },

  setIsMobile: (mobile: boolean) => set({ isMobile: mobile }),

  addToast: (message: string, type: Toast['type'] = 'info') => {
    const id = makeToastId();
    const toast: Toast = { id, message, type };
    set((s) => ({ toasts: [...s.toasts, toast] }));
    // Auto-remove after 5 seconds
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    }, 5000);
  },

  removeToast: (id: string) => {
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
  },

  // ── Settings slice ────────────────────────────────────────────
  models: [],
  currentModel: '',
  workspaces: [],
  currentWorkspace: '',
  profiles: [],
  activeProfile: '',
  settingsLoading: false,

  loadModels: async () => {
    try {
      const resp = await api.fetchModels();
      // Flatten groups into a flat model list with provider info
      const flatModels = resp.groups.flatMap((g) =>
        g.models.map((m) => ({ id: m.id, name: m.label || m.id, provider: g.provider }))
      );
      set({
        models: flatModels,
        currentModel: resp.default_model || (flatModels[0]?.id ?? ''),
      });
    } catch (err: any) {
      get().addToast(`Failed to load models: ${err.message}`, 'error');
    }
  },

  loadWorkspaces: async () => {
    try {
      const resp = await api.fetchWorkspaces();
      set({
        workspaces: resp.workspaces,
        currentWorkspace: resp.last || (resp.workspaces[0]?.name ?? ''),
      });
    } catch (err: any) {
      get().addToast(`Failed to load workspaces: ${err.message}`, 'error');
    }
  },

  loadProfiles: async () => {
    try {
      const [profilesResp, activeResp] = await Promise.all([
        api.fetchProfiles(),
        api.fetchActiveProfile(),
      ]);
      set({
        profiles: profilesResp.profiles,
        activeProfile: activeResp.name,
      });
    } catch (err: any) {
      get().addToast(`Failed to load profiles: ${err.message}`, 'error');
    }
  },

  setCurrentModel: (model: string) => set({ currentModel: model }),
  setCurrentWorkspace: (workspace: string) => set({ currentWorkspace: workspace }),

  setActiveProfile: async (name: string) => {
    try {
      await api.switchProfile(name);
      set({ activeProfile: name });
    } catch (err: any) {
      get().addToast(`Failed to switch profile: ${err.message}`, 'error');
    }
  },
}));

// ── SSE event handler ─────────────────────────────────────────────
// Extracted as a standalone function for clarity.

function handleSSEEvent(
  evt: SSEEvent,
  sessionId: string,
  set: (partial: Partial<AppStore> | ((s: AppStore) => Partial<AppStore>)) => void,
  get: () => AppStore,
): void {
  switch (evt.event) {
    case 'token': {
      set((s) => ({
        streamingText: s.streamingText + evt.data.text,
      }));
      break;
    }

    case 'tool': {
      set((s) => ({
        activeToolCalls: [
          ...s.activeToolCalls,
          {
            name: evt.data.name,
            preview: evt.data.preview,
            args: evt.data.args,
          },
        ],
      }));
      break;
    }

    case 'approval': {
      set({
        pendingApproval: {
          sessionId: evt.data.session_id,
          toolName: evt.data.tool_name,
          description: evt.data.description,
          options: evt.data.options,
        },
      });
      break;
    }

    case 'done': {
      const { session, usage } = evt.data;
      // Finalize: add the assistant message and update session data
      const assistantMessage: Message = {
        role: 'assistant',
        content: get().streamingText,
        tool_calls: session.tool_calls?.length
          ? session.tool_calls
          : undefined,
        timestamp: new Date().toISOString(),
      };
      set((s) => ({
        messages: [...s.messages, assistantMessage],
        streamingText: '',
        activeToolCalls: [],
        isStreaming: false,
        activeStreamId: null,
        lastUsage: usage,
        currentSession: session,
        sessions: s.sessions.map((sess) =>
          sess.session_id === session.session_id ? session : sess,
        ),
      }));
      break;
    }

    case 'compressed': {
      get().addToast(evt.data.message || 'Context was compressed', 'info');
      break;
    }

    case 'apperror': {
      const { message, hint } = evt.data;
      const fullMsg = hint ? `${message} (${hint})` : message;
      get().addToast(fullMsg, 'error');
      // If there was streaming text, finalize it as a partial message
      const streaming = get().streamingText;
      if (streaming) {
        const partialMsg: Message = {
          role: 'assistant',
          content: streaming + '\n\n[Error: ' + message + ']',
          timestamp: new Date().toISOString(),
        };
        set((s) => ({
          messages: [...s.messages, partialMsg],
          streamingText: '',
          activeToolCalls: [],
          isStreaming: false,
          activeStreamId: null,
        }));
      } else {
        set({
          streamingText: '',
          activeToolCalls: [],
          isStreaming: false,
          activeStreamId: null,
        });
      }
      break;
    }

    case 'cancel': {
      get().addToast(evt.data.message || 'Stream was cancelled', 'warning');
      const streaming = get().streamingText;
      if (streaming) {
        const partialMsg: Message = {
          role: 'assistant',
          content: streaming + '\n\n[Cancelled]',
          timestamp: new Date().toISOString(),
        };
        set((s) => ({
          messages: [...s.messages, partialMsg],
        }));
      }
      set({
        streamingText: '',
        activeToolCalls: [],
        isStreaming: false,
        activeStreamId: null,
      });
      break;
    }
  }
}
