/**
 * SA4E-85 — KnowledgeService: async business logic + workspace binding.
 * Event Sourcing: every mutation appends to the append-only event log;
 * threads / messages / checkpoints are projections on top of it.
 *
 * Workspace isolation (SECURITY-REVIEW Finding #18): every thread access verifies
 * the caller's workspace_id matches the stored one. On mismatch all accessor
 * methods return null (routes map to 404 — never 403, preventing enumeration).
 */

import type { Logger } from 'pino';
import * as crypto from 'crypto';
import type { KnowledgeDb } from './KnowledgeDb.js';
import type { ProjectContext } from '../modules/memory/ProjectContext.js';
import type {
  Thread,
  Message,
  Checkpoint,
  KnowledgeEvent,
  Artifact,
  ToolExecution,
  Agent,
  CreateThreadInput,
  SaveCheckpointInput,
} from './models.js';
import { isUuidV4 } from './models.js';

export interface KnowledgeServiceOptions {
  defaultWorkspace?: string;
}

export class KnowledgeService {
  private readonly defaultWorkspace: string;

  constructor(
    private readonly db: KnowledgeDb,
    private readonly logger: Logger,
    options: KnowledgeServiceOptions = {},
  ) {
    this.defaultWorkspace = options.defaultWorkspace ?? 'default';
  }

  /** Caller workspace: X-Project-Id > JWT wid claim > default. */
  resolveWorkspaceId(ctx: ProjectContext): string {
    return ctx.projectId || ctx.workspaceId || this.defaultWorkspace;
  }

  /** Return the thread only if it belongs to the caller's workspace. */
  private async ownedThread(ctx: ProjectContext, threadId: string): Promise<Thread | null> {
    if (!isUuidV4(threadId)) return null;
    const thread = await this.db.getThread(threadId);
    if (!thread || thread.workspace_id !== this.resolveWorkspaceId(ctx)) return null;
    return thread;
  }

  async createThread(ctx: ProjectContext, input: CreateThreadInput): Promise<Thread> {
    const now = new Date().toISOString();
    const thread: Thread = {
      thread_id: crypto.randomUUID(),
      workspace_id: this.resolveWorkspaceId(ctx),
      title: input.title?.trim() || 'New thread',
      agent_id: input.agent_id || null,
      status: 'active',
      created_at: now,
      updated_at: now,
    };
    await this.db.createThread(thread);
    await this.db.appendEvent(thread.workspace_id, thread.thread_id, 'THREAD_CREATED', {
      title: thread.title,
      agent_id: thread.agent_id,
    });
    this.logger.info({ thread_id: thread.thread_id, workspace_id: thread.workspace_id }, 'Thread created');
    return thread;
  }

  async listThreads(ctx: ProjectContext): Promise<Thread[]> {
    return this.db.listThreads(this.resolveWorkspaceId(ctx));
  }

  async getThread(ctx: ProjectContext, threadId: string): Promise<Thread | null> {
    return this.ownedThread(ctx, threadId);
  }

  async getMessages(ctx: ProjectContext, threadId: string): Promise<Message[] | null> {
    if (!await this.ownedThread(ctx, threadId)) return null;
    return this.db.listMessages(threadId);
  }

  async getCheckpoint(ctx: ProjectContext, threadId: string): Promise<Checkpoint | null> {
    if (!await this.ownedThread(ctx, threadId)) return null;
    return this.db.getCheckpoint(threadId);
  }

