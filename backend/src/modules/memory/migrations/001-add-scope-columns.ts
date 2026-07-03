/**
 * Migration 001: Add scope and user_id columns to knowledge_entries.
 * Supports multi-space KB architecture:
 *   - USER scope (private to user)
 *   - PROJECT scope (shared within project team)
 *   - SHARED scope (company-wide, cross-project)
 */
import type Database from 'better-sqlite3';

export function migrate001AddScopeColumns(db: Database.Database): void {
  // Check if column already exists
  const columns = db.pragma('table_info(knowledge_entries)') as Array<{ name: string }>;
  const hasScope = columns.some(c => c.name === 'scope');

  if (hasScope) return; // Already migrated

  db.exec(`
    ALTER TABLE knowledge_entries ADD COLUMN scope TEXT NOT NULL DEFAULT 'USER';
    ALTER TABLE knowledge_entries ADD COLUMN user_id TEXT DEFAULT NULL;

    CREATE INDEX IF NOT EXISTS idx_ke_scope ON knowledge_entries(scope);
    CREATE INDEX IF NOT EXISTS idx_ke_user_id ON knowledge_entries(user_id);
    CREATE INDEX IF NOT EXISTS idx_ke_scope_user ON knowledge_entries(scope, user_id);
  `);
}
