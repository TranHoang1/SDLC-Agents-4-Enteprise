/**
 * Custom error class for WebModule tools.
 * Each error carries a machine-readable code for consistent error responses.
 */

export type WebErrorCode =
  | 'SSRF_BLOCKED'
  | 'RATE_LIMITED'
  | 'TIMEOUT'
  | 'CONTENT_TOO_LARGE'
  | 'INVALID_URL'
  | 'DNS_FAILED'
  | 'BLOCKED_EXTENSION'
  | 'BROWSER_FAILED';

export class WebToolError extends Error {
  constructor(
    public readonly code: WebErrorCode,
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'WebToolError';
  }
}
