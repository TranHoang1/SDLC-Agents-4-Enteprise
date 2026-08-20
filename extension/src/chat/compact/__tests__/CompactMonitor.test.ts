/**
 * SA4E-182 — CompactMonitor unit tests.
 * Tests: threshold crossing, hysteresis reset, debounce, config-disabled.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CompactMonitor } from '../CompactMonitor';
import type { ContextManagerSubscription, MonitorContextState } from '../CompactMonitor';
import { CompactConfig } from '../CompactConfig';
import type { WorkspaceConfig } from '../CompactConfig';

function createMockContextManager() {
  let listener: ((state: MonitorContextState) => void) | null = null;
  const cm: ContextManagerSubscription = {
    onContextChanged: (fn: (state: MonitorContextState) => void) => {
      listener = fn;
      return { dispose: () => { listener = null; } };
    },
    getState: () => ({ usagePercent: 50, tokenCount: 50000 }),
  };
  const fire = (state: MonitorContextState) => { listener?.(state); };
  return { cm, fire };
}

function createMockConfig(autoCompact = true, threshold = 95): CompactConfig {
  const workspace: WorkspaceConfig = {
    getConfiguration: () => ({
      get: <T>(key: string, def: T) => {
        if (key === 'autoCompact') return autoCompact as unknown as T;
        if (key === 'autoCompactThreshold') return threshold as unknown as T;
        return def;
      },
    }),
    onDidChangeConfiguration: () => ({ dispose: vi.fn() }),
  };
  return new CompactConfig(workspace);
}

describe('CompactMonitor', () => {
  let triggerFn: ReturnType<typeof vi.fn>;
  let mockCm: ReturnType<typeof createMockContextManager>;
  let config: CompactConfig;
  let monitor: CompactMonitor;

  beforeEach(() => {
    triggerFn = vi.fn().mockResolvedValue(undefined);
    mockCm = createMockContextManager();
    config = createMockConfig(true, 95);
    monitor = new CompactMonitor(mockCm.cm, config, triggerFn);
    monitor.start();
  });

  it('should trigger when usage crosses threshold', () => {
    mockCm.fire({ usagePercent: 96, tokenCount: 96000 });
    expect(triggerFn).toHaveBeenCalledWith('auto');
  });

  it('should not trigger when below threshold', () => {
    mockCm.fire({ usagePercent: 90, tokenCount: 90000 });
    expect(triggerFn).not.toHaveBeenCalled();
  });

  it('should not trigger twice (debounce active)', () => {
    mockCm.fire({ usagePercent: 96, tokenCount: 96000 });
    mockCm.fire({ usagePercent: 97, tokenCount: 97000 });
    expect(triggerFn).toHaveBeenCalledTimes(1);
  });

  it('should reset debounce when usage drops below threshold - 10%', () => {
    // Cross threshold
    mockCm.fire({ usagePercent: 96, tokenCount: 96000 });
    expect(triggerFn).toHaveBeenCalledTimes(1);

    // Drop below reset point (95 - 10 = 85)
    mockCm.fire({ usagePercent: 80, tokenCount: 80000 });

    // Should trigger again
    mockCm.fire({ usagePercent: 96, tokenCount: 96000 });
    expect(triggerFn).toHaveBeenCalledTimes(2);
  });

  it('should NOT reset debounce when usage is between reset and threshold', () => {
    mockCm.fire({ usagePercent: 96, tokenCount: 96000 });
    // 90 is between 85 (reset) and 95 (threshold) — no reset
    mockCm.fire({ usagePercent: 90, tokenCount: 90000 });
    mockCm.fire({ usagePercent: 96, tokenCount: 96000 });
    expect(triggerFn).toHaveBeenCalledTimes(1);
  });

  it('should not trigger when autoCompact is disabled', () => {
    monitor.stop();
    config = createMockConfig(false, 95);
    monitor = new CompactMonitor(mockCm.cm, config, triggerFn);
    monitor.start();

    mockCm.fire({ usagePercent: 99, tokenCount: 99000 });
    expect(triggerFn).not.toHaveBeenCalled();
  });

  it('should not trigger while compacting', () => {
    monitor.getSharedState().isCompacting = true;
    mockCm.fire({ usagePercent: 99, tokenCount: 99000 });
    expect(triggerFn).not.toHaveBeenCalled();
  });

  it('should not fire after stop()', () => {
    monitor.stop();
    mockCm.fire({ usagePercent: 99, tokenCount: 99000 });
    expect(triggerFn).not.toHaveBeenCalled();
  });

  it('should report state correctly', () => {
    const state = monitor.getState();
    expect(state.isCompacting).toBe(false);
    expect(state.debounceActive).toBe(false);
  });
});
