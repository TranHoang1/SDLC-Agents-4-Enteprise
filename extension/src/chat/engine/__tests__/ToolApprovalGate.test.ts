/**
 * SA4E-85 — ToolApprovalGate unit tests.
 * Covers: approval/reject, timeout, dispose, idempotency guard,
 * rejection reasons, durable state callback, metrics, escalation,
 * retry mechanism, and event log integration.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ToolApprovalGate } from '../ToolApprovalGate';
import type { ApprovalResult, PendingSnapshot } from '../ToolApprovalGate';

describe('ToolApprovalGate', () => {
  let gate: ToolApprovalGate;

  beforeEach(() => {
    vi.useFakeTimers();
    gate = new ToolApprovalGate(30_000);
  });

  afterEach(() => {
    gate.dispose();
    vi.useRealTimers();
  });

  it('should block until user approves', async () => {
    const promise = gate.requestApproval('tc-1');
    expect(gate.hasPending('tc-1')).toBe(true);

    gate.resolveApproval('tc-1', 'approve');

    const result = await promise;
    expect(result.decision).toBe('approve');
    expect(gate.hasPending('tc-1')).toBe(false);
  });

  it('should block until user rejects with reason', async () => {
    const promise = gate.requestApproval('tc-2');
    gate.resolveApproval('tc-2', 'reject');

    const result = await promise;
    expect(result.decision).toBe('reject');
    expect((result as { reason: string }).reason).toBe('user_reject');
  });

  it('should auto-reject on timeout with reason', async () => {
    const promise = gate.requestApproval('tc-timeout');
    vi.advanceTimersByTime(30_001);

    const result = await promise;
    expect(result.decision).toBe('reject');
    expect((result as { reason: string }).reason).toBe('timeout');
    expect(gate.hasPending('tc-timeout')).toBe(false);
  });

  it('should be no-op if resolving unknown toolCallId', () => {
    gate.resolveApproval('nonexistent', 'approve');
    expect(gate.pendingCount).toBe(0);
  });

  it('should handle multiple concurrent approvals independently', async () => {
    const p1 = gate.requestApproval('tc-a');
    const p2 = gate.requestApproval('tc-b');
    expect(gate.pendingCount).toBe(2);

    gate.resolveApproval('tc-b', 'reject');
    gate.resolveApproval('tc-a', 'approve');

    const r1 = await p1;
    const r2 = await p2;
    expect(r1.decision).toBe('approve');
    expect(r2.decision).toBe('reject');
    expect(gate.pendingCount).toBe(0);
  });

  it('should reject all pending on dispose with reason', async () => {
    const p1 = gate.requestApproval('tc-x');
    const p2 = gate.requestApproval('tc-y');
    gate.dispose();

    const r1 = await p1;
    const r2 = await p2;
    expect(r1).toEqual({ decision: 'reject', reason: 'dispose' });
    expect(r2).toEqual({ decision: 'reject', reason: 'dispose' });
    expect(gate.pendingCount).toBe(0);
  });

  it('should use custom timeout value', async () => {
    const shortGate = new ToolApprovalGate(100);
    const promise = shortGate.requestApproval('tc-short');
    vi.advanceTimersByTime(101);

    const result = await promise;
    expect(result.decision).toBe('reject');
    expect((result as { reason: string }).reason).toBe('timeout');
    shortGate.dispose();
  });
});

describe('ToolApprovalGate — Idempotency Guard', () => {
  let gate: ToolApprovalGate;

  beforeEach(() => {
    vi.useFakeTimers();
    gate = new ToolApprovalGate(30_000);
  });

  afterEach(() => {
    gate.dispose();
    vi.useRealTimers();
  });

  it('should return same promise for duplicate requestApproval calls', async () => {
    const p1 = gate.requestApproval('tc-dup');
    const p2 = gate.requestApproval('tc-dup');

    // Same reference — no duplicate entry created
    expect(p1).toBe(p2);
    expect(gate.pendingCount).toBe(1);

    gate.resolveApproval('tc-dup', 'approve');
    const r1 = await p1;
    const r2 = await p2;
    expect(r1.decision).toBe('approve');
    expect(r2.decision).toBe('approve');
  });

  it('should not increment totalRequested on duplicate call', () => {
    gate.requestApproval('tc-idem');
    gate.requestApproval('tc-idem');
    gate.requestApproval('tc-idem');

    expect(gate.getMetrics().totalRequested).toBe(1);
  });
});

describe('ToolApprovalGate — Durable State Callback', () => {
  let gate: ToolApprovalGate;
  let stateChanges: PendingSnapshot[][];

  beforeEach(() => {
    vi.useFakeTimers();
    stateChanges = [];
    gate = new ToolApprovalGate({
      timeoutMs: 5_000,
      onStateChange: (pending) => stateChanges.push([...pending]),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should fire onStateChange on requestApproval', () => {
    gate.requestApproval('tc-s1');
    expect(stateChanges).toHaveLength(1);
    expect(stateChanges[0]).toHaveLength(1);
    expect(stateChanges[0][0].toolCallId).toBe('tc-s1');
  });

  it('should fire onStateChange on resolveApproval', () => {
    gate.requestApproval('tc-s2');
    gate.resolveApproval('tc-s2', 'approve');

    // 2 calls: one for request, one for resolve
    expect(stateChanges).toHaveLength(2);
    expect(stateChanges[1]).toHaveLength(0);
  });

  it('should fire onStateChange on timeout', () => {
    gate.requestApproval('tc-s3');
    vi.advanceTimersByTime(5_001);

    expect(stateChanges).toHaveLength(2);
    expect(stateChanges[1]).toHaveLength(0);
  });

  it('should fire onStateChange on dispose', () => {
    gate.requestApproval('tc-s4');
    gate.dispose();

    expect(stateChanges).toHaveLength(2);
    expect(stateChanges[1]).toHaveLength(0);
  });
});

describe('ToolApprovalGate — Metrics', () => {
  let gate: ToolApprovalGate;

  beforeEach(() => {
    vi.useFakeTimers();
    gate = new ToolApprovalGate(30_000);
  });

  afterEach(() => {
    gate.dispose();
    vi.useRealTimers();
  });

  it('should return zero metrics initially', () => {
    const m = gate.getMetrics();
    expect(m).toEqual({
      totalRequested: 0,
      totalApproved: 0,
      totalRejected: 0,
      avgResponseMs: 0,
    });
  });

  it('should track approved count and timing', async () => {
    gate.requestApproval('tc-m1');
    vi.advanceTimersByTime(500);
    gate.resolveApproval('tc-m1', 'approve');

    const m = gate.getMetrics();
    expect(m.totalRequested).toBe(1);
    expect(m.totalApproved).toBe(1);
    expect(m.avgResponseMs).toBe(500);
  });

  it('should track rejected count from timeout', async () => {
    gate.requestApproval('tc-m2');
    vi.advanceTimersByTime(30_001);

    const m = gate.getMetrics();
    expect(m.totalRejected).toBe(1);
    expect(m.totalRequested).toBe(1);
  });

  it('should compute avgResponseMs correctly', async () => {
    gate.requestApproval('tc-fast');
    vi.advanceTimersByTime(100);
    gate.resolveApproval('tc-fast', 'approve');

    gate.requestApproval('tc-slow');
    vi.advanceTimersByTime(300);
    gate.resolveApproval('tc-slow', 'approve');

    const m = gate.getMetrics();
    // avg of 100 and 300 = 200
    expect(m.avgResponseMs).toBe(200);
    expect(m.totalApproved).toBe(2);
  });
});

describe('ToolApprovalGate — Backward Compatibility', () => {
  it('should accept number as constructor arg', () => {
    const gate = new ToolApprovalGate(5000);
    expect(gate.pendingCount).toBe(0);
    gate.dispose();
  });

  it('should accept options object as constructor arg', () => {
    const gate = new ToolApprovalGate({ timeoutMs: 5000 });
    expect(gate.pendingCount).toBe(0);
    gate.dispose();
  });

  it('should default to 30s timeout with no args', () => {
    vi.useFakeTimers();
    const gate = new ToolApprovalGate();
    const p = gate.requestApproval('tc-def');
    vi.advanceTimersByTime(30_001);
    // Should have auto-rejected
    expect(gate.hasPending('tc-def')).toBe(false);
    gate.dispose();
    vi.useRealTimers();
  });
});

describe('ToolApprovalGate — 2-Phase Escalation', () => {
  let gate: ToolApprovalGate;
  let escalations: { toolCallId: string; remainingMs: number }[];

  beforeEach(() => {
    vi.useFakeTimers();
    escalations = [];
    gate = new ToolApprovalGate({
      timeoutMs: 10_000,
      warningMs: 7_000,
      onEscalation: (toolCallId, remainingMs) => {
        escalations.push({ toolCallId, remainingMs });
      },
    });
  });

  afterEach(() => {
    gate.dispose();
    vi.useRealTimers();
  });

  it('should fire onEscalation at warningMs', () => {
    gate.requestApproval('tc-esc1');
    vi.advanceTimersByTime(7_001);

    expect(escalations).toHaveLength(1);
    expect(escalations[0].toolCallId).toBe('tc-esc1');
    // remainingMs = timeoutMs - warningMs = 3000
    expect(escalations[0].remainingMs).toBe(3_000);
  });

  it('should not fire onEscalation if resolved before warning', () => {
    gate.requestApproval('tc-esc2');
    vi.advanceTimersByTime(3_000);
    gate.resolveApproval('tc-esc2', 'approve');
    vi.advanceTimersByTime(10_000);

    expect(escalations).toHaveLength(0);
  });

  it('should still hard-reject at timeoutMs after escalation', async () => {
    const promise = gate.requestApproval('tc-esc3');
    vi.advanceTimersByTime(10_001);

    const result = await promise;
    expect(result.decision).toBe('reject');
    expect((result as { reason: string }).reason).toBe('timeout');
    expect(escalations).toHaveLength(1);
  });

  it('should default warningMs to 70% of timeoutMs', () => {
    const customGate = new ToolApprovalGate({
      timeoutMs: 20_000,
      onEscalation: (id, ms) => escalations.push({ toolCallId: id, remainingMs: ms }),
    });
    customGate.requestApproval('tc-def-warn');
    // 70% of 20000 = 14000
    vi.advanceTimersByTime(14_001);
    expect(escalations).toHaveLength(1);
    // remainingMs = 20000 - 14000 = 6000
    expect(escalations[0].remainingMs).toBe(6_000);
    customGate.dispose();
  });
});

describe('ToolApprovalGate — Retry Mechanism', () => {
  let gate: ToolApprovalGate;

  beforeEach(() => {
    vi.useFakeTimers();
    gate = new ToolApprovalGate({ timeoutMs: 5_000 });
  });

  afterEach(() => {
    gate.dispose();
    vi.useRealTimers();
  });

  it('should allow retry after timeout rejection', async () => {
    const p1 = gate.requestApproval('tc-retry1');
    vi.advanceTimersByTime(5_001);
    await p1; // consumed — rejected

    const p2 = gate.retryApproval('tc-retry1');
    expect(p2).not.toBeNull();
    expect(gate.hasPending('tc-retry1')).toBe(true);

    gate.resolveApproval('tc-retry1', 'approve');
    const result = await p2!;
    expect(result.decision).toBe('approve');
  });

  it('should return null after max retries (3)', async () => {
    // Attempt 1 (initial request)
    const p1 = gate.requestApproval('tc-maxretry');
    vi.advanceTimersByTime(5_001);
    await p1;

    // Attempt 2 (retry 1)
    const p2 = gate.retryApproval('tc-maxretry');
    expect(p2).not.toBeNull();
    vi.advanceTimersByTime(5_001);
    await p2!;

    // Attempt 3 (retry 2)
    const p3 = gate.retryApproval('tc-maxretry');
    expect(p3).not.toBeNull();
    vi.advanceTimersByTime(5_001);
    await p3!;

    // Attempt 4 — should be blocked
    const p4 = gate.retryApproval('tc-maxretry');
    expect(p4).toBeNull();
  });

  it('should reset timers on retry', async () => {
    const p1 = gate.requestApproval('tc-timer-reset');
    vi.advanceTimersByTime(5_001);
    await p1;

    const p2 = gate.retryApproval('tc-timer-reset');
    expect(p2).not.toBeNull();

    // Should not auto-reject at 4000ms into retry
    vi.advanceTimersByTime(4_000);
    expect(gate.hasPending('tc-timer-reset')).toBe(true);

    // Should auto-reject at full timeout from retry start
    vi.advanceTimersByTime(1_001);
    const result = await p2!;
    expect(result.decision).toBe('reject');
    expect((result as { reason: string }).reason).toBe('timeout');
  });

  it('should return null for unknown toolCallId retry', () => {
    // Never requested — attemptHistory has 0
    const result = gate.retryApproval('tc-unknown');
    expect(result).toBeNull();
  });
});
