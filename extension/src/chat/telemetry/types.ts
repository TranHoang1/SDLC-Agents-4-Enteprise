/**
 * SA4E-85 — Telemetry types (Task 8.3).
 * JSONL telemetry event definitions for local-only logging.
 * Privacy-first: no network calls, append to .code-intel/telemetry.jsonl.
 */

/** Base fields shared by all telemetry entries */
interface TelemetryBase {
  /** ISO-8601 timestamp of the event */
  timestamp: string;
}

/** Diff accept/reject action in OpenCodeToolHandler */
export interface DiffActionEntry extends TelemetryBase {
  type: 'diff_action';
  agentId: string;
  action: 'accept' | 'reject';
  toolName: string;
  filePath: string;
}

/** MCP tool execution completion */
export interface ToolExecEntry extends TelemetryBase {
  type: 'tool_exec';
  toolName: string;
  duration_ms: number;
  success: boolean;
  agentId: string;
}

/** Context prune/unpin/clear operation */
export interface ContextPruneEntry extends TelemetryBase {
  type: 'context_prune';
  action: 'unpin' | 'clear';
  filePath?: string;
  tokenFreed: number;
}

/** LLM stream error occurrence */
export interface StreamErrorEntry extends TelemetryBase {
  type: 'stream_error';
  code: string;
  agentId: string;
  recoverable: boolean;
}

/** Permission guard approve/deny decision */
export interface PermissionDecisionEntry extends TelemetryBase {
  type: 'permission_decision';
  toolId: string;
  toolName: string;
  toolType: string;
  decision: 'APPROVE' | 'REJECT';
  sessionApproval: boolean;
}

/** Union of all telemetry event types */
export type TelemetryEntry =
  | DiffActionEntry
  | ToolExecEntry
  | ContextPruneEntry
  | StreamErrorEntry
  | PermissionDecisionEntry;

/**
 * ITelemetryService — contract for telemetry implementations.
 * Local-only, async buffered write.
 */
export interface ITelemetryService {
  /** Log a telemetry entry (buffered, async) */
  log(entry: TelemetryEntry): void;
  /** Flush buffered entries to disk */
  flush(): Promise<void>;
  /** Dispose and flush remaining entries */
  dispose(): Promise<void>;
}
