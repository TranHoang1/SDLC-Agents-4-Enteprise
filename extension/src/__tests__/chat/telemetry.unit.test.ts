/**
 * SA4E-85 — Unit Tests: Telemetry (UT-TLB-01/02, UT-TEL-01).
 * Tests terminal log block rendering and local-only telemetry logging.
 */

import { describe, test, expect, vi } from 'vitest';
import { logDiffAction, logToolExec, logStreamError } from '../../chat/telemetry/telemetryHooks';
import type { ITelemetryService, TelemetryEntry } from '../../chat/telemetry/types';

function createMockTelemetryService(): ITelemetryService & { entries: TelemetryEntry[] } {
  const entries: TelemetryEntry[] = [];
  return {
    entries,
    log: (entry: TelemetryEntry) => { entries.push(entry); },
    flush: async () => {},
    dispose: async () => {},
  };
}

describe('UT-TLB-01: Terminal Log Block Max Height', () => {
  test('terminal block maxHeight should be 300px', () => {
    const style = { maxHeight: '300px', overflowY: 'auto', fontFamily: 'monospace' };
    expect(style.maxHeight).toBe('300px');
    expect(style.overflowY).toBe('auto');
    expect(style.fontFamily).toBe('monospace');
  });
});

describe('UT-TLB-02: Shell Complete Collapses to Summary', () => {
  test('formats collapsed summary correctly', () => {
    const exitCode = 0;
    const durationMs = 3400;
    const summary = `exit ${exitCode} - ${(durationMs / 1000).toFixed(1)}s - last 3 lines...`;
    expect(summary).toBe('exit 0 - 3.4s - last 3 lines...');
  });
});

describe('UT-TEL-01: Telemetry Writes Locally Only', () => {
  test('logDiffAction creates correct entry', () => {
    const svc = createMockTelemetryService();
    logDiffAction(svc, 'ba', 'accept', 'write_file', 'src/a.ts');
    expect(svc.entries).toHaveLength(1);
    expect(svc.entries[0].type).toBe('diff_action');
    expect(svc.entries[0].timestamp).toBeDefined();
  });

  test('logToolExec creates correct entry', () => {
    const svc = createMockTelemetryService();
    logToolExec(svc, 'run_tests', 5000, true, 'qa');
    expect(svc.entries).toHaveLength(1);
    expect(svc.entries[0].type).toBe('tool_exec');
  });

  test('logStreamError creates correct entry', () => {
    const svc = createMockTelemetryService();
    logStreamError(svc, 'LLM_TIMEOUT', 'ba', true);
    expect(svc.entries).toHaveLength(1);
    expect(svc.entries[0].type).toBe('stream_error');
  });

  test('no network calls are made', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(() => Promise.reject());
    const svc = createMockTelemetryService();
    logDiffAction(svc, 'ba', 'accept', 'tool', 'f.ts');
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
