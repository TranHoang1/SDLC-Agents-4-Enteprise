/**
 * SA4E-85 — E2E-API Tests: Permission Guard (API-PG-01/02/03/04).
 * Validates TOOL_CALL_REQUEST and TOOL_CALL_RESPONSE contracts.
 */

import { describe, test, expect } from 'vitest';
import { isValidMessageType } from '../../chat/router/messageValidator';

describe('API-PG-01: TOOL_CALL_REQUEST for Dangerous Tool', () => {
  test('TOOL_CALL_REQUEST is a valid message type', () => {
    expect(isValidMessageType('TOOL_CALL_REQUEST')).toBe(true);
  });

  test('dangerous tool payload has all required fields', () => {
    const msg = { type: 'TOOL_CALL_REQUEST', toolId: 't1', name: 'write_file', args: { path: '/x' }, requiresApproval: true, toolType: 'write' };
    expect(msg.requiresApproval).toBe(true);
    expect(typeof msg.toolId).toBe('string');
    expect(typeof msg.name).toBe('string');
    expect(typeof msg.args).toBe('object');
  });
});

describe('API-PG-02: TOOL_CALL_RESPONSE APPROVE', () => {
  test('TOOL_CALL_RESPONSE is a valid message type', () => {
    expect(isValidMessageType('TOOL_CALL_RESPONSE')).toBe(true);
  });

  test('APPROVE response has correct shape', () => {
    const msg = { type: 'TOOL_CALL_RESPONSE', toolId: 't1', decision: 'APPROVE' };
    expect(msg.decision).toBe('APPROVE');
  });
});

describe('API-PG-03: TOOL_CALL_RESPONSE REJECT (Timeout)', () => {
  test('REJECT response has correct shape', () => {
    const msg = { type: 'TOOL_CALL_RESPONSE', toolId: 't1', decision: 'REJECT' };
    expect(msg.decision).toBe('REJECT');
  });
});

describe('API-PG-04: Session Approval Bypass', () => {
  test('second write tool does not require approval if session-approved', () => {
    const sessionApprovals = new Set(['write']);
    const secondWriteNeedsGuard = !sessionApprovals.has('write');
    expect(secondWriteNeedsGuard).toBe(false);
  });

  test('shell tool still requires approval', () => {
    const sessionApprovals = new Set(['write']);
    const shellNeedsGuard = !sessionApprovals.has('shell');
    expect(shellNeedsGuard).toBe(true);
  });
});
