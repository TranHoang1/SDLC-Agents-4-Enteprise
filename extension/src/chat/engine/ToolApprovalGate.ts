/**
 * SA4E-85 — ToolApprovalGate.
 * Manages deferred Promises keyed by toolCallId, allowing the graph
 * to pause execution until the user approves or rejects a dangerous tool.
 *
 * Pattern: Promise-based gate with timeout auto-reject, 2-phase escalation,
 * retry mechanism, idempotency guard, durable state callback, and metrics.
 */

import type { ApprovalEventLog } from './ApprovalEventLog';
import type {
  ApprovalResult, ApprovalMetrics, PendingSnapshot,
  ToolApprovalGateOptions, PendingApproval, RejectionReason,
} from './ApprovalGateTypes';
import { DEFAULT_TIMEOUT_MS, MAX_RETRY_ATTEMPTS } from './ApprovalGateTypes';

// Re-export types for consumers
export type { ApprovalResult, RejectionReason, ApprovalMetrics, PendingSnapshot, ToolApprovalGateOptions };

/**
 * Gate that blocks tool execution until user provides approval.
 * Each dangerous tool call creates a deferred Promise via `requestApproval()`.
 * The UI handler calls `resolveApproval()` when user responds.
 */
export class ToolApprovalGate {
  private readonly pending = new Map<string, PendingApproval>();
  private readonly attemptHistory = new Map<string, number>();
  private readonly timeoutMs: number;
  private readonly warningMs: number;
  private readonly onStateChange?: (pending: PendingSnapshot[]) => void;
  private readonly onEscalation?: (toolCallId: string, remainingMs: number) => void;
  private readonly eventLog?: ApprovalEventLog;
  private totalRequested = 0;
  private totalApproved = 0;
  private totalRejected = 0;
  private totalResponseMs = 0;

  constructor(options?: number | ToolApprovalGateOptions) {
    if (typeof options === 'number') {
      this.timeoutMs = options;
      this.warningMs = options * 0.7;
    } else {
      this.timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
      this.warningMs = options?.warningMs ?? this.timeoutMs * 0.7;
      this.onStateChange = options?.onStateChange;
      this.onEscalation = options?.onEscalation;
      this.eventLog = options?.eventLog;
    }
  }

  /**
   * Request approval for a tool call. Idempotent — same ID returns existing Promise.
   * @param toolCallId - Unique identifier for the tool call
   */
  requestApproval(toolCallId: string): Promise<ApprovalResult> {
    const existing = this.pending.get(toolCallId);
    if (existing) return existing.promise;

    const entry = this.createPendingEntry(toolCallId);
    this.pending.set(toolCallId, entry);
    this.totalRequested++;
    this.attemptHistory.set(toolCallId, 1);
    this.eventLog?.emit({ event: 'request', toolCallId });
    this.notifyStateChange();
    return entry.promise;
  }

  /**
   * Resolve a pending approval. No-op if toolCallId not found.
   * @param toolCallId - The tool call to resolve
   * @param decision - User's approval decision
   */
  resolveApproval(toolCallId: string, decision: 'approve' | 'reject'): void {
    const entry = this.pending.get(toolCallId);
    if (!entry) return;
    this.clearTimers(entry);
    this.recordMetrics(entry, decision);
    this.pending.delete(toolCallId);
    this.eventLog?.emit({ event: decision === 'approve' ? 'approve' : 'reject', toolCallId });
    entry.resolve(this.buildResult(decision, 'user_reject'));
    this.notifyStateChange();
  }

