/**
 * SA4E-110 - Standardized error response schema and sanitization.
 * Ensures no sensitive data leaks through error messages.
 */
import { AtlassianErrorCode } from './types.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

/** Patterns that may leak sensitive info in Jira error messages */
const SENSITIVE_PATTERNS = [
  /api[_-]?token[=:]\s*\S+/gi,
  /bearer\s+\S+/gi,
  /basic\s+\S+/gi,
  /password[=:]\s*\S+/gi,
  /email[=:]\s*\S+@\S+/gi,
];

/**
 * Remove sensitive data from Jira/Confluence error messages.
 * @param message Raw error message from Atlassian API
 * @returns Sanitized message safe for client display
 */
export function sanitizeJiraError(message: string): string {
  let sanitized = message;
  for (const pattern of SENSITIVE_PATTERNS) {
    sanitized = sanitized.replace(pattern, '[REDACTED]');
  }
  return sanitized;
}

/**
 * Map HTTP status codes to AtlassianErrorCode.
 * @param status HTTP response status
 * @returns Appropriate error code enum value
 */
export function mapStatusToErrorCode(status: number): AtlassianErrorCode {
  if (status === 401) return AtlassianErrorCode.AUTH_FAILED;
  if (status === 403) return AtlassianErrorCode.FORBIDDEN;
  if (status === 404) return AtlassianErrorCode.NOT_FOUND;
  if (status === 429) return AtlassianErrorCode.RATE_LIMITED;
  if (status >= 500) return AtlassianErrorCode.SERVER_ERROR;
  return AtlassianErrorCode.UNKNOWN;
}

/**
 * Create a standardized error result for MCP responses.
 * @param code Error classification code
 * @param message Human-readable error description
 * @returns CallToolResult with isError=true
 */
export function createErrorResult(code: AtlassianErrorCode, message: string): CallToolResult {
  const safe = sanitizeJiraError(message);
  return {
    content: [{ type: 'text', text: JSON.stringify({ error: code, message: safe }) }],
    isError: true,
  };
}

/**
 * Create a successful result with JSON data.
 * @param data Response data to serialize
 * @returns CallToolResult with content
 */
export function createSuccessResult(data: unknown): CallToolResult {
  return {
    content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
  };
}