/**
 * KSA-163 — Unit tests for DeadImportDetector unused-import reporting.
 */

import { describe, it, expect } from 'vitest';
import { DeadImportDetector } from '../DeadImportDetector.js';
import { makeFakeAdapter } from './fake-adapter.js';

describe('DeadImportDetector', () => {
  it('parses source module info from metadata', async () => {
    const adapter = makeFakeAdapter();
    adapter.routeAll('FROM relationships r', [
      { filePath: 'src/a.ts', line: 2, importedSymbol: 'lodash', metadata: '{"source":"lodash"}' },
      { filePath: 'src/b.ts', line: 1, importedSymbol: 'helper', metadata: '{"from":"./helper"}' },
      { filePath: 'src/c.ts', line: 5, importedSymbol: 'bad', metadata: '{not json' },
      { filePath: 'src/d.ts', line: 3, importedSymbol: 'none', metadata: null },
    ]);

    const detector = new DeadImportDetector(adapter, 'p1');
    const result = await detector.detect();

    expect(result).toHaveLength(4);
    expect(result.map(r => r.fromModule)).toEqual(['lodash', './helper', '', '']);
    expect(result[0]).toMatchObject({ filePath: 'src/a.ts', line: 2, importedSymbol: 'lodash' });
  });

  it('applies filePath filter to the query', async () => {
    const adapter = makeFakeAdapter();
    const detector = new DeadImportDetector(adapter, 'p1');
    await detector.detect({ filePath: 'src/' });
    expect(adapter.calls.join('\n')).toContain('r.file_path LIKE');
  });

  it('applies module filter to the query', async () => {
    const adapter = makeFakeAdapter();
    const detector = new DeadImportDetector(adapter, 'p1');
    await detector.detect({ module: 'app' });
    expect(adapter.calls.join('\n')).toContain('r.file_path LIKE');
  });

  it('respects the limit option', async () => {
    const adapter = makeFakeAdapter();
    const detector = new DeadImportDetector(adapter, 'p1');
    await detector.detect({ limit: 25 });
    expect(adapter.calls.join('\n')).toContain('LIMIT ?');
  });

  it('returns empty results when no rows are returned', async () => {
    const adapter = makeFakeAdapter();
    const detector = new DeadImportDetector(adapter, 'p1');
    expect(await detector.detect()).toEqual([]);
  });
});