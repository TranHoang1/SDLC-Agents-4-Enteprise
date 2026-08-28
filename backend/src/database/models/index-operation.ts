/**
 * SA4E-101 — Index operation persistence record (DB cold-path).
 * Mirrors the `index_operations` table defined in the SA4E-101 migration.
 */

import type { OperationStatus, ProgressPhase } from '../../engine/indexer/types.js';

export interface IndexOperationRecord {
  id: string; // UUID
  user_id: string; // from JWT
  project_id: string; // from X-Project-Id
  status: OperationStatus;
  phase: ProgressPhase | string;
  current: number;
  total: number;
  current_file?: string;
  started_at: Date;
  updated_at: Date;
}
