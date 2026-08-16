/**
 * SA4E-171 — Pega symbol search for dual-read in MemoryEngine.
 * Queries symbols_fts for pega_* kinds, enforces project_id (SEC-04).
 * FTS sanitization: strip special chars, limit to 200 chars (Security).
 */

import type { DatabaseAdapter } from '../../../database/adapters/DatabaseAdapter.js';
import type { SearchResult, ScopeContext } from '../models.js';

/** Max FTS query length to prevent abuse (Security Finding #2). */
const MAX_FTS_QUERY_LENGTH = 200;

/**
 * Search symbols_fts for Pega kinds (pega_*).
 * Enforces project_id scoping (SEC-04).
 * @param adapter - Database adapter
 * @param query - Raw search query from user
 * @param limit - Maximum results
 * @param scopeCtx - Scope context with projectId (required for search)
 * @returns Array of SearchResult from symbols_fts
 */
export async function searchPegaSymbols(
  adapter: DatabaseAdapter,
  query: string,
  limit: number,
  scopeCtx?: ScopeContext,
): Promise<SearchResult[]> {
  // SEC-04: require project_id for all Pega symbol queries
  if (!scopeCtx?.projectId) return [];

  // Security Finding #1, #2: sanitize + limit FTS query
  const ftsQuery = sanitizeFtsQuery(query);
  if (!ftsQuery) return [];

  const engine = adapter.getEngine();
  if (engine === 'sqlite') {
    return searchSqliteSymbols(adapter, ftsQuery, limit, scopeCtx.projectId);
  }
  if (engine === 'postgresql') {
    return searchPgSymbols(adapter, ftsQuery, limit, scopeCtx.projectId);
  }
  return [];
}

/**
 * Merge legacy KB results + symbol results, deduplicate by FQN (BR-22).
 * Prefer symbols result when FQN matches (newer data source).
 * @param legacy - Results from knowledge_fts
 * @param symbols - Results from symbols_fts
 * @param limit - Max combined results
 * @returns Merged and deduplicated results, sorted by score
 */
export function mergeDedupResults(
  legacy: SearchResult[],
  symbols: SearchResult[],
  limit: number,
): SearchResult[] {
  const seenFqns = new Set<string>();
  const merged: SearchResult[] = [];

  // Symbols first (preferred source — BR-22)
  for (const sr of symbols) {
    const fqn = extractFqn(sr);
    if (fqn) seenFqns.add(fqn);
    merged.push(sr);
  }

  // Legacy results — skip if FQN already seen from symbols
  for (const lr of legacy) {
    const fqn = extractFqn(lr);
    if (fqn && seenFqns.has(fqn)) continue;
    merged.push(lr);
  }

  return merged.sort((a, b) => (b.score ?? 0) - (a.score ?? 0)).slice(0, limit);
}

/**
 * Sanitize FTS query: strip special chars, limit length.
 * Security Finding #1: strip colons and quotes to prevent FTS injection.
 * Security Finding #2: limit to 200 chars to prevent abuse.
 */
function sanitizeFtsQuery(query: string): string {
  const sanitized = query
    .replace(/[^\w\s*]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_FTS_QUERY_LENGTH);
  return sanitized || '*';
}

/** Extract FQN from a SearchResult for dedup comparison. */
function extractFqn(result: SearchResult): string {
  return (result as any).signature
    || (result as any).source
    || result.entry?.source
    || '';
}

/** SQLite FTS5 query against symbols_fts. */
async function searchSqliteSymbols(
  adapter: DatabaseAdapter,
  ftsQuery: string, limit: number, projectId: string,
): Promise<SearchResult[]> {
  const sql = `SELECT s.id, s.name, s.kind, s.signature, s.doc_comment,
                      s.summary, s.enrichment_status, f.rank AS score
               FROM symbols_fts f
               JOIN symbols s ON f.rowid = s.id
               WHERE symbols_fts MATCH ?
                 AND s.kind LIKE 'pega_%'
                 AND s.project_id = ?
               ORDER BY f.rank LIMIT ?`;
  try {
    const rows = await adapter.allAsync<any>(sql, [ftsQuery, projectId, limit]);
    return rows.map(mapSymbolRow);
  } catch {
    return [];
  }
}

/** PostgreSQL full-text query against symbols table. */
async function searchPgSymbols(
  adapter: DatabaseAdapter,
  ftsQuery: string, limit: number, projectId: string,
): Promise<SearchResult[]> {
  // PostgreSQL uses ILIKE fallback (symbols_fts is SQLite-specific FTS5)
  const sql = `SELECT s.id, s.name, s.kind, s.signature, s.doc_comment,
                      s.summary, s.enrichment_status, 1.0 AS score
               FROM symbols s
               WHERE s.name ILIKE $1
                 AND s.kind LIKE 'pega_%'
                 AND s.project_id = $2
               ORDER BY s.name LIMIT $3`;
  try {
    const pattern = `%${ftsQuery.replace(/[*"]/g, '')}%`;
    const rows = await adapter.allAsync<any>(sql, [pattern, projectId, limit]);
    return rows.map(mapSymbolRow);
  } catch {
    return [];
  }
}

/** Map a symbols row to SearchResult format. */
function mapSymbolRow(row: any): SearchResult {
  return {
    entry: {
      id: row.id,
      content: row.doc_comment || '',
      summary: row.summary || `${row.kind}: ${row.name}`,
      type: 'PEGA_RULE',
      source: row.signature || row.name,
      tags: `pega,${row.kind}`,
      tier: 'SEMANTIC',
      scope: 'PROJECT',
    } as any,
    score: typeof row.score === 'number' ? -row.score : 0,
    matchType: 'symbols_fts',
  } as SearchResult;
}
