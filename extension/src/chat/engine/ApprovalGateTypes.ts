/**
 * SA4E-85 — Type definitions for ToolApprovalGate.
 * Models separated from processing logic per code standards.
 */

import type { ApprovalEventLog } from './ApprovalEventLog';

/** Reason why a tool call was rejected */
export type RejectionReason = 'user_reject' | 'timeout' | 'dispose';

/** Rich result returned from the approval gate */
export type ApprovalResult =
  | { decision: 'approve' }
  | { decision: 'reject'; reason: RejectionReason };

/** Snapshot of a pending approval for external persistence */
export interface PendingSnapshot {
  toolCallId: string;
  requestedAt: number;
}

/** Options for constructing the gate */
export interface ToolApprovalGateOptions {
  timeoutMs?: number;
  /** Warning timeout (fires onEscalation). Default: timeoutMs * 0.7 */
  warningMs?: number;
  /** Fires whenever the pending set changes — enables durable state persistence */
  onStateChange?: (pending: PendingSnapshot[]) => void;
  /** Fires when warning phase reached — UI should show "Approve soon or auto-reject" */
  onEscalation?: (toolCallId: string, remainingMs: number) => void;
  /** Event log for JSONL audit trail */
  eventLog?: ApprovalEventLog;
}

/** Aggregate metrics tracked by the gate */
export interface ApprovalMetrics {
  totalRequested: number;
  totalApproved: number;
  totalRejected: number;
  avgResponseMs: number;
}

/** Internal record for a pending approval request */
export interface PendingApproval {
  resolve: (result: ApprovalResult) => void;
  promise: Promise<ApprovalResult>;
  timer: ReturnType<typeof setTimeout>;
  warningTimer?: ReturnType<typeof setTimeout>;
  requestedAt: number;
  attemptCount: number;
}

/** Default timeout before auto-rejecting (120 seconds — gives user time to review) */
export const DEFAULT_TIMEOUT_MS = 120_000;

/** Maximum retry attempts per toolCallId */
export const MAX_RETRY_ATTEMPTS = 3;
