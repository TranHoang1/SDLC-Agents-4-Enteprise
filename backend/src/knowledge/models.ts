/**
 * SA4E-85 — Knowledge entity models.
 * Single source of truth (SSOT) for Threads, Messages, Checkpoints,
 * Tool Executions, Artifacts, Event History, and the Agent Registry.
 * Models are plain data contracts — no behavior, no framework coupling.
 */

/** Message roles supported by the chat protocol. */
export type MessageRole = 'user' | 'assistant' | 'system' | 'tool';

/** Thread lifecycle status. */
export type ThreadStatus = 'active' | 'completed' | 'archived';

export interface Thread {
  thread_id: string;
  workspace_id: string;
  title: string;
  agent_id: string | null;
  status: ThreadStatus;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  thread_id: string;
  workspace_id: string;
  role: MessageRole;
  content: string;
  agent_id: string | null;
  timestamp: string;
  seq: number;
}

/** LangGraph pending write — merged into checkpoint on getTuple. */
export interface PendingWrite {
  task_id: string;
  channel: string;
  value: unknown;
}

/** Checkpoint projection persisted by KnowledgeService (not a checkpointer). */
export interface Checkpoint {
  thread_id: string;
  workspace_id: string;
  checkpoint: Record<string, unknown> | null;
  metadata: Record<string, unknown>;
  channel_versions: Record<string, unknown>;
  pending_writes: PendingWrite[];
  version: number;
  updated_at: string;
}

export interface ToolExecution {
  id: string;
  thread_id: string;
  workspace_id: string;
  tool_id: string;
  name: string;
  status: 'running' | 'success' | 'error' | 'cancelled';
  input: unknown;
  output: unknown;
  created_at: string;
}

export interface Artifact {
  id: string;
  thread_id: string;
  workspace_id: string;
  type: string;
  name: string;
  content: unknown;
  created_at: string;
}

/** Append-only event log row (Event Sourcing). */
export interface KnowledgeEvent {
  id: number;
  thread_id: string;
  workspace_id: string;
  type: string;
  payload: unknown;
  created_at: string;
}

export interface Agent {
  agent_id: string;
  name: string;
  description: string;
  tools: string[];
  mcp_servers: string[];
  auto_approve: string[];
  created_at: string;
  updated_at: string;
}

/** POST /api/v1/threads request payload. */
export interface CreateThreadInput {
  title?: string;
  agent_id?: string | null;
}

/** PUT /api/v1/threads/:id/checkpoint payload.
 *  Accepts LangGraph checkpoint fields; `writes`/`pendingWrites` follow
 *  putWrites semantics; `messages` feeds the message-history projection. */
export interface SaveCheckpointInput {
  checkpoint?: Record<string, unknown> | null;
  metadata?: Record<string, unknown>;
  newVersions?: Record<string, unknown>;
  pendingWrites?: PendingWrite[];
  writes?: PendingWrite[];
  messages?: MessageInput[];
}

export interface MessageInput {
  id?: string;
  role: MessageRole;
  content: string;
  agent_id?: string | null;
  timestamp?: string;
}

/** UUID v4 contract for thread_id (PBT-HYD-01, STC). */
export const UUID_V4_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuidV4(value: string): boolean {
  return UUID_V4_REGEX.test(value);
}
