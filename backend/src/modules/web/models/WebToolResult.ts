/**
 * Result type helpers for WebModule tool responses.
 */

import type { ToolResult } from '../../../types/tool.js';
import { WebToolError } from './WebError.js';

export function successResult(data: unknown): ToolResult {
  return {
    content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
    isError: false,
  };
}

export function errorResult(error: WebToolError): ToolResult {
  return {
    content: [{
      type: 'text',
      text: JSON.stringify({ error: error.code, message: error.message, ...error.details }),
    }],
    isError: true,
  };
}
