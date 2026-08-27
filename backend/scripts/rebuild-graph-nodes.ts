/**
 * One-off (SA4E): Rebuild code graph_nodes for a project via the production
 * GraphSyncService.syncProjectSymbols(). Fixes stale 'code:{id}' nodes that point
 * at symbol ids removed during re-index/reclassify (cause of the KB Graph
 * "No content available" bug). Rebuild deletes all code:% nodes then re-projects
 * from the CURRENT symbols table (includes all pega_* kinds).
 *
 * Usage (from backend/):
 *   $env:PGPASSWORD_OVERRIDE="..."; npx tsx scripts/rebuild-graph-nodes.ts <projectId>
 */

import pino from 'pino';
import { DatabaseAdapterFactory } from '../src/database/factory/DatabaseAdapterFactory.js';
import { GraphSyncService } from '../src/engine/graph/graph-sync-service.js';

async function main(): Promise<void> {
  const projectId = process.argv[2];
  if (!projectId) throw new Error('Usage: rebuild-graph-nodes.ts <projectId>');
  const password = process.env.PGPASSWORD_OVERRIDE || '';
  if (!password) throw new Error('Set PGPASSWORD_OVERRIDE with the postgres password.');

  const adapter = DatabaseAdapterFactory.create({
    engine: 'postgresql', host: 'localhost', port: 5432,
    username: 'sa4e_user', password, database: 'sa4e_db', ssl: false,
  });
  await (adapter as any).connect?.();

  const before = await adapter.getAsync<{ c: number }>(
    `SELECT COUNT(*)::int AS c FROM graph_nodes WHERE entry_id LIKE 'code:%' AND project_id = $1`,
    [projectId],
  );

  // Same adapter for index + admin (single unified Postgres DB in this deployment).
  const sync = new GraphSyncService(adapter, adapter, pino({ level: 'info' }));
  await sync.syncProjectSymbols(projectId);

  const after = await adapter.getAsync<{ c: number }>(
    `SELECT COUNT(*)::int AS c FROM graph_nodes WHERE entry_id LIKE 'code:%' AND project_id = $1`,
    [projectId],
  );
  const stale = await adapter.getAsync<{ c: number }>(
    `SELECT COUNT(*)::int AS c FROM graph_nodes g
     WHERE g.entry_id LIKE 'code:%' AND g.project_id = $1
       AND NOT EXISTS (SELECT 1 FROM symbols s WHERE s.id = CAST(substring(g.entry_id FROM 6) AS INTEGER))`,
    [projectId],
  );

  console.log(`[info] code nodes before=${before?.c} after=${after?.c} remaining_stale=${stale?.c}`);
  await (adapter as any).disconnect?.();
  console.log('[done]');
}

main().catch(err => { console.error(err); process.exit(1); });
