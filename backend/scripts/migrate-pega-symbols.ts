/**
 * SA4E-171 — Migration script: Migrate Pega rules from knowledge_entries to symbols.
 * Batch processes existing PEGA_RULE/PEGA_DATA entries into the symbols table.
 * Idempotent: safe to run multiple times (dedup by signature+project_id).
 *
 * Usage: npx tsx backend/scripts/migrate-pega-symbols.ts [options]
 * Options:
 *   --batch-size <N>   Batch size per transaction (default: 100, range: 1-1000)
 *   --project-id <ID>  Scope to specific project (default: all)
 *   --dry-run          Read-only mode — no writes
 *   --refresh          Re-store body content + re-queue enrichment for existing symbols (SA4E-106 backfill)
 *   --verbose          Per-rule logging
 *
 * Exit codes: 0 = success, 1 = partial failure, 2 = fatal error
 */

import { parseArgs } from 'node:util';
import { syncRuleToSymbols, refreshRuleSymbolBody } from '../src/modules/pega/PegaSymbolSync.js';
import { buildFqn } from '../src/modules/pega/pega-mapping.js';

/** Migration summary output. */
interface MigrationSummary {
  totalProcessed: number;
  migrated: number;
  skipped: number;
  errors: number;
  durationMs: number;
  batches: number;
}

/** Parse CLI arguments with validation. */
function parseCliArgs() {
  const { values } = parseArgs({
    options: {
      'batch-size': { type: 'string', default: '100' },
      'project-id': { type: 'string', default: '' },
      'dry-run': { type: 'boolean', default: false },
      'refresh': { type: 'boolean', default: false },
      'verbose': { type: 'boolean', default: false },
    },
    strict: false,
  });

  const batchSize = Math.max(1, Math.min(1000, parseInt(values['batch-size'] as string) || 100));
  return {
    batchSize,
    projectId: (values['project-id'] as string) || '',
    dryRun: values['dry-run'] as boolean,
    refresh: values['refresh'] as boolean,
    verbose: values['verbose'] as boolean,
  };
}

/** Main migration entry point. */
async function main(): Promise<void> {
  const args = parseCliArgs();
  console.log(`[migrate-pega-symbols] Starting migration...`);
  console.log(`  batch-size: ${args.batchSize}`);
  console.log(`  project-id: ${args.projectId || '(all)'}`);
  console.log(`  dry-run: ${args.dryRun}`);
  console.log(`  refresh: ${args.refresh}`);
  console.log(`  verbose: ${args.verbose}`);

  // Dynamic import — use pg directly to avoid adapter bootstrapping issues
  const pg = await import('pg');
  const pool = new pg.default.Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://sa4e_user:sa4e_local_dev_password@localhost:5432/sa4e_db',
  });
  // Wrap pool as minimal adapter compatible with syncRuleToSymbols
  const adapter = {
    getEngine: () => 'postgresql' as const,
    runAsync: async (sql: string, params?: unknown[]) => {
      const pgSql = sql.replace(/\?/g, (() => { let i = 0; return () => `$${++i}`; })());
      const res = await pool.query(pgSql, params);
      return { lastInsertRowid: res.rows?.[0]?.id ?? 0 };
    },
    getAsync: async <T>(sql: string, params?: unknown[]): Promise<T | undefined> => {
      const pgSql = sql.replace(/\?/g, (() => { let i = 0; return () => `$${++i}`; })());
      const res = await pool.query(pgSql, params);
      return res.rows[0] as T | undefined;
    },
    allAsync: async <T>(sql: string, params?: unknown[]): Promise<T[]> => {
      const pgSql = sql.replace(/\?/g, (() => { let i = 0; return () => `$${++i}`; })());
      const res = await pool.query(pgSql, params);
      return res.rows as T[];
    },
  };

  const startTime = Date.now();
  const summary: MigrationSummary = {
    totalProcessed: 0, migrated: 0, skipped: 0, errors: 0, durationMs: 0, batches: 0,
  };

  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const batch = await fetchBatch(adapter, args.projectId, args.batchSize, offset);
    if (batch.length === 0) { hasMore = false; break; }

    summary.batches++;
    const batchResult = await processBatch(adapter, batch, args);
    summary.totalProcessed += batch.length;
    summary.migrated += batchResult.migrated;
    summary.skipped += batchResult.skipped;
    summary.errors += batchResult.errors;
    offset += args.batchSize;

    console.log(`  [batch ${summary.batches}] offset=${offset - args.batchSize} migrated=${batchResult.migrated} skipped=${batchResult.skipped} errors=${batchResult.errors}`);

    if (batch.length < args.batchSize) hasMore = false;
  }

  summary.durationMs = Date.now() - startTime;
  console.log(`\n[migrate-pega-symbols] Complete.`);
  console.log(JSON.stringify(summary, null, 2));

  // Exit code based on result
  if (summary.errors > 0 && summary.migrated === 0) process.exit(2);
  if (summary.errors > 0) process.exit(1);
  process.exit(0);
}

