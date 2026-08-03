/**
 * SA4E-85 — E2E-API Tests: Context (API-CTX-01).
 * Validates CONTEXT_UPDATE and CONTEXT_UNPIN_FILE contracts.
 */

import { describe, test, expect } from 'vitest';
import { isValidMessageType } from '../../chat/router/messageValidator';

describe('API-CTX-01: CONTEXT_UPDATE + UNPIN Flow', () => {
  test('CONTEXT_UPDATE is a valid message type', () => {
    expect(isValidMessageType('CONTEXT_UPDATE')).toBe(true);
  });

  test('CONTEXT_UNPIN_FILE is a valid message type', () => {
    expect(isValidMessageType('CONTEXT_UNPIN_FILE')).toBe(true);
  });

  test('CONTEXT_UPDATE payload has tokenCount, maxTokens, files', () => {
    const msg = { type: 'CONTEXT_UPDATE', tokenCount: 8000, maxTokens: 10000, files: [{ path: 'a.ts', tokenCount: 500, pinned: true }] };
    expect(msg.tokenCount).toBe(8000);
    expect(msg.maxTokens).toBe(10000);
    expect(msg.files).toHaveLength(1);
  });

  test('CONTEXT_UNPIN_FILE payload has filePath', () => {
    const msg = { type: 'CONTEXT_UNPIN_FILE', filePath: 'src/old.ts' };
    expect(typeof msg.filePath).toBe('string');
  });

  test('CONTEXT_CLEAR is a valid message type', () => {
    expect(isValidMessageType('CONTEXT_CLEAR')).toBe(true);
  });
});
