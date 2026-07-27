/**
 * SA4E-51 — KB Graph Module.
 * Passes getAdminAdapter() to GraphService so graph_nodes/graph_edges
 * are stored in the active engine (SQLite or PostgreSQL), not hardcoded SQLite.
 */

import type { IModule, ModuleStatus } from '../../types/module.js';
import type { ToolHandler, ToolDefinition } from '../../types/tool.js';
import type { Logger } from 'pino';
import { getAdminAdapter } from '../../admin/db/core.js';
import { GraphService } from './service/index.js';

export class KBGraphModule implements IModule {
  readonly name = 'kbGraph';
  private _status: ModuleStatus = 'initializing';
  private readonly logger: Logger;
  private readonly graphService: GraphService;

  /**
   * @param logger - Pino logger; child logger scoped to module name is created internally
   */
  constructor(logger: Logger) {
    this.logger = logger.child({ module: this.name });
    // DIP: inject DatabaseAdapter so GraphService is engine-agnostic
    this.graphService = new GraphService(getAdminAdapter(), this.logger);
  }

  get status(): ModuleStatus { return this._status; }

  async initialize(): Promise<void> {
    this.logger.info('Initializing KB graph module');
    await this.graphService.initialize();
    // Expose globally for admin routes spatial endpoint
    (globalThis as any).__sqliteGraphService = this.graphService;
    this._status = 'ready';
  }

  async shutdown(): Promise<void> {
    this._status = 'stopped';
  }

