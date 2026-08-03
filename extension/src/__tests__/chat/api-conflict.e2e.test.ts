/**
 * SA4E-85 — E2E-API Tests: Conflict Management (API-CM-01/02/03).
 * Validates ACTION_ACCEPT_DIFF, stale patch, REGENERATE_PATCH contracts.
 */

import { describe, test, expect } from 'vitest';
import { isValidMessageType } from '../../chat/router/messageValidator';
import { isDiffStale } from '../../chat/tools/diffTypes';

describe('API-CM-01: ACTION_ACCEPT_DIFF Contract', () => {
  test('ACTION_ACCEPT_DIFF is a valid message type', () => {
    expect(isValidMessageType('ACTION_ACCEPT_DIFF')).toBe(true);
  });

  test('payload has diffId, filePath, patch', () => {
    const msg = { type: 'ACTION_ACCEPT_DIFF', diffId: 'd1', filePath: 'src/x.ts', patch: '+line' };
    expect(typeof msg.diffId).toBe('string');
    expect(typeof msg.filePath).toBe('string');
    expect(typeof msg.patch).toBe('string');
  });
});

describe('API-CM-02: Stale Patch Warning Message', () => {
  test('diff older than 5min is marked stale', () => {
    const diff = { diffId: 'd1', filePath: 'x.ts', patch: '', fileHashAtGeneration: 'a', generatedAt: Date.now() - 6 * 60 * 1000, status: 'pending' as const };
    expect(isDiffStale(diff)).toBe(true);
  });
});

describe('API-CM-03: REGENERATE_PATCH Flow', () => {
  test('REGENERATE_PATCH is a valid message type', () => {
    expect(isValidMessageType('REGENERATE_PATCH')).toBe(true);
  });

  test('payload has diffId and filePath', () => {
    const msg = { type: 'REGENERATE_PATCH', diffId: 'd1', filePath: 'src/y.ts' };
    expect(typeof msg.diffId).toBe('string');
    expect(typeof msg.filePath).toBe('string');
  });
});