  /**
   * Retry approval for a previously rejected tool call.
   * Max 3 retries per toolCallId to prevent infinite loops.
   * @param toolCallId - The tool call to retry
   * @returns New Promise, or null if max retries exceeded or unknown ID
   */
  retryApproval(toolCallId: string): Promise<ApprovalResult> | null {
    const attempts = this.attemptHistory.get(toolCallId);
    if (attempts === undefined || attempts >= MAX_RETRY_ATTEMPTS) return null;
    const stale = this.pending.get(toolCallId);
    if (stale) this.clearTimers(stale);
    const newAttempt = attempts + 1;
    this.attemptHistory.set(toolCallId, newAttempt);
    const entry = this.createPendingEntry(toolCallId, newAttempt);
    this.pending.set(toolCallId, entry);
    this.eventLog?.emit({ event: 'retry', toolCallId, data: { attempt: newAttempt } });
    this.notifyStateChange();
    return entry.promise;
  }

  /** Check if a tool call is currently awaiting approval */
  hasPending(toolCallId: string): boolean {
    return this.pending.has(toolCallId);
  }

  /** Count of all pending approvals */
  get pendingCount(): number {
    return this.pending.size;
  }

  /** Get aggregate metrics for all approval requests processed */
  getMetrics(): ApprovalMetrics {
    const responded = this.totalApproved + this.totalRejected;
    return {
      totalRequested: this.totalRequested,
      totalApproved: this.totalApproved,
      totalRejected: this.totalRejected,
      avgResponseMs: responded > 0 ? this.totalResponseMs / responded : 0,
    };
  }

  /** Dispose all pending approvals (reject them) on shutdown */
  dispose(): void {
    for (const [id, entry] of this.pending) {
      this.clearTimers(entry);
      entry.resolve({ decision: 'reject', reason: 'dispose' });
      this.recordMetrics(entry, 'reject');
      this.eventLog?.emit({ event: 'dispose', toolCallId: id });
    }
    this.pending.clear();
    this.eventLog?.close();
    this.notifyStateChange();
  }

  // --- Private helpers ---

  private createPendingEntry(toolCallId: string, attempt = 1): PendingApproval {
    const requestedAt = Date.now();
    let resolve!: (result: ApprovalResult) => void;
    const promise = new Promise<ApprovalResult>((res) => { resolve = res; });
    const timer = setTimeout(() => this.handleTimeout(toolCallId), this.timeoutMs);
    if (timer.unref) timer.unref();
    const warningTimer = this.createWarningTimer(toolCallId);
    return { resolve, promise, timer, warningTimer, requestedAt, attemptCount: attempt };
  }

  private createWarningTimer(toolCallId: string): ReturnType<typeof setTimeout> | undefined {
    if (!this.onEscalation) return undefined;
    const remainingMs = this.timeoutMs - this.warningMs;
    const t = setTimeout(() => this.onEscalation!(toolCallId, remainingMs), this.warningMs);
    if (t.unref) t.unref();
    return t;
  }

  private handleTimeout(toolCallId: string): void {
    const entry = this.pending.get(toolCallId);
    if (!entry) return;
    if (entry.warningTimer) clearTimeout(entry.warningTimer);
    this.recordMetrics(entry, 'reject');
    this.pending.delete(toolCallId);
    this.eventLog?.emit({ event: 'timeout', toolCallId });
    entry.resolve({ decision: 'reject', reason: 'timeout' });
    this.notifyStateChange();
  }

  private buildResult(decision: 'approve' | 'reject', reason: RejectionReason): ApprovalResult {
    return decision === 'approve' ? { decision: 'approve' } : { decision: 'reject', reason };
  }

  private recordMetrics(entry: PendingApproval, decision: 'approve' | 'reject'): void {
    const elapsed = Date.now() - entry.requestedAt;
    this.totalResponseMs += elapsed;
    if (decision === 'approve') this.totalApproved++;
    else this.totalRejected++;
  }

  private clearTimers(entry: PendingApproval): void {
    clearTimeout(entry.timer);
    if (entry.warningTimer) clearTimeout(entry.warningTimer);
  }

  private notifyStateChange(): void {
    if (!this.onStateChange) return;
    const snapshot: PendingSnapshot[] = [];
    for (const [id, entry] of this.pending) {
      snapshot.push({ toolCallId: id, requestedAt: entry.requestedAt });
    }
    this.onStateChange(snapshot);
  }
}
