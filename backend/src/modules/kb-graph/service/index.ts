/**
 * SA4E-51 — GraphService: KB Graph operations backed by DatabaseAdapter.
 * SA4E-53: updated to async API for PostgreSQL compatibility.
 * Replaces the previous SqliteGraphService which used getAdminDb() directly.
 * Constructor accepts a DatabaseAdapter (injected by KBGraphModule) so the
 * correct engine is used at runtime.
 */

import type { Logger } from 'pino';
import type { DatabaseAdapter } from '../../../database/adapters/DatabaseAdapter.js';
import type { SpatialQueryParams, SpatialGraphResult, GraphNode } from './constants.js';
import { getKbEntryCount } from '../../../admin/admin-db.js';

export type { GraphNode, GraphEdge, SpatialQueryParams, SpatialGraphResult } from './constants.js';
export { LEVEL_MAP, KIND_TO_TYPE, graphTypeForKind } from './constants.js';
export * from './nodes.js';
export * from './spatial.js';
export * from './sync.js';

import * as nodes from './nodes.js';
import * as sync from './sync.js';
import * as spatial from './spatial.js';

/**
 * Facade over KB Graph helpers — all writes go through the injected adapter.
 * Rename: GraphService (alias SqliteGraphService kept for backward compat).
 */
export class GraphService {
  private readonly db: DatabaseAdapter;
  private readonly logger: Logger;
  private _ready = false;

  /**
   * @param db - DatabaseAdapter for graph_nodes / graph_edges
   * @param logger - Pino logger
   */
  constructor(db: DatabaseAdapter, logger: Logger) {
    this.db = db;
    this.logger = logger.child({ service: 'graph-service' });
  }

  get ready(): boolean { return this._ready; }

  /** Initialise: count existing nodes and trigger full sync if empty. SA4E-53: async. */
  async initialize(): Promise<void> {
    const graphCount = await nodes.getNodeCount(this.db);
    this._ready = true;
    if (graphCount === 0) {
      const kbCount = await getKbEntryCount();
      if (kbCount > 0) {
        // KB has entries but graph is empty — sync immediately
        this.logger.info({ kbCount }, 'Graph empty but KB has entries — starting full sync');
        await this.fullSync();
      } else {
        // Both empty at startup — schedule a delayed sync to catch documents indexed after startup
        this.logger.info('Graph and KB both empty at startup — scheduling delayed sync in 60s');
        setTimeout(() => {
          this.fullSync().catch(err =>
            this.logger.warn({ err }, 'Delayed graph sync failed'),
          );
        }, 60_000);
      }
    } else {
      this.logger.info({ existingNodes: graphCount }, 'Graph service ready');
    }
  }

  /**
   * Full sync from KB entries + code symbols.
   * @returns Counts of nodes and edges created plus breakdown by source type
   */
  async fullSync(): Promise<{ nodesCreated: number; edgesCreated: number; sources: Record<string, number> }> {
    const result = await sync.fullSync(this.db, this.logger);
    this._ready = true;
    return result;
  }

  /** @returns Current node count, optionally scoped to a project. SA4E-53: async. */
  async getNodeCount(projectId?: string): Promise<number> {
    return nodes.getNodeCount(this.db, projectId);
  }

  /**
   * Add a node; no-op if entry already exists. SA4E-53: async.
   * @returns The inserted or existing node
   */
  async addNode(entryId: string, label: string, type: string, tier: string, projectId = ''): Promise<GraphNode> {
    return nodes.addNode(entryId, label, type, tier, this.db, this.logger, projectId);
  }

  /** Remove a node and all its incident edges. SA4E-53: async. */
  async removeNode(entryId: string): Promise<void> {
    return nodes.removeNode(entryId, this.db);
  }

  /** @returns Node by ID or null. SA4E-53: async. */
  async getNode(entryId: string): Promise<GraphNode | null> {
    return nodes.getNode(entryId, this.db, this.logger);
  }

