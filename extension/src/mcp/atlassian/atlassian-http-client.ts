/**
 * SA4E-110 — In-process HTTP client for Atlassian APIs.
 * Reads credentials from AtlassianCredentialService (SecretStorage).
 * No IPC, no child process — direct fetch from extension host.
 * Token bucket rate limiting (100 tokens/60s), retry on 429/5xx.
 */
import { AtlassianCredentialService } from "../../services/AtlassianCredentialService";

/** Request options for the Atlassian HTTP client */
export interface AtlassianRequestOptions {
  isUpload?: boolean;
  headers?: Record<string, string>;
  timeout?: number;
}

/** Standardized response from Atlassian API */
export interface AtlassianResponse {
  status: number;
  data: unknown;
}

/** MCP tool result shape */
export interface ToolResult {
  isError?: boolean;
  content: Array<{ type: "text"; text: string }>;
}

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;
const DEFAULT_TIMEOUT_MS = 30000;
const MAX_TOKENS = 100;
const REFILL_INTERVAL_MS = 60000;

/**
 * Lightweight HTTP client for Atlassian REST APIs.
 * Reads credentials from SecretStorage on every request (hot-reload).
 * Rate limits via token bucket, retries on transient errors.
 */
export class AtlassianHttpClient {
  private tokens = MAX_TOKENS;
  private lastRefill = Date.now();

  constructor(private readonly credService: AtlassianCredentialService) {}

  /** Execute HTTP request with auth, rate limiting, and retry */
  async request(
    method: string, path: string, body?: unknown, options?: AtlassianRequestOptions,
  ): Promise<AtlassianResponse> {
    await this.acquireToken();
    const { url, authHeader } = await this.buildRequest(path);
    return this.executeWithRetry(method, url, body, authHeader, options, 0);
  }

  /** Download raw binary/text content (for attachments). Returns ArrayBuffer. */
  async requestRaw(method: string, path: string): Promise<ArrayBuffer | null> {
    await this.acquireToken();
    const { url, authHeader } = await this.buildRequest(path);
    try {
      const res = await fetch(url, {
        method, headers: { Authorization: authHeader },
        signal: AbortSignal.timeout(60000),
      });
      if (!res.ok) { return null; }
      return await res.arrayBuffer();
    } catch { return null; }
  }

  private async buildRequest(path: string): Promise<{ url: string; authHeader: string }> {
    const config = await this.credService.getConfig();
    if (!config) throw new Error("Atlassian credentials not configured");
    const baseUrl = config.baseUrl.replace(/\/+$/, "");
    const token = Buffer.from(`${config.email}:${config.apiToken}`).toString("base64");
    return { url: `${baseUrl}${path}`, authHeader: `Basic ${token}` };
  }

  private async executeWithRetry(
    method: string, url: string, body: unknown,
    authHeader: string, options: AtlassianRequestOptions | undefined, attempt: number,
  ): Promise<AtlassianResponse> {
    const timeout = options?.timeout ?? DEFAULT_TIMEOUT_MS;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await this.doFetch(method, url, body, authHeader, options, controller);
      clearTimeout(timer);
      if (response.ok) return this.parseOkResponse(response);
      return this.handleErrorResponse(response, method, url, body, authHeader, options, attempt);
    } catch (err) {
      clearTimeout(timer);
      return this.handleNetworkError(err, method, url, body, authHeader, options, attempt);
    }
  }

  private async doFetch(
    method: string, url: string, body: unknown,
    authHeader: string, options: AtlassianRequestOptions | undefined,
    controller: AbortController,
  ): Promise<Response> {
    const headers: Record<string, string> = {
      Authorization: authHeader, Accept: "application/json", ...options?.headers,
    };
    if (body && !options?.isUpload) headers["Content-Type"] = "application/json";

    return fetch(url, {
      method, headers, signal: controller.signal,
      body: body && !options?.isUpload ? JSON.stringify(body) : body as BodyInit | undefined,
    });
  }

  private async parseOkResponse(response: Response): Promise<AtlassianResponse> {
    const text = await response.text();
    if (!text) { return { status: response.status, data: undefined }; }
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      return { status: response.status, data: JSON.parse(text) };
    }
    // Non-JSON response (text, markdown, etc.) — return as raw string
    return { status: response.status, data: text };
  }

  private async handleErrorResponse(
    response: Response, method: string, url: string, body: unknown,
    authHeader: string, options: AtlassianRequestOptions | undefined, attempt: number,
  ): Promise<AtlassianResponse> {
    if (this.isRetryable(response.status) && attempt < MAX_RETRIES) {
      const delay = this.getBackoffDelay(attempt, response);
      await this.sleep(delay);
      return this.executeWithRetry(method, url, body, authHeader, options, attempt + 1);
    }
    const errorText = await response.text().catch(() => "");
    throw new Error(`HTTP ${response.status}: ${errorText}`);
  }

  private async handleNetworkError(
    err: unknown, method: string, url: string, body: unknown,
    authHeader: string, options: AtlassianRequestOptions | undefined, attempt: number,
  ): Promise<AtlassianResponse> {
    if (attempt < MAX_RETRIES) {
      await this.sleep(BASE_DELAY_MS * Math.pow(2, attempt));
      return this.executeWithRetry(method, url, body, authHeader, options, attempt + 1);
    }
    throw err;
  }

  /** Only retry 429 (rate limited) and 5xx (server errors) */
  private isRetryable(status: number): boolean {
    return status === 429 || status >= 500;
  }

  private getBackoffDelay(attempt: number, response: Response): number {
    const retryAfter = response.headers.get("retry-after");
    if (retryAfter) return parseInt(retryAfter, 10) * 1000;
    return BASE_DELAY_MS * Math.pow(2, attempt);
  }

  /** Token bucket: acquire one token, wait if empty */
  private async acquireToken(): Promise<void> {
    this.refill();
    if (this.tokens >= 1) { this.tokens -= 1; return; }
    const waitMs = Math.ceil((1 - this.tokens) / (MAX_TOKENS / REFILL_INTERVAL_MS));
    await this.sleep(waitMs);
    this.refill();
    this.tokens -= 1;
  }

  private refill(): void {
    const elapsed = Date.now() - this.lastRefill;
    this.tokens = Math.min(MAX_TOKENS, this.tokens + elapsed * (MAX_TOKENS / REFILL_INTERVAL_MS));
    this.lastRefill = Date.now();
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/** Wrap HTTP response into MCP tool result format */
export function toResult(res: AtlassianResponse): ToolResult {
  return { isError: false, content: [{ type: "text", text: JSON.stringify(res.data, null, 2) }] };
}

/** Wrap error into MCP tool result format */
export function toErrorResult(err: unknown): ToolResult {
  const msg = err instanceof Error ? err.message : String(err);
  return { isError: true, content: [{ type: "text", text: JSON.stringify({ error: msg }) }] };
}
