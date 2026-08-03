/**
 * SA4E-85 — Code Diff Types (Phase 5).
 * Shared interfaces for diff block management, apply results,
 * and tool handler contract.
 */

/** Staleness threshold: 5 minutes in milliseconds (BR-06) */
export const STALE_THRESHOLD_MS = 5 * 60 * 1000;

/** Represents a single code diff block with metadata */
export interface DiffBlock {
  /** Unique identifier for this diff */
  diffId: string;
  /** Target file path (workspace-relative or absolute) */
  filePath: string;
  /** Unified diff patch content */
  patch: string;
  /** SHA-256 hash of file at patch generation time (BR-05) */
  fileHashAtGeneration: string;
  /** Timestamp when the patch was generated (Date.now()) */
  generatedAt: number;
  /** Current lifecycle status of this diff */
  status: DiffStatus;
}

/** Possible diff lifecycle states */
export type DiffStatus =
  | 'pending'
  | 'applied'
  | 'rejected'
  | 'stale'
  | 'conflict';

/** Result from attempting to apply a diff */
export interface ApplyResult {
  /** Whether the patch was applied successfully */
  success: boolean;
  /** Error category if apply failed */
  error?: ApplyError;
}

/** Categorized apply failure reasons */
export type ApplyError = 'CONFLICT' | 'FILE_DELETED' | 'EDIT_FAILED';

/**
 * Tool handler interface for code diff operations (DIP).
 * Extension host implements this; webview consumes via messages.
 */
export interface IToolHandler {
  /** Apply a diff via WorkspaceEdit (BR-23) */
  applyDiff(diff: DiffBlock): Promise<ApplyResult>;
  /** Mark diff as rejected without applying */
  rejectDiff(diffId: string): void;
  /** Request fresh patch after conflict (BR-07) */
  regeneratePatch(diffId: string, filePath: string): Promise<DiffBlock>;
  /** Compute current file hash for comparison */
  computeFileHash(filePath: string): Promise<string>;
  /** Run a terminal command */
  runTerminalCommand(command: string, terminalName: string): void;
}

/**
 * Check if a DiffBlock is stale (BR-06).
 * A patch older than 5 minutes is considered potentially outdated.
 * @param diff - DiffBlock to check
 * @returns True if patch exceeds staleness threshold
 */
export function isDiffStale(diff: DiffBlock): boolean {
  return Date.now() - diff.generatedAt > STALE_THRESHOLD_MS;
}