  /**
   * Insert a direct graph edge between two nodes. SA4E-53: async.
   * @param weight - Edge strength [0,1]
   * @param relType - Relationship label
   */
  async addEdge(source: string, target: string, weight = 0.5, relType = 'RELATED_TO'): Promise<void> {
    await this.db.runAsync(
      'INSERT INTO graph_edges (source, target, weight, rel_type) VALUES (?, ?, ?, ?) ON CONFLICT (source, target) DO NOTHING',
      [source, target, weight, relType],
    );
  }

  /** @returns All node positions (lightweight for 3D viewport load). SA4E-53: async. */
  async getAllPositions(projectId?: string) {
    return spatial.getAllPositions(this.db, projectId);
  }

  /** @returns Nodes + edges for current camera frustum. SA4E-53: async. */
  async spatialQuery(params: SpatialQueryParams, projectId?: string): Promise<SpatialGraphResult> {
    return spatial.spatialQuery(params, this.db, this.logger, projectId);
  }

  /**
   * Sync a pre-prepared entry list into the graph.
   * @param entries - Node descriptors to upsert
   * @param projectId - Default project ID
   */
  async syncFromEntries(
    entries: Array<{ id: string; label: string; type: string; tier: string; groupId?: number; projectId?: string }>,
    projectId = '',
  ): Promise<{ nodesCreated: number; edgesCreated: number }> {
    return await sync.syncFromEntries(entries, this.db, this.logger, projectId);
  }

  /** Compute Fibonacci-sphere position for a node by current graph state. SA4E-53: async. */
  async computePosition(index: number, type: string) {
    return nodes.computePosition(index, type, this.db);
  }

  /** Compute position by explicit group/count parameters (no DB reads). */
  computePositionByIndex(i: number, total: number, type: string, groupId: number, groupCount: number) {
    return nodes.computePositionByIndex(i, total, type, groupId, groupCount);
  }

  /** Trigger neighbourhood edge creation for an existing node. SA4E-53: async. */
  async autoCreateEdges(entryId: string, type: string, tier: string, projectId = ''): Promise<void> {
    return nodes.autoCreateEdges(entryId, type, tier, this.db, projectId);
  }

  /** Map a raw DB row to a typed GraphNode. */
  rowToNode(row: any): GraphNode {
    return nodes.rowToNode(row);
  }

  /** Search graph_nodes by label, type, or tier. SA4E-53: async. */
  async searchNodes(
    query?: string, type?: string, tier?: string,
    limit = 20, projectId?: string,
  ): Promise<GraphNode[]> {
    const clauses: string[] = [];
    const params: unknown[] = [];

    if (query) {
      clauses.push('(label LIKE ? OR entry_id LIKE ?)');
      params.push(`%${query}%`, `%${query}%`);
    }
    if (type) {
      clauses.push('type = ?');
      params.push(type.toUpperCase());
    }
    if (tier) {
      clauses.push('tier = ?');
      params.push(tier);
    }
    if (projectId) {
      clauses.push('project_id = ?');
      params.push(projectId);
    }

    const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
    const rows = await this.db.allAsync<any>(
      `SELECT * FROM graph_nodes ${where} ORDER BY label ASC LIMIT ?`,
      [...params, limit],
    );
    return rows.map(nodes.rowToNode);
  }

  /** Get edges where either endpoint is in the given node ID set. */
  async getEdgesForNodeIds(
    ids: string[], limit = 200,
  ): Promise<Array<{ source: string; target: string; weight: number; type: string }>> {
    if (ids.length === 0) return [];
    const placeholders = ids.map(() => '?').join(',');
    const rows = await this.db.allAsync<any>(
      `SELECT source, target, weight, rel_type FROM graph_edges
       WHERE source IN (${placeholders}) OR target IN (${placeholders}) LIMIT ?`,
      [...ids, ...ids, limit],
    );
    return rows.map(r => ({ source: r.source, target: r.target, weight: r.weight, type: r.rel_type }));
  }

  /** Load all edges from the graph into memory. */
  private async loadAllEdges(): Promise<Array<{ source: string; target: string; weight: number }>> {
    return this.db.allAsync<any>(
      'SELECT source, target, weight FROM graph_edges', [],
    ).then(rows => rows.map(r => ({ source: r.source, target: r.target, weight: r.weight })));
  }

