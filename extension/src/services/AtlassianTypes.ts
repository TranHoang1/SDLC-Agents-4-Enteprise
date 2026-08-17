/**
 * SA4E-110 — Shared types for Atlassian IPC credential protocol.
 * Mirrors backend/src/servers/atlassian/models/types.ts for extension side.
 */

/** Credential data sent to child server via IPC */
export interface AtlassianCredentials {
  email: string;
  apiToken: string;
  baseUrl: string;
}

/** IPC credential request from child server */
export interface CredentialRequest {
  type: "getCredentials";
  requestId: string;
  timestamp: number;
}

/** IPC credential response from extension to child server */
export interface CredentialResponse {
  type: "credentials";
  requestId: string;
  timestamp: number;
  credentials: AtlassianCredentials;
}
