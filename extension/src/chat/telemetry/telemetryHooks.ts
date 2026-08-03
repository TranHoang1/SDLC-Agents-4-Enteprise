/**
 * SA4E-85 — Telemetry hooks (Task 8.4).
 * Factory functions for creating telemetry entries at key integration points.
 * Each hook creates a properly-typed entry and logs via ITelemetryService.
 * Locations: OpenCodeToolHandler, toolStore, IdeContextManager, chatStore, PermissionGuard.
 */

import type { ITelemetryService } from './types';
import type {
  DiffActionEntry,
  ToolExecEntry,
  ContextPruneEntry,
  StreamErrorEntry,
  PermissionDecisionEntry,
} from './types';

/** Create ISO-8601 timestamp for current moment */
function now(): string {
  return new Date().toISOString();
}

/**
 * Log a diff accept/reject action (OpenCodeToolHandler).
 * @param service - Telemetry service instance
 * @param agentId - Agent that generated the diff
 * @param action - User decision: accept or reject
 * @param toolName - Tool that produced the diff
 * @param filePath - Target file path
 */
export function logDiffAction(
  service: ITelemetryService,
  agentId: string,
  action: 'accept' | 'reject',
  toolName: string,
  filePath: string
): void {
  const entry: DiffActionEntry = {
    type: 'diff_action',
    agentId,
    action,
    toolName,
    filePath,
    timestamp: now(),
  };
  service.log(entry);
}

/**
 * Log a tool execution completion (toolStore on MCP_TOOL_RESULT).
 * @param service - Telemetry service instance
 * @param toolName - Executed tool name
 * @param duration_ms - Execution duration in milliseconds
 * @param success - Whether tool completed without error
 * @param agentId - Agent that requested the tool
 */
export function logToolExec(
  service: ITelemetryService,
  toolName: string,
  duration_ms: number,
  success: boolean,
  agentId: string
): void {
  const entry: ToolExecEntry = {
    type: 'tool_exec',
    toolName,
    duration_ms,
    success,
    agentId,
    timestamp: now(),
  };
  service.log(entry);
}

/**
 * Log a context prune/unpin/clear (IdeContextManager).
 * @param service - Telemetry service instance
 * @param action - Prune action type
 * @param tokenFreed - Number of tokens freed
 * @param filePath - File path (for unpin; undefined for clear)
 */
export function logContextPrune(
  service: ITelemetryService,
  action: 'unpin' | 'clear',
  tokenFreed: number,
  filePath?: string
): void {
  const entry: ContextPruneEntry = {
    type: 'context_prune',
    action,
    tokenFreed,
    filePath,
    timestamp: now(),
  };
  service.log(entry);
}

/**
 * Log a stream error (chatStore on STREAM_ERROR).
 * @param service - Telemetry service instance
 * @param code - Error code (e.g., LLM_TIMEOUT)
 * @param agentId - Agent session that errored
 * @param recoverable - Whether error is retryable
 */
export function logStreamError(
  service: ITelemetryService,
  code: string,
  agentId: string,
  recoverable: boolean
): void {
  const entry: StreamErrorEntry = {
    type: 'stream_error',
    code,
    agentId,
    recoverable,
    timestamp: now(),
  };
  service.log(entry);
}

/**
 * Log a permission decision (PermissionGuard on approve/deny).
 * @param service - Telemetry service instance
 * @param toolId - Tool call identifier
 * @param toolName - Tool display name
 * @param toolType - Tool category (shell, file, mcp, etc.)
 * @param decision - User decision
 * @param sessionApproval - Whether approval covers entire session
 */
export function logPermissionDecision(
  service: ITelemetryService,
  toolId: string,
  toolName: string,
  toolType: string,
  decision: 'APPROVE' | 'REJECT',
  sessionApproval: boolean
): void {
  const entry: PermissionDecisionEntry = {
    type: 'permission_decision',
    toolId,
    toolName,
    toolType,
    decision,
    sessionApproval,
    timestamp: now(),
  };
  service.log(entry);
}