  /** Save checkpoint (+ optional writes / messages) — projection updated. */
  async saveCheckpoint(ctx: ProjectContext, threadId: string, input: SaveCheckpointInput): Promise<Checkpoint | null> {
    const workspaceId = this.resolveWorkspaceId(ctx);
    let thread = await this.ownedThread(ctx, threadId);
    if (!thread) {
      // LangGraph generates arbitrary thread_id UUIDs per run and persists via the
      // checkpointer without a prior POST /threads — auto-create the thread if it
      // genuinely does not exist (mock contract, IT-HYD-03). A thread owned by
      // another workspace is NEVER created or written (SECURITY-REVIEW #18 → 404).
      const existing = await this.db.getThread(threadId);
      if (existing) return null;
      if (!isUuidV4(threadId)) return null;
      const now = new Date().toISOString();
      thread = {
        thread_id: threadId,
        workspace_id: workspaceId,
        title: 'Auto thread',
        agent_id: null,
        status: 'active',
        created_at: now,
        updated_at: now,
      };
      await this.db.createThread(thread);
      await this.db.appendEvent(workspaceId, threadId, 'THREAD_CREATED', { title: thread.title, agent_id: null });
    }
    const checkpoint = await this.db.upsertCheckpoint(thread.workspace_id, threadId, input);
    const messages = input.messages ?? [];
    const seqBase = await this.db.countMessages(threadId);
    for (let i = 0; i < messages.length; i++) {
      await this.db.appendMessage(thread.workspace_id, threadId, messages[i], seqBase + i);
    }
    await this.db.appendEvent(thread.workspace_id, threadId, 'CHECKPOINT_SAVED', {
      version: checkpoint.version,
      writes: (input.writes ?? input.pendingWrites ?? []).length,
      messages: messages.length,
    });
    this.logger.info({ thread_id: threadId, version: checkpoint.version }, 'Checkpoint saved');
    return checkpoint;
  }

  async getEvents(ctx: ProjectContext, threadId: string): Promise<KnowledgeEvent[] | null> {
    if (!await this.ownedThread(ctx, threadId)) return null;
    return this.db.listEvents(threadId);
  }

  async getArtifacts(ctx: ProjectContext, threadId: string): Promise<Artifact[] | null> {
    if (!await this.ownedThread(ctx, threadId)) return null;
    return this.db.listArtifacts(threadId);
  }

  async addArtifact(ctx: ProjectContext, threadId: string, input: { type: string; name: string; content?: unknown }): Promise<Artifact | null> {
    const thread = await this.ownedThread(ctx, threadId);
    if (!thread) return null;
    const artifact: Artifact = {
      id: crypto.randomUUID(),
      thread_id: threadId,
      workspace_id: thread.workspace_id,
      type: input.type,
      name: input.name,
      content: input.content ?? null,
      created_at: new Date().toISOString(),
    };
    await this.db.addArtifact(artifact);
    await this.db.appendEvent(thread.workspace_id, threadId, 'ARTIFACT_ADDED', { type: input.type, name: input.name });
    return artifact;
  }

  async addToolExecution(ctx: ProjectContext, threadId: string, input: { tool_id: string; name: string; status: ToolExecution['status']; input?: unknown; output?: unknown }): Promise<ToolExecution | null> {
    const thread = await this.ownedThread(ctx, threadId);
    if (!thread) return null;
    const exec: ToolExecution = {
      id: crypto.randomUUID(),
      thread_id: threadId,
      workspace_id: thread.workspace_id,
      tool_id: input.tool_id,
      name: input.name,
      status: input.status,
      input: input.input ?? null,
      output: input.output ?? null,
      created_at: new Date().toISOString(),
    };
    await this.db.addToolExecution(exec);
    await this.db.appendEvent(thread.workspace_id, threadId, 'TOOL_EXECUTION', { tool_id: input.tool_id, status: input.status });
    return exec;
  }

  async getAgents(): Promise<Agent[]> {
    return this.db.listAgents();
  }

  async upsertAgent(input: Omit<Agent, 'created_at' | 'updated_at'>): Promise<Agent> {
    const now = new Date().toISOString();
    const agent: Agent = { ...input, created_at: now, updated_at: now };
    return this.db.upsertAgent(agent);
  }

  async deleteThread(ctx: ProjectContext, threadId: string): Promise<boolean> {
    const thread = await this.ownedThread(ctx, threadId);
    if (!thread) return false;
    await this.db.appendEvent(thread.workspace_id, threadId, 'THREAD_DELETED', {});
    await this.db.deleteThread(threadId);
    this.logger.info({ thread_id: threadId }, 'Thread deleted');
    return true;
  }
}
