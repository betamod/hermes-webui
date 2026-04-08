// Hermes WebUI — TypeScript type definitions
// Matches the actual Python backend API responses.

// ── Core domain types ────────────────────────────────────────────────

export interface ToolCall {
  name: string;
  snippet: string;
  tid: string;
  assistant_msg_idx: number;
  args: Record<string, unknown>;
}

export interface Message {
  role: 'user' | 'assistant' | 'tool' | 'system';
  content: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  name?: string;
  attachments?: string[];
  timestamp?: string;
}

export interface Session {
  session_id: string;
  title: string;
  model: string;
  workspace: string;
  messages: Message[];
  created: string;
  updated: string;
  pinned: boolean;
  archived: boolean;
  project: string;
  input_tokens: number;
  output_tokens: number;
  estimated_cost: number;
  tool_calls: ToolCall[];
  personality: string;
}

export interface Workspace {
  name: string;
  path: string;
}

export interface Model {
  id: string;
  name: string;
  provider?: string;
  label?: string;
}

export interface ModelGroup {
  provider: string;
  models: Model[];
}

export interface CronJob {
  id: string;
  name: string;
  schedule: string;
  prompt: string;
  deliver: string;
  status: string;
  last_run?: string;
  repeat?: number;
  model?: string;
  provider?: string;
  skills?: string[];
  skill?: string;
  created_at?: string;
}

export interface Skill {
  name: string;
  description: string;
  category?: string | null;
}

export interface Memory {
  content: string;
  id?: string;
  target?: string;
}

export interface Profile {
  name: string;
  path: string;
  is_default?: boolean;
  is_active?: boolean;
  gateway_running?: boolean;
  model?: string | null;
  provider?: string | null;
  has_env?: boolean;
  skill_count?: number;
}

export interface Settings {
  theme?: string;
  default_model?: string;
  default_workspace?: string;
  send_key?: string;
  show_token_usage?: boolean;
  show_cli_sessions?: boolean;
  sync_to_insights?: boolean;
  auth_enabled?: boolean;
  auth_password?: string;
  personality?: string;
  bot_name?: string;
}

export interface UsageStats {
  input_tokens: number;
  output_tokens: number;
  estimated_cost?: number;
  context_length?: number;
  threshold_tokens?: number;
  last_prompt_tokens?: number;
}

// ── API response wrappers (matching backend shapes) ──────────────────

export interface SessionsResponse {
  sessions: Session[];
  cli_count: number;
}

export interface ModelsResponse {
  active_provider: string;
  default_model: string;
  groups: ModelGroup[];
}

export interface WorkspacesResponse {
  workspaces: Workspace[];
  last: string;
}

export interface MemoryResponse {
  memory: string; // raw text, not structured lines
}

export interface ProfilesResponse {
  profiles: Profile[];
  active: string;
}

export interface ActiveProfileResponse {
  name: string;
  path: string;
}

export interface FileContentResponse {
  content: string;
  path: string;
}

export interface SkillContentResponse {
  content: string;
  path: string;
}

export interface NewSessionResponse {
  session_id?: string;
  session?: { session_id: string; [key: string]: any };
}

export interface SendMessageResponse {
  stream_id: string;
}

export interface HealthResponse {
  status: string;
}

export interface FileEntry {
  name: string;
  path: string;
  type: 'file' | 'dir';
  size?: number;
  modified?: string;
}

// ── SSE event types (discriminated union) ────────────────────────────

export interface TokenEvent {
  event: 'token';
  data: { text: string };
}

export interface ToolEvent {
  event: 'tool';
  data: { name: string; preview: string; args: Record<string, string> };
}

export interface ApprovalEvent {
  event: 'approval';
  data: {
    session_id: string;
    tool_name: string;
    description: string;
    options: string[];
  };
}

export interface DoneEvent {
  event: 'done';
  data: { session: Session; usage: UsageStats };
}

export interface CompressedEvent {
  event: 'compressed';
  data: { message: string };
}

export interface AppErrorEvent {
  event: 'apperror';
  data: { message: string; type: string; hint?: string };
}

export interface CancelEvent {
  event: 'cancel';
  data: { message: string };
}

export type SSEEvent =
  | TokenEvent
  | ToolEvent
  | ApprovalEvent
  | DoneEvent
  | CompressedEvent
  | AppErrorEvent
  | CancelEvent;
