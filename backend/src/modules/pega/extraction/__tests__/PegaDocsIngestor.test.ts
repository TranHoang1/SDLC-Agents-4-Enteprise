/**
 * SA4E-222 Scope C — Unit tests for PegaDocsIngestor.
 * Verifies summary + source-attributed storage with the correct pega-doc tags, and
 * that per-page failures are logged (never swallowed) without aborting the batch.
 */

import { describe, it, expect, vi } from 'vitest';
import pino from 'pino';
import { PegaDocsIngestor, buildPegaDocTags, type PegaDocPage, type DocSummarizer, type DocStore } from '../PegaDocsIngestor.js';

const LOGGER = pino({ name: 'test', level: 'silent' });

const PAGE: PegaDocPage = {
  url: 'https://docs.pega.com/bundle/platform/page/flows',
  title: 'Process Flows',
  concept: 'flows',
  ruleType: 'Rule-Obj-Flow',
  content: 'Flows orchestrate...',
};

describe('PegaDocsIngestor', () => {
  it('stores a summarized entry with pega-doc tags and source attribution', async () => {
    const storeMock = vi.fn().mockResolvedValue(undefined);
    const store = { store: storeMock } as unknown as DocStore;
    const summarizer: DocSummarizer = { summarize: vi.fn().mockResolvedValue('A concise paraphrase of flows.') };
    const ingestor = new PegaDocsIngestor(summarizer, store, LOGGER);

    const result = await ingestor.ingest([PAGE]);
    expect(result.ingested).toBe(1);
    expect(result.failed).toBe(0);
    expect(storeMock).toHaveBeenCalledWith({
      content: expect.stringContaining('Source: https://docs.pega.com/bundle/platform/page/flows'),
      source: PAGE.url,
      tags: 'pega-doc,concept:flows,ruletype:Rule-Obj-Flow',
      summary: 'Process Flows',
    });
  });

  it('continues past a failing page and counts it as failed', async () => {
    const storeMock = vi.fn().mockResolvedValue(undefined);
    const store = { store: storeMock } as unknown as DocStore;
    const summarizer: DocSummarizer = {
      summarize: vi.fn().mockRejectedValue(new Error('llm down')),
    };
    const ingestor = new PegaDocsIngestor(summarizer, store, LOGGER);

    const result = await ingestor.ingest([PAGE, PAGE]);
    expect(result.ingested).toBe(0);
    expect(result.failed).toBe(2);
  });

  it('buildPegaDocTags includes ruletype only when provided', () => {
    expect(buildPegaDocTags(PAGE)).toBe('pega-doc,concept:flows,ruletype:Rule-Obj-Flow');
    expect(buildPegaDocTags({ ...PAGE, ruleType: undefined })).toBe('pega-doc,concept:flows');
  });
});
