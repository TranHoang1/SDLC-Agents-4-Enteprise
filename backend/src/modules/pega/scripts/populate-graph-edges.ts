/**
 * SA4E-87 — Parse .pega.json files and populate KB Graph edges.
 * Reads all rules from a directory, extracts relationships using
 * type-specific extractors, and batch-inserts edges into the graph.
 *
 * Idempotent: uses ON CONFLICT DO NOTHING via GraphService.addEdge.
 */

import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { ExtractedEdge } from './edge-extractors.js';
import { ALL_EXTRACTORS } from './edge-extractors.js';

/** Options for the edge population script. */
export interface PopulateOptions {
  rulesDir: string;
  dryRun?: boolean;
}

/** Statistics returned after processing. */
export interface PopulateStats {
  nodesProcessed: number;
  edgesCreated: number;
  errors: number;
  skipped: number;
}

/** Adapter interface for graph edge insertion (DIP). */
export interface GraphEdgeWriter {
  addEdge(source: string, target: string, weight: number, relType: string): Promise<void>;
}

/**
 * Discover all .pega.json files recursively in the given directory.
 * @param dir - Root directory to scan
 * @returns Array of absolute file paths
 */
async function discoverRuleFiles(dir: string): Promise<string[]> {
  const files: string[] = [];
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      const nested = await discoverRuleFiles(fullPath);
      files.push(...nested);
    } else if (entry.name.endsWith('.pega.json')) {
      files.push(fullPath);
    }
  }
  return files;
}

/**
 * Parse a single .pega.json file safely.
 * @returns Parsed JSON or null if malformed.
 */
async function parseRuleFile(filePath: string): Promise<Record<string, unknown> | null> {
  try {
    const raw = await readFile(filePath, 'utf-8');
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * Extract all edges from a single rule JSON using registered extractors.
 * @param json - Parsed rule content
 * @returns Deduplicated edge list
 */
function extractEdgesFromRule(json: Record<string, unknown>): ExtractedEdge[] {
  const pxObjClass = (json.pxObjClass as string) || '';
  if (!pxObjClass) return [];

  const edges: ExtractedEdge[] = [];
  const seen = new Set<string>();

  for (const extractor of ALL_EXTRACTORS) {
    if (!extractor.supports(pxObjClass)) continue;
    const extracted = extractor.extract(json);
    for (const edge of extracted) {
      // Deduplicate within same rule
      const key = `${edge.sourceId}→${edge.targetId}→${edge.label}`;
      if (seen.has(key)) continue;
      seen.add(key);
      edges.push(edge);
    }
  }
  return edges;
}

/**
 * Insert edges in batches via the graph writer.
 * @param edges - All extracted edges to insert
 * @param writer - GraphEdgeWriter implementation
 * @returns Number of edges successfully written
 */
async function batchInsertEdges(
  edges: ExtractedEdge[], writer: GraphEdgeWriter,
): Promise<{ created: number; errors: number }> {
  let created = 0;
  let errors = 0;
  // Process in batches of 200 for optimal throughput
  const BATCH_SIZE = 200;
  for (let i = 0; i < edges.length; i += BATCH_SIZE) {
    const batch = edges.slice(i, i + BATCH_SIZE);
    for (const edge of batch) {
      try {
        await writer.addEdge(edge.sourceId, edge.targetId, edge.weight, edge.label);
        created++;
      } catch {
        errors++;
      }
    }
  }
  return { created, errors };
}

/**
 * Main entry point — parse .pega.json rules and populate KB Graph edges.
 * @param options - Configuration: rulesDir path and optional dryRun flag
 * @param writer - GraphEdgeWriter for inserting edges (injected dependency)
 * @returns Statistics about processing results
 */
export async function populateGraphEdges(
  options: PopulateOptions,
  writer: GraphEdgeWriter,
): Promise<PopulateStats> {
  const { rulesDir, dryRun = false } = options;
  const stats: PopulateStats = { nodesProcessed: 0, edgesCreated: 0, errors: 0, skipped: 0 };

  const filePaths = await discoverRuleFiles(rulesDir);
  const allEdges: ExtractedEdge[] = [];

  for (const filePath of filePaths) {
    const json = await parseRuleFile(filePath);
    if (!json) {
      stats.skipped++;
      continue;
    }
    stats.nodesProcessed++;
    const edges = extractEdgesFromRule(json);
    allEdges.push(...edges);
  }

  if (dryRun) {
    stats.edgesCreated = allEdges.length;
    return stats;
  }

  const result = await batchInsertEdges(allEdges, writer);
  stats.edgesCreated = result.created;
  stats.errors = result.errors;
  return stats;
}
