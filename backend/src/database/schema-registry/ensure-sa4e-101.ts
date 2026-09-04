/**
 * SA4E-101 — Idempotent schema bootstrap for persistent index status.
 *
 * Creates `index_operations` and `file_checksums` tables (plus indexes)
 * if they do not exist. DDL is engine-aware (SQLite vs PostgreSQL) and
 * safe to call on every boot. Called once at server startup, before
 * StartupInterruptDetector and CleanupScheduler.
 */

import pino from 'pino';
import { getDbAdapter, getActiveEngine } from '../../admin/db/core.js';

const logger = pino({ name: 'sa4e-101-schema' });

/** Ensure SA4E-101 tables exist. Idempotent and safe to call on every boot. */
export async function ensureSa4e101Tables(): Promise<void> {
  const engine = getActiveEngine();
  const tsType = engine === 'postgresql' ? 'TIMESTAMP WITH TIME ZONE' : 'TIMESTAMP';
  const adapter = getDbAdapter();

  const ddl = `
CREATE TABLE IF NOT EXISTS index_operations (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL,
  project_id   TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'running'
               CHECK (status IN ('running','interrupted','completed','cancelled','failed','superseded')),
  phase        TEXT NOT NULL DEFAULT 'scanning',
  current      INTEGER NOT NULL DEFAULT 0,
  total        INTEGER NOT NULL DEFAULT 0,
  current_file TEXT,
  started_at   ${tsType} NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   ${tsType} NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_operations_active_tenant
  ON index_operations (user_id, project_id)
  WHERE status IN ('running','interrupted');
CREATE INDEX IF NOT EXISTS idx_operations_status_updated
  ON index_operations (status, updated_at);
CREATE INDEX IF NOT EXISTS idx_operations_tenant
  ON index_operations (user_id, project_id);

CREATE TABLE IF NOT EXISTS file_checksums (
  id               TEXT PRIMARY KEY,
  user_id          TEXT NOT NULL,
  project_id       TEXT NOT NULL,
  file_path        TEXT NOT NULL,
  file_checksum    TEXT NOT NULL,
  last_indexed_at  ${tsType} NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_checksums_tenant_file
  ON file_checksums (user_id, project_id, file_path);
CREATE INDEX IF NOT EXISTS idx_checksums_tenant
  ON file_checksums (user_id, project_id);
`;

  try {
    await adapter.execAsync(ddl);
    logger.info('[sa4e-101] index_operations + file_checksums tables ensured');
  } catch (err) {
    logger.error({ err }, '[sa4e-101] failed to ensure tables');
    throw err;
  }
}
