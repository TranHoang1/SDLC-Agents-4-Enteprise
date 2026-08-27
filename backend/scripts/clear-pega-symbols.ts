/**
 * One-off (SA4E): Clear all Pega symbol data for a project BEFORE a full live
 * re-crawl, so the re-crawl repopulates with the correct 5-part identity
 * (type:class:name:ruleSet:version) instead of leaving orphaned old-format rows.
 *
 * Deletes ONLY Pega-scoped rows (kind LIKE 'pega_%'):
 *   - graph_nodes for those symbols (code:{id})
 *   - body_embeddings for those symbols
 *   - pending_tasks (CODE_ENRICHMENT) for those symbols
 *   - the symbols themselves
 *   - their virtual files (language='pega') that are now unreferenced
 * Standard code symbols/files/nodes are untouched.
 *
 * Usage (from backend/):
 *   $env:PGPASSWORD_OVERRIDE="..."; npx tsx scripts/clear-pega-symbols.ts <projectId> [--apply]
 *   (no --apply = dry run: reports counts, deletes nothing)
 */

import { DatabaseAdapterFactory } from '../src/database/factory/DatabaseAdapterFactory.js';

async function main(): Promise<void> {
  const projectId = process.argv[2];
  const apply = process.argv.includes('--apply');
  if (!projectId) throw new Error('Usage: clear-pega-symbols.ts <projectId> [--apply]');
  const password = process.env.PGPASSWORD_OVERRIDE || '';
  if (!password) throw new Error('Set PGPASSWORD_OVERRIDE with the postgres password.');

  const adapter = DatabaseAdapterFactory.create({
    engine: 'postgresql', host: 'localhost', port: 5432,
    username: 'sa4e_user', password, database: 'sa4e_db', ssl: false,
  });
  await (adapter as any).connect?.();

  const count = async (sql: string) =>
    (await adapter.getAsync<{ c: number }>(sql, [projectId]))?.c ?? 0;

  const symbols = await count(
    `SELECT COUNT(*)::int AS c FROM symbols WHERE project_id = $1 AND kind LIKE 'pega_%'`);
  const files = await count(
    `SELECT COUNT(*)::int AS c FROM files WHERE project_id = $1 AND language = 'pega'`);
  const nodes = await count(
    `SELECT COUNT(*)::int AS c FROM graph_nodes g WHERE g.project_id = $1
       AND g.entry_id LIKE 'code:%'
       AND CAST(substring(g.entry_id FROM 6) AS INTEGER) IN
         (SELECT id FROM symbols WHERE project_id = $1 AND kind LIKE 'pega_%')`);

  console.log(`[info] project=${projectId} pega_symbols=${symbols} pega_files=${files} pega_graph_nodes=${nodes}`);

  if (!apply) { console.log('[info] DRY-RUN (no writes). Re-run with --apply.'); await (adapter as any).disconnect?.(); return; }

  // Order matters: dependents first, then symbols, then unreferenced files.
  const pegaSymIds = `SELECT id FROM symbols WHERE project_id = $1 AND kind LIKE 'pega_%'`;

  const gn = await adapter.runAsync(
    `DELETE FROM graph_nodes WHERE project_id = $1 AND entry_id LIKE 'code:%'
       AND CAST(substring(entry_id FROM 6) AS INTEGER) IN (${pegaSymIds})`, [projectId]);
  const be = await adapter.runAsync(
    `DELETE FROM body_embeddings WHERE project_id = $1 AND symbol_id IN (${pegaSymIds})`, [projectId]);
  const pt = await adapter.runAsync(
    `DELETE FROM pending_tasks WHERE task_type = 'CODE_ENRICHMENT' AND project_id = $1
       AND entry_id IN (${pegaSymIds})`, [projectId]);
  const sy = await adapter.runAsync(
    `DELETE FROM symbols WHERE project_id = $1 AND kind LIKE 'pega_%'`, [projectId]);
  const fi = await adapter.runAsync(
    `DELETE FROM files WHERE project_id = $1 AND language = 'pega'`, [projectId]);

  console.log(`[info] deleted graph_nodes=${gn.changes} body_embeddings=${be.changes} pending_tasks=${pt.changes} symbols=${sy.changes} files=${fi.changes}`);
  await (adapter as any).disconnect?.();
  console.log('[done] Now trigger the live Pega re-crawl in the extension to repopulate.');
}

main().catch(err => { console.error(err); process.exit(1); });
