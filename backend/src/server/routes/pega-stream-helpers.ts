/**
 * Helper functions for pega-stream route — DB queries and project registration.
 * Extracted to keep route file ≤ 200 lines (SRP compliance).
 */

import type { PegaService } from '../../modules/pega/PegaService.js';

/** Aggregate totals from the knowledge database */
export interface PegaDbTotals {
  totalRulesInDb: number;
  totalKbEntriesInDb: number;
  totalGraphNodesInDb: number;
}

/** Query aggregate totals from the database for a given project */
export async function queryPegaTotals(service: PegaService, projectId: string): Promise<PegaDbTotals> {
  let totalRulesInDb = 0;
  let totalKbEntriesInDb = 0;
  let totalGraphNodesInDb = 0;

  try {
    const adapter = (service as any).memoryEngine.getAdapter();

    const rowRules = await adapter.getAsync(
      "SELECT COUNT(DISTINCT source) as cnt FROM knowledge_entries WHERE project_id = $1 AND type IN ('PEGA_RULE', 'PEGA_DATA')",
      [projectId],
    ) as { cnt?: number } | undefined;
    if (rowRules?.cnt) totalRulesInDb = Number(rowRules.cnt);

    const rowKb = await adapter.getAsync(
      "SELECT COUNT(*) as cnt FROM knowledge_entries WHERE project_id = $1",
      [projectId],
    ) as { cnt?: number } | undefined;
    if (rowKb?.cnt) totalKbEntriesInDb = Number(rowKb.cnt);

    const rowGraph = await adapter.getAsync(
      "SELECT COUNT(*) as cnt FROM graph_nodes WHERE project_id = $1",
      [projectId],
    ) as { cnt?: number } | undefined;
    if (rowGraph?.cnt) totalGraphNodesInDb = Number(rowGraph.cnt);
  } catch { /* fallback to zeros */ }

  return { totalRulesInDb, totalKbEntriesInDb, totalGraphNodesInDb };
}

/** Register project in project_registry table (non-fatal on failure) */
export async function registerPegaProject(
  service: PegaService,
  projectId: string,
  ingestedRules: Record<string, unknown>[],
): Promise<void> {
  try {
    const adapter = (service as any).memoryEngine.getAdapter();
    const eng = adapter.getEngine();
    const ts = eng === 'sqlite' ? `datetime('now')` : 'current_timestamp';
    const appName = (ingestedRules[0] as any)?.pyApplication || projectId;
    await adapter.runAsync(
      `INSERT INTO project_registry (project_id, display_name, workspace_path, created_by, last_seen)
       VALUES ($1, $2, $3, $4, ${ts})
       ON CONFLICT (project_id) DO UPDATE SET last_seen = ${ts}`,
      [projectId, 'Pega: ' + appName, '', 'pega-crawler'],
    );
  } catch { /* non-fatal */ }
}
