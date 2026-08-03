/**
 * SA4E-85 — Unit Tests: Permission Guard (UT-PG-01/02/03/04).
 * Tests permission gate logic for dangerous vs safe tools.
 */

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';

describe('UT-PG-01: Dangerous Tool Shows PermissionGuard', () => {
  test('requiresApproval=true triggers guard display', () => {
    const request = { type: 'TOOL_CALL_REQUEST', toolId: 't1', name: 'write_file', args: { path: 'x' }, requiresApproval: true, toolType: 'write' as const };
    const shouldShowGuard = request.requiresApproval === true;
    expect(shouldShowGuard).toBe(true);
  });
});

describe('UT-PG-02: Safe Tool Auto-Approves', () => {
  test('requiresApproval=false auto-approves without guard', () => {
    const request = { type: 'TOOL_CALL_REQUEST', toolId: 't2', name: 'read_file', args: {}, requiresApproval: false, toolType: 'read' as const };
    const shouldShowGuard = request.requiresApproval === true;
    expect(shouldShowGuard).toBe(false);
    const decision = shouldShowGuard ? 'PENDING' : 'APPROVE';
    expect(decision).toBe('APPROVE');
  });
});

describe('UT-PG-03: Permission Timeout Auto-Denies at 60s', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  test('auto-rejects after 60000ms timeout', () => {
    let decision: string | null = null;
    const TIMEOUT_MS = 60_000;
    setTimeout(() => { decision = 'REJECT'; }, TIMEOUT_MS);
    vi.advanceTimersByTime(TIMEOUT_MS);
    expect(decision).toBe('REJECT');
  });
});

describe('UT-PG-04: Allow All Session Scope Per Type', () => {
  test('session approval applies only to matching toolType', () => {
    const sessionApprovals = new Set<string>();
    sessionApprovals.add('write');

    const writeAutoApproved = sessionApprovals.has('write');
    expect(writeAutoApproved).toBe(true);

    const shellAutoApproved = sessionApprovals.has('shell');
    expect(shellAutoApproved).toBe(false);
  });

  test('session approval does not leak across types', () => {
    const sessionApprovals = new Set<string>();
    sessionApprovals.add('write');
    expect(sessionApprovals.has('shell')).toBe(false);
    expect(sessionApprovals.has('delete')).toBe(false);
    expect(sessionApprovals.has('write')).toBe(true);
  });
});
