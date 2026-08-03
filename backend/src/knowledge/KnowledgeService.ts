/**
 * SA4E-85 — KnowledgeService: business logic + workspace binding.
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
  private ownedThread(ctx: ProjectContext, threadId: string): Thread | null {
    if (!isUuidV4(threadId)) return null;
    const thread = this.db.getThread(threadId);
    if (!thread || thread.workspace_id !== this.resolveWorkspaceId(ctx)) return null;
    return thread;
  }

  createThread(ctx: ProjectContext, input: CreateThreadInput): Thread {
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
    this.db.createThread(thread);
    this.db.appendEvent(thread.workspace_id, thread.thread_id, 'THREAD_CREATED', {
      title: thread.title,
      agent_id: thread.agent_id,
    });
    this.logger.info({ thread_id: thread.thread_id, workspace_id: thread.workspace_id }, 'Thread created');
    return thread;
  }

  listThreads(ctx: ProjectContext): Thread[] {
    return this.db.listThreads(this.resolveWorkspaceId(ctx));
  }

  getThread(ctx: ProjectContext, threadId: string): Thread | null {
    return this.ownedThread(ctx, threadId);
  }

  getMessages(ctx: ProjectContext, threadId: string): Message[] | null {
    if (!this.ownedThread(ctx, threadId)) return null;
    return this.db.listMessages(threadId);
  }

  getCheckpoint(ctx: ProjectContext, threadId: string): Checkpoint | null {
    if (!this.ownedThread(ctx, threadId)) return null;
    return this.db.getCheckpoint(threadId);
  }

  /** Save checkpoint (+ optional writes / messages) — projection updated transactionally. */
  saveCheckpoint(ctx: ProjectContext, threadId: string, input: SaveCheckpointInput): Checkpoint | null {
    const thread = this.ownedThread(ctx, threadId);
    if (!thread) return null;
    const checkpoint = this.db.upsertCheckpoint(thread.workspace_id, threadId, input);
    const messages = input.messages ?? [];
    const seqBase = this.db.countMessages(threadId);
    messages.forEach((m, i) => {
      this.db.appendMessage(thread.workspace_id, threadId, m, seqBase + i);
    });
    this.db.appendEvent(thread.workspace_id, threadId, 'CHECKPOINT_SAVED', {
      version: checkpoint.version,
      writes: (input.writes ?? input.pendingWrites ?? []).length,
      messages: messages.length,
    });
    this.logger.info({ thread_id: threadId, version: checkpoint.version }, 'Checkpoint saved');
    return checkpoint;
  }

  getEvents(ctx: ProjectContext, threadId: string): KnowledgeEvent[] | null {
    if (!this.ownedThread(ctx, threadId)) return null;
    return this.db.listEvents(threadId);
  }

  getArtifacts(ctx: ProjectContext, threadId: string): Artifact[] | null {
    if (!this.ownedThread(ctx, threadId)) return null;
    return this.db.listArtifacts(threadId);
  }

  addArtifact(ctx: ProjectContext, threadId: string, input: { type: string; name: string; content?: unknown }): Artifact | null {
    const thread = this.ownedThread(ctx, threadId);
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
    this.db.addArtifact(artifact);
    this.db.appendEvent(thread.workspace_id, threadId, 'ARTIFACT_ADDED', { type: input.type, name: input.name });
    return artifact;
  }

  addToolExecution(ctx: ProjectContext, threadId: string, input: { tool_id: string; name: string; status: ToolExecution['status']; input?: unknown; output?: unknown }): ToolExecution | null {
    const thread = this.ownedThread(ctx, threadId);
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
    this.db.addToolExecution(exec);
    this.db.appendEvent(thread.workspace_id, threadId, 'TOOL_EXECUTION', { tool_id: input.tool_id, status: input.status });
    return exec;
  }

  getAgents(): Agent[] {
    return this.db.listAgents();
  }

  upsertAgent(input: Omit<Agent, 'created_at' | 'updated_at'>): Agent {
    const now = new Date().toISOString();
    const agent: Agent = { ...input, created_at: now, updated_at: now };
    return this.db.upsertAgent(agent);
  }

  deleteThread(ctx: ProjectContext, threadId: string): boolean {
    const thread = this.ownedThread(ctx, threadId);
    if (!thread) return false;
    this.db.appendEvent(thread.workspace_id, threadId, 'THREAD_DELETED', {});
    this.db.deleteThread(threadId);
    this.logger.info({ thread_id: threadId }, 'Thread deleted');
    return true;
  }
}
