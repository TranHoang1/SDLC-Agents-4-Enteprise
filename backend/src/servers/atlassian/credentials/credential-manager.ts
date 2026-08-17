/**
 * SA4E-110 - IPC credential receiver for the Atlassian child server.
 * Handles credential requests/responses with requestId correlation
 * and timestamp staleness check (P4 security requirement).
 */
import { randomUUID } from 'node:crypto';
import { CredentialResponseSchema } from './credential-schemas.js';
import type { AtlassianCredentials } from '../models/types.js';

/** Max age for credential responses (5 seconds) */
const MAX_STALENESS_MS = 5000;

type RefreshCallback = (creds: AtlassianCredentials) => void;

/**
 * Manages credentials received via IPC from the orchestrator process.
 * Validates requestId correlation and rejects stale messages.
 */
export class CredentialManager {
  private credentials: AtlassianCredentials | null = null;
  private pendingRequest: { id: string; resolve: (c: AtlassianCredentials) => void; reject: (e: Error) => void } | null = null;
  private refreshCallbacks: RefreshCallback[] = [];
  private initialized = false;

  /** Set up IPC message listener on process */
  initialize(): void {
    if (this.initialized) return;
    this.initialized = true;
    process.on('message', (msg: unknown) => this.handleMessage(msg));
  }

  /**
   * Request auth headers from cached credentials.
   * If no credentials cached, requests them via IPC.
   * @returns Basic auth headers for Atlassian API
   */
  async getAuthHeaders(): Promise<Record<string, string>> {
    const creds = await this.getCredentials();
    const token = Buffer.from(`${creds.email}:${creds.apiToken}`).toString('base64');
    return { Authorization: `Basic ${token}`, Accept: 'application/json' };
  }

  /** Register callback for credential refresh events */
  onRefresh(callback: RefreshCallback): void {
    this.refreshCallbacks.push(callback);
  }

  /** Get base URL from credentials */
  async getBaseUrl(): Promise<string> {
    const creds = await this.getCredentials();
    return creds.baseUrl;
  }

  private async getCredentials(): Promise<AtlassianCredentials> {
    if (this.credentials) return this.credentials;
    return this.requestCredentials();
  }

  private requestCredentials(): Promise<AtlassianCredentials> {
    return new Promise((resolve, reject) => {
      const id = randomUUID();
      this.pendingRequest = { id, resolve, reject };

      const msg = { type: 'getCredentials', requestId: id, timestamp: Date.now() };
      if (process.send) {
        process.send(msg);
      } else {
        reject(new Error('No IPC channel available'));
      }

      // Timeout after 10 seconds
      setTimeout(() => {
        if (this.pendingRequest?.id === id) {
          this.pendingRequest = null;
          reject(new Error('Credential request timed out'));
        }
      }, 10000);
    });
  }

  private handleMessage(msg: unknown): void {
    const parsed = CredentialResponseSchema.safeParse(msg);
    if (!parsed.success) return;

    const response = parsed.data;

    // P4: Validate requestId correlation
    if (!this.pendingRequest || this.pendingRequest.id !== response.requestId) {
      return;
    }

    // P4: Reject stale messages (>5s old)
    if (Date.now() - response.timestamp > MAX_STALENESS_MS) {
      this.pendingRequest.reject(new Error('Credential response is stale'));
      this.pendingRequest = null;
      return;
    }

    const creds = response.credentials;
    const isRefresh = this.credentials !== null;
    this.credentials = creds;
    this.pendingRequest.resolve(creds);
    this.pendingRequest = null;

    // Notify refresh listeners
    if (isRefresh) {
      for (const cb of this.refreshCallbacks) cb(creds);
    }
  }
}