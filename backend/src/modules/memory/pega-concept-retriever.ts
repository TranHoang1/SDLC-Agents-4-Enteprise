/**
 * SA4E-222 Scope C — Pega concept retrieval helper.
 *
 * Thin wrapper over mem_search (MemoryEngine.search) that filters the KB to
 * Pega documentation entries by the structured tags written by PegaDocsIngestor:
 *   pega-doc, concept:{name}, ruletype:{x}
 * Reused by both the enrichment pipeline (understanding a rule) and the future
 * rule-generation pipeline (grounding generated rule JSON) — FR-C-3 / AC-C-2 / AC-C-3.
 */

import type { ScopeContext, SearchResult } from './models.js';

/** Minimal search surface required from the memory engine (structural typing). */
export interface PegaConceptSearchEngine {
  search(
    query: string,
    limit?: number,
    tier?: string,
    type?: string,
    scopeCtx?: ScopeContext,
  ): Promise<SearchResult[]>;
}

export interface RetrievePegaConceptOptions {
  /** Pega rule type to filter on (ruletype:{x} tag). */
  ruleType?: string;
  /** Concept/topic name to filter on (concept:{name} tag). */
  topic?: string;
  /** Maximum number of hits to return. Default 5. */
  k?: number;
  /** Scope isolation context (project/user). */
  scopeCtx?: ScopeContext;
}

export interface PegaConceptHit {
  id: number;
  type: string;
  summary: string;
  content: string;
  source: string | null;
  tags: string;
  score: number;
}

/**
 * Retrieve authoritative Pega platform knowledge from the KB.
 * @returns concatenated context blocks (with source attribution), or '' when none.
 */
export async function retrievePegaConcept(
  engine: PegaConceptSearchEngine,
  opts: RetrievePegaConceptOptions,
): Promise<string> {
  const k = opts.k ?? 5;
  const queryParts = ['pega concept'];
  if (opts.ruleType) queryParts.push(opts.ruleType);
  if (opts.topic) queryParts.push(opts.topic);
  const query = queryParts.join(' ');

  const results = await engine.search(query, k, undefined, undefined, opts.scopeCtx);
  const hits: PegaConceptHit[] = results
    .filter((r) => hasPegaDocTags(r, opts))
    .map((r) => ({
      id: r.entry.id,
      type: r.entry.type,
      summary: r.entry.summary,
      content: r.entry.content,
      source: r.entry.source,
      tags: r.entry.tags || '',
      score: r.score,
    }));

  if (hits.length === 0) return '';
  return hits
    .map((h) => {
      const src = h.source ? ` (source: ${h.source})` : '';
      return `[${h.type}] ${h.summary}${src}\n${h.content}`;
    })
    .join('\n\n');
}

/** True when the entry carries pega-doc tags matching the requested filters. */
function hasPegaDocTags(r: SearchResult, opts: RetrievePegaConceptOptions): boolean {
  const tags = (r.entry.tags || '').toLowerCase();
  if (!tags.includes('pega-doc')) return false;
  if (opts.ruleType && !tags.includes(`ruletype:${opts.ruleType.toLowerCase()}`)) return false;
  if (opts.topic && !tags.includes(`concept:${opts.topic.toLowerCase()}`)) return false;
  return true;
}
