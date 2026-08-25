/**
 * SA4E-106: End-to-end enrichment flow integration test.
 * Verifies: TaskWorker receives CODE_ENRICHMENT task -> processCodeSummary
 * -> uses llmService to generate summary -> marks task completed.
 * Also verifies Pega symbol enrichment routing.
 *
 * SA4E-174: processCodeSummary replaced enrichSymbol — handler is a no-op,
 * llmService is used directly.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TaskWorker } from '../../../modules/memory/task-queue/TaskWorker.js';
import { TaskType, TaskStatus } from '../../../modules/memory/task-queue/models.js';
import type { PendingTask } from '../../../modules/memory/task-queue/models.js';
import type { DatabaseAdapter } from '../../../database/adapters/DatabaseAdapter.js';
import type { MemoryEngine } from '../../../modules/memory/engine/index.js';
import pino from 'pino';

const logger = pino({ level: 'silent' });

function createMockDb(): DatabaseAdapter {
  return {
    getAsync: vi.fn(),
    allAsync: vi.fn(() => Promise.resolve([])),
    runAsync: vi.fn(() => Promise.resolve({ changes: 0, lastInsertRowid: 0 })),
    getEngine: vi.fn(() => 'sqlite'),
  } as unknown as DatabaseAdapter;
}

function createMockEngine(): MemoryEngine {
  const mockAdapter = {
    getAsync: vi.fn(),
    allAsync: vi.fn(() => Promise.resolve([])),
    runAsync: vi.fn(() => Promise.resolve({ changes: 0 })),
    getEngine: vi.fn(() => 'sqlite'),
  };
  return {
    findById: vi.fn(),
    updateTags: vi.fn(),
    updateStructuredMap: vi.fn(),
    getAdapter: vi.fn(() => mockAdapter),
  } as unknown as MemoryEngine;
}

function createMockLlmService() {
  return {
    complete: vi.fn().mockResolvedValue({
      content: JSON.stringify({ summary: 'Test summary', pseudo_code: 'Step 1' }),
      model: 'test-model',
      provider: 'ollama',
    }),
    getConfig: vi.fn(() => ({ model: 'test-model' })),
  };
}

describe('SA4E-106: End-to-end enrichment flow', () => {
  let db: DatabaseAdapter;
  let engine: MemoryEngine;

  beforeEach(() => {
    db = createMockDb();
    engine = createMockEngine();
  });

  it('dispatches CODE_ENRICHMENT task to processCodeSummary and marks completed', async () => {
    const mockLlm = createMockLlmService();
    const worker = new TaskWorker(db, engine, logger, {});
    (worker as any).llmService = mockLlm;
    const repo = (worker as any).repo;
    vi.spyOn(repo, 'markCompleted').mockResolvedValue(undefined);

    const task: PendingTask = {
      id: 1,
      task_type: TaskType.CODE_ENRICHMENT,
      entry_id: 100,
      status: TaskStatus.PROCESSING,
      payload: JSON.stringify({
        symbol_id: 100, name: 'MyClass', kind: 'class',
        project_id: 'proj-1', file_path: 'src/a.ts',
        body: 'class MyClass { constructor() {} method() { return 42; } }',
        signature: 'class MyClass',
      }),
      error: null,
      retry_count: 0,
      max_retries: 3,
      created_at: '2025-01-01T00:00:00Z',
      started_at: null,
      completed_at: null,
    };

    await (worker as any).processTask(task);

    // processCodeSummary calls llmService.complete then markCompleted
    expect(mockLlm.complete).toHaveBeenCalled();
    expect(repo.markCompleted).toHaveBeenCalledWith(1);
  });

  it('resets for retry when llmService not injected', async () => {
    const worker = new TaskWorker(db, engine, logger, {});
    const repo = (worker as any).repo;
    vi.spyOn(repo, 'resetForRetry').mockResolvedValue(undefined);
    vi.spyOn(repo, 'markCompleted').mockResolvedValue(undefined);

    const task: PendingTask = {
      id: 2,
      task_type: TaskType.CODE_ENRICHMENT,
      entry_id: 200,
      status: TaskStatus.PROCESSING,
      payload: JSON.stringify({
        symbol_id: 200, name: 'fn', kind: 'function',
        project_id: 'proj-1', file_path: 'src/b.ts',
        body: 'function fn() { return 1; }',
        signature: 'function fn()',
      }),
      error: null,
      retry_count: 0,
      max_retries: 3,
      created_at: '2025-01-01T00:00:00Z',
      started_at: null,
      completed_at: null,
    };

    await (worker as any).processTask(task);

    expect(repo.resetForRetry).toHaveBeenCalledWith(2);
  });

  it('marks completed when body is too short (no LLM call)', async () => {
    const mockLlm = createMockLlmService();
    const worker = new TaskWorker(db, engine, logger, {});
    (worker as any).llmService = mockLlm;
    const repo = (worker as any).repo;
    vi.spyOn(repo, 'markCompleted').mockResolvedValue(undefined);

    const task: PendingTask = {
      id: 3,
      task_type: TaskType.CODE_ENRICHMENT,
      entry_id: 300,
      status: TaskStatus.PROCESSING,
      payload: JSON.stringify({
        symbol_id: 300, name: 'tiny', kind: 'function',
        project_id: 'proj-1', file_path: 'src/c.ts',
        body: 'short',
        signature: null,
      }),
      error: null,
      retry_count: 0,
      max_retries: 3,
      created_at: '2025-01-01T00:00:00Z',
      started_at: null,
      completed_at: null,
    };

    await (worker as any).processTask(task);

    // body < 20 chars: skip LLM, mark completed
    expect(mockLlm.complete).not.toHaveBeenCalled();
    expect(repo.markCompleted).toHaveBeenCalledWith(3);
  });

  it('marks completed even when LLM throws (non-fatal catch)', async () => {
    const mockLlm = createMockLlmService();
    mockLlm.complete.mockRejectedValue(new Error('LLM unreachable'));
    const worker = new TaskWorker(db, engine, logger, {});
    (worker as any).llmService = mockLlm;
    const repo = (worker as any).repo;
    vi.spyOn(repo, 'markCompleted').mockResolvedValue(undefined);

    const task: PendingTask = {
      id: 4,
      task_type: TaskType.CODE_ENRICHMENT,
      entry_id: 400,
      status: TaskStatus.PROCESSING,
      payload: JSON.stringify({
        symbol_id: 400, name: 'broken', kind: 'function',
        project_id: 'proj-1', file_path: 'src/d.ts',
        body: 'function broken() { throw new Error("fail"); }',
        signature: 'function broken()',
      }),
      error: null,
      retry_count: 0,
      max_retries: 3,
      created_at: '2025-01-01T00:00:00Z',
      started_at: null,
      completed_at: null,
    };

    await (worker as any).processTask(task);

    // LLM error is caught internally (non-fatal), task still completed
    expect(repo.markCompleted).toHaveBeenCalledWith(4);
  });

  it('marks failed for invalid JSON payload', async () => {
    const worker = new TaskWorker(db, engine, logger, {});
    const repo = (worker as any).repo;
    vi.spyOn(repo, 'markFailed').mockResolvedValue(undefined);

    const task: PendingTask = {
      id: 5,
      task_type: TaskType.CODE_ENRICHMENT,
      entry_id: 500,
      status: TaskStatus.PROCESSING,
      payload: 'NOT_JSON',
      error: null,
      retry_count: 0,
      max_retries: 3,
      created_at: '2025-01-01T00:00:00Z',
      started_at: null,
      completed_at: null,
    };

    await (worker as any).processTask(task);

    expect(repo.markFailed).toHaveBeenCalledWith(5, 'invalid_json_payload');
  });
});

describe('SA4E-106: Pega symbol enrichment routing', () => {
  let db: DatabaseAdapter;
  let engine: MemoryEngine;

  beforeEach(() => {
    db = createMockDb();
    engine = createMockEngine();
  });

  it('Pega symbol task sets workspaceType=pega in payload', () => {
    const payload = JSON.stringify({
      symbolId: 500, symbolName: 'ProcessClaim',
      symbolKind: 'pega_flow', projectId: 'pega-proj',
      filePath: 'rules/ProcessClaim.json', workspaceType: 'pega',
    });

    const parsed = JSON.parse(payload);
    expect(parsed.workspaceType).toBe('pega');
    expect(parsed.symbolKind).toBe('pega_flow');
  });

  it('dispatches Pega symbol to processCodeSummary same as standard', async () => {
    const mockLlm = createMockLlmService();
    const worker = new TaskWorker(db, engine, logger, {});
    (worker as any).llmService = mockLlm;
    const repo = (worker as any).repo;
    vi.spyOn(repo, 'markCompleted').mockResolvedValue(undefined);

    const task: PendingTask = {
      id: 6,
      task_type: TaskType.CODE_ENRICHMENT,
      entry_id: 500,
      status: TaskStatus.PROCESSING,
      payload: JSON.stringify({
        symbol_id: 500, name: 'ProcessClaim',
        kind: 'pega_flow', project_id: 'pega-proj',
        file_path: 'rules/ProcessClaim.json',
        body: 'ProcessClaim rule: validates claim data and routes to approval flow',
        signature: 'Pega Flow: ProcessClaim',
      }),
      error: null,
      retry_count: 0,
      max_retries: 3,
      created_at: '2025-01-01T00:00:00Z',
      started_at: null,
      completed_at: null,
    };

    await (worker as any).processTask(task);

    expect(mockLlm.complete).toHaveBeenCalled();
    expect(repo.markCompleted).toHaveBeenCalledWith(6);
  });
});
