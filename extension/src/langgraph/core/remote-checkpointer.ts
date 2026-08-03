/**
 * SA4E-85 — RemoteCheckpointer [v3.1].
 * LangGraph `BaseCheckpointSaver` that persists checkpoint state to the
 * Backend Knowledge Service via HTTP — replaces the legacy `WorkspaceCheckpointer`
 * (JSON files in `.vscode/kiro-pipeline-state/`). Backend KB is the SSOT.
 *
 * Network resilience (TDD §5.4): configurable timeout + retry. On unreachable
 * backend a `KbUnreachableError` (recoverable) is thrown — the engine boundary
 * surfaces it as STREAM_ERROR(recoverable).
 *
 * Security: NO local JSON writes. Every request is workspace-bound via
 * X-Project-Id (SECURITY-REVIEW #18/#19).
 */
import {
  BaseCheckpointSaver,
  Checkpoint,
  CheckpointMetadata,
  CheckpointTuple,
  ChannelVersions,
  PendingWrite,
  CheckpointPendingWrite,
} from "@langchain/langgraph-checkpoint";
import type { RunnableConfig } from "@langchain/core/runnables";
import {
  KnowledgeClient,
  KbMessageInput,
  KbMessageRole,
  KbPendingWrite,
  KbSaveCheckpointInput,
  resolveKbBaseUrl,
} from "../../knowledge-client";
import { sanitizeMetadata } from "./checkpointer-helpers";
import { PersistedPipelineInfo } from "./state";

export interface RemoteCheckpointerOptions {
  timeoutMs?: number;
  retries?: number;
}

/**
 * Persists LangGraph checkpoints to Backend KB over HTTP.
 * Implements the same BaseCheckpointSaver contract as WorkspaceCheckpointer,
 * so LangGraph engine code is unchanged (BR-30, BR-31).
 */
export class RemoteCheckpointer extends BaseCheckpointSaver {
  private readonly client: KnowledgeClient;

  constructor(kbBaseUrl?: string, private readonly options: RemoteCheckpointerOptions = {}) {
    super();
    this.client = new KnowledgeClient(kbBaseUrl ?? resolveKbBaseUrl(), {
      timeoutMs: options.timeoutMs,
      retries: options.retries,
    });
  }

  /** HTTP: GET /api/v1/threads/:id/checkpoint */
  async getTuple(config: RunnableConfig): Promise<CheckpointTuple | undefined> {
    const threadId = getThreadId(config);
    if (!threadId) { return undefined; }
    const kb = await this.client.getCheckpoint(threadId);
    if (!kb?.checkpoint) { return undefined; }
    return {
      config,
      checkpoint: kb.checkpoint as unknown as Checkpoint,
      metadata: (kb.metadata ?? {}) as unknown as CheckpointMetadata,
      pendingWrites: convertPendingWrites(kb.pending_writes ?? []),
    };
  }

  /** HTTP: PUT /api/v1/threads/:id/checkpoint */
  async put(
    config: RunnableConfig,
    checkpoint: Checkpoint,
    metadata: CheckpointMetadata,
    newVersions: ChannelVersions
  ): Promise<RunnableConfig> {
    const threadId = getThreadId(config);
    if (!threadId) { throw new Error("thread_id required"); }
    const payload: KbSaveCheckpointInput = {
      checkpoint: checkpoint as unknown as Record<string, unknown>,
      metadata: sanitizeMetadata(metadata) as unknown as Record<string, unknown>,
      newVersions: newVersions as unknown as Record<string, unknown>,
      messages: extractMessages(checkpoint),
    };
    await this.client.saveCheckpoint(threadId, payload);
    return config;
  }

  /** HTTP: PUT /api/v1/threads/:id/checkpoint (pending writes only) */
  async putWrites(config: RunnableConfig, writes: PendingWrite[], taskId: string): Promise<void> {
    const threadId = getThreadId(config);
    if (!threadId) { return; }
    const pending: KbPendingWrite[] = writes.map(([channel, value]) => ({
      task_id: taskId,
      channel,
      value,
    }));
    await this.client.saveCheckpoint(threadId, { writes: pending });
  }

