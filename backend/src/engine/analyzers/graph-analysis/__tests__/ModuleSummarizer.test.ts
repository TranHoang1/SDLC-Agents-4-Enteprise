/**
 * KSA-163 — Unit tests for ModuleSummarizer per-module quality aggregation.
 */

import { describe, it, expect } from 'vitest';
import { ModuleSummarizer } from '../ModuleSummarizer.js';
import { makeFakeAdapter } from './fake-adapter.js';

function buildAdapter() {
  const adapter = makeFakeAdapter();
  adapter.routeAll('FROM modules', [{ name: 'app', fileCount: 5, symbolCount: 20 }]);
  adapter.routeAll('FROM relationships r', [
    { filePath: 'src/legacy.ts', line: 1, importedSymbol: 'lodash', metadata: '{"source":"lodash"}' },
    { filePath: 'src/util.ts', line: 2, importedSymbol: 'moment', metadata: null },
  ]);
  adapter.routeAll("kind = 'imports'", [
    { source_symbol_id: 1, target_symbol_id: 2 },
    { source_symbol_id: 2, target_symbol_id: 1 },
  ]);
  adapter.routeAll("kind = 'calls'", [
    { source_symbol_id: 1, target_symbol_id: 2 },
    { source_symbol_id: 1, target_symbol_id: 3 },
    { source_symbol_id: 2, target_symbol_id: 4 },
    { source_symbol_id: 3, target_symbol_id: 4 },
    { source_symbol_id: 4, target_symbol_id: 5 },
  ]);
  adapter.routeAll('SELECT s.id, s.name', [
    { id: 1, name: 'compA', kind: 'function', filePath: 'src/a.ts' },
    { id: 2, name: 'compB', kind: 'function', filePath: 'src/b.ts' },
  ]);
  adapter.routeGet('FROM symbols s JOIN files', { id: 4, name: 'render', kind: 'function', filePath: 'src/app.ts' });
  adapter.routeGet('AVG(c.cyclomatic_complexity)', { avg: 3.5 });
  return adapter;
}

describe('ModuleSummarizer', () => {
  it('aggregates metrics for every module', async () => {
    const summarizer = new ModuleSummarizer(buildAdapter(), 'p1');
    const results = await summarizer.summarize();

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      module: 'app',
      fileCount: 5,
      symbolCount: 20,
      circularDeps: 1,
      deadImports: 2,
      avgComplexity: 3.5,
    });
    expect(results[0].hotPaths).toHaveLength(1);
    expect(results[0].hotPaths[0]).toMatchObject({
      symbolId: 4, symbolName: 'render', directCallers: 2, transitiveCallers: 3,
    });
  });

  it('filters to a specific module by name', async () => {
    const adapter = buildAdapter();
    const summarizer = new ModuleSummarizer(adapter, 'p1');
    await summarizer.summarize('app');
    expect(adapter.calls.join('\n')).toContain('AND name = ?');
  });

  it('returns empty when no modules exist', async () => {
    const summarizer = new ModuleSummarizer(makeFakeAdapter(), 'p1');
    expect(await summarizer.summarize()).toEqual([]);
  });
});