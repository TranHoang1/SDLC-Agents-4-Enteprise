/**
 * SA4E-85 — RemoteCheckpointer tests (IT-HYD-03).
 * Verifies HTTP persistence contract: write → restart → read over the real
 * HTTP path of a mock Backend Knowledge Service (embedded server).
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { RunnableConfig } from '@langchain/core/runnables';
import { RemoteCheckpointer } from '../remote-checkpointer';
import { startMockKbServer, type MockKbServer } from './helpers/mock-kb-server';

const CHAT_HISTORY = [
  { id: 'm-1', role: 'user', content: 'Implement COLLEX-64', timestamp: '2026-01-01T00:00:00.000Z' },
  { id: 'm-2', role: 'assistant', content: 'Plan created', timestamp: '2026-01-01T00:00:10.000Z' },
];

function makeCheckpoint(): { checkpoint: any; metadata: any; newVersions: any } {
  return {
    checkpoint: {
      v: 4,
      id: 'cp-001',
      ts: '2026-01-01T00:00:20.000Z',
      channel_values: {
        ticketKey: 'COLLEX-64',
        currentPhase: 'implementation',
        pipelineStatus: 'paused',
        chatHistory: CHAT_HISTORY,
      },
      channel_versions: { chatHistory: 2 },
      versions_seen: {},
    },
    metadata: { source: 'test', step: 1 },
    newVersions: { chatHistory: 2 },
  };
}

function configFor(threadId: string): RunnableConfig {
  return { configurable: { thread_id: threadId } };
}

describe('IT-HYD-03 — RemoteCheckpointer HTTP persistence (write → restart → read)', () => {
  let server: MockKbServer;

  beforeEach(async () => {
    server = await startMockKbServer();
  });

  afterEach(async () => {
    await server.close();
  });

  it('persists a checkpoint via PUT and reads it back intact after "restart"', async () => {
    const threadId = '11111111-1111-4111-8111-111111111111';
    const first = new RemoteCheckpointer(server.url, { timeoutMs: 2000, retries: 0 });

    // Write phase (graph processes 2 messages → checkpoint)
    const { checkpoint, metadata, newVersions } = makeCheckpoint();
    const config = await first.put(configFor(threadId), checkpoint, metadata, newVersions);
    expect(config).toEqual(configFor(threadId));

    // Verify a PUT /checkpoint request was actually sent over HTTP
    const putReq = server.requests.find(
      (r) => r.method === 'PUT' && r.url === `/api/v1/threads/${threadId}/checkpoint`
    );
    expect(putReq).toBeDefined();

    // Destroy orchestrator instance (simulate restart)
    // → new instance with the same RemoteCheckpointer config
    const second = new RemoteCheckpointer(server.url, { timeoutMs: 2000, retries: 0 });

    const tuple = await second.getTuple(configFor(threadId));
    expect(tuple).toBeDefined();
    expect(tuple!.checkpoint.channel_values.chatHistory).toHaveLength(2);
    expect((tuple!.checkpoint.channel_values as { ticketKey: string }).ticketKey).toBe('COLLEX-64');
    expect((tuple!.checkpoint.channel_values as { currentPhase: string }).currentPhase).toBe('implementation');
    expect(tuple!.metadata?.source).toBe('test');

    // Messages projection persisted for hydration
    const messages = await server.messagesByThread.get(threadId);
    expect(messages).toHaveLength(2);
    expect(messages![0].content).toBe('Implement COLLEX-64');
  });

  it('returns undefined for a thread with no saved checkpoint', async () => {
    const cp = new RemoteCheckpointer(server.url, { timeoutMs: 2000, retries: 0 });
    const tuple = await cp.getTuple(configFor('22222222-2222-4222-8222-222222222222'));
    expect(tuple).toBeUndefined();
  });

  it('putWrites stores pending writes that merge back into getTuple', async () => {
    const threadId = '33333333-3333-4333-8333-333333333333';
    const cp = new RemoteCheckpointer(server.url, { timeoutMs: 2000, retries: 0 });
    await cp.putWrites(configFor(threadId), [['ticketKey', 'COLLEX-64']], 'task-1');

    const putReq = server.requests.find((r) => r.method === 'PUT');
    expect(putReq).toBeDefined();
    expect((putReq!.body as { writes: unknown[] }).writes).toEqual([
      { task_id: 'task-1', channel: 'ticketKey', value: 'COLLEX-64' },
    ]);
  });

  it('list() yields tuples for persisted threads', async () => {
    const threadId = '44444444-4444-4444-8444-444444444444';
    const cp = new RemoteCheckpointer(server.url, { timeoutMs: 2000, retries: 0 });
    const { checkpoint, metadata, newVersions } = makeCheckpoint();
    await cp.put(configFor(threadId), checkpoint, metadata, newVersions);

    const collected = [];
    for await (const tuple of cp.list({})) {
      collected.push(tuple);
    }
    expect(collected.length).toBeGreaterThanOrEqual(1);
    expect(collected[0].checkpoint.channel_values.chatHistory).toHaveLength(2);
  });

  it('deleteThread removes the persisted checkpoint', async () => {
    const threadId = '55555555-5555-4555-8555-555555555555';
    const cp = new RemoteCheckpointer(server.url, { timeoutMs: 2000, retries: 0 });
    const { checkpoint, metadata, newVersions } = makeCheckpoint();
    await cp.put(configFor(threadId), checkpoint, metadata, newVersions);

    await cp.deleteThread(threadId);
    expect(server.checkpoints.has(threadId)).toBe(false);
    const tuple = await cp.getTuple(configFor(threadId));
    expect(tuple).toBeUndefined();
  });
});
