// Hermes WebUI — API client layer
// All requests are relative; Vite dev proxy forwards /api -> localhost:8787.
// Response shapes match the actual Python backend.

import type {
  Session,
  CronJob,
  Skill,
  Settings,
  ModelsResponse,
  WorkspacesResponse,
  MemoryResponse,
  ProfilesResponse,
  FileContentResponse,
  SkillContentResponse,
  NewSessionResponse,
  SendMessageResponse,
  HealthResponse,
  FileEntry,
  SSEEvent,
} from './types';

// ── Generic fetch helper ─────────────────────────────────────────────

async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });
  if (!res.ok) {
    throw new Error(`API error: ${res.status}`);
  }
  return res.json();
}

// ── Sessions ─────────────────────────────────────────────────────────

export async function fetchSessions(): Promise<Session[]> {
  const resp = await api<{ sessions: Session[] }>('/api/sessions');
  return resp.sessions;
}

export async function fetchSession(id: string): Promise<Session> {
  const resp = await api<{ session: Session }>(`/api/session?session_id=${encodeURIComponent(id)}`);
  return resp.session;
}

export function createSession(
  model?: string,
  workspace?: string,
): Promise<NewSessionResponse> {
  return api<NewSessionResponse>('/api/session/new', {
    method: 'POST',
    body: JSON.stringify({ model, workspace }),
  });
}

export function deleteSession(id: string): Promise<void> {
  return api<void>('/api/session/delete', {
    method: 'POST',
    body: JSON.stringify({ session_id: id }),
  });
}

export function renameSession(id: string, title: string): Promise<void> {
  return api<void>('/api/session/rename', {
    method: 'POST',
    body: JSON.stringify({ session_id: id, title }),
  });
}

export function pinSession(id: string, pinned: boolean): Promise<void> {
  return api<void>('/api/session/pin', {
    method: 'POST',
    body: JSON.stringify({ session_id: id, pinned }),
  });
}

export function archiveSession(id: string, archived: boolean): Promise<void> {
  return api<void>('/api/session/archive', {
    method: 'POST',
    body: JSON.stringify({ session_id: id, archived }),
  });
}

export function clearSession(id: string): Promise<void> {
  return api<void>('/api/session/clear', {
    method: 'POST',
    body: JSON.stringify({ session_id: id }),
  });
}

export async function searchSessions(query: string): Promise<Session[]> {
  const resp = await api<{ sessions: Session[] }>(`/api/sessions/search?q=${encodeURIComponent(query)}`);
  return resp.sessions;
}

// ── Chat / streaming ─────────────────────────────────────────────────

export function sendMessage(
  sessionId: string,
  text: string,
  model: string,
  workspace: string,
  attachments?: string[],
): Promise<SendMessageResponse> {
  return api<SendMessageResponse>('/api/chat/start', {
    method: 'POST',
    body: JSON.stringify({ session_id: sessionId, text, message: text, model, workspace, attachments }),
  });
}

export function cancelStream(streamId: string): Promise<void> {
  return api<void>(`/api/chat/cancel?stream_id=${encodeURIComponent(streamId)}`);
}

/**
 * Open an SSE connection for a chat stream and yield typed events.
 */
export async function* streamChat(streamId: string): AsyncGenerator<SSEEvent> {
  const url = `/api/chat/stream?stream_id=${encodeURIComponent(streamId)}`;
  const MAX_RETRIES = 3;
  let retries = 0;

  while (retries < MAX_RETRIES) {
    const queue: SSEEvent[] = [];
    let done = false;
    let error: Error | null = null;

    const es = new EventSource(url);

    const push = (e: SSEEvent) => {
      queue.push(e);
    };

    es.addEventListener('token', (raw) => {
      push({ event: 'token', data: JSON.parse(raw.data) });
    });
    es.addEventListener('tool', (raw) => {
      push({ event: 'tool', data: JSON.parse(raw.data) });
    });
    es.addEventListener('approval', (raw) => {
      push({ event: 'approval', data: JSON.parse(raw.data) });
    });
    es.addEventListener('done', (raw) => {
      push({ event: 'done', data: JSON.parse(raw.data) });
      done = true;
      es.close();
    });
    es.addEventListener('compressed', (raw) => {
      push({ event: 'compressed', data: JSON.parse(raw.data) });
    });
    es.addEventListener('apperror', (raw) => {
      push({ event: 'apperror', data: JSON.parse(raw.data) });
      done = true;
      es.close();
    });
    es.addEventListener('cancel', (raw) => {
      push({ event: 'cancel', data: JSON.parse(raw.data) });
      done = true;
      es.close();
    });

    es.onerror = () => {
      if (es.readyState === EventSource.CLOSED) {
        done = true;
      }
      error = new Error('SSE connection error');
      es.close();
    };

    while (!done && queue.length === 0) {
      await new Promise((r) => setTimeout(r, 30));
    }

    while (queue.length > 0) {
      const evt = queue.shift()!;
      yield evt;
      if (evt.event === 'done' || evt.event === 'apperror' || evt.event === 'cancel') {
        return;
      }
    }

    if (error) {
      retries++;
      if (retries >= MAX_RETRIES) {
        throw error;
      }
      await new Promise((r) => setTimeout(r, 500 * retries));
      continue;
    }

    return;
  }
}

// ── Models ───────────────────────────────────────────────────────────

