/**
 * PegaGraphProjector — Projects Pega rules into graph_nodes + creates dependency edges.
 * Extracted from PegaService to keep files ≤200 LOC.
 */
import type { DatabaseAdapter } from '../../database/adapters/DatabaseAdapter.js';
import type { UnresolvedDependency } from './models.js';
import { pxObjClassToGraphType } from './pega-utils.js';
import pino from 'pino';

const logger = pino({ name: 'pega-graph-projector' });

/**
 * Insert/update a graph node for an ingested Pega rule.
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
  const x = Math.floor(Math.random() * 400) - 200;
  const y = Math.floor(Math.random() * 400) - 200;

  const engine = adapter.getEngine();
  if (engine === 'postgresql') {
    await adapter.runAsync(
      `INSERT INTO graph_nodes (entry_id, label, type, tier, project_id, x, y, z, level, cluster_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (entry_id) DO UPDATE SET label = EXCLUDED.label, type = EXCLUDED.type`,
      [graphNodeId, fqn, graphType, 'SEMANTIC', projectId, x, y, 0, 0, 'pega-cluster'],
    );
  } else {
    await adapter.runAsync(
      `INSERT OR REPLACE INTO graph_nodes (entry_id, label, type, tier, project_id, x, y, z, level, cluster_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [graphNodeId, fqn, graphType, 'SEMANTIC', projectId, x, y, 0, 0, 'pega-cluster'],
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
    } catch (err) { logger.debug({ err, sourceNodeId, targetNodeId }, '[PegaGraphProjector] Edge insert failed (target node may not exist yet)'); }
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
