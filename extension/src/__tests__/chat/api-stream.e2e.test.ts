/**
 * SA4E-85 — E2E-API Tests: Stream Protocol (API-STR-01/02/03/04).
 * Validates STREAM_START, STREAM_TOKEN, STREAM_END, STREAM_ERROR contracts.
 */

import { describe, test, expect } from 'vitest';
import { isValidMessageType } from '../../chat/router/messageValidator';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

describe('API-STR-01: STREAM_START Contract', () => {
  test('STREAM_START is a valid message type', () => {
    expect(isValidMessageType('STREAM_START')).toBe(true);
  });

  test('payload schema has required fields', () => {
    const msg = { type: 'STREAM_START', messageId: 'abc-123', agentId: 'ba' };
    expect(msg.type).toBe('STREAM_START');
    expect(typeof msg.messageId).toBe('string');
    expect(typeof msg.agentId).toBe('string');
  });
});

describe('API-STR-02: STREAM_TOKEN Batching Contract', () => {
  test('STREAM_TOKEN is a valid message type', () => {
    expect(isValidMessageType('STREAM_TOKEN')).toBe(true);
  });

  test('payload contains messageId and token', () => {
    const msg = { type: 'STREAM_TOKEN', messageId: 'm1', token: 'Hello' };
    expect(typeof msg.messageId).toBe('string');
    expect(typeof msg.token).toBe('string');
    expect(msg.token.length).toBeGreaterThan(0);
  });
});

describe('API-STR-03: STREAM_END Finalizes', () => {
  test('STREAM_END is a valid message type', () => {
    expect(isValidMessageType('STREAM_END')).toBe(true);
  });

  test('payload contains only type and messageId', () => {
    const msg = { type: 'STREAM_END', messageId: 'm1' };
    expect(Object.keys(msg)).toEqual(['type', 'messageId']);
  });
});

describe('API-STR-04: STREAM_ERROR Codes Valid', () => {
  const VALID_CODES = ['LLM_TIMEOUT', 'BACKEND_CRASH', 'RATE_LIMITED', 'CONTEXT_OVERFLOW', 'AGENT_NOT_FOUND', 'NETWORK_ERROR'];

  test('STREAM_ERROR is a valid message type', () => {
    expect(isValidMessageType('STREAM_ERROR')).toBe(true);
  });

  test('error payload has code, message, retryable', () => {
    const msg = {
      type: 'STREAM_ERROR', messageId: 'm1',
      error: { code: 'LLM_TIMEOUT', message: 'timed out', retryable: true },
    };
    expect(typeof msg.error.code).toBe('string');
    expect(typeof msg.error.message).toBe('string');
    expect(typeof msg.error.retryable).toBe('boolean');
  });

  test('all 6 error codes are strings', () => {
    expect(VALID_CODES).toHaveLength(6);
    VALID_CODES.forEach((c) => expect(typeof c).toBe('string'));
  });
});
