/**
 * SA4E-222 Scope C — PegaDocsIngestor (logic module).
 *
 * Summarizes docs.pega.com concept pages (with source attribution, never verbatim
 * bulk copy — NFR-5 / FR-C-5) and stores them into the KB. The actual network
 * fetch + LLM summarization live in the out-of-band CLI (`scripts/ingest-pega-docs.ts`),
 * which injects a fetcher/summarizer/store into this class so the core logic is
 * deterministic and unit-testable without internet (R-3).
 */

import type { Logger } from 'pino';

/** A single Pega documentation page to ingest. */
export interface PegaDocPage {
  url: string;
  title: string;
  /** Concept name used in the `concept:{name}` tag. */
  concept: string;
  /** Optional rule type used in the `ruletype:{x}` tag. */
  ruleType?: string;
  /** Raw page text (already fetched by the caller). */
  content: string;
}

/** Summarizes a page into a short paraphrase. Injected for testability. */
export interface DocSummarizer {
  summarize(page: PegaDocPage): Promise<string>;
}

/** Persists a summarized entry. Injected for testability. */
export interface DocStore {
  store(entry: { content: string; source: string; tags: string; summary: string }): Promise<void>;
}

/** Build the structured tag string for a page (pega-doc, concept:{name}, ruletype:{x}). */
export function buildPegaDocTags(page: PegaDocPage): string {
  const tags = ['pega-doc', `concept:${page.concept}`];
  if (page.ruleType) tags.push(`ruletype:${page.ruleType}`);
  return tags.join(',');
}

/**
 * Ingests Pega documentation pages into the KB with source attribution.
 * Failures are logged (never swallowed silently) and counted, so a partial KB
 * is acceptable and per-page retries are possible (FR-C-5 / §6).
 */
export class PegaDocsIngestor {
  constructor(
    private readonly summarizer: DocSummarizer,
    private readonly store: DocStore,
    private readonly logger: Logger,
  ) {}

  async ingest(pages: PegaDocPage[]): Promise<{ ingested: number; failed: number }> {
    let ingested = 0;
    let failed = 0;
    for (const page of pages) {
      try {
        const summary = await this.summarizer.summarize(page);
        const tags = buildPegaDocTags(page);
        await this.store.store({
          content: `${summary}\n\nSource: ${page.url}`,
          source: page.url,
          tags,
          summary: page.title,
        });
        ingested++;
      } catch (err) {
        this.logger.warn({ err, url: page.url }, '[pega-docs] Ingest failed for page');
        failed++;
      }
    }
    return { ingested, failed };
  }
}
