/**
 * SA4E-222 (DISC-2) — Re-enrich Pega rules by kind.
 *
 * The FSD/BRD reference `reenrich-pega-all.ts --kind`, but no such file exists in the
 * repo (DISC-2). This wrapper iterates a directory of exported Pega rule JSON files and
 * calls PegaSymbolSync.refreshRuleSymbolBody for each, so existing indexed symbols get
 * their bodies regenerated with the new Scope A/B extractors (NFR-4).
 *
 * The raw rule JSON is required for re-extraction (it is not persisted in the DB, only
 * the extracted text is). Feed the original Pega export directory via --src.
 *
 * Usage: tsx scripts/reenrich-pega.ts --kind Rule-Obj-Activity --src ./pega-export
 */

import { readdirSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { DatabaseAdapterFactory } from '../src/database/factory/DatabaseAdapterFactory.js';
import { refreshRuleSymbolBody } from '../src/modules/pega/PegaSymbolSync.js';
import pino from 'pino';

const logger = pino({ name: 'reenrich-pega' });

/** Map a pxObjClass fragment to a pega_ kind for symbol lookup. */
function pxObjClassToKind(pxObjClass: string): string {
  const tail = pxObjClass.split('-').pop() || '';
  return `pega_${tail.toLowerCase()}`;
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const kindIdx = argv.indexOf('--kind');
  const kindFilter: string | null = kindIdx >= 0 ? argv[kindIdx + 1] : null;
  const srcIdx = argv.indexOf('--src');
  const src = srcIdx >= 0 ? argv[srcIdx + 1] : './pega-export';
  const projectId = process.env.PROJECT_ID || 'default';

  if (!existsSync(src)) {
    logger.error({ src }, 'Source directory not found');
    process.exit(1);
  }

  const adapter = DatabaseAdapterFactory.create({
    engine: (process.env.DB_ENGINE as any) || 'sqlite',
    dbPath: process.env.DB_PATH || 'data/agent.db',
  });
  await adapter.connect();

  const files = readdirSync(src).filter((f) => f.endsWith('.json'));
  let processed = 0;
  let skipped = 0;

  for (const file of files) {
    let ruleJson: Record<string, unknown>;
    try {
      ruleJson = JSON.parse(readFileSync(join(src, file), 'utf-8'));
    } catch (err) {
      logger.warn({ err, file }, 'unreadable JSON; skipped');
      skipped++;
      continue;
    }

    const pxObjClass = String(ruleJson.pxObjClass || '');
    if (kindFilter && pxObjClass !== kindFilter) continue;

    const name = String(
      ruleJson.pyRuleName || ruleJson.pyActivityName || ruleJson.pyModelName || ruleJson.pyFlowName || '',
    );
    const kind = pxObjClassToKind(pxObjClass);
    const sym = await adapter.getAsync<{ id: number }>(
      'SELECT id FROM symbols WHERE kind = ? AND name = ? AND project_id = ? LIMIT 1',
      [kind, name, projectId],
    );
    if (!sym) {
      logger.debug({ file, kind, name }, 'no matching symbol; skipped');
      skipped++;
      continue;
    }

    await refreshRuleSymbolBody(adapter, ruleJson, sym.id, projectId);
    processed++;
  }

  logger.info({ processed, skipped }, '[reenrich-pega] Completed');
}

main().catch((err) => {
  logger.error({ err }, 'reenrich-pega failed');
  process.exit(1);
});
