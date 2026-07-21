/**
 * SA4E-50 — Repository type definitions (models/DTOs).
 * Separated from processing logic per code standards.
 * Implements: BR-06
 */

/** Node count breakdown returned by GraphRepository. */
export interface GraphNodeCounts {
  total: number;
  code: number;
  kb: number;
}

/** Parameters for upserting a graph node. */
export interface UpsertNodeParams {
  entryId: string;
  label: string;
  type: string;
  tier: string;
  projectId: string;
  x?: number;
  y?: number;
  z?: number;
  level?: string;
  clusterId?: string;
}

/** A single audit log entry. */
export interface AuditEntry {
  id: number;
  userId: string;
  username: string;
  action: string;
  resource: string;
  resourceId?: string;
  details?: string;
  timestamp: string;
}

/** Paginated result set for list queries. */
export interface PaginatedResult {
  items: Record<string, unknown>[];
  total: number;
}

/** Detail of a single code symbol (for KB Graph node click). */
export interface SymbolDetail {
  id: number;
  name: string;
  kind: string;
  signature: string | null;
  startLine: number | null;
  endLine: number | null;
  parentSymbol: string | null;
  visibility: string | null;
  docComment: string | null;
  relativePath: string | null;
  language: string | null;
  module: string | null;
}
