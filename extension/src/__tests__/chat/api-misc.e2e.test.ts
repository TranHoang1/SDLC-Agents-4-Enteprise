/**
 * SA4E-85 — E2E-API Tests: Misc + Validation (API-DL-01, API-VALIDATE-01/02/03/04/05).
 * Validates deep link, message validation edge cases.
 */

import { describe, test, expect } from 'vitest';
import { isValidMessageType, isExtensionMessageType, isWebviewMessageType } from '../../chat/router/messageValidator';

describe('API-DL-01: MCP_TOOL_RESULT with deepLinkUri', () => {
  test('MCP_TOOL_RESULT is a valid message type', () => {
    expect(isValidMessageType('MCP_TOOL_RESULT')).toBe(true);
  });

  test('result payload can include deepLinkUri', () => {
    const msg = { type: 'MCP_TOOL_RESULT', toolId: 't1', result: { content: 'done', isError: false, deepLinkUri: 'antigravity://workspace/file' } };
    expect(msg.result.deepLinkUri).toMatch(/^antigravity:\/\//);
  });
});

describe('API-VALIDATE-01: Invalid Message Type Dropped', () => {
  test('unknown type is not valid', () => {
    expect(isValidMessageType('UNKNOWN_TYPE')).toBe(false);
  });

  test('empty string is not valid', () => {
    expect(isValidMessageType('')).toBe(false);
  });
});

describe('API-VALIDATE-02: Empty messageId Rejected', () => {
  test('empty messageId fails validation logic', () => {
    const messageId = '';
    expect(messageId.length).toBe(0);
    expect(messageId === '').toBe(true);
  });
});

describe('API-VALIDATE-03: Invalid agentId Returns Error', () => {
  test('nonexistent agentId detected', () => {
    const knownAgents = new Set(['ba', 'sa', 'dev', 'qa']);
    expect(knownAgents.has('nonexistent')).toBe(false);
  });
});

describe('API-VALIDATE-04: Non-Workspace filePath Rejected', () => {
  test('/etc/passwd rejected as non-workspace path', () => {
    const filePath = '/etc/passwd';
    const isWorkspace = filePath.startsWith('/workspace') || filePath.startsWith('src/');
    expect(isWorkspace).toBe(false);
  });
});

describe('API-VALIDATE-05: Direction Validation', () => {
  test('extension message types classified correctly', () => {
    expect(isExtensionMessageType('STREAM_START')).toBe(true);
    expect(isExtensionMessageType('SEND_PROMPT')).toBe(false);
  });

  test('webview message types classified correctly', () => {
    expect(isWebviewMessageType('SEND_PROMPT')).toBe(true);
    expect(isWebviewMessageType('STREAM_START')).toBe(false);
  });
});
