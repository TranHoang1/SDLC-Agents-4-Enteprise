/**
 * One-off (SA4E): Purge superseded COMPLETED pending_tasks using the production
 * PendingTaskRepository.purgeSupersededCompleted() method (keeps only the latest
 * COMPLETED task per entry_id+task_type). Safe: never touches PENDING/PROCESSING/FAILED.
 *
 * Usage (from backend/):
 *   $env:PGPASSWORD_OVERRIDE="..."; npx tsx scripts/purge-superseded-tasks.ts
 */

import { DatabaseAdapterFactory } from '../src/database/factory/DatabaseAdapterFactory.js';
import { PendingTaskRepository } from '../src/modules/memory/task-queue/PendingTaskRepository.js';

async function main(): Promise<void> {
  const password = process.env.PGPASSWORD_OVERRIDE || '';
  if (!password) throw new Error('Set PGPASSWORD_OVERRIDE with the postgres password.');

  const adapter = DatabaseAdapterFactory.create({
    engine: 'postgresql', host: 'localhost', port: 5432,
    username: 'sa4e_user', password, database: 'sa4e_db', ssl: false,
  });
  await (adapter as any).connect?.();

  const before = await adapter.getAsync<{ c: number }>(
    `SELECT COUNT(*)::int AS c FROM pending_tasks WHERE status = 'COMPLETED'`,
  );
  const repo = new PendingTaskRepository(adapter);
  const deleted = await repo.purgeSupersededCompleted();
  const after = await adapter.getAsync<{ c: number }>(
    `SELECT COUNT(*)::int AS c FROM pending_tasks WHERE status = 'COMPLETED'`,
  );

  console.log(`[info] COMPLETED before=${before?.c} deleted=${deleted} after=${after?.c}`);
  await (adapter as any).disconnect?.();
  console.log('[done]');
}

main().catch(err => { console.error(err); process.exit(1); });
