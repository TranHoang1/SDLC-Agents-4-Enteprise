/**
 * SA4E-110 — Shared interfaces and enums for the Atlassian MCP child server.
 * Defines core types used across clients, tools, and credential management.
 */

/** Error codes specific to Atlassian API interactions */
export enum AtlassianErrorCode {
  AUTH_FAILED = 'AUTH_FAILED',
  RATE_LIMITED = 'RATE_LIMITED',
  NOT_FOUND = 'NOT_FOUND',
  FORBIDDEN = 'FORBIDDEN',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  SERVER_ERROR = 'SERVER_ERROR',
  TIMEOUT = 'TIMEOUT',
  NETWORK_ERROR = 'NETWORK_ERROR',
  UNKNOWN = 'UNKNOWN',
}

/** Configuration for the HTTP client used by API clients */
export interface HttpClientConfig {
  baseUrl: string;
  authHeaders: () => Promise<Record<string, string>>;
  rateLimiter: RateLimiterInterface;
  timeouts: { default: number; upload: number };
}

/** Options for individual HTTP requests */
export interface RequestOptions {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  body?: unknown;
  headers?: Record<string, string>;
  timeout?: number;
  isUpload?: boolean;
}

/** Standardized HTTP response from Atlassian APIs */
export interface HttpResponse<T = unknown> {
  status: number;
  data: T;
  headers: Record<string, string>;
}

/** Standardized tool result returned to MCP framework */
export interface ToolResult {
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
}

/** Registration metadata for a tool handler */
export interface ToolRegistration {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

/** Rate limiter contract used by HttpClientConfig */
export interface RateLimiterInterface {
  acquire(): Promise<void>;
  setReconnectMode(isReconnect: boolean): void;
}

/** Credential data received via IPC from orchestrator */
export interface AtlassianCredentials {
  email: string;
  apiToken: string;
  baseUrl: string;
}

/** IPC credential request sent by child to parent */
export interface CredentialRequest {
  type: 'getCredentials';
  requestId: string;
  timestamp: number;
}

/** IPC credential response from parent to child */
export interface CredentialResponse {
  type: 'credentials';
  requestId: string;
  timestamp: number;
  credentials: AtlassianCredentials;
}
