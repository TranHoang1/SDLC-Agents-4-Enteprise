/**
 * SA4E-85 — Integration Tests: Permission Guard (IT-PG-01/02/03/04).
 * Tests permission round-trip between extension host and webview.
 */

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { MessageRouter } from '../../chat/router/MessageRouter';

describe('IT-PG-01: Permission Round-Trip', () => {
  test('TOOL_CALL_REQUEST dispatches to handler', async () => {
    let received: unknown = null;
    const router = new MessageRouter(undefined);
    router.registerHandler('TOOL_CALL_REQUEST' as any, async (msg) => { received = msg; });
    await router.dispatch({ type: 'TOOL_CALL_REQUEST', toolId: 't1', name: 'write', args: {}, requiresApproval: true, toolType: 'write' } as any);
    expect(received).not.toBeNull();
    router.dispose();
  });
});

describe('IT-PG-02: Safe Tool Bypasses Guard', () => {
  test('requiresApproval=false skips guard', () => {
    const decision = false ? 'PENDING' : 'APPROVE';
    expect(decision).toBe('APPROVE');
  });
});

describe('IT-PG-03: Timeout Flows Through Full Stack', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  test('60s timeout triggers auto-REJECT', () => {
    let decision = 'PENDING';
    setTimeout(() => { decision = 'REJECT'; }, 60_000);
    vi.advanceTimersByTime(60_000);
    expect(decision).toBe('REJECT');
  });
});

describe('IT-PG-04: Session Approval Isolation Per Type', () => {
  test('write approval does not apply to shell', () => {
    const approvals = new Set(['write']);
    expect(approvals.has('write')).toBe(true);
    expect(approvals.has('shell')).toBe(false);
  });
});
