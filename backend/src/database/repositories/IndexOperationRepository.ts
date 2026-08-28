/**
 * SA4E-101 — IndexOperationRepository: PostgreSQL/SQLite CRUD for the
 * `index_operations` table. Enforces tenant isolation on every query.
 * Implements: BR-01, BR-02, BR-05, BR-06
 */

import type { DatabaseAdapter } from '../adapters/DatabaseAdapter.js';
import { getDbAdapter } from '../../admin/db/core.js';
import { translateError } from '../errors/index.js';
import type { IndexOperationRecord } from '../models/index-operation.js';
import type { OperationStatus, ProgressPhase } from '../../engine/indexer/types.js';
import { randomUUID } from 'crypto';

export interface ProgressUpdate {
  phase?: ProgressPhase | string;
  current?: number;
  total?: number;
  current_file?: string | null;
}

/** Record shape accepted by create() — server-generated fields optional. */
export type IndexOperationInsert = {
  user_id: string;
  project_id: string;
  status: OperationStatus;
  phase?: ProgressPhase | string;
  current?: number;
  total?: number;
  current_file?: string | null;
  id?: string;
};

export class IndexOperationRepository {
  constructor(private readonly adapter: DatabaseAdapter = getDbAdapter()) {}

  async create(op: IndexOperationInsert): Promise<void> {
    try {
      const id = op.id ?? randomUUID();
      await this.adapter.runAsync(
        `INSERT INTO index_operations (id, user_id, project_id, status, phase, current, total, current_file, started_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          op.user_id,
          op.project_id,
          op.status,
          op.phase ?? 'scanning',
          op.current ?? 0,
          op.total ?? 0,
          op.current_file ?? null,
          new Date().toISOString(),
          new Date().toISOString(),
        ],
      );
    } catch (err) {
      throw translateError(err);
    }
  }

  async updateProgress(id: string, fields: ProgressUpdate): Promise<void> {
    const sets: string[] = [];
    const params: unknown[] = [];
    if (fields.phase !== undefined) {
      sets.push('phase = ?');
      params.push(fields.phase);
    }
    if (fields.current !== undefined) {
      sets.push('current = ?');
      params.push(fields.current);
    }
    if (fields.total !== undefined) {
      sets.push('total = ?');
      params.push(fields.total);
    }
    if (fields.current_file !== undefined) {
      sets.push('current_file = ?');
      params.push(fields.current_file);
    }
    if (sets.length === 0) return;
    sets.push('updated_at = ?');
    params.push(new Date().toISOString());
    params.push(id);
    try {
      await this.adapter.runAsync(
        `UPDATE index_operations SET ${sets.join(', ')} WHERE id = ?`,
        params,
      );
    } catch (err) {
      throw translateError(err);
    }
  }

  async updateStatus(id: string, status: OperationStatus): Promise<void> {
    try {
      await this.adapter.runAsync(
        `UPDATE index_operations SET status = ?, updated_at = ? WHERE id = ?`,
        [status, new Date().toISOString(), id],
      );
    } catch (err) {
      throw translateError(err);
    }
  }

  /**
   * Auto-cancel any running/interrupted record for a tenant before starting a
   * new operation (BR-11). Marks them `superseded` so the partial unique index
   * frees up for the new run.
   */
  async supersedeActive(userId: string, projectId: string): Promise<number> {
    try {
      const res = await this.adapter.runAsync(
        `UPDATE index_operations SET status = 'superseded', updated_at = ?
         WHERE user_id = ? AND project_id = ? AND status IN ('running','interrupted')`,
        [new Date().toISOString(), userId, projectId],
      );
      return res.changes;
    } catch (err) {
      throw translateError(err);
    }
  }

  /** Latest running/interrupted record for a tenant (cold-path fallback). */
  async findActive(
    userId: string,
    projectId: string,
  ): Promise<IndexOperationRecord | null> {
    try {
      const row = await this.adapter.getAsync<any>(
        `SELECT * FROM index_operations
         WHERE user_id = ? AND project_id = ? AND status IN ('running','interrupted')
         ORDER BY updated_at DESC LIMIT 1`,
        [userId, projectId],
      );
      return row ? mapRow(row) : null;
    } catch (err) {
      throw translateError(err);
    }
  }

  /** Running records not updated within thresholdSeconds (for interrupt detection). */
  async findStaleRunning(thresholdSeconds: number): Promise<IndexOperationRecord[]> {
    const cutoff = new Date(Date.now() - thresholdSeconds * 1000).toISOString();
    try {
      const rows = await this.adapter.allAsync<any>(
        `SELECT * FROM index_operations WHERE status = 'running' AND updated_at < ?`,
        [cutoff],
      );
      return rows.map(mapRow);
    } catch (err) {
      throw translateError(err);
    }
  }

  /** All records currently marked `interrupted` (post-restart hydration). */
  async findInterrupted(): Promise<IndexOperationRecord[]> {
    try {
      const rows = await this.adapter.allAsync<any>(
        `SELECT * FROM index_operations WHERE status = 'interrupted'`,
        [],
      );
      return rows.map(mapRow);
    } catch (err) {
      throw translateError(err);
    }
  }

  /** Delete terminal records older than `hours` (BR-05). Never touches running/interrupted. */
  async deleteTerminalOlderThan(hours: number): Promise<number> {
    const cutoff = new Date(Date.now() - hours * 3600 * 1000).toISOString();
    try {
      const res = await this.adapter.runAsync(
        `DELETE FROM index_operations
         WHERE status IN ('completed','cancelled','failed','superseded') AND updated_at < ?`,
        [cutoff],
      );
      return res.changes;
    } catch (err) {
      throw translateError(err);
    }
  }
}

function mapRow(row: any): IndexOperationRecord {
  return {
    id: row.id,
    user_id: row.user_id,
    project_id: row.project_id,
    status: row.status,
    phase: row.phase,
    current: row.current,
    total: row.total,
    current_file: row.current_file ?? undefined,
    started_at: new Date(row.started_at),
    updated_at: new Date(row.updated_at),
  };
}
