/**
 * Migration 005: Add UNIQUE constraint on (source, project_id) for knowledge_entries.
 * SA4E-163: Enables UPSERT pattern to prevent orphan pending_tasks.
 *
 * Cross-engine: PostgreSQL + SQLite compatible.
 * Uses partial unique index (WHERE source IS NOT NULL) to allow
 * multiple NULL source entries.
 */
import type { DatabaseAdapter } from '../../../database/adapters/DatabaseAdapter.js';

export async function migrate005UniqueSourceProject(db: DatabaseAdapter): Promise<void> {
  const engine = db.getEngine();

  if (engine === 'postgresql') {
    // PostgreSQL: CREATE UNIQUE INDEX IF NOT EXISTS with partial condition
    await db.execAsync(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_ke_source_project_unique
      ON knowledge_entries (source, project_id)
      WHERE source IS NOT NULL
    `);
  } else {
    // SQLite: try/catch for idempotency (no IF NOT EXISTS for indexes in some versions)
    try {
      await db.execAsync(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_ke_source_project_unique
        ON knowledge_entries (source, project_id)
        WHERE source IS NOT NULL
      `);
    } catch (err) {
      const msg = (err as Error).message || '';
      if (!msg.includes('already exists')) throw err;
    }
  }
}
