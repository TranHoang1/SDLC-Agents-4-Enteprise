/**
 * Migration 006: Add project_id column to pending_tasks.
 * SA4E-164: Eliminates expensive JOIN for per-project task stats.
 *
 * Cross-engine: PostgreSQL + SQLite compatible.
 * Backfills project_id from knowledge_entries for existing tasks.
 */
import type { DatabaseAdapter } from '../../../database/adapters/DatabaseAdapter.js';

export async function migrate006PendingTasksProjectId(db: DatabaseAdapter): Promise<void> {
  const engine = db.getEngine();

  // Step 1: Add project_id column (idempotent)
  if (engine === 'postgresql') {
    await db.execAsync(`
      ALTER TABLE pending_tasks
      ADD COLUMN IF NOT EXISTS project_id TEXT DEFAULT NULL
    `);
  } else {
    try {
      await db.execAsync(`ALTER TABLE pending_tasks ADD COLUMN project_id TEXT DEFAULT NULL`);
    } catch (err) {
      const msg = (err as Error).message || '';
      if (!msg.includes('duplicate column') && !msg.includes('already exists')) throw err;
    }
  }

  // Step 2: Backfill from knowledge_entries (non-blocking, best effort)
  try {
    await db.runAsync(`
      UPDATE pending_tasks SET project_id = (
        SELECT ke.project_id FROM knowledge_entries ke
        WHERE ke.id = pending_tasks.entry_id
      ) WHERE project_id IS NULL
    `, []);
  } catch (err) {
    // Non-fatal: backfill may fail if entries are deleted
    console.debug('[migration-006] Backfill partial:', (err as Error).message);
  }

  // Step 3: Create index for per-project status queries
  try {
    await db.execAsync(`
      CREATE INDEX IF NOT EXISTS idx_pending_tasks_project_status
      ON pending_tasks (project_id, status)
    `);
  } catch (err) {
    console.debug('[migration-006] Index creation:', (err as Error).message);
  }
}