  getToolHandlers(): Map<string, ToolHandler> {
    const handlers = new Map<string, ToolHandler>();

    handlers.set('kb_graph_query', async (args) => {
      const query = args.query as string | undefined;
      const type = args.type as string | undefined;
      const tier = args.tier as string | undefined;
      const limit = (args.limit as number) || 20;
      const projectId = (args.project_id as string) || (args.__projectId as string) || undefined;

      try {
        const nodes = await this.graphService.searchNodes(query, type, tier, limit, projectId);
        const nodeIds = nodes.map(n => n.id);
        const edges = await this.graphService.getEdgesForNodeIds(nodeIds);
        return {
          content: [{ type: 'text', text: JSON.stringify({
            nodes, edges, query: query ?? null,
            stats: { nodeCount: nodes.length, edgeCount: edges.length },
          }) }],
          isError: false,
        };
      } catch (err: any) {
        this.logger.error({ err: err.message, query }, 'kb_graph_query failed');
        return {
          content: [{ type: 'text', text: JSON.stringify({ error: err.message, nodes: [], edges: [] }) }],
          isError: true,
        };
      }
    });

    handlers.set('kb_graph_add_node', async (args) => {
      const label = args.label as string || args.title as string || '';
      const type = (args.type as string) || 'CONTEXT';
      const tier = (args.tier as string) || 'SHARED';
      const entryId = (args.entry_id as string) || `custom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const projectId = (args.project_id as string) || '';

      try {
        const node = await this.graphService.addNode(entryId, label, type, tier, projectId);
        return {
          content: [{ type: 'text', text: JSON.stringify({ status: 'added', node }) }],
          isError: false,
        };
      } catch (err: any) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ error: err.message }) }],
          isError: true,
        };
      }
    });

    handlers.set('kb_graph_add_edge', async (args) => {
      const source = args.source as string || args.from as string || '';
      const target = args.target as string || args.to as string || '';
      if (!source || !target) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ error: 'source and target are required' }) }],
          isError: true,
        };
      }
      const weight = (args.weight as number) ?? 0.5;
      const relType = (args.relation as string) || (args.rel_type as string) || 'RELATED_TO';

      try {
        await this.graphService.addEdge(source, target, weight, relType);
        return {
          content: [{ type: 'text', text: JSON.stringify({ status: 'added', source, target, relType }) }],
          isError: false,
        };
      } catch (err: any) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ error: err.message }) }],
          isError: true,
        };
      }
    });

    handlers.set('kb_graph_community', async (args) => {
      const maxIterations = (args.max_iterations as number) || 20;
      const minClusterSize = (args.min_cluster_size as number) || 2;

      try {
        const communities = await this.graphService.detectCommunities(maxIterations, minClusterSize);
        return {
          content: [{ type: 'text', text: JSON.stringify({
            communities,
            totalClusters: communities.length,
            totalNodes: communities.reduce((s, c) => s + c.nodeCount, 0),
          }) }],
          isError: false,
        };
      } catch (err: any) {
        this.logger.error({ err: err.message }, 'kb_graph_community failed');
        return {
          content: [{ type: 'text', text: JSON.stringify({ error: err.message, communities: [] }) }],
          isError: true,
        };
      }
    });

    handlers.set('kb_graph_pagerank', async (args) => {
      const topN = (args.top_n as number) || 20;
      const dampingFactor = (args.damping_factor as number) ?? 0.85;
      const maxIterations = (args.max_iterations as number) || 20;

      try {
        const ranked = await this.graphService.computePageRank(dampingFactor, maxIterations, 0.001, topN);
        return {
          content: [{ type: 'text', text: JSON.stringify({
            ranked,
            topN: ranked.length,
          }) }],
          isError: false,
        };
      } catch (err: any) {
        this.logger.error({ err: err.message }, 'kb_graph_pagerank failed');
        return {
          content: [{ type: 'text', text: JSON.stringify({ error: err.message, ranked: [] }) }],
          isError: true,
        };
      }
    });

    handlers.set('kb_graph_merge', async (args) => {
      const projectIds = args.project_ids as string[] || [];
      try {
        const result = await this.graphService.mergeGraph(projectIds);
        return {
          content: [{ type: 'text', text: JSON.stringify(result) }],
          isError: false,
        };
      } catch (err: any) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ error: err.message }) }],
          isError: true,
        };
      }
    });

    handlers.set('kb_graph_cross_sync', async (args) => {
      const source = args.source_project_id as string || '';
      const target = args.target_project_id as string || '';
      if (!source || !target) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ error: 'source_project_id and target_project_id are required' }) }],
          isError: true,
        };
      }
      try {
        const result = await this.graphService.crossSync(source, target);
        return {
          content: [{ type: 'text', text: JSON.stringify(result) }],
          isError: false,
        };
      } catch (err: any) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ error: err.message }) }],
          isError: true,
        };
      }
    });

    handlers.set('kb_graph_remove_cross', async (args) => {
      const a = args.project_a as string || '';
      const b = args.project_b as string || '';
      if (!a || !b) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ error: 'project_a and project_b are required' }) }],
          isError: true,
        };
      }
      try {
        const result = await this.graphService.removeCrossEdges(a, b);
        return {
          content: [{ type: 'text', text: JSON.stringify(result) }],
          isError: false,
        };
      } catch (err: any) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ error: err.message }) }],
          isError: true,
        };
      }
    });

    handlers.set('kb_graph_stats', async () => {
      try {
        const stats = await this.graphService.getGraphStats();
        return {
          content: [{ type: 'text', text: JSON.stringify(stats) }],
          isError: false,
        };
      } catch (err: any) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ error: err.message }) }],
          isError: true,
        };
      }
    });

    return handlers;
  }

  getToolDefinitions(): ToolDefinition[] {
    return [
      {
        name: 'kb_graph_query',
        description: 'Query the knowledge base graph — search by label, type, or tier',
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Fuzzy search label or entry_id' },
            type: { type: 'string', description: 'Filter by node type (FUNCTION, CLASS, DOCUMENT, etc.)' },
            tier: { type: 'string', description: 'Filter by tier (CODE, SHARED, etc.)' },
            limit: { type: 'number', description: 'Max results (default 20)' },
            project_id: { type: 'string' },
          },
        },
        category: 'kb-graph',
      },
      {
        name: 'kb_graph_add_node',
        description: 'Add a node to the KB graph — auto-creates position and type/tier edges',
        inputSchema: {
          type: 'object',
          properties: {
            label: { type: 'string', description: 'Display label (max 50 chars)' },
            type: { type: 'string', description: 'Node type (CLASS, FUNCTION, DOCUMENT, CONTEXT, etc.)' },
            tier: { type: 'string', description: 'Tier (SHARED, CODE, etc.)' },
            entry_id: { type: 'string', description: 'Unique ID (auto-generated if omitted)' },
            project_id: { type: 'string' },
          },
          required: ['label'],
        },
        category: 'kb-graph',
      },
      {
        name: 'kb_graph_add_edge',
        description: 'Add an edge between KB graph nodes',
        inputSchema: {
          type: 'object',
          properties: {
            source: { type: 'string', description: 'Source node entry_id' },
            target: { type: 'string', description: 'Target node entry_id' },
            relation: { type: 'string', description: 'Relationship label (default: RELATED_TO)' },
            weight: { type: 'number', description: 'Edge strength 0-1 (default 0.5)' },
          },
          required: ['source', 'target'],
        },
        category: 'kb-graph',
      },
      {
        name: 'kb_graph_community',
        description: 'Detect communities/clusters in the KB graph using label propagation. Returns groups of densely connected nodes.',
        inputSchema: {
          type: 'object',
          properties: {
            max_iterations: { type: 'number', description: 'Max label propagation passes (default 20)' },
            min_cluster_size: { type: 'number', description: 'Minimum nodes per cluster (default 2)' },
          },
        },
        category: 'kb-graph',
      },
      {
        name: 'kb_graph_pagerank',
        description: 'Compute PageRank scores for all graph nodes. Returns top-N nodes ranked by importance.',
        inputSchema: {
          type: 'object',
          properties: {
            top_n: { type: 'number', description: 'Return top N nodes (default 20, 0 = all)' },
            damping_factor: { type: 'number', description: 'Probability of following edges (default 0.85)' },
            max_iterations: { type: 'number', description: 'Max iterations (default 20)' },
          },
        },
        category: 'kb-graph',
      },
      {
        name: 'kb_graph_merge',
        description: 'Multi-agent graph merge — combine nodes/edges from multiple projects. Returns merged view with conflict detection.',
        inputSchema: {
          type: 'object',
          properties: {
            project_ids: { type: 'array', items: { type: 'string' }, description: 'Project IDs to merge' },
          },
          required: ['project_ids'],
        },
        category: 'kb-graph',
      },
      {
        name: 'kb_graph_cross_sync',
        description: 'Cross-tenant sync — create CROSS_TENANT edges between matching nodes across two projects.',
        inputSchema: {
          type: 'object',
          properties: {
            source_project_id: { type: 'string', description: 'Source project ID' },
            target_project_id: { type: 'string', description: 'Target project ID' },
          },
          required: ['source_project_id', 'target_project_id'],
        },
        category: 'kb-graph',
      },
      {
        name: 'kb_graph_remove_cross',
        description: 'Remove all CROSS_TENANT edges between two projects.',
        inputSchema: {
          type: 'object',
          properties: {
            project_a: { type: 'string', description: 'First project ID' },
            project_b: { type: 'string', description: 'Second project ID' },
          },
          required: ['project_a', 'project_b'],
        },
        category: 'kb-graph',
      },
      {
        name: 'kb_graph_stats',
        description: 'Get KB graph summary statistics: node/edge count, density, type distribution.',
        inputSchema: { type: 'object', properties: {} },
        category: 'kb-graph',
      },
    ];
  }
}
