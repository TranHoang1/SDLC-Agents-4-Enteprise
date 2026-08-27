/**
 * SA4E-222 Scope C — Unit tests for retrievePegaConcept.
 * Verifies the mem_search wrapper applies pega-doc tag filters (concept:{name}, ruletype:{x}).
 */

import { describe, it, expect, vi } from 'vitest';
import { retrievePegaConcept, type PegaConceptSearchEngine } from '../../memory/pega-concept-retriever.js';
import type { SearchResult } from '../../memory/models.js';

function entry(tags: string, id: number, summary = 's', content = 'c', source: string | null = 'https://docs.pega.com/x') {
  return {
    entry: { id, type: 'PEGA_DOC', summary, content, source, tags },
    score: 1,
    matchType: 'fts',
  } as SearchResult;
}

describe('retrievePegaConcept', () => {
  it('filters results to pega-doc tagged entries', async () => {
    const engine = {
      search: vi.fn().mockResolvedValue([
        entry('pega-doc,concept:flows', 1, 'FlowsDoc'),
        entry('unrelated,concept:other', 2, 'OtherDoc'),
      ]),
    } as unknown as PegaConceptSearchEngine;

    const out = await retrievePegaConcept(engine, { topic: 'flows' });
    expect(out).toContain('[PEGA_DOC]');
    expect(out).toContain('FlowsDoc');
    expect(out).not.toContain('OtherDoc');
  });

  it('applies ruletype:{x} filter when ruleType given', async () => {
    const engine = {
      search: vi.fn().mockResolvedValue([
        entry('pega-doc,concept:flows,ruletype:Rule-Obj-Flow', 1, 'FlowDoc'),
        entry('pega-doc,concept:flows,ruletype:Rule-Obj-Activity', 2, 'ActivityDoc'),
      ]),
    } as unknown as PegaConceptSearchEngine;

    const out = await retrievePegaConcept(engine, { ruleType: 'Rule-Obj-Flow' });
    expect(out).toContain('FlowDoc');
    expect(out).not.toContain('ActivityDoc');
  });

  it('includes source attribution in output', async () => {
    const engine = {
      search: vi.fn().mockResolvedValue([entry('pega-doc,concept:ui', 9, 'UI', 'UI is...', 'https://docs.pega.com/ui')]),
    } as unknown as PegaConceptSearchEngine;

    const out = await retrievePegaConcept(engine, { topic: 'ui' });
    expect(out).toContain('(source: https://docs.pega.com/ui)');
  });

  it('returns empty string when nothing matches', async () => {
    const engine = { search: vi.fn().mockResolvedValue([]) } as unknown as PegaConceptSearchEngine;
    const out = await retrievePegaConcept(engine, { topic: 'nope' });
    expect(out).toBe('');
  });
});
