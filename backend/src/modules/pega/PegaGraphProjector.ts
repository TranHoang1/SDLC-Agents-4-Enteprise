/**
 * PegaGraphProjector — Projects Pega rules into graph_nodes + creates dependency edges.
 * SA4E-97: Uses computePositionByIndex() with Records tree categories for
 * hierarchical 3D layout instead of flat random placement.
 */
import type { DatabaseAdapter } from '../../database/adapters/DatabaseAdapter.js';
import type { UnresolvedDependency } from './models.js';
import { pxObjClassToGraphType } from './pega-utils.js';
import { computePositionByIndex } from '../kb-graph/service/nodes.js';

/**
 * 16 Pega Records tree categories — each maps to a cluster on the Fibonacci sphere.
 * Order determines groupId (0..15) for spatial positioning.
 */
const PEGA_CATEGORIES = [
  'APPLICATION_DEFINITION', 'DATA_MODEL', 'DECISION', 'GENERATIVE_AI',
  'INTEGRATION_CONNECTORS', 'INTEGRATION_MAPPING', 'INTEGRATION_RESOURCES',
  'INTEGRATION_SERVICES', 'ORGANIZATION', 'PROCESS', 'REPORTS',
  'SECURITY', 'SURVEY', 'SYSADMIN', 'TECHNICAL', 'USER_INTERFACE',
] as const;

/** Per-category counters for assigning intra-cluster index. */
const categoryCounters = new Map<string, number>();

/** Get the groupId for a graph type (category), defaulting to TECHNICAL. */
function getCategoryGroupId(graphType: string): number {
  const idx = PEGA_CATEGORIES.indexOf(graphType as typeof PEGA_CATEGORIES[number]);
  return idx >= 0 ? idx : PEGA_CATEGORIES.indexOf('TECHNICAL');
}

/**
 * Insert/update a graph node for an ingested Pega rule.
 * SA4E-97: Positions nodes using Fibonacci sphere with category-based clustering.
 * @returns The graph node ID (pega:{fqn}).
 */
export async function projectRuleToGraphNode(
  adapter: DatabaseAdapter,
  fqn: string,
  pxObjClass: string,
  projectId: string,
): Promise<string> {
  const graphNodeId = `pega:${fqn}`;
  const graphType = pxObjClassToGraphType(pxObjClass);

  // SA4E-97: Compute hierarchical position by category cluster
  const groupId = getCategoryGroupId(graphType);
  const intraIndex = categoryCounters.get(graphType) ?? 0;
  categoryCounters.set(graphType, intraIndex + 1);
  const pos = computePositionByIndex(
    intraIndex, 200, graphType, groupId, PEGA_CATEGORIES.length,
  );

  const engine = adapter.getEngine();
  if (engine === 'postgresql') {
    await adapter.runAsync(
      `INSERT INTO graph_nodes (entry_id, label, type, tier, project_id, x, y, z, level, cluster_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (entry_id) DO UPDATE SET label = EXCLUDED.label, type = EXCLUDED.type,
         x = EXCLUDED.x, y = EXCLUDED.y, z = EXCLUDED.z, level = EXCLUDED.level, cluster_id = EXCLUDED.cluster_id`,
      [graphNodeId, fqn, graphType, 'SEMANTIC', projectId, pos.x, pos.y, pos.z, pos.level, pos.clusterId],
    );
  } else {
    await adapter.runAsync(
      `INSERT OR REPLACE INTO graph_nodes (entry_id, label, type, tier, project_id, x, y, z, level, cluster_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [graphNodeId, fqn, graphType, 'SEMANTIC', projectId, pos.x, pos.y, pos.z, pos.level, pos.clusterId],
    );
  }
  return graphNodeId;
}

/**
 * Create graph edges from a rule node to its extracted dependencies.
 * Uses ON CONFLICT DO NOTHING for idempotency — target node may not exist yet.
 */
export async function createDependencyEdges(
  adapter: DatabaseAdapter,
  sourceNodeId: string,
  deps: UnresolvedDependency[],
): Promise<void> {
  if (deps.length === 0) return;
  const sql = adapter.getEngine() === 'sqlite'
    ? `INSERT OR IGNORE INTO graph_edges (source, target, weight, rel_type) VALUES (?, ?, ?, ?)`
    : `INSERT INTO graph_edges (source, target, weight, rel_type) VALUES ($1, $2, $3, $4) ON CONFLICT (source, target) DO NOTHING`;

  for (const dep of deps) {
    const targetFqn = `${dep.ruleType}:${dep.className}:${dep.ruleName}`;
    const targetNodeId = `pega:${targetFqn}`;
    const relType = mapDependencyRelType(dep.ruleType);
    try {
      await adapter.runAsync(sql, [sourceNodeId, targetNodeId, 0.7, relType]);
    } catch { /* non-fatal — target node may not exist yet */ }
  }
}

/** Map Pega rule type to relationship type for graph edges. */
function mapDependencyRelType(ruleType: string): string {
  if (ruleType.includes('Activity') || ruleType.includes('Flow')) return 'CALLS';
  if (ruleType.includes('Class')) return 'INHERITS';
  if (ruleType.includes('Property')) return 'HAS_PROPERTY';
  if (ruleType.includes('Connect')) return 'CONNECTS_TO';
  if (ruleType.includes('Decision') || ruleType.includes('When')) return 'EVALUATES';
  return 'USES';
}