  /**
   * Community detection via label propagation.
   * Returns clusters (community -> node IDs) sorted by size descending.
   * @param maxIterations - Max label propagation passes (default 20)
   * @param minClusterSize - Minimum nodes per cluster in output (default 2)
   */
  async detectCommunities(
    maxIterations = 20, minClusterSize = 2,
  ): Promise<Array<{ community: string; nodeCount: number; nodeIds: string[]; avgWeight: number }>> {
    const edges = await this.loadAllEdges();
    if (edges.length === 0) return [];

    const nodeSet = new Set<string>();
    const adjacency = new Map<string, Map<string, number>>();
    for (const e of edges) {
      nodeSet.add(e.source); nodeSet.add(e.target);
      if (!adjacency.has(e.source)) adjacency.set(e.source, new Map());
      if (!adjacency.has(e.target)) adjacency.set(e.target, new Map());
      adjacency.get(e.source)!.set(e.target, (adjacency.get(e.source)!.get(e.target) || 0) + e.weight);
      adjacency.get(e.target)!.set(e.source, (adjacency.get(e.target)!.get(e.source) || 0) + e.weight);
    }

    const nodes = Array.from(nodeSet);
    const labels = new Map<string, string>();
    for (const n of nodes) labels.set(n, n);

    for (let iter = 0; iter < maxIterations; iter++) {
      let changed = 0;
      for (const n of nodes) {
        const neighbors = adjacency.get(n);
        if (!neighbors || neighbors.size === 0) continue;
        const freq = new Map<string, number>();
        for (const [neighbor, w] of neighbors) {
          const lbl = labels.get(neighbor)!;
          freq.set(lbl, (freq.get(lbl) || 0) + w);
        }
        let bestLabel = labels.get(n)!;
        let bestCount = 0;
        for (const [lbl, count] of freq) {
          if (count > bestCount) { bestCount = count; bestLabel = lbl; }
        }
        if (bestLabel !== labels.get(n)) { labels.set(n, bestLabel); changed++; }
      }
      if (changed === 0) break;
    }

    const communities = new Map<string, { nodeIds: string[]; totalWeight: number; edgeCount: number }>();
    for (const n of nodes) {
      const lbl = labels.get(n)!;
      if (!communities.has(lbl)) communities.set(lbl, { nodeIds: [], totalWeight: 0, edgeCount: 0 });
      communities.get(lbl)!.nodeIds.push(n);
    }

    for (const e of edges) {
      const sl = labels.get(e.source);
      const tl = labels.get(e.target);
      if (sl && tl && sl === tl) {
        const c = communities.get(sl)!;
        c.totalWeight += e.weight;
        c.edgeCount++;
      }
    }

    return Array.from(communities.entries())
      .filter(([, c]) => c.nodeIds.length >= minClusterSize)
      .map(([community, c]) => ({
        community,
        nodeCount: c.nodeIds.length,
        nodeIds: c.nodeIds,
        avgWeight: c.edgeCount > 0 ? Math.round((c.totalWeight / c.edgeCount) * 100) / 100 : 0,
      }))
      .sort((a, b) => b.nodeCount - a.nodeCount);
  }

