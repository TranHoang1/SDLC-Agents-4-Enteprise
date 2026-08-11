/**
 * SA4E-85 — Knowledge SQLite persistence layer.
 * Internal storage behind KnowledgeService. Not a LangGraph checkpointer —
 * checkpoints are JSON projections stored here. DB perms hardened (Finding #22).
 */

import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { KNOWLEDGE_SCHEMA } from './schema.js';
import type { Thread, Message, Checkpoint, ToolExecution, Artifact, KnowledgeEvent, Agent, PendingWrite, SaveCheckpointInput, MessageInput } from './models.js';

type Row = Record<string, any>;

function parse<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try { return JSON.parse(raw) as T; } catch (err) { return fallback; }
}

function openDb(dbPath?: string): Database.Database {
  if (!dbPath) throw new Error('KnowledgeDb requires a dbPath');
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL'); db.pragma('foreign_keys = ON');
  try { fs.chmodSync(dbPath, 0o600); } catch (err) { console.debug('[KnowledgeDb] best-effort on Windows :', (err as Error).message); }
  return db;
}

export class KnowledgeDb {
  private db: Database.Database;

  constructor(dbPath?: string, existing?: Database.Database) {
    this.db = existing ?? openDb(dbPath);
    this.migrate();
  }

  static createInMemory(): KnowledgeDb {
    return new KnowledgeDb(undefined, new Database(':memory:'));
  }

  private migrate(): void { this.db.exec(KNOWLEDGE_SCHEMA); }

  close(): void { this.db.close(); }

  // --- threads (projection) ---
  createThread(t: Thread): void {
    this.db.prepare('INSERT INTO threads (thread_id, workspace_id, title, agent_id, status, created_at, updated_at) VALUES (@thread_id, @workspace_id, @title, @agent_id, @status, @created_at, @updated_at)')
      .run(t as unknown as Record<string, unknown>);
  }

  listThreads(workspaceId: string): Thread[] {
    return this.db.prepare('SELECT * FROM threads WHERE workspace_id = ? ORDER BY updated_at DESC').all(workspaceId) as unknown as Thread[];
  }

  getThread(threadId: string): Thread | null {
    const row = this.db.prepare('SELECT * FROM threads WHERE thread_id = ?').get(threadId) as Row | undefined;
    return row ? (row as unknown as Thread) : null;
  }

  deleteThread(threadId: string): void {
    this.db.transaction(() => {
      for (const table of ['threads', 'messages', 'checkpoints', 'tool_executions', 'artifacts', 'events']) {
        this.db.prepare(`DELETE FROM ${table} WHERE thread_id = ?`).run(threadId);
      }
    })();
  }

  // --- messages (projection) ---
  appendMessage(workspaceId: string, threadId: string, m: MessageInput, seq: number): void {
    const row = { id: m.id ?? crypto.randomUUID(), thread_id: threadId, workspace_id: workspaceId, role: m.role, content: m.content, agent_id: m.agent_id ?? null, timestamp: m.timestamp ?? new Date().toISOString(), seq };
    this.db.prepare('INSERT OR IGNORE INTO messages (id, thread_id, workspace_id, role, content, agent_id, timestamp, seq) VALUES (@id, @thread_id, @workspace_id, @role, @content, @agent_id, @timestamp, @seq)').run(row);
  }

  listMessages(threadId: string): Message[] {
    return this.db.prepare('SELECT * FROM messages WHERE thread_id = ? ORDER BY seq ASC').all(threadId) as unknown as Message[];
  }

  countMessages(threadId: string): number {
    const row = this.db.prepare('SELECT COUNT(*) as cnt FROM messages WHERE thread_id = ?').get(threadId) as Row;
    return row?.cnt ?? 0;
  }

  // --- checkpoints (projection) ---
  getCheckpoint(threadId: string): Checkpoint | null {
    const row = this.db.prepare('SELECT * FROM checkpoints WHERE thread_id = ?').get(threadId) as Row | undefined;
    if (!row) return null;
    return {
      thread_id: row.thread_id,
      workspace_id: row.workspace_id,
      checkpoint: parse(row.checkpoint, null),
      metadata: parse(row.metadata, {}),
      channel_versions: parse(row.channel_versions, {}),
      pending_writes: parse<PendingWrite[]>(row.pending_writes, []),
      version: row.version,
      updated_at: row.updated_at,
    };
  }

