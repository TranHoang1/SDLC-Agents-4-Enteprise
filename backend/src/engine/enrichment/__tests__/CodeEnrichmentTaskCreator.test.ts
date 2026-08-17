/**
 * SA4E-106: CodeEnrichmentTaskCreator — cross-scope enrichment copy.
 * Verifies copyEnrichmentFromOtherScope copies summary, pseudo_code, llm_tags
 * from enriched symbols in another project to the current project.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CodeEnrichmentTaskCreator } from '../CodeEnrichmentTaskCreator.js';
import type { DatabaseAdapter } from '../../../database/adapters/DatabaseAdapter.js';
import pino from 'pino';

const logger = pino({ level: 'silent' });

/** Create mock DB adapter with controllable query responses. */
function createMockAdapter() {
  return {
    getAsync: vi.fn(),
    allAsync: vi.fn(() => Promise.resolve([])),
    runAsync: vi.fn(() => Promise.resolve({ changes: 0, lastInsertRowid: 0 })),
    getEngine: vi.fn(() => 'sqlite'),
  } as unknown as DatabaseAdapter;
}

describe('SA4E-106: copyEnrichmentFromOtherScope', () => {
  let adapter: DatabaseAdapter;
  let creator: CodeEnrichmentTaskCreator;

  beforeEach(() => {
    adapter = createMockAdapter();
    creator = new CodeEnrichmentTaskCreator(adapter, logger);
  });

  it('copies enrichment data from source scope to target', async () => {
    // Setup: current file has content_hash
    (adapter.getAsync as any)
      .mockResolvedValueOnce({ content_hash: 'abc123' })  // findSourceFileId -> currentFile
      .mockResolvedValueOnce({ id: 10 })                   // findSourceFileId -> sourceFile
      .mockResolvedValueOnce({ id: 20 });                  // findTargetFileId -> targetFile

    // Source symbols enriched
    (adapter.allAsync as any).mockResolvedValueOnce([
      { name: 'MyClass', kind: 'class', summary: 'A utility class', pseudo_code: null, llm_tags: 'domain:util' },
      { name: 'process', kind: 'function', summary: 'Process data', pseudo_code: 'load then transform', llm_tags: 'responsibility:processing' },
    ]);

    // Both updates succeed
    (adapter.runAsync as any)
      .mockResolvedValueOnce({ changes: 1, lastInsertRowid: 0 })
      .mockResolvedValueOnce({ changes: 1, lastInsertRowid: 0 });

    const result = await (creator as any).copyEnrichmentFromOtherScope('src/utils.ts', 'project-B');
    expect(result).toBe(2);
    expect(adapter.runAsync).toHaveBeenCalledTimes(2);
  });

  it('returns 0 when no content_hash exists for current file', async () => {
    (adapter.getAsync as any).mockResolvedValueOnce(null);

    const result = await (creator as any).copyEnrichmentFromOtherScope('src/new.ts', 'project-B');
    expect(result).toBe(0);
  });

  it('returns 0 when no source file found in other scope', async () => {
    (adapter.getAsync as any)
      .mockResolvedValueOnce({ content_hash: 'abc123' })
      .mockResolvedValueOnce(null); // No source file

    const result = await (creator as any).copyEnrichmentFromOtherScope('src/file.ts', 'project-B');
    expect(result).toBe(0);
  });

  it('returns 0 when target file not found in current project', async () => {
    (adapter.getAsync as any)
      .mockResolvedValueOnce({ content_hash: 'abc123' })
      .mockResolvedValueOnce({ id: 10 })
      .mockResolvedValueOnce(null); // No target file

    const result = await (creator as any).copyEnrichmentFromOtherScope('src/file.ts', 'project-B');
    expect(result).toBe(0);
  });

  it('skips source symbols without summary', async () => {
    (adapter.getAsync as any)
      .mockResolvedValueOnce({ content_hash: 'abc123' })
      .mockResolvedValueOnce({ id: 10 })
      .mockResolvedValueOnce({ id: 20 });

    // One symbol has no summary -> should be skipped
    (adapter.allAsync as any).mockResolvedValueOnce([
      { name: 'Helper', kind: 'class', summary: null, pseudo_code: null, llm_tags: null },
      { name: 'run', kind: 'function', summary: 'Run logic', pseudo_code: 'call api', llm_tags: 'domain:api' },
    ]);

    (adapter.runAsync as any).mockResolvedValueOnce({ changes: 1, lastInsertRowid: 0 });

    const result = await (creator as any).copyEnrichmentFromOtherScope('src/file.ts', 'project-B');
    expect(result).toBe(1); // Only 'run' copied
    expect(adapter.runAsync).toHaveBeenCalledTimes(1);
  });

  it('uses COALESCE for pseudo_code to preserve existing values', async () => {
    (adapter.getAsync as any)
      .mockResolvedValueOnce({ content_hash: 'abc123' })
      .mockResolvedValueOnce({ id: 10 })
      .mockResolvedValueOnce({ id: 20 });

    (adapter.allAsync as any).mockResolvedValueOnce([
      { name: 'PegaFlow', kind: 'pega_flow', summary: 'A flow', pseudo_code: 'new pseudo', llm_tags: 'domain:pega' },
    ]);

    (adapter.runAsync as any).mockResolvedValueOnce({ changes: 1, lastInsertRowid: 0 });

    await (creator as any).copyEnrichmentFromOtherScope('src/flow.ts', 'project-B');

    // Verify COALESCE is used in the SQL (pseudo_code param passed)
    const sqlCall = (adapter.runAsync as any).mock.calls[0];
    expect(sqlCall[0]).toContain('COALESCE');
    expect(sqlCall[1]).toContain('new pseudo');
  });
});

describe('SA4E-106: createTasks calls copyEnrichmentFromOtherScope', () => {
  let adapter: DatabaseAdapter;
  let creator: CodeEnrichmentTaskCreator;

  beforeEach(() => {
    adapter = createMockAdapter();
    creator = new CodeEnrichmentTaskCreator(adapter, logger);
  });

  it('copies enrichment and returns 0 when file enriched in other scope', async () => {
    // isFileEnrichedInOtherScope returns true
    (adapter.getAsync as any)
      .mockResolvedValueOnce({ content_hash: 'hash1' })   // isFileEnrichedInOtherScope -> currentFile
      .mockResolvedValueOnce({ id: 5 })                    // isFileEnrichedInOtherScope -> enrichedElsewhere
      // copyEnrichmentFromOtherScope
      .mockResolvedValueOnce({ content_hash: 'hash1' })   // findSourceFileId -> currentFile
      .mockResolvedValueOnce({ id: 5 })                    // findSourceFileId -> sourceFile
      .mockResolvedValueOnce({ id: 15 });                  // findTargetFileId -> targetFile

    (adapter.allAsync as any).mockResolvedValueOnce([
      { name: 'Foo', kind: 'class', summary: 'Foo class', pseudo_code: null, llm_tags: 'domain:core' },
    ]);
    (adapter.runAsync as any).mockResolvedValueOnce({ changes: 1, lastInsertRowid: 0 });

    const symbolIds = new Map([['Foo', 1]]);
    const result = await creator.createTasks(symbolIds, 'src/foo.ts', 'project-new');

    // Returns 0 (no LLM tasks needed) but copy happened
    expect(result).toBe(0);
  });
});
