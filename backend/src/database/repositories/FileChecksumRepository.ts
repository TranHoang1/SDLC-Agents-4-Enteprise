/**
 * SA4E-101 — FileChecksumRepository: PostgreSQL/SQLite CRUD for the
 * `file_checksums` table. Supports batch pre-load and chunked deletion.
 * Implements: UC-07, AF-13
 */

import type { DatabaseAdapter } from '../adapters/DatabaseAdapter.js';
import { getDbAdapter } from '../../admin/db/core.js';
import { translateError } from '../errors/index.js';
import { randomUUID } from 'crypto';

export type FileChecksumInsert = {
  user_id: string;
  project_id: string;
  file_path: string;
  file_checksum: string;
  id?: string;
};

export class FileChecksumRepository {
  constructor(private readonly adapter: DatabaseAdapter = getDbAdapter()) {}

  /** Pre-load all checksums for a tenant into memory (single SELECT). */
  async loadAll(userId: string, projectId: string): Promise<Map<string, string>> {
    try {
      const rows = await this.adapter.allAsync<{ file_path: string; file_checksum: string }>(
        `SELECT file_path, file_checksum FROM file_checksums WHERE user_id = ? AND project_id = ?`,
        [userId, projectId],
      );
      const map = new Map<string, string>();
      for (const r of rows) map.set(r.file_path, r.file_checksum);
      return map;
    } catch (err) {
      throw translateError(err);
    }
  }

  /** Upsert a single checksum (cross-engine). */
  async upsert(record: FileChecksumInsert): Promise<void> {
    try {
      const id = record.id ?? randomUUID();
      const ts = new Date().toISOString();
      if (this.adapter.getEngine() === 'sqlite') {
        await this.adapter.runAsync(
          `INSERT OR REPLACE INTO file_checksums (id, user_id, project_id, file_path, file_checksum, last_indexed_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [id, record.user_id, record.project_id, record.file_path, record.file_checksum, ts],
        );
      } else {
        await this.adapter.runAsync(
          `INSERT INTO file_checksums (id, user_id, project_id, file_path, file_checksum, last_indexed_at)
           VALUES (?, ?, ?, ?, ?, ?)
           ON CONFLICT (user_id, project_id, file_path)
           DO UPDATE SET file_checksum = EXCLUDED.file_checksum, last_indexed_at = EXCLUDED.last_indexed_at`,
          [id, record.user_id, record.project_id, record.file_path, record.file_checksum, ts],
        );
      }
    } catch (err) {
      throw translateError(err);
    }
  }

  /** Delete checksums whose file_path is NOT in currentPaths (AF-13). */
  async deleteNotIn(userId: string, projectId: string, currentPaths: string[]): Promise<number> {
    try {
      if (currentPaths.length === 0) {
        const r = await this.adapter.runAsync(
          `DELETE FROM file_checksums WHERE user_id = ? AND project_id = ?`,
          [userId, projectId],
        );
        return r.changes;
      }
      const placeholders = currentPaths.map(() => '?').join(',');
      const r = await this.adapter.runAsync(
        `DELETE FROM file_checksums
         WHERE user_id = ? AND project_id = ? AND file_path NOT IN (${placeholders})`,
        [userId, projectId, ...currentPaths],
      );
      return r.changes;
    } catch (err) {
      throw translateError(err);
    }
  }

  /** Delete all checksums for a tenant. */
  async deleteAll(userId: string, projectId: string): Promise<number> {
    try {
      const r = await this.adapter.runAsync(
        `DELETE FROM file_checksums WHERE user_id = ? AND project_id = ?`,
        [userId, projectId],
      );
      return r.changes;
    } catch (err) {
      throw translateError(err);
    }
  }
}
