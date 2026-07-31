/**
 * Migration 007 — SA4E-79: Add enrichment tracking columns.
 * Non-destructive ALTER TABLE — existing entries default to 'done' (BR-03).
 * Adds enrichment_status, enriched_by, enriched_at + partial index for pending entries.
 * PostgreSQL-compatible: uses ADD COLUMN IF NOT EXISTS.
 */

import type { DatabaseAdapter } from '../../../../database/adapters/DatabaseAdapter.js';

/**
 * Execute migration 007 — adds enrichment status tracking.
 * Idempotent: safe to run multiple times (IF NOT EXISTS for PG, try/catch for SQLite).
 * @param adapter - Database adapter for executing SQL
 */
export async function migrate007Up(adapter: DatabaseAdapter): Promise<void> {
  const engine = adapter.getEngine();

  if (engine === 'postgresql') {
    await adapter.runAsync(
      `ALTER TABLE knowledge_entries ADD COLUMN IF NOT EXISTS enrichment_status TEXT NOT NULL DEFAULT 'done'`, [],
    );
    await adapter.runAsync(
      `ALTER TABLE knowledge_entries ADD COLUMN IF NOT EXISTS enriched_by TEXT DEFAULT NULL`, [],
    );
    await adapter.runAsync(
      `ALTER TABLE knowledge_entries ADD COLUMN IF NOT EXISTS enriched_at TEXT DEFAULT NULL`, [],
    );
  } else {
    // SQLite doesn't support IF NOT EXISTS for ADD COLUMN — use try/catch
    for (const col of [
      `ALTER TABLE knowledge_entries ADD COLUMN enrichment_status TEXT NOT NULL DEFAULT 'done'`,
      `ALTER TABLE knowledge_entries ADD COLUMN enriched_by TEXT DEFAULT NULL`,
      `ALTER TABLE knowledge_entries ADD COLUMN enriched_at TEXT DEFAULT NULL`,
    ]) {
      try { await adapter.runAsync(col, []); } catch { /* column already exists */ }
    }
  }

  // Partial index — idempotent via IF NOT EXISTS
  await adapter.runAsync(
    `CREATE INDEX IF NOT EXISTS idx_ke_enrichment_pending
     ON knowledge_entries(enrichment_status)
     WHERE enrichment_status = 'pending'`, [],
  );
}
