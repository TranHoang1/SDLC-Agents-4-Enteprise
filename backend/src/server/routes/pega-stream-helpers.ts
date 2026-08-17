/**
 * Helper functions for pega-stream route — DB queries, project registration, line processing.
 * Extracted to keep route file ≤ 200 lines (SRP compliance).
 */

import type { Logger } from 'pino';
import type { PegaService } from '../../modules/pega/PegaService.js';

/** Metadata sent as the first NDJSON line */
export interface StreamMetadata {
  __meta: true;
  projectId: string;
  checksums: Record<string, string>;
  versions: Record<string, string>;
  visitedKeys: string[];
}

/** Result of processing a single NDJSON line */
export interface LineResult {
  isMeta: boolean;
  meta?: StreamMetadata;
  stored: boolean;
  rule?: Record<string, unknown>;
}

/** Process a single NDJSON line — either metadata or a rule to index (Phase 1 only) */
export async function processOneLine(
  line: string,
  meta: StreamMetadata | null,
  service: PegaService,
  logger: Logger,
): Promise<LineResult> {
  let obj: Record<string, unknown>;
  try {
    obj = JSON.parse(line);
  } catch (err) {
    logger.debug({ line: line.substring(0, 80) }, '[pega-stream] Malformed JSON line — skipping');
    return { isMeta: false, stored: false };
  }

  if (obj.__meta) {
    return { isMeta: true, meta: obj as unknown as StreamMetadata, stored: false };
  }

  if (!meta) {
    logger.warn('[pega-stream] Rule received before metadata line — skipping');
    return { isMeta: false, stored: false };
  }

  try {
    const sym = service.parseRuleToSymbol(obj);
    const checksum = sym ? meta.checksums[sym.fqn] : undefined;
    const version = sym ? meta.versions[sym.fqn] : undefined;

    // SA4E-158: Use indexRuleOnly (Phase 1) — no KB/graph/enrichment
    const result = await service.indexRuleOnly({
      projectId: meta.projectId,
      ruleJson: obj,
      checksum,
      version,
    });

    const didStore = result.status === 'success' && result.ruleId !== -1;
    return { isMeta: false, stored: didStore, rule: didStore ? obj : undefined };
  } catch (err: any) {
    logger.debug({ err: err.message }, '[pega-stream] Single rule index failed — skipping');
    return { isMeta: false, stored: false };
  }
}

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
      "SELECT COUNT(*) as cnt FROM symbols WHERE project_id = $1 AND kind LIKE 'pega_%'",
      [projectId],
    ) as { cnt?: number } | undefined;
    if (rowRules?.cnt) totalRulesInDb = Number(rowRules.cnt);

    const rowKb = await adapter.getAsync(
      "SELECT COUNT(*) as cnt FROM symbols WHERE project_id = $1",
      [projectId],
    ) as { cnt?: number } | undefined;
    if (rowKb?.cnt) totalKbEntriesInDb = Number(rowKb.cnt);

    const rowGraph = await adapter.getAsync(
      "SELECT COUNT(*) as cnt FROM graph_nodes WHERE project_id = $1",
      [projectId],
    ) as { cnt?: number } | undefined;
    if (rowGraph?.cnt) totalGraphNodesInDb = Number(rowGraph.cnt);
  } catch (err) { console.debug('[pega-stream] Failed to query DB totals (fallback to zeros):', (err as Error).message); }

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
  } catch (err) { console.debug('[pega-stream] Failed to register project in project_registry (non-fatal):', (err as Error).message); }
}