/** Fetch a batch of PEGA_RULE/PEGA_DATA entries from knowledge_entries. */
async function fetchBatch(
  adapter: any, projectId: string, batchSize: number, offset: number,
): Promise<any[]> {
  const params: unknown[] = [];
  let whereClause = `WHERE type IN ('PEGA_RULE', 'PEGA_DATA')`;
  if (projectId) {
    whereClause += ` AND project_id = ?`;
    params.push(projectId);
  }
  params.push(batchSize, offset);
  return adapter.allAsync(
    `SELECT id, content, source, project_id FROM knowledge_entries ${whereClause} ORDER BY id LIMIT ? OFFSET ?`,
    params,
  );
}

/** Process a batch of KB entries, migrating each to symbols. */
async function processBatch(
  adapter: any,
  batch: any[],
  args: { dryRun: boolean; refresh: boolean; verbose: boolean },
): Promise<{ migrated: number; skipped: number; errors: number }> {
  let migrated = 0, skipped = 0, errors = 0;

  for (const row of batch) {
    try {
      const ruleJson = JSON.parse(row.content);
      const pxObjClass = String(ruleJson?.pxObjClass || '');
      const pyClassName = String(ruleJson?.pyClassName || '');
      const pyRuleName = String(ruleJson?.pyRuleName || '');

      if (!pxObjClass || !pyClassName || !pyRuleName) {
        if (args.verbose) console.log(`    SKIP: missing fields, id=${row.id}`);
        skipped++;
        continue;
      }

      // SEC-06: skip oversized rules (5MB)
      if (row.content.length > 5 * 1024 * 1024) {
        if (args.verbose) console.log(`    SKIP: oversized rule, id=${row.id}`);
        skipped++;
        continue;
      }

      // Dedup check: already migrated? (BR-14, BR-18)
      const fqn = buildFqn(pxObjClass, pyClassName, pyRuleName);
      const existing = await adapter.getAsync(
        'SELECT id FROM symbols WHERE signature = ? AND project_id = ?',
        [fqn, row.project_id],
      );
      if (existing) {
        if (args.refresh) {
          if (args.dryRun) {
            if (args.verbose) console.log(`    DRY-RUN: would refresh fqn=${fqn}`);
            migrated++;
            continue;
          }
          // SA4E-106 backfill: re-store extracted body + re-queue enrichment
          await refreshRuleSymbolBody(adapter, ruleJson, existing.id, row.project_id);
          if (args.verbose) console.log(`    REFRESHED: fqn=${fqn}`);
          migrated++;
          continue;
        }
        if (args.verbose) console.log(`    SKIP: already exists, fqn=${fqn}`);
        skipped++;
        continue;
      }

      if (args.dryRun) {
        if (args.verbose) console.log(`    DRY-RUN: would migrate fqn=${fqn}`);
        migrated++;
        continue;
      }

      const result = await syncRuleToSymbols(adapter, ruleJson, row.project_id, '');
      if (result) { migrated++; }
      else { skipped++; }
    } catch (err) {
      errors++;
      if (args.verbose) console.log(`    ERROR: id=${row.id}, ${(err as Error).message}`);
    }
  }

  return { migrated, skipped, errors };
}

main().catch(err => {
  console.error('[migrate-pega-symbols] Fatal error:', err);
  process.exit(2);
});
