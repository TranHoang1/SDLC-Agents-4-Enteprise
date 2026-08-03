/**
 * SA4E-85 — KnowledgeService unit tests.
 * Covers: thread creation (PBT-HYD-01 contract), workspace binding (#18),
 * checkpoint PUT→GET roundtrip (IT-HYD-03 backend logic), DELETE cascade.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import pino from 'pino';
import { KnowledgeDb } from '../KnowledgeDb.js';
import { KnowledgeService } from '../KnowledgeService.js';
import { createProjectContext } from '../../modules/memory/ProjectContext.js';
import { isUuidV4 } from '../models.js';

const logger = pino({ level: 'silent' });

function ctx(projectId: string, wid?: string) {
  return createProjectContext(projectId, 'user-1', undefined, wid);
}

describe('KnowledgeService', () => {
  let db: KnowledgeDb;
  let service: KnowledgeService;

  beforeEach(() => {
    db = KnowledgeDb.createInMemory();
    service = new KnowledgeService(db, logger);
  });

  describe('createThread', () => {
    it('returns a UUID v4 thread_id (PBT-HYD-01)', () => {
      const thread = service.createThread(ctx('ws-A'), { title: 'Hello' });
      expect(isUuidV4(thread.thread_id)).toBe(true);
      expect(thread.workspace_id).toBe('ws-A');
      expect(thread.status).toBe('active');
    });

    it('appends THREAD_CREATED event (event sourcing)', () => {
      const thread = service.createThread(ctx('ws-A'), { title: 'T' });
      const events = service.getEvents(ctx('ws-A'), thread.thread_id);
      expect(events).toHaveLength(1);
      expect(events?.[0].type).toBe('THREAD_CREATED');
    });

    it('defaults title when omitted', () => {
      const thread = service.createThread(ctx('ws-A'), {});
      expect(thread.title).toBe('New thread');
    });
  });

  describe('workspace binding — Finding #18', () => {
    it('getThread returns null for a thread owned by another workspace', () => {
      const thread = service.createThread(ctx('ws-A'), {});
      expect(service.getThread(ctx('ws-B'), thread.thread_id)).toBeNull();
      expect(service.getMessages(ctx('ws-B'), thread.thread_id)).toBeNull();
      expect(service.getCheckpoint(ctx('ws-B'), thread.thread_id)).toBeNull();
      expect(service.getEvents(ctx('ws-B'), thread.thread_id)).toBeNull();
      expect(service.getArtifacts(ctx('ws-B'), thread.thread_id)).toBeNull();
    });

    it('saveCheckpoint returns null for a thread owned by another workspace', () => {
      const thread = service.createThread(ctx('ws-A'), {});
      const saved = service.saveCheckpoint(ctx('ws-B'), thread.thread_id, { checkpoint: { v: 1 } });
      expect(saved).toBeNull();
    });

    it('listThreads only returns caller workspace threads', () => {
      service.createThread(ctx('ws-A'), { title: 'A1' });
      service.createThread(ctx('ws-B'), { title: 'B1' });
      service.createThread(ctx('ws-A'), { title: 'A2' });
      const threadsA = service.listThreads(ctx('ws-A'));
      const threadsB = service.listThreads(ctx('ws-B'));
      expect(threadsA).toHaveLength(2);
      expect(threadsB).toHaveLength(1);
    });

    it('uses JWT wid claim when no X-Project-Id header present', () => {
      // projectId = '' → falls back to workspaceId (wid claim)
      const thread = service.createThread(ctx('', 'wid-1'), {});
      expect(thread.workspace_id).toBe('wid-1');
      expect(service.getThread(ctx('', 'wid-2'), thread.thread_id)).toBeNull();
    });

    it('invalid thread_id is never treated as owned (404 path)', () => {
      expect(service.getThread(ctx('ws-A'), 'not-a-uuid')).toBeNull();
      expect(service.getMessages(ctx('ws-A'), 'not-a-uuid')).toBeNull();
      expect(service.deleteThread(ctx('ws-A'), 'not-a-uuid')).toBe(false);
    });
  });

  describe('checkpoint roundtrip — IT-HYD-03 (backend logic)', () => {
    it('PUT then GET returns identical checkpoint + metadata + writes', () => {
      const thread = service.createThread(ctx('ws-A'), {});
      const payload = {
        checkpoint: { v: 1, channel_values: { messages: [{ role: 'user', content: 'hello' }] } },
        metadata: { source: 'langgraph', configurable: { thread_id: thread.thread_id } },
        newVersions: { channel: '1' },
        pendingWrites: [{ task_id: 't1', channel: 'messages', value: { role: 'assistant', content: 'hi' } }],
      };
      const saved = service.saveCheckpoint(ctx('ws-A'), thread.thread_id, payload);
      const loaded = service.getCheckpoint(ctx('ws-A'), thread.thread_id);
      expect(loaded).not.toBeNull();
      expect(loaded?.checkpoint).toEqual(payload.checkpoint);
      expect(loaded?.metadata).toEqual(payload.metadata);
      expect(loaded?.channel_versions).toEqual(payload.newVersions);
      expect(loaded?.pending_writes).toEqual(payload.pendingWrites);
      expect(loaded?.version).toBe(1);
      expect(saved?.thread_id).toBe(thread.thread_id);
    });

    it('successive writes append pending_writes and bump version', () => {
      const thread = service.createThread(ctx('ws-A'), {});
      service.saveCheckpoint(ctx('ws-A'), thread.thread_id, { checkpoint: { v: 1 } });
      service.saveCheckpoint(ctx('ws-A'), thread.thread_id, { writes: [{ task_id: 'w1', channel: 'x', value: 1 }] });
      const loaded = service.getCheckpoint(ctx('ws-A'), thread.thread_id);
      expect(loaded?.version).toBe(2);
      expect(loaded?.checkpoint).toEqual({ v: 1 });
      expect(loaded?.pending_writes).toEqual([{ task_id: 'w1', channel: 'x', value: 1 }]);
    });

    it('messages passed with checkpoint are persisted for hydration', () => {
      const thread = service.createThread(ctx('ws-A'), {});
      service.saveCheckpoint(ctx('ws-A'), thread.thread_id, {
        messages: [
          { id: 'm1', role: 'user', content: 'Hello from IDE 1' },
          { id: 'm2', role: 'assistant', content: 'Hello from IDE 2' },
        ],
      });
      const messages = service.getMessages(ctx('ws-A'), thread.thread_id);
      expect(messages).toHaveLength(2);
      expect(messages?.[0].content).toBe('Hello from IDE 1');
      expect(messages?.[1].content).toBe('Hello from IDE 2');
      // idempotent — same message id is ignored
      service.saveCheckpoint(ctx('ws-A'), thread.thread_id, { messages: [{ id: 'm1', role: 'user', content: 'dup' }] });
      expect(service.getMessages(ctx('ws-A'), thread.thread_id)).toHaveLength(2);
    });
  });

  describe('deleteThread', () => {
    it('removes thread and all related projections', () => {
      const thread = service.createThread(ctx('ws-A'), { title: 'doomed' });
      service.saveCheckpoint(ctx('ws-A'), thread.thread_id, { checkpoint: { v: 1 } });
      service.addArtifact(ctx('ws-A'), thread.thread_id, { type: 'diagram', name: 'arch.png' });
      expect(service.deleteThread(ctx('ws-A'), thread.thread_id)).toBe(true);
      // Thread gone → all accessors return null (→404 at route layer)
      expect(service.getThread(ctx('ws-A'), thread.thread_id)).toBeNull();
      expect(service.getCheckpoint(ctx('ws-A'), thread.thread_id)).toBeNull();
      expect(service.getMessages(ctx('ws-A'), thread.thread_id)).toBeNull();
      expect(service.getEvents(ctx('ws-A'), thread.thread_id)).toBeNull();
      expect(service.getArtifacts(ctx('ws-A'), thread.thread_id)).toBeNull();
    });

    it('returns false for non-owned thread', () => {
      const thread = service.createThread(ctx('ws-A'), {});
      expect(service.deleteThread(ctx('ws-B'), thread.thread_id)).toBe(false);
      expect(service.getThread(ctx('ws-A'), thread.thread_id)).not.toBeNull();
    });
  });

  describe('agents registry', () => {
    it('upsertAgent registers agent and getAgents lists it', () => {
      service.upsertAgent({
        agent_id: 'dev-agent',
        name: 'Dev Agent',
        description: 'General dev agent',
        tools: ['bash'],
        mcp_servers: ['fs'],
        auto_approve: ['read'],
      });
      const agents = service.getAgents();
      expect(agents).toHaveLength(1);
      expect(agents[0].tools).toEqual(['bash']);
      expect(agents[0].auto_approve).toEqual(['read']);
    });
  });

  describe('tool executions + artifacts', () => {
    it('addToolExecution stores a row scoped to workspace', () => {
      const thread = service.createThread(ctx('ws-A'), {});
      const exec = service.addToolExecution(ctx('ws-A'), thread.thread_id, {
        tool_id: 'tid-1',
        name: 'read_file',
        status: 'success',
        input: { path: 'a.ts' },
        output: 'content',
      });
      expect(exec?.name).toBe('read_file');
      // cross-workspace call is rejected
      const denied = service.addToolExecution(ctx('ws-B'), thread.thread_id, {
        tool_id: 'tid-2',
        name: 'write_file',
        status: 'running',
      });
      expect(denied).toBeNull();
    });
  });
});
