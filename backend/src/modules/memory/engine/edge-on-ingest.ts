/**
 * SA4E-91 — Edge-on-Ingest: extracts graph edges when KB entries are ingested.
 * Pattern-matches content for entity references (ticket keys, file paths,
 * class names) and creates REFERENCES/DISCUSSES/BELONGS_TO edges.
 * Non-blocking, best-effort: ingest always succeeds even if edge extraction fails.
 */

import type { DatabaseAdapter } from '../../../database/adapters/DatabaseAdapter.js';

/** Context provided when a KB entry is ingested. */
export interface IngestEdgeContext {
  entryId: string;
  content: string;
  source?: string | null;
  tags?: string;
  type?: string;
}

/** An edge to be inserted into graph_edges. */
export interface IngestGraphEdge {
  source: string;
  target: string;
  label: string;
  weight: number;
}

/** Strategy interface for ingest-time edge extraction. */
export interface IngestEdgeStrategy {
  /** Extract edges from the ingest context against existing graph labels. */
  extract(ctx: IngestEdgeContext, existingNodes: NodeLabel[]): IngestGraphEdge[];
}

/** Minimal node info for matching references. */
export interface NodeLabel {
  entry_id: string;
  label: string;
}

// Patterns for entity detection
const TICKET_KEY_PATTERN = /\b([A-Z][A-Z0-9]+-\d+)\b/g;
const FILE_PATH_PATTERN = /(?:^|\s)([\w./-]+\.\w{1,5})\b/g;
const PASCAL_CASE_PATTERN = /\b([A-Z][a-z]+(?:[A-Z][a-z]+){1,})\b/g;

/** Extracts DISCUSSES edges from ticket key references (e.g. SA4E-91). */
export class TicketRefStrategy implements IngestEdgeStrategy {
  extract(ctx: IngestEdgeContext, existingNodes: NodeLabel[]): IngestGraphEdge[] {
    const matches = [...ctx.content.matchAll(TICKET_KEY_PATTERN)];
    if (matches.length === 0) return [];

    const ticketKeys = new Set(matches.map(m => m[1]));
    const edges: IngestGraphEdge[] = [];

    for (const key of ticketKeys) {
      const matched = existingNodes.find(n => n.label.includes(key));
      if (matched && matched.entry_id !== ctx.entryId) {
        edges.push({ source: ctx.entryId, target: matched.entry_id, label: 'DISCUSSES', weight: 0.5 });
      }
    }
    return edges;
  }
}

/** Extracts REFERENCES edges from file path references. */
export class FilePathRefStrategy implements IngestEdgeStrategy {
  extract(ctx: IngestEdgeContext, existingNodes: NodeLabel[]): IngestGraphEdge[] {
    const matches = [...ctx.content.matchAll(FILE_PATH_PATTERN)];
    if (matches.length === 0) return [];

    const paths = new Set(matches.map(m => m[1].trim()));
    const edges: IngestGraphEdge[] = [];

    for (const filePath of paths) {
      const matched = existingNodes.find(n => n.label.includes(filePath));
      if (matched && matched.entry_id !== ctx.entryId) {
        edges.push({ source: ctx.entryId, target: matched.entry_id, label: 'REFERENCES', weight: 0.6 });
      }
    }
    return edges;
  }
}

/** Extracts REFERENCES edges from PascalCase class/type name mentions. */
export class ClassNameRefStrategy implements IngestEdgeStrategy {
  extract(ctx: IngestEdgeContext, existingNodes: NodeLabel[]): IngestGraphEdge[] {
    const matches = [...ctx.content.matchAll(PASCAL_CASE_PATTERN)];
    if (matches.length === 0) return [];

    const names = new Set(matches.map(m => m[1]));
    const edges: IngestGraphEdge[] = [];

    for (const name of names) {
      const matched = existingNodes.find(n => n.label.startsWith(name));
      if (matched && matched.entry_id !== ctx.entryId) {
        edges.push({ source: ctx.entryId, target: matched.entry_id, label: 'REFERENCES', weight: 0.6 });
      }
    }
    return edges;
  }
}

/** Extracts BELONGS_TO edge from source field (links entry to its origin file node). */
export class BelongsToStrategy implements IngestEdgeStrategy {
  extract(ctx: IngestEdgeContext, existingNodes: NodeLabel[]): IngestGraphEdge[] {
    if (!ctx.source) return [];

    const matched = existingNodes.find(n => n.label.includes(ctx.source!));
    if (matched && matched.entry_id !== ctx.entryId) {
      return [{ source: ctx.entryId, target: matched.entry_id, label: 'BELONGS_TO', weight: 0.6 }];
    }
    return [];
  }
}

/** All ingest-edge strategies (Strategy pattern registry). */
const INGEST_STRATEGIES: IngestEdgeStrategy[] = [
  new TicketRefStrategy(),
  new FilePathRefStrategy(),
  new ClassNameRefStrategy(),
  new BelongsToStrategy(),
];

/**
 * Extract and insert edges after a KB entry is ingested.
 * Queries existing graph_nodes for label matching, then batch-inserts edges.
 * @returns Number of edges created.
 */
export async function extractAndInsertIngestEdges(
  adapter: DatabaseAdapter,
  ctx: IngestEdgeContext,
): Promise<number> {
  // Fetch a limited set of existing node labels for matching
  const existingNodes = await adapter.allAsync<NodeLabel>(
    `SELECT entry_id, label FROM graph_nodes LIMIT 2000`,
    [],
  );
  if (existingNodes.length === 0) return 0;

  const allEdges: IngestGraphEdge[] = [];
  for (const strategy of INGEST_STRATEGIES) {
    const edges = strategy.extract(ctx, existingNodes);
    allEdges.push(...edges);
  }

  if (allEdges.length === 0) return 0;
  return batchInsertIngestEdges(adapter, allEdges);
}

/** Insert edges in batch with ON CONFLICT DO NOTHING (idempotent). */
async function batchInsertIngestEdges(adapter: DatabaseAdapter, edges: IngestGraphEdge[]): Promise<number> {
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
