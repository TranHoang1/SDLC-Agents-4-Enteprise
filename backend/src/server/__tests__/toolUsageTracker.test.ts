/**
 * UT-10..12 — toolUsageTracker.trackToolUsage (SA4E-18).
 * Non-blocking per-tool usage increment. Verifies no-op when memory not ready,
 * swallow-with-warn on engine throw, and guard for empty/invalid tool name.
 */

import { describe, it, expect, vi } from 'vitest';
import { ModuleRegistry } from '../../modules/ModuleRegistry.js';
import { trackToolUsage } from '../toolUsageTracker.js';
import { silentLogger } from '../../__tests__/sa4e-testkit.js';
import type { ModuleStatus } from '../../types/module.js';

function makeRegistry(status: ModuleStatus, increment: () => void) {
  const registry = new ModuleRegistry(silentLogger());
  const fake: any = {
    name: 'memory',
    status,
    initialize: async () => {},
    shutdown: async () => {},
    getToolHandlers: () => new Map(),
    getToolDefinitions: () => [],
    getEngine: () => ({ incrementToolUsage: increment }),
  };
  registry.register(fake);
  return registry;
}

describe('trackToolUsage', () => {
  it('UT-10: no-op when memory module not ready', () => {
    const inc = vi.fn();
    const registry = makeRegistry('initializing', inc);
    expect(() => trackToolUsage(registry, silentLogger(), 'mem_search')).not.toThrow();
    expect(inc).not.toHaveBeenCalled();
  });

  it('UT-11: DB write throw is swallowed with warn (non-blocking, BR-09)', () => {
    const inc = vi.fn(() => { throw new Error('db locked'); });
    const registry = makeRegistry('ready', inc);
    const logger = { warn: vi.fn(), error: vi.fn(), info: vi.fn(), child: () => logger } as any;
    expect(() => trackToolUsage(registry, logger, 'mem_search')).not.toThrow();
    expect(inc).toHaveBeenCalledTimes(1);
    expect(logger.warn).toHaveBeenCalled();
    const calls = logger.warn.mock.calls.map((c: any[]) => JSON.stringify(c));
    expect(calls.some((s: string) => s.includes('BR-09'))).toBe(true);
  });

  it('UT-12: guards empty / non-string tool name (no increment)', () => {
    const inc = vi.fn();
    const registry = makeRegistry('ready', inc);
    expect(() => trackToolUsage(registry, silentLogger(), '')).not.toThrow();
    expect(() => trackToolUsage(registry, silentLogger(), undefined as any)).not.toThrow();
    expect(() => trackToolUsage(registry, silentLogger(), 123 as any)).not.toThrow();
    expect(inc).not.toHaveBeenCalled();
  });
});
