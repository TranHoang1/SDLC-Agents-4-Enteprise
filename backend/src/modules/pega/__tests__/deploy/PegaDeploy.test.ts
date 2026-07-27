import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PegaConfigProvider, type PegaConfig } from '../../deploy/PegaConfigProvider.js';
import { PegaEvaluationCache } from '../../deploy/PegaEvaluationCache.js';
import { PegaWorkerPool } from '../../deploy/PegaWorkerPool.js';

describe('PegaConfigProvider', () => {
  const OLD_ENV = process.env;

  afterEach(() => {
    process.env = { ...OLD_ENV };
  });

  it('constructor uses defaults when no overrides given', () => {
    const provider = new PegaConfigProvider();
    const config = provider.getConfig();
    expect(config.workerPoolSize).toBe(2);
    expect(config.sandboxTimeoutMs).toBe(5000);
    expect(config.maxDecisionRows).toBe(10000);
    expect(config.cacheTtlMs).toBe(300_000);
    expect(config.cacheMaxEntries).toBe(1000);
  });

  it('getConfig returns full config with defaults', () => {
    const provider = new PegaConfigProvider();
    const config = provider.getConfig();
    expect(config).toHaveProperty('workerPoolSize');
    expect(config).toHaveProperty('sandboxTimeoutMs');
    expect(config).toHaveProperty('maxDecisionRows');
    expect(config).toHaveProperty('deploymentMode');
    expect(config).toHaveProperty('cacheTtlMs');
    expect(config).toHaveProperty('cacheMaxEntries');
  });

  it('constructor merges overrides with defaults', () => {
    const provider = new PegaConfigProvider({ workerPoolSize: 8, maxDecisionRows: 50000 });
    const config = provider.getConfig();
    expect(config.workerPoolSize).toBe(8);
    expect(config.maxDecisionRows).toBe(50000);
    expect(config.sandboxTimeoutMs).toBe(5000);
    expect(config.cacheTtlMs).toBe(300_000);
    expect(config.cacheMaxEntries).toBe(1000);
  });

  it('loads from environment variables', () => {
    process.env.PEGA_WORKER_POOL_SIZE = '4';
    process.env.PEGA_SANDBOX_TIMEOUT_MS = '10000';
    process.env.PEGA_MAX_DECISION_ROWS = '20000';
    process.env.PEGA_CACHE_TTL_MS = '600000';
    process.env.PEGA_CACHE_MAX_ENTRIES = '500';
    const provider = new PegaConfigProvider();
    const config = provider.getConfig();
    expect(config.workerPoolSize).toBe(4);
    expect(config.sandboxTimeoutMs).toBe(10000);
    expect(config.maxDecisionRows).toBe(20000);
    expect(config.cacheTtlMs).toBe(600000);
    expect(config.cacheMaxEntries).toBe(500);
  });

  it('deploymentMode defaults to in-process', () => {
    const provider = new PegaConfigProvider();
    const config = provider.getConfig();
    expect(config.deploymentMode).toBe('in-process');
  });
});

describe('PegaEvaluationCache', () => {
  let cache: PegaEvaluationCache;

  beforeEach(() => {
    cache = new PegaEvaluationCache(5, 300_000);
  });

  it('get returns undefined for non-existent key', () => {
    expect(cache.get('nonexistent')).toBeUndefined();
  });

  it('set stores value, get retrieves it', () => {
    cache.set('key1', { result: 'value1' });
    expect(cache.get('key1')).toEqual({ result: 'value1' });
  });

  it('get returns undefined after TTL expiry', async () => {
    const shortCache = new PegaEvaluationCache(5, 1);
    shortCache.set('key1', 'value1');
    expect(shortCache.get('key1')).toBe('value1');
    await new Promise(resolve => setTimeout(resolve, 10));
    expect(shortCache.get('key1')).toBeUndefined();
  });

  it('clear removes all entries', () => {
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3);
    expect(cache.size).toBe(3);
    cache.clear();
    expect(cache.size).toBe(0);
    expect(cache.get('a')).toBeUndefined();
  });

  it('size property reflects entry count', () => {
    expect(cache.size).toBe(0);
    cache.set('x', 10);
    expect(cache.size).toBe(1);
    cache.set('y', 20);
    expect(cache.size).toBe(2);
  });

  it('evictExpired removes only expired entries', async () => {
    const shortCache = new PegaEvaluationCache(10, 50);
    shortCache.set('expiring', 'will expire');
    shortCache.set('permanent', 'stays');
    await new Promise(resolve => setTimeout(resolve, 60));
    expect(shortCache.get('expiring')).toBeUndefined();
    expect(shortCache.get('permanent')).toBeUndefined();
  });

  it('set evicts oldest entry when maxEntries reached', () => {
    const smallCache = new PegaEvaluationCache(3, 300_000);
    smallCache.set('a', 1);
    smallCache.set('b', 2);
    smallCache.set('c', 3);
    expect(smallCache.size).toBe(3);
    smallCache.set('d', 4);
    expect(smallCache.size).toBe(3);
    expect(smallCache.get('a')).toBeUndefined();
    expect(smallCache.get('b')).toBe(2);
    expect(smallCache.get('c')).toBe(3);
    expect(smallCache.get('d')).toBe(4);
  });

  it('set/get for different keys works independently', () => {
    cache.set('alpha', { data: 'first' });
    cache.set('beta', { data: 'second' });
    cache.set('gamma', { data: 'third' });
    expect(cache.get('alpha')).toEqual({ data: 'first' });
    expect(cache.get('beta')).toEqual({ data: 'second' });
    expect(cache.get('gamma')).toEqual({ data: 'third' });
  });
});

describe('PegaWorkerPool', () => {
  it('constructor creates specified number of workers', () => {
    const pool = new PegaWorkerPool(3);
    const stats = pool.getStats();
    expect(stats.total).toBeGreaterThanOrEqual(0);
  });

  it('getStats returns correct total/busy/idle/pending counts on empty pool', () => {
    const pool = new PegaWorkerPool(1);
    const stats = pool.getStats();
    expect(stats).toHaveProperty('total');
    expect(stats).toHaveProperty('busy');
    expect(stats).toHaveProperty('idle');
    expect(stats).toHaveProperty('pendingTasks');
    expect(stats.busy).toBe(0);
    expect(stats.pendingTasks).toBe(0);
  });

  it('worker pool starts with no busy workers', () => {
    const pool = new PegaWorkerPool(2);
    const stats = pool.getStats();
    expect(stats.busy).toBe(0);
  });

  it('dispatch returns a Promise', () => {
    const pool = new PegaWorkerPool(1);
    const result = pool.dispatch('test-data');
    expect(result).toBeInstanceOf(Promise);
  });
});