  upsertCheckpoint(workspaceId: string, threadId: string, input: SaveCheckpointInput): Checkpoint {
    const existing = this.getCheckpoint(threadId);
    const version = (existing?.version ?? 0) + 1;
    const writes = [...(existing?.pending_writes ?? []), ...(input.writes ?? input.pendingWrites ?? [])];
    const checkpoint = input.checkpoint ?? existing?.checkpoint ?? null;
    const metadata = input.metadata ?? existing?.metadata ?? {};
    const channelVersions = input.newVersions ?? existing?.channel_versions ?? {};
    const updatedAt = new Date().toISOString();
    this.db.prepare('INSERT INTO checkpoints (thread_id, workspace_id, checkpoint, metadata, channel_versions, pending_writes, version, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT (thread_id) DO UPDATE SET checkpoint = excluded.checkpoint, metadata = excluded.metadata, channel_versions = excluded.channel_versions, pending_writes = excluded.pending_writes, version = excluded.version, updated_at = excluded.updated_at')
      .run(threadId, workspaceId, JSON.stringify(checkpoint), JSON.stringify(metadata), JSON.stringify(channelVersions), JSON.stringify(writes), version, updatedAt);
    return { thread_id: threadId, workspace_id: workspaceId, checkpoint, metadata, channel_versions: channelVersions, pending_writes: writes, version, updated_at: updatedAt };
  }

  // --- tool executions (projection) ---
  addToolExecution(exec: ToolExecution): void {
    this.db.prepare('INSERT INTO tool_executions (id, thread_id, workspace_id, tool_id, name, status, input, output, created_at) VALUES (@id, @thread_id, @workspace_id, @tool_id, @name, @status, @input, @output, @created_at)')
      .run({ ...exec, input: JSON.stringify(exec.input ?? null), output: JSON.stringify(exec.output ?? null) });
  }

  // --- artifacts (projection) ---
  addArtifact(a: Artifact): void {
    this.db.prepare('INSERT INTO artifacts (id, thread_id, workspace_id, type, name, content, created_at) VALUES (@id, @thread_id, @workspace_id, @type, @name, @content, @created_at)')
      .run({ ...a, content: JSON.stringify(a.content ?? null) });
  }

  listArtifacts(threadId: string): Artifact[] {
    return (this.db.prepare('SELECT * FROM artifacts WHERE thread_id = ? ORDER BY created_at ASC').all(threadId) as unknown as Row[])
      .map((row) => ({ ...row, content: parse(row.content, null) })) as unknown as Artifact[];
  }

  // --- events (append-only log) ---
  appendEvent(workspaceId: string, threadId: string, type: string, payload: unknown): void {
    this.db.prepare('INSERT INTO events (thread_id, workspace_id, type, payload, created_at) VALUES (?, ?, ?, ?, ?)')
      .run(threadId, workspaceId, type, JSON.stringify(payload ?? {}), new Date().toISOString());
  }

  listEvents(threadId: string): KnowledgeEvent[] {
    return (this.db.prepare('SELECT * FROM events WHERE thread_id = ? ORDER BY id ASC').all(threadId) as unknown as Row[])
      .map((row) => ({ ...row, payload: parse(row.payload, null) })) as unknown as KnowledgeEvent[];
  }

  // --- agents (registry) ---
  upsertAgent(a: Agent): Agent {
    this.db.prepare('INSERT INTO agents (agent_id, name, description, tools, mcp_servers, auto_approve, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT (agent_id) DO UPDATE SET name = excluded.name, description = excluded.description, tools = excluded.tools, mcp_servers = excluded.mcp_servers, auto_approve = excluded.auto_approve, updated_at = excluded.updated_at')
      .run(a.agent_id, a.name, a.description, JSON.stringify(a.tools), JSON.stringify(a.mcp_servers), JSON.stringify(a.auto_approve), a.created_at, a.updated_at);
    return a;
  }

  listAgents(): Agent[] {
    return (this.db.prepare('SELECT * FROM agents ORDER BY name ASC').all() as unknown as Row[]).map((row) => ({
      agent_id: row.agent_id,
      name: row.name,
      description: row.description,
      tools: parse<string[]>(row.tools, []),
      mcp_servers: parse<string[]>(row.mcp_servers, []),
      auto_approve: parse<string[]>(row.auto_approve, []),
      created_at: row.created_at,
      updated_at: row.updated_at,
    })) as unknown as Agent[];
  }
}
