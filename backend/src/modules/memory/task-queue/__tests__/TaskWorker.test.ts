/**
 * UT-12: loadPreviousContext — SQL query behavior
 * Unit tests for TaskWorker.loadPreviousContext with mocked engine.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TaskWorker } from '../TaskWorker.js';
import type { DatabaseAdapter } from '../../../../database/adapters/DatabaseAdapter.js';
import type { MemoryEngine } from '../../engine/index.js';
import pino from 'pino';

function createMockDb(): DatabaseAdapter {
  return {
    run: vi.fn(),
    get: vi.fn(),
    all: vi.fn(),
    transaction: vi.fn((fn: any) => fn()),
    getEngine: vi.fn(() => 'sqlite'),
    getAsync: vi.fn(),
    allAsync: vi.fn(() => Promise.resolve([])),
    runAsync: vi.fn(() => Promise.resolve({ changes: 0, lastInsertRowid: 0 })),
  } as unknown as DatabaseAdapter;
}

function createMockEngine(entries: Map<number, any>): MemoryEngine {
  const mockAdapter = {
    getAsync: vi.fn(),
    allAsync: vi.fn(() => Promise.resolve([])),
    runAsync: vi.fn(() => Promise.resolve({ changes: 0, lastInsertRowid: 0 })),
    getEngine: vi.fn(() => 'sqlite'),
  };
  const engine = {
    findById: vi.fn((id: number) => entries.get(id)),
    updateTags: vi.fn(),
    updateStructuredMap: vi.fn(),
    getAdapter: vi.fn(() => mockAdapter),
    getDb: vi.fn(() => ({
      prepare: vi.fn(() => ({
        get: vi.fn(),
        run: vi.fn(),
      })),
    })),
  } as unknown as MemoryEngine;
  return engine;
}

const logger = pino({ level: 'silent' });
const testConfig = {
  enableContextChain: true,
  contextChainMaxLength: 500,
  structuredMapMaxSize: 102400,
};

describe('UT-12: loadPreviousContext', () => {
  let engine: MemoryEngine;
  let entries: Map<number, any>;
  let db: DatabaseAdapter;

  beforeEach(() => {
    entries = new Map();
    engine = createMockEngine(entries);
    db = createMockDb();
  });

  function createWorker(): TaskWorker {
    const worker = new TaskWorker(db, engine, logger, testConfig);
    return worker;
  }

  it('returns context when previous entry has structured_map with summary', async () => {
    entries.set(1, {
      id: 1,
      structured_map: JSON.stringify({
        summary: 'Auth flow description',
        business_entities: ['User'],
        actors: ['Admin'],
      }),
    });
    // Mock getAdapter().getAsync() to return entry 1
    const adapter = (engine as any).getAdapter();
    adapter.getAsync.mockResolvedValue({ id: 1, structured_map: entries.get(1).structured_map });

    const worker = createWorker();
    const result = await (worker as any).loadPreviousContext(2, '/doc.md');

    expect(result).not.toBeNull();
    expect(result.previous_section_id).toBe(1);
    expect(result.summary).toBe('Auth flow description');
    expect(result.business_entities).toEqual(['User']);
    expect(result.actors).toEqual(['Admin']);
  });

  it('returns null for first section (no previous entry)', async () => {
    const mockGet = vi.fn().mockReturnValue(null);
    const mockPrepare = vi.fn().mockReturnValue({ get: mockGet });
    (engine as any).getDb.mockReturnValue({ prepare: mockPrepare });

    const worker = createWorker();
    const result = await (worker as any).loadPreviousContext(1, '/doc.md');
    expect(result).toBeNull();
  });

  it('returns null when source is null (single ingest)', async () => {
    const worker = createWorker();
    const result = await (worker as any).loadPreviousContext(1, null);
    expect(result).toBeNull();
  });

  it('returns null when previous entry has empty structured_map', async () => {
    entries.set(1, { id: 1, structured_map: '{}' });
    const mockGet = vi.fn().mockReturnValue({ id: 1, structured_map: '{}' });
    const mockPrepare = vi.fn().mockReturnValue({ get: mockGet });
    (engine as any).getDb.mockReturnValue({ prepare: mockPrepare });

    const worker = createWorker();
    const result = await (worker as any).loadPreviousContext(2, '/doc.md');
    expect(result).toBeNull();
  });

  it('returns null when previous entry has no summary', async () => {
    entries.set(1, {
      id: 1,
      structured_map: JSON.stringify({ tags: ['error-pattern'], extraction_meta: { fallback_used: true } }),
    });
    const mockGet = vi.fn().mockReturnValue({ id: 1, structured_map: entries.get(1).structured_map });
    const mockPrepare = vi.fn().mockReturnValue({ get: mockGet });
    (engine as any).getDb.mockReturnValue({ prepare: mockPrepare });

    const worker = createWorker();
    const result = await (worker as any).loadPreviousContext(2, '/doc.md');
    expect(result).toBeNull();
  });

  it('returns null on DB error', async () => {
    const mockPrepare = vi.fn(() => { throw new Error('DB error'); });
    (engine as any).getDb.mockReturnValue({ prepare: mockPrepare });

    const worker = createWorker();
    const result = await (worker as any).loadPreviousContext(2, '/doc.md');
    expect(result).toBeNull();
  });
});


/**
 * SA4E-106: handleTaskError — non-retryable error patterns.
 * Verifies invalid_payload and symbol_not_found are marked failed immediately.
 */
