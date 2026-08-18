/**
 * SA4E-89 — Graph Fallback for mem_search.
 * When BM25/vector search returns 0 results AND query matches Pega patterns,
 * auto-fallback to kb_graph_query (label match) + expand neighbors.
 * Transparent to caller — results flagged with source: "graph_fallback".
 */

import type { GraphService } from '../../kb-graph/service/index.js';
import type { GraphNode } from '../../kb-graph/service/constants.js';
import pino from 'pino';

const logger = pino({ name: 'graph-fallback' });

/** Patterns indicating a query targets Pega rule knowledge. */
const PEGA_PATTERNS: RegExp[] = [
  /Rule-Obj-/i,
  /Work-/,
  /Data-/,
  /^[A-Z][a-z]+[A-Z]/,   // PascalCase (Activity/Flow names)
  /pega/i,
  /\.py[A-Z]/,            // Pega property pattern (.pyLabel, .pyID)
];

/** Result shape returned by graph fallback — compatible with search output. */
export interface GraphFallbackResult {
  id: string;
  content: string;
  summary: string;
  type: string;
  source: string;
  tags: string;
  score: number;
  created_at: string;
}

/**
 * Detect if query likely targets Pega rule knowledge.
 * Used to gate graph fallback — avoids unnecessary graph queries for general searches.
 */
export function isPegaQuery(query: string): boolean {
  return PEGA_PATTERNS.some(p => p.test(query));
}

/**
 * Infer graph node type from query string for narrower graph search.
 * Matches GraphSyncService.nodeTypeFor() graph types (pega_* → uppercase, no prefix).
 * Returns undefined if type cannot be inferred (search all types).
 */
export function inferNodeType(query: string): string | undefined {
  if (/Rule-Obj-Activity/i.test(query)) return 'ACTIVITY';
  if (/Rule-Obj-Flow/i.test(query)) return 'FLOW';
  if (/Rule-Obj-Decision/i.test(query)) return 'DECISION_TABLE';
  if (/Work-|Data-/i.test(query)) return 'CLASS';
  if (/\.py[A-Z]/i.test(query)) return 'PROPERTY';
  return undefined;
}

/** Convert a GraphNode to the fallback result format. */
export function graphNodeToResult(node: GraphNode): GraphFallbackResult {
  return {
    id: node.id,
    content: `[Graph Node] ${node.label} (${node.type})`,
    summary: node.label,
    type: node.type || 'CODE_ENTITY',
    source: 'graph_fallback',
    tags: `pega,graph,${node.type.toLowerCase()}`,
    score: 0.5,
    created_at: new Date().toISOString(),
  };
}

/**
 * Execute graph fallback: search nodes by label, expand 1-hop neighbors.
 * @returns Formatted results or empty array if graph service unavailable.
 */
export async function executeGraphFallback(
  query: string,
  limit = 10,
): Promise<GraphFallbackResult[]> {
  const graphService = getGraphService();
  if (!graphService) {
    logger.debug('Graph service unavailable — skipping fallback');
    return [];
  }

  try {
    const type = inferNodeType(query);
    const nodes = await graphService.searchNodes(query, type, undefined, limit);
    if (nodes.length === 0) return [];

    // Expand 1-hop neighbors for richer context
    const nodeIds = nodes.map(n => n.id);
    const edges = await graphService.getEdgesForNodeIds(nodeIds, 50);
    const neighborIds = extractNeighborIds(edges, nodeIds);
    const neighbors = await fetchNeighborNodes(graphService, neighborIds);

    // Combine: direct matches + neighbors (deduped)
    const seen = new Set(nodeIds);
    const results = nodes.map(graphNodeToResult);

    for (const neighbor of neighbors) {
      if (!seen.has(neighbor.id)) {
        seen.add(neighbor.id);
        const result = graphNodeToResult(neighbor);
        result.score = 0.3; // Neighbors score lower than direct matches
        results.push(result);
      }
    }

    logger.info({ query, directHits: nodes.length, neighbors: neighbors.length },
      'Graph fallback returned results');
    return results;
  } catch (err: any) {
    logger.warn({ err: err.message, query }, 'Graph fallback failed (non-fatal)');
    return [];
  }
}

/** Extract unique neighbor entry_ids not already in the direct hit set. */
function extractNeighborIds(
  edges: Array<{ source: string; target: string }>,
  directIds: string[],
): string[] {
  const directSet = new Set(directIds);
  const neighborSet = new Set<string>();
  for (const edge of edges) {
    if (!directSet.has(edge.source)) neighborSet.add(edge.source);
    if (!directSet.has(edge.target)) neighborSet.add(edge.target);
  }
  return Array.from(neighborSet).slice(0, 20);
}

/** Fetch neighbor nodes by their entry_ids. */
async function fetchNeighborNodes(
  graphService: GraphService,
  neighborIds: string[],
): Promise<GraphNode[]> {
  if (neighborIds.length === 0) return [];
  // Use searchNodes with each ID — batch via label search
  // More efficient: query all at once by entry_id pattern
  return graphService.searchNodes(
    undefined, undefined, undefined, neighborIds.length,
  ).then(allNodes =>
    allNodes.filter(n => neighborIds.includes(n.id)),
  );
}

/** Retrieve GraphService from globalThis (set by KBGraphModule on init). */
function getGraphService(): GraphService | null {
  return (globalThis as any).__sqliteGraphService ?? null;
}
