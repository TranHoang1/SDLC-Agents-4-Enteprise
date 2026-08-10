/**
 * SA4E-91 — Code Edge Extractor.
 * Extracts IMPORTS, EXTENDS, and CALLS edges from code intelligence data
 * (code_dependencies, code_call_graph, symbols) after graph node projection.
 * Non-blocking, best-effort: failures never break the index run.
 */

import type { DatabaseAdapter } from '../../database/adapters/DatabaseAdapter.js';
import type { Logger } from 'pino';

/** A graph edge extracted from code intelligence tables. */
export interface CodeGraphEdge {
  source: string;
  target: string;
  label: string;
  weight: number;
}

/** Strategy interface for code edge extraction. */
export interface CodeEdgeStrategy {
  /** Extract edges for the given project from the index DB. */
  extract(indexAdapter: DatabaseAdapter, projectId: string): Promise<CodeGraphEdge[]>;
}

/** Extracts IMPORTS edges from code_dependencies table. */
export class ImportsEdgeStrategy implements CodeEdgeStrategy {
  async extract(indexAdapter: DatabaseAdapter, projectId: string): Promise<CodeGraphEdge[]> {
    const rows = await indexAdapter.allAsync<{ source_file_id: number; target_file_id: number }>(
      `SELECT cd.source_file_id, cd.target_file_id
       FROM code_dependencies cd
       JOIN files f ON cd.source_file_id = f.id
       WHERE f.project_id = ? AND cd.target_file_id IS NOT NULL`,
      [projectId],
    );
    return rows.map(r => ({
      source: `code:${r.source_file_id}`,
      target: `code:${r.target_file_id}`,
      label: 'IMPORTS',
      weight: 0.8,
    }));
  }
}

/** Extracts CALLS edges from code_call_graph table. */
export class CallsEdgeStrategy implements CodeEdgeStrategy {
  async extract(indexAdapter: DatabaseAdapter, projectId: string): Promise<CodeGraphEdge[]> {
    const rows = await indexAdapter.allAsync<{ caller_id: number; callee_id: number }>(
      `SELECT cg.caller_symbol_id AS caller_id, cg.callee_symbol_id AS callee_id
       FROM code_call_graph cg
       JOIN symbols s ON cg.caller_symbol_id = s.id
       WHERE s.project_id = ?`,
      [projectId],
    );
    return rows.map(r => ({
      source: `code:${r.caller_id}`,
      target: `code:${r.callee_id}`,
      label: 'CALLS',
      weight: 0.7,
    }));
  }
}

/** Extracts EXTENDS edges from class inheritance (parent_symbol_id). */
export class ExtendsEdgeStrategy implements CodeEdgeStrategy {
  async extract(indexAdapter: DatabaseAdapter, projectId: string): Promise<CodeGraphEdge[]> {
    const rows = await indexAdapter.allAsync<{ child_id: number; parent_id: number }>(
      `SELECT s.id AS child_id, s.parent_symbol_id AS parent_id
       FROM symbols s
       WHERE s.project_id = ? AND s.parent_symbol_id IS NOT NULL`,
      [projectId],
    );
    return rows.map(r => ({
      source: `code:${r.child_id}`,
      target: `code:${r.parent_id}`,
      label: 'EXTENDS',
      weight: 0.9,
    }));
  }
}

/** Registry of all code-edge strategies. */
const CODE_EDGE_STRATEGIES: CodeEdgeStrategy[] = [
  new ImportsEdgeStrategy(),
  new CallsEdgeStrategy(),
  new ExtendsEdgeStrategy(),
];

/**
 * Batch-insert extracted code edges into graph_edges (admin DB).
 * Uses ON CONFLICT DO NOTHING for idempotency.
 * Non-fatal: catches all errors to avoid breaking index pipeline.
 */
export async function extractAndInsertCodeEdges(
  indexAdapter: DatabaseAdapter,
  adminAdapter: DatabaseAdapter,
  projectId: string,
  log: Logger,
): Promise<number> {
  let totalInserted = 0;
  for (const strategy of CODE_EDGE_STRATEGIES) {
    try {
      const edges = await strategy.extract(indexAdapter, projectId);
      totalInserted += await batchInsertEdges(adminAdapter, edges);
    } catch (err) {
      // Best-effort: log and continue with next strategy
      log.warn({ err }, `[code-edge-extractor] Strategy ${strategy.constructor.name} failed`);
    }
  }
  return totalInserted;
}

/** Insert edges in batch, ignoring conflicts (idempotent). */
async function batchInsertEdges(adapter: DatabaseAdapter, edges: CodeGraphEdge[]): Promise<number> {
  let count = 0;
  const sql = adapter.getEngine() === 'sqlite'
    ? `INSERT OR IGNORE INTO graph_edges (source, target, weight, rel_type) VALUES (?, ?, ?, ?)`
    : `INSERT INTO graph_edges (source, target, weight, rel_type) VALUES ($1, $2, $3, $4) ON CONFLICT (source, target) DO NOTHING`;
  for (const edge of edges) {
    const result = await adapter.runAsync(sql, [edge.source, edge.target, edge.weight, edge.label]);
    if ((result.changes ?? 0) > 0) count++;
  }
  return count;
}
