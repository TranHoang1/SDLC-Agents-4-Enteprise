/**
 * SA4E-88 — PegaIndexerTool: MCP tool handler for full/incremental
 * indexing of .pega.json rules into the KB Graph (nodes + edges).
 * Runs on-demand or at workspace open to build/update the knowledge graph.
 */

import { join, relative } from 'node:path';
import type { Logger } from 'pino';
import {
  loadHashCache, saveHashCache, compareFileHash, computeHash,
  type HashCacheData,
} from './PegaHashCache.js';
import {
  discoverRuleFiles, readFileSafe,
  buildNodeId, ruleClassToNodeType, buildNodeLabel, extractEdgesFromRule,
} from './PegaIndexerHelpers.js';

/** Adapter interface for graph node insertion (DIP). */
export interface GraphNodeWriter {
  addNode(entryId: string, label: string, type: string, tier: string, projectId: string): Promise<void>;
}

/** Adapter interface for graph edge insertion (DIP). */
export interface GraphEdgeWriter {
  addEdge(source: string, target: string, weight: number, relType: string): Promise<void>;
}

/** Adapter combining both graph write capabilities. */
export interface GraphWriter extends GraphNodeWriter, GraphEdgeWriter {
  removeNodesByPrefix(prefix: string): Promise<void>;
}

/** Input arguments for the pega_index_workspace tool. */
export interface IndexWorkspaceArgs {
  mode?: 'full' | 'incremental';
  rules_dir?: string;
}

/** Statistics returned after indexing completes. */
export interface IndexStats {
  filesScanned: number;
  filesChanged: number;
  nodesCreated: number;
  nodesUpdated: number;
  edgesCreated: number;
  errors: number;
  duration_ms: number;
}

/** Structured response from the indexer tool. */
export interface IndexResult {
  status: 'completed' | 'error';
  mode: 'full' | 'incremental';
  stats: IndexStats;
  error?: string;
}

/**
 * PegaIndexerTool — orchestrates full or incremental indexing of Pega rules.
 * Uses Strategy pattern via injected GraphWriter for graph operations.
 */
export class PegaIndexerTool {
  constructor(
    private readonly graphWriter: GraphWriter,
    private readonly logger: Logger,
  ) {}

  /**
   * Execute the indexing operation.
   * @param args - Tool input (mode, rules_dir)
   * @param workspaceRoot - Workspace root for hash cache location
   * @returns Structured result with stats
   */
  async execute(args: IndexWorkspaceArgs, workspaceRoot: string): Promise<IndexResult> {
    const mode = args.mode || 'incremental';
    const rulesDir = args.rules_dir || join(workspaceRoot, 'rules');
    const start = Date.now();
    const stats = this.createEmptyStats();

    try {
      const filePaths = await discoverRuleFiles(rulesDir);
      stats.filesScanned = filePaths.length;

      if (mode === 'full') {
        await this.fullIndex(filePaths, rulesDir, workspaceRoot, stats);
      } else {
        await this.incrementalIndex(filePaths, rulesDir, workspaceRoot, stats);
      }

      stats.duration_ms = Date.now() - start;
      return { status: 'completed', mode, stats };
    } catch (err: any) {
      stats.duration_ms = Date.now() - start;
      this.logger.error({ err: err.message }, 'pega_index_workspace failed');
      return { status: 'error', mode, stats, error: err.message };
    }
  }

  private createEmptyStats(): IndexStats {
    return {
      filesScanned: 0, filesChanged: 0, nodesCreated: 0,
      nodesUpdated: 0, edgesCreated: 0, errors: 0, duration_ms: 0,
    };
  }

  /** Full re-index: clear existing pega nodes, re-parse all files. */
  private async fullIndex(
    filePaths: string[], rulesDir: string,
    workspaceRoot: string, stats: IndexStats,
  ): Promise<void> {
    await this.graphWriter.removeNodesByPrefix('pega::');
    const cache: HashCacheData = { version: 1, entries: {} };

    for (const filePath of filePaths) {
      const relPath = relative(rulesDir, filePath);
      const hash = await this.processFile(filePath, stats);
      if (hash) cache.entries[relPath] = hash;
    }

    await saveHashCache(workspaceRoot, cache);
  }

  /** Incremental index: only process files whose hash changed. */
  private async incrementalIndex(
    filePaths: string[], rulesDir: string,
    workspaceRoot: string, stats: IndexStats,
  ): Promise<void> {
    const cache = await loadHashCache(workspaceRoot);

    for (const filePath of filePaths) {
      const relPath = relative(rulesDir, filePath);
      const content = await readFileSafe(filePath);
      if (!content) { stats.errors++; continue; }

      const cmp = compareFileHash(relPath, content, cache);
      if (!cmp.changed) continue;

      stats.filesChanged++;
      const ok = await this.indexContent(content, stats);
      if (ok) cache.entries[relPath] = cmp.hash;
    }

    await saveHashCache(workspaceRoot, cache);
  }

  /** Read file, compute hash, index content. Returns hash on success. */
  private async processFile(filePath: string, stats: IndexStats): Promise<string | null> {
    const content = await readFileSafe(filePath);
    if (!content) { stats.errors++; return null; }
    stats.filesChanged++;
    const ok = await this.indexContent(content, stats);
    return ok ? computeHash(content) : null;
  }

  /** Parse JSON and insert node + edges into graph. */
  private async indexContent(content: string, stats: IndexStats): Promise<boolean> {
    let json: Record<string, unknown>;
    try { json = JSON.parse(content); } catch { stats.errors++; return false; }

    const pxObjClass = (json.pxObjClass as string) || '';
    if (!pxObjClass) { stats.errors++; return false; }

    await this.insertNode(json, pxObjClass, stats);
    await this.insertEdges(json, stats);
    return true;
  }

  /** Insert a single graph node for a rule. */
  private async insertNode(
    json: Record<string, unknown>, pxObjClass: string, stats: IndexStats,
  ): Promise<void> {
    const nodeId = `pega::${buildNodeId(json)}`;
    const nodeType = ruleClassToNodeType(pxObjClass);
    const label = buildNodeLabel(json);
    try {
      await this.graphWriter.addNode(nodeId, label, nodeType, 'PEGA', '');
      stats.nodesCreated++;
    } catch {
      stats.nodesUpdated++;
    }
  }

  /** Insert all extracted edges for a rule. */
  private async insertEdges(
    json: Record<string, unknown>, stats: IndexStats,
  ): Promise<void> {
    const edges = extractEdgesFromRule(json);
    for (const edge of edges) {
      try {
        await this.graphWriter.addEdge(
          `pega::${edge.sourceId}`, `pega::${edge.targetId}`,
          edge.weight, edge.label,
        );
        stats.edgesCreated++;
      } catch {
        // Edge conflict or dangling target — non-fatal
      }
    }
  }
}
