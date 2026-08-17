/**
 * KSA-161 — Unit tests for the ComplexityStore CRUD layer.
 */

import { describe, it, expect } from 'vitest';
import { ComplexityStore } from '../ComplexityStore.js';
import type { ComplexityResult } from '../types.js';
import { makeFakeAdapter } from './fake-adapter.js';

const RESULT: ComplexityResult = {
  symbol_id: 1,
  symbol_name: 'calc',
  file_path: 'src/calc.ts',
  start_line: 1,
  end_line: 10,
  cyclomatic_complexity: 5,
  branches: 2,
  loops: 1,
  logical_ops: 0,
  nesting_depth: 1,
  early_returns: 0,
  exception_handlers: 0,
  grade: 'B',
};

describe('ComplexityStore', () => {
  it('upserts a result with sqlite upsert SQL', async () => {
    const adapter = makeFakeAdapter();
    const store = new ComplexityStore(adapter, 'p1');
    await store.upsert(RESULT);

    const write = adapter.writes.find(w => w.sql.includes('INSERT OR REPLACE INTO complexity'));
    expect(write).toBeDefined();
    expect(write!.params[0]).toBe(1);
    expect(write!.params[1]).toBe(5);
    expect(write!.params[8]).toBe('B');
  });

  it('upsertBatch wraps inserts in a transaction', async () => {
    const adapter = makeFakeAdapter();
    const store = new ComplexityStore(adapter, 'p1');
    await store.upsertBatch([RESULT, { ...RESULT, symbol_id: 2, symbol_name: 'render' }]);

    const inserts = adapter.writes.filter(w => w.sql.includes('INSERT OR REPLACE INTO complexity'));
    expect(inserts).toHaveLength(2);
  });

  it('fetches a row by symbol id and returns null when missing', async () => {
    const adapter = makeFakeAdapter();
    adapter.routeGet('SELECT c.*, s.name as symbol_name', RESULT);
    const store = new ComplexityStore(adapter, 'p1');
    expect((await store.getBySymbol(1))?.symbol_name).toBe('calc');

    const emptyAdapter = makeFakeAdapter();
    const emptyStore = new ComplexityStore(emptyAdapter, 'p1');
    expect(await emptyStore.getBySymbol(1)).toBeNull();
  });

  it('queries with filters, sorting and summary metrics', async () => {
    const adapter = makeFakeAdapter();
    adapter.routeGet('AVG(c.cyclomatic_complexity)', { avg: 4.25 });
    adapter.routeAll('SELECT c.*, s.name as symbol_name', [RESULT]);
    adapter.routeAll('SELECT c.grade, COUNT(*)', [{ grade: 'B', count: 2 }, { grade: 'C', count: 3 }]);

    const store = new ComplexityStore(adapter, 'p1');
    const result = await store.query({
      filePath: 'src/',
      symbolName: 'calc',
      minComplexity: 3,
      gradeFilter: ['B', 'C'],
      module: 'app',
      limit: 10,
      sortBy: 'name',
    });

    expect(result.results).toHaveLength(1);
    expect(result.summary.average).toBe(4.25);
    expect(result.summary.gradeDistribution).toEqual({ A: 0, B: 2, C: 3, D: 0, F: 0 });

    const sql = adapter.calls.join('\n');
    expect(sql).toContain('f.relative_path LIKE');
    expect(sql).toContain('s.name LIKE');
    expect(sql).toContain('c.cyclomatic_complexity >=');
    expect(sql).toContain('grade IN (?,?)');
    expect(sql).toContain('f.module = ?');
    expect(sql).toContain('ORDER BY s.name ASC');
    expect(sql).toContain('LIMIT ?');
  });

  it('sorts by file when requested', async () => {
    const adapter = makeFakeAdapter();
    const store = new ComplexityStore(adapter, 'p1');
    await store.query({ limit: 5, sortBy: 'file' });
    expect(adapter.calls.join('\n')).toContain('ORDER BY f.relative_path ASC, s.start_line ASC');
  });

  it('is fail-closed when no project id is present', async () => {
    const adapter = makeFakeAdapter();
    const store = new ComplexityStore(adapter);
    const result = await store.query({ limit: 5, sortBy: 'complexity' });
    expect(result.results).toEqual([]);
    expect(result.total).toBe(0);
    expect(result.summary.gradeDistribution).toEqual({ A: 0, B: 0, C: 0, D: 0, F: 0 });
    expect(result.summary.average).toBe(0);
  });

  it('deletes a complexity row by symbol id', async () => {
    const adapter = makeFakeAdapter();
    const store = new ComplexityStore(adapter, 'p1');
    await store.deleteBySymbol(42);
    const write = adapter.writes.find(w => w.sql.includes('DELETE FROM complexity'));
    expect(write?.params[0]).toBe(42);
  });
});