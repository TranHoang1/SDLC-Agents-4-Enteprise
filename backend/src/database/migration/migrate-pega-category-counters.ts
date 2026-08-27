/**
 * Migration: Create pega_category_counters table and add dedup_config entries.
 * SA4E-217: Category counter migration from in-memory to DB COUNT.
 * 
 * This migration creates the pega_category_counters table used for storing
 * category counts computed via COUNT(*) queries, and updates the dedup_config
 * to reflect that category counters are now source "db".
 */

export function up(db: any): void {
  // Create pega_category_counters table if not exists
  db.exec(`
    CREATE TABLE IF NOT EXISTS pega_category_counters (
      rule_type TEXT PRIMARY KEY,
      count INTEGER NOT NULL DEFAULT 0,
      last_updated TEXT NOT NULL DEFAULT (datetime('now')),
      source TEXT NOT NULL DEFAULT 'memory'
    )
  `);

  // Ensure dedup_config has categoryCounterSource entry
  db.exec(`
    INSERT INTO config_entries (section, key, value, type, requires_restart, workspace_id)
    VALUES ('dedup', 'categoryCounterSource', 'db', 'json', 0, 'default')
    ON CONFLICT(section, key) DO NOTHING
  `);
}

export function down(db: any): void {
  // Drop pega_category_counters table
  db.exec(`DROP TABLE IF EXISTS pega_category_counters`);

  // Remove dedup config entry (reset to memory)
  db.exec(`DELETE FROM config_entries WHERE section = 'dedup' AND key = 'categoryCounterSource'`);
}