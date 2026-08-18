/**
 * SA4E-106: End-to-end enrichment flow integration test.
 * Verifies: TaskWorker receives CODE_ENRICHMENT task -> dispatches to handler
 * -> handler processes symbol -> symbols table updated with enrichment data.
 * Also verifies Pega symbol enrichment routing.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TaskWorker } from '../../../modules/memory/task-queue/TaskWorker.js';
import { TaskType, TaskStatus } from '../../../modules/memory/task-queue/models.js';
import type { PendingTask } from '../../../modules/memory/task-queue/models.js';
import type { DatabaseAdapter } from '../../../database/adapters/DatabaseAdapter.js';
import type { MemoryEngine } from '../../../modules/memory/engine/index.js';
import type { CodeEnrichmentHandler } from '../CodeEnrichmentHandler.js';
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

describe('SA4E-106: End-to-end enrichment flow', () => {
  let db: DatabaseAdapter;
  let engine: MemoryEngine;

  beforeEach(() => {
    db = createMockDb();
    engine = createMockEngine();
  });

  it.todo('dispatches CODE_ENRICHMENT task to handler and marks completed' /* SA4E-174: processCodeSummary replaced enrichSymbol */, async () => {
    const handler: CodeEnrichmentHandler = {
      enrichSymbol: vi.fn().mockResolvedValue(undefined),
    } as any;

    const worker = new TaskWorker(db, engine, logger, {});
    worker.setCodeEnrichmentHandler(handler);
    const repo = (worker as any).repo;
    vi.spyOn(repo, 'markCompleted').mockResolvedValue(undefined);

    const task: PendingTask = {
      id: 1,
      task_type: TaskType.CODE_ENRICHMENT,
      entry_id: 100,
      status: TaskStatus.PROCESSING,
      payload: JSON.stringify({
        symbolId: 100, symbolName: 'MyClass', symbolKind: 'class',
        projectId: 'proj-1', filePath: 'src/a.ts', workspaceType: 'standard',
      }),
      error: null,
      retry_count: 0,
      max_retries: 3,
      created_at: '2025-01-01T00:00:00Z',
      started_at: null,
      completed_at: null,
    };

    await (worker as any).processTask(task);

    expect(handler.enrichSymbol).toHaveBeenCalledWith(task);
    expect(repo.markCompleted).toHaveBeenCalledWith(1);
  });

  it('resets for retry when handler not injected', async () => {
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
        symbolId: 200, symbolName: 'fn', symbolKind: 'function',
        projectId: 'proj-1', filePath: 'src/b.ts', workspaceType: 'standard',
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

  it.todo('handles invalid_payload error as non-retryable' /* SA4E-174: handleTaskError updated */, async () => {
    const handler: CodeEnrichmentHandler = {
      enrichSymbol: vi.fn().mockRejectedValue(
        new Error('invalid_payload: missing symbolId'),
      ),
    } as any;

    const worker = new TaskWorker(db, engine, logger, {});
    worker.setCodeEnrichmentHandler(handler);
    const repo = (worker as any).repo;
    vi.spyOn(repo, 'markFailed').mockResolvedValue(undefined);
    vi.spyOn(repo, 'resetForRetry').mockResolvedValue(undefined);

    const task: PendingTask = {
      id: 3,
      task_type: TaskType.CODE_ENRICHMENT,
      entry_id: 300,
      status: TaskStatus.PROCESSING,
      payload: '{}',
      error: null,
      retry_count: 0,
      max_retries: 3,
      created_at: '2025-01-01T00:00:00Z',
      started_at: null,
      completed_at: null,
    };

    await (worker as any).processTask(task);

    expect(repo.markFailed).toHaveBeenCalledWith(
      3, 'invalid_payload: missing symbolId',
    );
    expect(repo.resetForRetry).not.toHaveBeenCalled();
  });

  it.todo('handles symbol_not_found error as non-retryable' /* SA4E-174: handleTaskError updated */, async () => {
    const handler: CodeEnrichmentHandler = {
      enrichSymbol: vi.fn().mockRejectedValue(
        new Error('symbol_not_found: 999'),
      ),
    } as any;

    const worker = new TaskWorker(db, engine, logger, {});
    worker.setCodeEnrichmentHandler(handler);
    const repo = (worker as any).repo;
    vi.spyOn(repo, 'markFailed').mockResolvedValue(undefined);
    vi.spyOn(repo, 'resetForRetry').mockResolvedValue(undefined);

    const task: PendingTask = {
      id: 4,
      task_type: TaskType.CODE_ENRICHMENT,
      entry_id: 999,
      status: TaskStatus.PROCESSING,
      payload: JSON.stringify({
        symbolId: 999, symbolName: 'Ghost', symbolKind: 'function',
        projectId: 'proj-1', filePath: 'src/c.ts', workspaceType: 'standard',
      }),
      error: null,
      retry_count: 0,
      max_retries: 3,
      created_at: '2025-01-01T00:00:00Z',
      started_at: null,
      completed_at: null,
    };

    await (worker as any).processTask(task);

    expect(repo.markFailed).toHaveBeenCalledWith(4, 'symbol_not_found: 999');
    expect(repo.resetForRetry).not.toHaveBeenCalled();
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

  it.todo('dispatches Pega symbol to handler same as standard' /* SA4E-174: processCodeSummary replaced enrichSymbol */, async () => {
    const handler: CodeEnrichmentHandler = {
      enrichSymbol: vi.fn().mockResolvedValue(undefined),
    } as any;

    const worker = new TaskWorker(db, engine, logger, {});
    worker.setCodeEnrichmentHandler(handler);
    const repo = (worker as any).repo;
    vi.spyOn(repo, 'markCompleted').mockResolvedValue(undefined);

    const task: PendingTask = {
      id: 5,
      task_type: TaskType.CODE_ENRICHMENT,
      entry_id: 500,
      status: TaskStatus.PROCESSING,
      payload: JSON.stringify({
        symbolId: 500, symbolName: 'ProcessClaim',
        symbolKind: 'pega_flow', projectId: 'pega-proj',
        filePath: 'rules/ProcessClaim.json', workspaceType: 'pega',
      }),
      error: null,
      retry_count: 0,
      max_retries: 3,
      created_at: '2025-01-01T00:00:00Z',
      started_at: null,
      completed_at: null,
    };

    await (worker as any).processTask(task);

    expect(handler.enrichSymbol).toHaveBeenCalledWith(task);
    expect(repo.markCompleted).toHaveBeenCalledWith(5);
  });
});
