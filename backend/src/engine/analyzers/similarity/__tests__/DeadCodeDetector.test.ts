/**
 * KSA-168 — Unit tests for DeadCodeDetector reachability and confidence scoring.
 */

import { describe, it, expect } from 'vitest';
import { DeadCodeDetector } from '../DeadCodeDetector.js';
import { makeFakeAdapter } from './fake-adapter.js';

function fnRow(id: number, name: string, opts: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    id, name, kind: 'function', filePath: `src/f${id}.ts`, startLine: id * 4,
    isExported: 0, isAsync: 0, decorators: null,
    ...opts,
  };
}

describe('DeadCodeDetector', () => {
  it('reports unreachable functions that clear the confidence threshold', async () => {
    const adapter = makeFakeAdapter();
    adapter.routeAll('SELECT ep.symbol_id', [{ symbol_id: 10 }]);
    adapter.routeAll('FROM relationships', [
      { source_symbol_id: 10, target_symbol_id: 11 },
      { source_symbol_id: 11, target_symbol_id: 12 },
    ]);
    adapter.routeAll('FROM symbols s', [
      fnRow(11, 'used'),
      fnRow(20, 'helper'),
      fnRow(30, 'onMount', { isExported: 1, decorators: '@Component' }),
    ]);
    adapter.routeGet('FROM relationships r', { count: 0 });

    const detector = new DeadCodeDetector(adapter, 60, 'p1');
    const report = await detector.detect();

    expect(report.totalFunctions).toBe(3);
    expect(report.reachableCount).toBe(3);
    expect(report.unreachableCount).toBe(2);
    expect(report.candidates).toHaveLength(1);
    expect(report.candidates[0]).toMatchObject({
      symbolId: 20,
      name: 'helper',
      confidence: 75,
      reasons: ['no_callers', 'not_exported', 'no_tests'],
    });
  });

  it('treats exported uncalled functions as below threshold', async () => {
    const adapter = makeFakeAdapter();
    adapter.routeAll('SELECT ep.symbol_id', [{ symbol_id: 10 }]);
    adapter.routeAll('FROM relationships', [
      { source_symbol_id: 10, target_symbol_id: 99 },
    ]);
    adapter.routeAll('FROM symbols s', [fnRow(40, 'pubApi', { isExported: 1 })]);
    adapter.routeGet('FROM relationships r', { count: 0 });

    const detector = new DeadCodeDetector(adapter, 60, 'p1');
    const report = await detector.detect();
    expect(report.candidates).toEqual([]);
    expect(report.unreachableCount).toBe(1);
  });

  it('applies the limit option to candidates', async () => {
    const adapter = makeFakeAdapter();
    adapter.routeAll('SELECT ep.symbol_id', []);
    adapter.routeAll('FROM relationships', []);
    adapter.routeAll('FROM symbols s', [fnRow(1, 'a'), fnRow(2, 'b')]);
    adapter.routeGet('FROM relationships r', { count: 0 });

    const detector = new DeadCodeDetector(adapter, 60, 'p1');
    const report = await detector.detect({ limit: 1 });
    expect(report.candidates).toHaveLength(1);
    expect(report.unreachableCount).toBe(2);
  });

  it('falls back to exported symbols when the entry_points table is missing', async () => {
    const adapter = makeFakeAdapter();
    adapter.routeFailAll('SELECT ep.symbol_id');
    adapter.routeAll('is_exported = 1', [{ id: 30 }]);
    adapter.routeAll('FROM relationships', []);
    adapter.routeAll('FROM symbols s', [
      fnRow(30, 'onMount', { isExported: 1 }),
      fnRow(11, 'orphan'),
    ]);
    adapter.routeGet('FROM relationships r', { count: 0 });

    const detector = new DeadCodeDetector(adapter, 60, 'p1');
    const report = await detector.detect();
    expect(report.candidates.map(c => c.symbolId)).toEqual([11]);
    expect(report.candidates[0].reasons).toContain('no_callers');
  });
});