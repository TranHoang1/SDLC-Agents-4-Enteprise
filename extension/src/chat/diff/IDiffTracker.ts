/**
 * SA4E-183 — IDiffTracker Interface & Types.
 * Defines the contract for session-scoped file change tracking.
 * All types for ChangeEntry, DiffSummary, and RecordChangeInput live here.
 */

/** File operation classification */
export type OperationType = 'added' | 'modified' | 'deleted';

/**
 * A single recorded file change within the current session.
 * Represents the latest state of a file modification.
 */
export interface ChangeEntry {
  filePath: string;
  operation: OperationType;
  linesAdded: number;
  linesRemoved: number;
  diffContent: string;
  timestamp: number;
  originalContent?: string;
}

/**
 * Aggregated summary of all file changes in the session.
 * Computed on-demand by getSummary().
 */
export interface DiffSummary {
  totalFiles: number;
  totalAdded: number;
  totalModified: number;
  totalDeleted: number;
  totalLinesAdded: number;
  totalLinesRemoved: number;
  entries: ChangeEntry[];
}

/**
 * Input for recording a new file change.
 * Passed from tool execution hooks into DiffTracker.
 */
export interface RecordChangeInput {
  filePath: string;
  operation: OperationType;
  linesAdded: number;
  linesRemoved: number;
  diffContent: string;
  originalContent?: string;
}

/**
 * Payload shape sent to webview via DIFF_SUMMARY_RESPONSE.
 * Excludes originalContent for security (not needed by UI).
 */
export interface DiffSummaryPayload {
  totalFiles: number;
  totalAdded: number;
  totalModified: number;
  totalDeleted: number;
  totalLinesAdded: number;
  totalLinesRemoved: number;
  entries: ChangeEntryPayload[];
}

/**
 * Single entry payload for webview consumption.
 * Strips originalContent (never sent to webview).
 */
export interface ChangeEntryPayload {
  filePath: string;
  operation: OperationType;
  linesAdded: number;
  linesRemoved: number;
  diffContent: string;
  timestamp: number;
}

/**
 * Core DiffTracker interface (ISP — focused contract).
 * Session-scoped singleton that records file changes and exposes summaries.
 */
export interface IDiffTracker {
  /** Record a successful file change. Debounces badge update (100ms). */
  recordChange(input: RecordChangeInput): void;
  /** Compute current aggregated summary on demand. */
  getSummary(): DiffSummary;
  /** Get current tracked file count. */
  getFileCount(): number;
  /** Get original content for a tracked file (for VS Code diff editor). */
  getOriginalContent(filePath: string): string | undefined;
  /** Clear all tracked state (session reset). */
  clearSession(): void;
  /** Dispose resources (debounce timer). */
  dispose(): void;
}
