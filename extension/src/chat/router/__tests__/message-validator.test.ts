/**
 * SA4E-85 — Unit Tests: Message Validator (UT-MSG-01).
 * Tests discriminant validation for extension/webview message types.
 */

import { describe, it, expect } from 'vitest';
import {
  isValidMessageType,
  isExtensionMessageType,
  isWebviewMessageType,
} from '../messageValidator';

const VALID_EXTENSION_TYPES = [
  'STREAM_START',
  'STREAM_TOKEN',
  'STREAM_END',
  'STREAM_ERROR',
  'THINKING_START',
  'THINKING_TOKEN',
  'THINKING_END',
  'TOOL_CALL_REQUEST',
  'TOOL_STREAM_OUTPUT',
  'MCP_TOOL_RESULT',
  'SYNC_AVAILABLE_AGENTS',
  'IPC_STATUS',
  'CONTEXT_UPDATE',
  'SYNC_CHAT_HISTORY',
];

const VALID_WEBVIEW_TYPES = [
  'SEND_PROMPT',
  'TOOL_CALL_RESPONSE',
  'COMMAND_DISPATCH',
  'RUN_TERMINAL_COMMAND',
  'ACTION_ACCEPT_DIFF',
  'ACTION_REJECT_DIFF',
  'REGENERATE_PATCH',
  'CONTEXT_UNPIN_FILE',
  'CONTEXT_CLEAR',
  'REQUEST_SYNC_STATE',
];

describe('UT-MSG-01: Message Type Validation', () => {
  it('accepts every valid webview message type', () => {
    for (const type of VALID_WEBVIEW_TYPES) {
      expect(isValidMessageType(type)).toBe(true);
    }
  });

  it('accepts every valid extension message type', () => {
    for (const type of VALID_EXTENSION_TYPES) {
      expect(isValidMessageType(type)).toBe(true);
    }
  });

  it('rejects unknown message types', () => {
    expect(isValidMessageType('NOPE_NOT_REAL')).toBe(false);
    expect(isValidMessageType('send_prompt')).toBe(false);
    expect(isValidMessageType('')).toBe(false);
  });

  it('rejects lowercase or partial type strings', () => {
    expect(isValidMessageType('STREAM')).toBe(false);
    expect(isValidMessageType('send_prompt')).toBe(false);
    expect(isValidMessageType('SEND_PROMPT_EXTRA')).toBe(false);
  });

  it('classifies extension types as extension direction', () => {
    for (const type of VALID_EXTENSION_TYPES) {
      expect(isExtensionMessageType(type)).toBe(true);
      expect(isWebviewMessageType(type)).toBe(false);
    }
  });

  it('classifies webview types as webview direction', () => {
    for (const type of VALID_WEBVIEW_TYPES) {
      expect(isWebviewMessageType(type)).toBe(true);
      expect(isExtensionMessageType(type)).toBe(false);
    }
  });

  it('returns false for unknown types in both directions', () => {
    expect(isExtensionMessageType('UNKNOWN')).toBe(false);
    expect(isWebviewMessageType('UNKNOWN')).toBe(false);
  });
});