export async function fetchModels(): Promise<ModelsResponse> {
  return api<ModelsResponse>('/api/models');
}

// ── Workspaces ───────────────────────────────────────────────────────

export async function fetchWorkspaces(): Promise<WorkspacesResponse> {
  return api<WorkspacesResponse>('/api/workspaces');
}

// ── File browser ─────────────────────────────────────────────────────

export function fetchFiles(dir: string, sessionId?: string): Promise<FileEntry[]> {
  const params = new URLSearchParams({ dir });
  if (sessionId) params.set('session_id', sessionId);
  return api<FileEntry[]>(`/api/list?${params.toString()}`);
}

export function readFile(path: string, sessionId?: string): Promise<FileContentResponse> {
  const params = new URLSearchParams({ path });
  if (sessionId) params.set('session_id', sessionId);
  return api<FileContentResponse>(`/api/file?${params.toString()}`);
}

export function saveFile(path: string, content: string): Promise<void> {
  return api<void>('/api/file/save', {
    method: 'POST',
    body: JSON.stringify({ path, content }),
  });
}

export function deleteFile(path: string): Promise<void> {
  return api<void>('/api/file/delete', {
    method: 'POST',
    body: JSON.stringify({ path }),
  });
}

// ── Upload ───────────────────────────────────────────────────────────

export async function uploadFile(file: File, dir: string): Promise<void> {
  const form = new FormData();
  form.append('file', file);
  form.append('dir', dir);
  const res = await fetch('/api/upload', {
    method: 'POST',
    body: form,
  });
  if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
}

// ── Cron jobs ────────────────────────────────────────────────────────

export async function fetchCrons(): Promise<CronJob[]> {
  const resp = await api<{ jobs: CronJob[] }>('/api/crons');
  return resp.jobs;
}

export function createCron(job: Partial<CronJob>): Promise<void> {
  return api<void>('/api/crons/create', {
    method: 'POST',
    body: JSON.stringify(job),
  });
}

export function updateCron(job: Partial<CronJob>): Promise<void> {
  return api<void>('/api/crons/update', {
    method: 'POST',
    body: JSON.stringify(job),
  });
}

export function deleteCron(id: string): Promise<void> {
  return api<void>('/api/crons/delete', {
    method: 'POST',
    body: JSON.stringify({ id }),
  });
}

export function runCron(id: string): Promise<void> {
  return api<void>('/api/crons/run', {
    method: 'POST',
    body: JSON.stringify({ id }),
  });
}

export function pauseCron(id: string): Promise<void> {
  return api<void>('/api/crons/pause', {
    method: 'POST',
    body: JSON.stringify({ id }),
  });
}

export function resumeCron(id: string): Promise<void> {
  return api<void>('/api/crons/resume', {
    method: 'POST',
    body: JSON.stringify({ id }),
  });
}

// ── Skills ───────────────────────────────────────────────────────────

export async function fetchSkills(): Promise<Skill[]> {
  const resp = await api<{ skills: Skill[] }>('/api/skills');
  return resp.skills;
}

export function fetchSkillContent(
  name: string,
  file?: string,
): Promise<SkillContentResponse> {
  const params = new URLSearchParams({ name });
  if (file) params.set('file', file);
  return api<SkillContentResponse>(`/api/skills/content?${params.toString()}`);
}

// ── Memory ───────────────────────────────────────────────────────────

export function fetchMemory(): Promise<MemoryResponse> {
  return api<MemoryResponse>('/api/memory');
}

export function writeMemory(
  action: string,
  target: string,
  content: string,
  old_text?: string,
): Promise<void> {
  return api<void>('/api/memory/write', {
    method: 'POST',
    body: JSON.stringify({ action, target, content, old_text }),
  });
}

// ── Profiles ─────────────────────────────────────────────────────────

export function fetchProfiles(): Promise<ProfilesResponse> {
  return api<ProfilesResponse>('/api/profiles');
}

export async function fetchActiveProfile(): Promise<{ name: string; path: string }> {
  const resp = await api<ProfilesResponse>('/api/profiles');
  const active = resp.profiles.find((p) => p.is_active) || resp.profiles[0];
  return { name: active.name, path: active.path };
}

export function switchProfile(name: string): Promise<void> {
  return api<void>('/api/profile/switch', {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
}

// ── Projects ─────────────────────────────────────────────────────────

export async function fetchProjects(): Promise<string[]> {
  const resp = await api<{ projects: string[] }>('/api/projects');
  return resp.projects || [];
}

// ── Settings ─────────────────────────────────────────────────────────

export function fetchSettings(): Promise<Settings> {
  return api<Settings>('/api/settings');
}

export function saveSettings(settings: Settings): Promise<void> {
  return api<void>('/api/settings', {
    method: 'POST',
    body: JSON.stringify(settings),
  });
}

// ── Personality ──────────────────────────────────────────────────────

export function setPersonality(name: string): Promise<void> {
  return api<void>('/api/personality/set', {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
}

// ── Approval ─────────────────────────────────────────────────────────

export function respondApproval(
  sessionId: string,
  response: string,
  toolName: string,
): Promise<void> {
  return api<void>('/api/approval/respond', {
    method: 'POST',
    body: JSON.stringify({ session_id: sessionId, response, tool_name: toolName }),
  });
}

// ── Health ───────────────────────────────────────────────────────────

export function checkHealth(): Promise<HealthResponse> {
  return api<HealthResponse>('/health');
}