  /**
   * Simplified PageRank — iterative rank propagation over graph edges.
   * @param dampingFactor - Probability of following an edge vs teleporting (default 0.85)
   * @param maxIterations - Max iterations (default 20)
   * @param convergence - Stop when max rank change < this (default 0.001)
   * @param topN - Return only top-N nodes (default 20, 0 = all)
   */
  async computePageRank(
    dampingFactor = 0.85, maxIterations = 20, convergence = 0.001, topN = 20,
  ): Promise<Array<{ nodeId: string; rank: number; label: string; type: string }>> {
    const edges = await this.loadAllEdges();
    if (edges.length === 0) return [];

    const outDegree = new Map<string, number>();
    const inLinks = new Map<string, Map<string, number>>();
    const nodeSet = new Set<string>();

    for (const e of edges) {
      nodeSet.add(e.source); nodeSet.add(e.target);
      outDegree.set(e.source, (outDegree.get(e.source) || 0) + 1);
      if (!inLinks.has(e.target)) inLinks.set(e.target, new Map());
      inLinks.get(e.target)!.set(e.source, e.weight);
    }

    const nodes = Array.from(nodeSet);
    const N = nodes.length;
    const rank = new Map<string, number>();
    const teleport = (1 - dampingFactor) / N;

    for (const n of nodes) rank.set(n, 1 / N);

    for (let iter = 0; iter < maxIterations; iter++) {
      const newRank = new Map<string, number>();
      let maxDelta = 0;

      for (const n of nodes) {
        let sum = 0;
        const incoming = inLinks.get(n);
        if (incoming) {
          for (const [source, weight] of incoming) {
            const deg = outDegree.get(source) || 1;
            sum += (rank.get(source) || 0) * (weight / deg);
          }
        }
        const pr = teleport + dampingFactor * sum;
        newRank.set(n, pr);
        maxDelta = Math.max(maxDelta, Math.abs(pr - (rank.get(n) || 0)));
      }

      for (const [n, pr] of newRank) rank.set(n, pr);
      if (maxDelta < convergence) break;
    }

    const nodeRows = await this.db.allAsync<any>(
      'SELECT entry_id, label, type FROM graph_nodes', [],
    );
    const nodeMeta = new Map<string, { label: string; type: string }>();
    for (const r of nodeRows) nodeMeta.set(r.entry_id, { label: r.label, type: r.type });

    const ranked = Array.from(rank.entries())
      .map(([nodeId, pr]) => {
        const meta = nodeMeta.get(nodeId) || { label: nodeId, type: 'UNKNOWN' };
        return { nodeId, rank: Math.round(pr * 100000) / 100000, label: meta.label, type: meta.type };
      })
      .sort((a, b) => b.rank - a.rank);

    return topN > 0 ? ranked.slice(0, topN) : ranked;
  }

  /** Get graph summary statistics. */
  async getGraphStats(): Promise<{
    nodeCount: number; edgeCount: number; density: number;
    typeDistribution: Record<string, number>;
  }> {
    const nodeRow = await this.db.getAsync<{ cnt: number }>('SELECT COUNT(*) as cnt FROM graph_nodes');
    const edgeRow = await this.db.getAsync<{ cnt: number }>('SELECT COUNT(*) as cnt FROM graph_edges');
    const nodeCount = nodeRow?.cnt ?? 0;
    const edgeCount = edgeRow?.cnt ?? 0;
    const density = nodeCount > 1
      ? Math.round((edgeCount / (nodeCount * (nodeCount - 1) / 2)) * 100000) / 100000
      : 0;

    const typeRows = await this.db.allAsync<{ type: string; cnt: number }>(
      'SELECT type, COUNT(*) as cnt FROM graph_nodes GROUP BY type ORDER BY cnt DESC',
    );
    const typeDistribution: Record<string, number> = {};
    for (const r of typeRows) typeDistribution[r.type] = r.cnt;

    return { nodeCount, edgeCount, density, typeDistribution };
  }

  /**
   * Multi-agent graph merge — combine nodes/edges from multiple projects.
   * Returns a read-only merged graph view with conflict resolution notes.
   */
  async mergeGraph(
    projectIds: string[],
  ): Promise<{
    nodes: Array<any>;
    edges: Array<any>;
    stats: { totalNodes: number; totalEdges: number; projectCount: number; conflicts: number };
  }> {
    if (projectIds.length === 0) return { nodes: [], edges: [], stats: { totalNodes: 0, totalEdges: 0, projectCount: 0, conflicts: 0 } };

    const placeholders = projectIds.map(() => '?').join(',');
    const nodes = await this.db.allAsync<any>(
      `SELECT * FROM graph_nodes WHERE project_id IN (${placeholders}) ORDER BY label ASC`,
      projectIds,
    );

    const nodeIds = nodes.map((n: any) => n.entry_id);
    if (nodeIds.length === 0) {
      return { nodes: [], edges: [], stats: { totalNodes: 0, totalEdges: 0, projectCount: projectIds.length, conflicts: 0 } };
    }
    const edgePlaceholders = nodeIds.map(() => '?').join(',');
    const edges = await this.db.allAsync<any>(
      `SELECT * FROM graph_edges WHERE source IN (${edgePlaceholders}) OR target IN (${edgePlaceholders})`,
      [...nodeIds, ...nodeIds],
    );

    const labelProjects = new Map<string, Set<string>>();
    const conflicts = new Set<string>();
    for (const n of nodes) {
      if (!labelProjects.has(n.label)) labelProjects.set(n.label, new Set());
      labelProjects.get(n.label)!.add(n.project_id || '');
      if (labelProjects.get(n.label)!.size > 1) conflicts.add(n.label);
    }

    return {
      nodes: nodes.map((n: any) => this.rowToNode(n)),
      edges: edges.map((r: any) => ({ source: r.source, target: r.target, weight: r.weight, type: r.rel_type })),
      stats: {
        totalNodes: nodes.length,
        totalEdges: edges.length,
        projectCount: projectIds.length,
        conflicts: conflicts.size,
      },
    };
  }

