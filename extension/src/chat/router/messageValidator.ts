/**
 * SA4E-85 — Message type validator.
 * Runtime validation for discriminated union type field.
 * Ensures only known message types pass through the router.
 */

import type { MessageType } from '../types';

/** All valid Extension Host → Webview message types */
const EXTENSION_MESSAGE_TYPES = new Set<string>([
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
  'AGENT_SWITCHED',
]);

/** All valid Webview → Extension Host message types */
const WEBVIEW_MESSAGE_TYPES = new Set<string>([
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
  'SELECT_AGENT',
  'DIFF_OPEN_FILE', // SA4E-183: File Change Tracking
]);

/** Combined set for fast O(1) lookup */
const ALL_MESSAGE_TYPES = new Set<string>([
  ...EXTENSION_MESSAGE_TYPES,
  ...WEBVIEW_MESSAGE_TYPES,
]);

/**
 * Validates that a string is a known message type.
 * @param type - Candidate type string to validate
 * @returns True if type is a recognized MessageType discriminant
 */
export function isValidMessageType(type: string): type is MessageType {
  return ALL_MESSAGE_TYPES.has(type);
}

/**
 * Validates that a type belongs to Extension → Webview direction.
 * @param type - Candidate type string
 */
export function isExtensionMessageType(type: string): boolean {
  return EXTENSION_MESSAGE_TYPES.has(type);
}

/**
 * Validates that a type belongs to Webview → Extension direction.
 * @param type - Candidate type string
 */
export function isWebviewMessageType(type: string): boolean {
  return WEBVIEW_MESSAGE_TYPES.has(type);
}