describe('SA4E-106: handleTaskError non-retryable patterns', () => {
  let db: DatabaseAdapter;
  let engine: MemoryEngine;

  beforeEach(() => {
    db = createMockDb();
    engine = createMockEngine(new Map());
  });

  function createWorkerWithSpies() {
    const worker = new TaskWorker(db, engine, logger, testConfig);
    const repo = (worker as any).repo;
    // Spy on repo methods to track calls without executing real SQL
    vi.spyOn(repo, 'markFailed').mockResolvedValue(undefined);
    vi.spyOn(repo, 'resetForRetry').mockResolvedValue(undefined);
    return { worker, repo };
  }

  function createFakeTask(retryCount = 0, maxRetries = 3): any {
    return { id: 42, retry_count: retryCount, max_retries: maxRetries };
  }

  it('marks task failed immediately for invalid_payload error', async () => {
    const { worker, repo } = createWorkerWithSpies();
    const task = createFakeTask();
    const error = new Error('invalid_payload: symbolId is required');

    await (worker as any).handleTaskError(task, error);

    expect(repo.markFailed).toHaveBeenCalledWith(42, error.message);
    expect(repo.resetForRetry).not.toHaveBeenCalled();
  });

  it('marks task failed immediately for symbol_not_found error', async () => {
    const { worker, repo } = createWorkerWithSpies();
    const task = createFakeTask();
    const error = new Error('symbol_not_found: 999');

    await (worker as any).handleTaskError(task, error);

    expect(repo.markFailed).toHaveBeenCalledWith(42, error.message);
    expect(repo.resetForRetry).not.toHaveBeenCalled();
  });

  it('marks task failed immediately for invalid_json error', async () => {
    const { worker, repo } = createWorkerWithSpies();
    const task = createFakeTask();
    const error = new Error('invalid_json: unexpected token');

    await (worker as any).handleTaskError(task, error);

    expect(repo.markFailed).toHaveBeenCalledWith(42, error.message);
    expect(repo.resetForRetry).not.toHaveBeenCalled();
  });

  it('marks task failed immediately for entry_not_found error', async () => {
    const { worker, repo } = createWorkerWithSpies();
    const task = createFakeTask();
    const error = new Error('entry_not_found');

    await (worker as any).handleTaskError(task, error);

    expect(repo.markFailed).toHaveBeenCalledWith(42, error.message);
    expect(repo.resetForRetry).not.toHaveBeenCalled();
  });

  it('resets for retry on transient error with retries remaining', async () => {
    const { worker, repo } = createWorkerWithSpies();
    const task = createFakeTask(0, 3);
    const error = new Error('llm_timeout');

    await (worker as any).handleTaskError(task, error);

    expect(repo.markFailed).toHaveBeenCalledWith(42, error.message);
    expect(repo.resetForRetry).toHaveBeenCalledWith(42);
  });

  it('marks failed when max retries exhausted for transient error', async () => {
    const { worker, repo } = createWorkerWithSpies();
    const task = createFakeTask(2, 3); // retry_count + 1 >= max_retries
    const error = new Error('llm_timeout');

    await (worker as any).handleTaskError(task, error);

    expect(repo.markFailed).toHaveBeenCalledWith(42, error.message);
    expect(repo.resetForRetry).not.toHaveBeenCalled();
  });

  it('does NOT increment consecutiveErrors for non-retryable data errors', async () => {
    const { worker, repo } = createWorkerWithSpies();
    const task = createFakeTask();

    // symbol_not_found should not count as LLM error
    await (worker as any).handleTaskError(task, new Error('symbol_not_found: 999'));
    expect((worker as any).consecutiveErrors).toBe(0);

    // entry_not_found should not count as LLM error
    await (worker as any).handleTaskError(task, new Error('entry_not_found'));
    expect((worker as any).consecutiveErrors).toBe(0);

    // invalid_payload should not count as LLM error
    await (worker as any).handleTaskError(task, new Error('invalid_payload: bad'));
    expect((worker as any).consecutiveErrors).toBe(0);
  });

  it('DOES increment consecutiveErrors for real LLM/transient errors', async () => {
    const { worker, repo } = createWorkerWithSpies();
    const task = createFakeTask(0, 3);

    await (worker as any).handleTaskError(task, new Error('llm_timeout'));
    expect((worker as any).consecutiveErrors).toBe(1);
  });
});