  /** HTTP: GET /api/v1/threads (+ per-thread checkpoint) */
  async *list(
    config: RunnableConfig,
    _options?: { limit?: number; before?: RunnableConfig; filter?: Record<string, unknown> }
  ): AsyncGenerator<CheckpointTuple> {
    const threads = await this.client.listThreads();
    for (const thread of threads) {
      try {
        const tuple = await this.getTuple({ configurable: { thread_id: thread.thread_id } });
        if (tuple) { yield tuple; }
      } catch (err) {
        console.debug(`[RemoteCheckpointer] list: skipping thread ${thread.thread_id}: ${(err as Error).message}`);
      }
    }
  }

  /** HTTP: DELETE /api/v1/threads/:id */
  async deleteThread(threadId: string): Promise<void> {
    await this.client.deleteThread(threadId);
  }

  /** Alias kept for engine compatibility. */
  async delete(config: RunnableConfig): Promise<void> {
    const threadId = getThreadId(config);
    if (threadId) { await this.deleteThread(threadId); }
  }

  /** List persisted pipelines via KB query (GET /api/v1/threads). */
  async listPersistedPipelines(): Promise<PersistedPipelineInfo[]> {
    const threads = await this.client.listThreads();
    const infos: PersistedPipelineInfo[] = [];
    for (const thread of threads) {
      try {
        const kb = await this.client.getCheckpoint(thread.thread_id);
        const values = (kb?.checkpoint as { channel_values?: Record<string, unknown> } | null)
          ?.channel_values ?? {};
        infos.push({
          threadId: thread.thread_id,
          ticketKey: (values.ticketKey as string) || thread.title || "unknown",
          phase: (values.currentPhase as PersistedPipelineInfo["phase"]) || "requirements",
          status: (values.pipelineStatus as PersistedPipelineInfo["status"]) || "idle",
          lastUpdatedAt: (values.lastUpdatedAt as string) || thread.updated_at,
        });
      } catch (err) {
        console.debug(`[RemoteCheckpointer] listPersistedPipelines skip thread ${thread.thread_id}: ${(err as Error).message}`);
      }
    }
    return infos.sort((a, b) => b.lastUpdatedAt.localeCompare(a.lastUpdatedAt));
  }

  /** Cleanup — retention is handled by the backend; local cleanup is a no-op. */
  async cleanup(): Promise<void> {
    // Backend Knowledge Service owns retention. Nothing to do locally (BR-30).
  }
}

/** Extract thread_id from a RunnableConfig. */
function getThreadId(config: RunnableConfig): string | undefined {
  return config.configurable?.thread_id as string | undefined;
}

/** Convert backend pending writes ({task_id, channel, value}) → LangGraph tuples. */
function convertPendingWrites(writes: KbPendingWrite[]): CheckpointPendingWrite[] {
  return writes.map((w) => [w.task_id, w.channel, w.value]);
}

/** Extract chat messages from a checkpoint for the backend message projection. */
function extractMessages(checkpoint: Checkpoint): KbMessageInput[] {
  const values = checkpoint.channel_values ?? {};
  const history = (values.chatHistory ?? values.messages) as
    | Array<{ id?: string; role?: string; content?: string; agentId?: string; nodeId?: string; timestamp?: string }>
    | undefined;
  if (!Array.isArray(history)) { return []; }
  return history
    .filter((m): m is { id?: string; role?: string; content: string; agentId?: string; nodeId?: string; timestamp?: string } =>
      !!m && typeof m.content === "string")
    .map((m) => ({
      id: m.id,
      role: toMessageRole(m.role),
      content: m.content,
      agent_id: m.agentId ?? m.nodeId ?? null,
      timestamp: m.timestamp,
    }));
}

/** Coerce a ChatMessage role into the KB message role set. */
function toMessageRole(role: string | undefined): KbMessageRole {
  if (role === "user" || role === "assistant" || role === "system" || role === "tool") {
    return role;
  }
  return "system";
}
