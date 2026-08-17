/**
 * Migration 007: Add instinct system tables (contradiction_log) and seed config.
 * SA4E-121: Instincts and Confidence Scoring System.
 * Cross-engine: PostgreSQL + SQLite compatible.
 * Additive only — no ALTER on existing tables.
 */
import type { DatabaseAdapter } from '../../../database/adapters/DatabaseAdapter.js';

async function tableExists(db: DatabaseAdapter, table: string): Promise<boolean> {
  try {
    const pg = await db.allAsync<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables WHERE table_name = $1`,
      [table],
    );
    if (pg.length > 0) return true;
  } catch {
    try {
      const lite = await db.allAsync<{ name: string }>(
        `SELECT name FROM sqlite_master WHERE type='table' AND name=?`,
        [table],
      );
      return lite.length > 0;
    } catch { return false; }
  }
  return false;
}

export async function migrate007AddInstinctTables(db: DatabaseAdapter): Promise<void> {
  if (!await tableExists(db, 'contradiction_log')) {
    await db.execAsync(`
      CREATE TABLE contradiction_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        entry_id_a INTEGER NOT NULL,
        entry_id_b INTEGER NOT NULL,
        similarity REAL NOT NULL,
        classification TEXT NOT NULL CHECK (classification IN ('CONTRADICTION', 'SUPPLEMENT', 'SUPERSEDE')),
        status TEXT NOT NULL DEFAULT 'unresolved' CHECK (status IN ('unresolved', 'resolved', 'stale')),
        resolution TEXT DEFAULT NULL,
        resolved_by TEXT DEFAULT NULL,
        detected_at TEXT NOT NULL DEFAULT (datetime('now')),
        resolved_at TEXT DEFAULT NULL,
        project_id TEXT DEFAULT NULL,
        FOREIGN KEY (entry_id_a) REFERENCES knowledge_entries(id) ON DELETE CASCADE,
        FOREIGN KEY (entry_id_b) REFERENCES knowledge_entries(id) ON DELETE CASCADE
      )
    `);
  }

  try { await db.execAsync(`CREATE INDEX IF NOT EXISTS idx_cl_status ON contradiction_log(status)`); } catch { /* exists */ }
  try { await db.execAsync(`CREATE INDEX IF NOT EXISTS idx_cl_entry_a ON contradiction_log(entry_id_a)`); } catch { /* exists */ }
  try { await db.execAsync(`CREATE INDEX IF NOT EXISTS idx_cl_entry_b ON contradiction_log(entry_id_b)`); } catch { /* exists */ }
  try { await db.execAsync(`CREATE INDEX IF NOT EXISTS idx_cl_project ON contradiction_log(project_id)`); } catch { /* exists */ }

  const seeds: [string, string][] = [
    ['instinct_initial_confidence', '0.5'],
    ['instinct_confidence_floor', '0.3'],
    ['instinct_confidence_ceiling', '0.9'],
    ['instinct_decay_rate', '0.08'],
    ['instinct_boost_factor', '1.1'],
    ['instinct_fail_factor', '0.9'],
    ['instinct_access_threshold_days', '14'],
    ['instinct_promotion_threshold', '3'],
    ['contradiction_similarity_threshold', '0.85'],
  ];

  for (const [key, value] of seeds) {
    await db.runAsync(
      `INSERT INTO decay_config (key, value, updated_at) VALUES (?, ?, datetime('now')) ON CONFLICT (key) DO NOTHING`,
      [key, value],
    );
  }
}