  /**
   * Cross-tenant sync — create edges between matching nodes across two projects.
   */
  async crossSync(
    sourceProjectId: string,
    targetProjectId: string,
  ): Promise<{ edgesCreated: number; matches: number; sourceNodes: number; targetNodes: number }> {
    const sourceNodes = await this.db.allAsync<any>(
      'SELECT * FROM graph_nodes WHERE project_id = ?', [sourceProjectId],
    );
    const targetNodes = await this.db.allAsync<any>(
      'SELECT * FROM graph_nodes WHERE project_id = ?', [targetProjectId],
    );

    if (sourceNodes.length === 0 || targetNodes.length === 0) {
      return { edgesCreated: 0, matches: 0, sourceNodes: sourceNodes.length, targetNodes: targetNodes.length };
    }

    const targetByLabel = new Map<string, any[]>();
    for (const tn of targetNodes) {
      const key = tn.label.toLowerCase();
      if (!targetByLabel.has(key)) targetByLabel.set(key, []);
      targetByLabel.get(key)!.push(tn);
    }

    let edgesCreated = 0;
    let matches = 0;

    for (const sn of sourceNodes) {
      const key = sn.label.toLowerCase();
      const matches_target = targetByLabel.get(key);
      if (!matches_target) continue;
      for (const tn of matches_target) {
        if (sn.entry_id === tn.entry_id) continue;
        matches++;
        try {
          await this.db.runAsync(
            'INSERT INTO graph_edges (source, target, weight, rel_type) VALUES (?, ?, ?, ?) ON CONFLICT (source, target) DO NOTHING',
            [sn.entry_id, tn.entry_id, 0.8, 'CROSS_TENANT'],
          );
          edgesCreated++;
        } catch (err) { this.logger.debug({ err }, '[kb-graph] Cross-tenant edge insert failed (non-fatal)'); }
      }
    }

    return { edgesCreated, matches, sourceNodes: sourceNodes.length, targetNodes: targetNodes.length };
  }

  /**
   * Remove all cross-tenant edges between two projects.
   */
  async removeCrossEdges(projectIdA: string, projectIdB: string): Promise<{ removed: number }> {
    const aNodes = await this.db.allAsync<any>(
      'SELECT entry_id FROM graph_nodes WHERE project_id = ?', [projectIdA],
    );
    const bNodes = await this.db.allAsync<any>(
      'SELECT entry_id FROM graph_nodes WHERE project_id = ?', [projectIdB],
    );
    const aIds = aNodes.map((n: any) => n.entry_id);
    const bIds = bNodes.map((n: any) => n.entry_id);
    if (aIds.length === 0 || bIds.length === 0) return { removed: 0 };

    const aPH = aIds.map(() => '?').join(',');
    const bPH = bIds.map(() => '?').join(',');

    const result = await this.db.runAsync(
      `DELETE FROM graph_edges WHERE rel_type = 'CROSS_TENANT'
       AND ((source IN (${aPH}) AND target IN (${bPH})) OR (source IN (${bPH}) AND target IN (${aPH})))`,
      [...aIds, ...bIds, ...bIds, ...aIds],
    );
    return { removed: typeof result === 'object' && result !== null && 'changes' in result ? (result as any).changes : 0 };
  }
}

// Backward-compat alias — existing code that imports SqliteGraphService still compiles
export { GraphService as SqliteGraphService };


