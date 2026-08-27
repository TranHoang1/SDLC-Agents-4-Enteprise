/**
 * One-off (SA4E): Reclassify symbols.kind for Pega symbols using the corrected
 * PEGA_OBJ_CLASS_TO_KIND mapping. Fixes rows mis-tagged as pega_unknown when the
 * mapping table previously had wrong/missing pxObjClass names (e.g. Rule-Obj-Model).
 *
 * kind is derived from the pxObjClass, which is the first ':'-segment of the
 * symbol signature (FQN = pxObjClass:pyClassName:pyRuleName). Only updates rows
 * whose recomputed kind differs from the stored kind.
 *
 * Usage (from backend/):
 *   $env:PGPASSWORD_OVERRIDE="..."; npx tsx scripts/reclassify-pega-kinds.ts [--apply]
 */

import { DatabaseAdapterFactory } from '../src/database/factory/DatabaseAdapterFactory.js';
import { resolveSymbolKind } from '../src/modules/pega/pega-mapping.js';

async function main(): Promise<void> {
  const apply = process.argv.includes('--apply');
  const password = process.env.PGPASSWORD_OVERRIDE || '';
  if (!password) throw new Error('Set PGPASSWORD_OVERRIDE with the postgres password.');

  const adapter = DatabaseAdapterFactory.create({
    engine: 'postgresql', host: 'localhost', port: 5432,
    username: 'sa4e_user', password, database: 'sa4e_db', ssl: false,
  });
  await (adapter as any).connect?.();

  const rows = await adapter.allAsync<{ id: number; kind: string; signature: string }>(
    `SELECT id, kind, signature FROM symbols WHERE kind LIKE 'pega_%'`,
  );

  const changes: Array<{ id: number; from: string; to: string }> = [];
  for (const r of rows) {
    const pxObjClass = (r.signature || '').split(':')[0];
    if (!pxObjClass) continue;
    const correct = resolveSymbolKind(pxObjClass);
    if (correct !== r.kind) changes.push({ id: r.id, from: r.kind, to: correct });
  }

  // Summary of kind transitions
  const summary = new Map<string, number>();
  for (const c of changes) {
    const key = `${c.from} -> ${c.to}`;
    summary.set(key, (summary.get(key) || 0) + 1);
  }
  console.log(`[info] total pega symbols=${rows.length} reclassify=${changes.length}`);
  for (const [k, n] of [...summary.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${k}: ${n}`);
  }

  if (!apply) { console.log('[info] DRY-RUN (no writes). Re-run with --apply to update.'); }
  else {
    for (const c of changes) {
      await adapter.runAsync(`UPDATE symbols SET kind = ? WHERE id = ?`, [c.to, c.id]);
    }
    console.log(`[info] updated ${changes.length} symbol kinds`);
  }

  await (adapter as any).disconnect?.();
  console.log('[done]');
}

main().catch(err => { console.error(err); process.exit(1); });
