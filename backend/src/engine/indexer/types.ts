/**
 * SA4E-78 — Indexer type definitions for decoupled architecture.
 * Shared interfaces for file events, progress tracking, and operation management.
 */

/** File event pushed from Extension-driven file watching. */
export interface FileEvent {
  /** Event type: add = new file, change = modified, delete = removed */
  type: 'add' | 'change' | 'delete';
  /** Relative path within workspace */
  path: string;
  /** File content for add/change (optional — if absent, file must exist on disk) */
  content?: string;
  /** SHA-256 prefix for skip-if-unchanged optimization */
  contentHash?: string;
}

/** Progress phases during a full index operation lifecycle. */
export type ProgressPhase =
  | 'idle'
  | 'scanning'
  | 'indexing'
  | 'resolving'
  | 'complete'
  | 'cancelled'
  | 'error';

/** Runtime status of a tracked index operation. */
export type OperationStatus = 'running' | 'completed' | 'cancelled' | 'failed';

/** Progress snapshot emitted at batch boundaries. */
export interface ProgressEvent {
  operationId: string;
  phase: ProgressPhase;
  current: number;
  total: number;
  percentage: number;
  message?: string;
  currentFile?: string;
  startedAt: string;
  elapsedMs: number;
}

/** Result summary returned from the file-events endpoint. */
export interface FileEventsResult {
  indexed: number;
  updated: number;
  removed: number;
  skipped: number;
  rejected: string[];
  projectId: string;
}
