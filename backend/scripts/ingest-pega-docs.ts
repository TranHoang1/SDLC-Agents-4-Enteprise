/**
 * SA4E-222 Scope C — Out-of-band Pega documentation ingestion CLI.
 *
 * The backend has NO internet at runtime (R-3), so this script is executed by
 * DevOps/CI on a host with network + LLM access. It fetches docs.pega.com concept
 * pages, summarizes them via the local LLM (paraphrase ONLY, with source attribution
 * per NFR-5 / FR-C-5), and stores them into the KB via PegaDocsIngestor with the
 * structured tags: pega-doc, concept:{name}, ruletype:{x}.
 *
 * Reuses the PegaDocsIngestor logic module (injected fetcher/summarizer/store) so the
 * core behavior remains unit-tested without internet.
 *
 * Usage: tsx scripts/ingest-pega-docs.ts [--limit N]
 */

import { DatabaseAdapterFactory } from '../src/database/factory/DatabaseAdapterFactory.js';
import { LLMService } from '../src/modules/memory/llm/LLMService.js';
import {
  PegaDocsIngestor,
  type PegaDocPage,
  type DocSummarizer,
  type DocStore,
} from '../src/modules/pega/extraction/PegaDocsIngestor.js';
import pino from 'pino';

const logger = pino({ name: 'ingest-pega-docs' });

/** Seed concept areas required by BRD SM-5 (core Pega concept coverage). */
const SEED_CONCEPTS: Array<{ url: string; title: string; concept: string; ruleType?: string }> = [
  { url: 'https://docs.pega.com/bundle/platform/page/platform/rules/rule-types/rule-types.html', title: 'Pega Rule Types', concept: 'rule-types', ruleType: '*' },
  { url: 'https://docs.pega.com/bundle/platform/page/platform/case-management/case-management.html', title: 'Case Management', concept: 'case-management' },
  { url: 'https://docs.pega.com/bundle/platform/page/platform/process-flow/process-flows.html', title: 'Process Flows', concept: 'flows', ruleType: 'Rule-Obj-Flow' },
  { url: 'https://docs.pega.com/bundle/platform/page/platform/data-model/data-model.html', title: 'Data Model', concept: 'data-model' },
  { url: 'https://docs.pega.com/bundle/platform/page/platform/decisioning/decisioning.html', title: 'Decisioning', concept: 'decisioning', ruleType: 'Rule-Declare-DecisionTable' },
  { url: 'https://docs.pega.com/bundle/platform/page/platform/ui/ui.html', title: 'User Interface', concept: 'ui', ruleType: 'Rule-Obj-Section' },
  { url: 'https://docs.pega.com/bundle/platform/page/platform/integration/integration.html', title: 'Integration', concept: 'integration', ruleType: 'Rule-Connect-REST' },
];

/** Fetch a docs.pega.com page and return a coarse plain-text extraction. */
async function fetchPageText(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  const html = await res.text();
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 8000);
}

/** Build a DocStore backed by the knowledge_entries table. */
function buildStore(adapter: any): DocStore {
  return {
    async store(entry) {
      const now = new Date().toISOString();
      await adapter.runAsync(
        `INSERT INTO knowledge_entries (content, summary, type, source, tags, scope, tier, created_at, enrichment_status)
         VALUES (?, ?, 'PEGA_DOC', ?, ?, 'PROJECT', 'SEMANTIC', ?, 'done')`,
        [entry.content, entry.summary, entry.source, entry.tags, now],
      );
    },
  };
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const limitIdx = argv.indexOf('--limit');
  const limit = limitIdx >= 0 ? Number(argv[limitIdx + 1]) : SEED_CONCEPTS.length;

  const adapter = DatabaseAdapterFactory.create({
    engine: (process.env.DB_ENGINE as any) || 'sqlite',
    dbPath: process.env.DB_PATH || 'data/agent.db',
  });
  await adapter.connect();

  const llm = new LLMService();
  const summarizer: DocSummarizer = {
    async summarize(page: PegaDocPage) {
      const text = page.content || (await fetchPageText(page.url));
      const prompt = `Summarize the following Pega Platform documentation page for an engineer who builds Pega rules. Produce a concise paraphrase (max 300 words) covering key concepts and how they affect rule authoring. Do NOT copy verbatim. No citations.\n\nTitle: ${page.title}\n\n${text}`;
      return (await llm.ask(prompt, 'You are a senior Pega Platform architect.')).trim();
    },
  };

  const ingestor = new PegaDocsIngestor(summarizer, buildStore(adapter), logger);
  const pages: PegaDocPage[] = SEED_CONCEPTS.slice(0, limit).map((c) => ({ ...c, content: '' }));
  for (const p of pages) {
    try {
      p.content = await fetchPageText(p.url);
    } catch (err) {
      logger.warn({ err, url: p.url }, 'fetch failed; will let summarizer retry');
    }
  }

  const result = await ingestor.ingest(pages);
  logger.info(result, '[ingest-pega-docs] Completed');
}

main().catch((err) => {
  logger.error({ err }, 'ingest-pega-docs failed');
  process.exit(1);
});
