/**
 * SA4E-110 - Abstract HTTP client with retry, rate limiting, and auth refresh.
 * Uses native fetch. Retries on 429/5xx/timeout with exponential backoff.
 * Refreshes auth once on 401 before failing.
 */
import type { HttpClientConfig, HttpResponse, RequestOptions } from '../models/types.js';
import { AtlassianErrorCode } from '../models/types.js';
import { mapStatusToErrorCode } from '../models/error-schemas.js';

/** Maximum retry attempts for transient errors */
const MAX_RETRIES = 3;
/** Base delay for exponential backoff (ms) */
const BASE_DELAY_MS = 1000;

/**
 * Abstract base client for Atlassian REST APIs.
 * Subclasses provide domain-specific methods (Jira, Confluence).
 */
export abstract class BaseAtlassianClient {
  protected config: HttpClientConfig;
  private authRefreshed = false;

  constructor(config: HttpClientConfig) {
    this.config = config;
  }

  /**
   * Execute an HTTP request with retry logic and rate limiting.
   * @param options Request options (method, path, body, headers)
   * @returns Typed HTTP response
   * @throws Error with AtlassianErrorCode on unrecoverable failure
   */
  protected async request<T>(options: RequestOptions): Promise<HttpResponse<T>> {
    await this.config.rateLimiter.acquire();
    return this.executeWithRetry<T>(options, 0);
  }

  private async executeWithRetry<T>(
    options: RequestOptions,
    attempt: number
  ): Promise<HttpResponse<T>> {
    const url = `${this.config.baseUrl}${options.path}`;
    const timeout = options.timeout ?? (options.isUpload
      ? this.config.timeouts.upload
      : this.config.timeouts.default);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    try {
      const headers = {
        ...await this.config.authHeaders(),
        ...options.headers,
      };
      if (options.body && !options.isUpload) {
        headers['Content-Type'] = 'application/json';
      }

      const response = await fetch(url, {
        method: options.method,
        headers,
        body: options.body && !options.isUpload
          ? JSON.stringify(options.body)
          : options.body as RequestInit["body"],
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (response.ok) {
        const data = await this.parseResponse<T>(response);
        return { status: response.status, data, headers: this.extractHeaders(response) };
      }

      // 401: try auth refresh once
      if (response.status === 401 && !this.authRefreshed) {
        this.authRefreshed = true;
        return this.executeWithRetry<T>(options, attempt);
      }

      // Retryable: 429 or 5xx
      if (this.isRetryable(response.status) && attempt < MAX_RETRIES) {
        const delay = this.getBackoffDelay(attempt, response);
        await this.sleep(delay);
        return this.executeWithRetry<T>(options, attempt + 1);
      }

      const errorBody = await response.text().catch(() => '');
      const code = mapStatusToErrorCode(response.status);
      throw new AtlassianApiError(code, `HTTP ${response.status}: ${errorBody}`, response.status);
    } catch (err) {
      clearTimeout(timer);
      if (err instanceof AtlassianApiError) throw err;

      // Timeout or network error — retry
      if (attempt < MAX_RETRIES) {
        await this.sleep(BASE_DELAY_MS * Math.pow(2, attempt));
        return this.executeWithRetry<T>(options, attempt + 1);
      }

      const code = (err as Error).name === 'AbortError'
        ? AtlassianErrorCode.TIMEOUT
        : AtlassianErrorCode.NETWORK_ERROR;
      throw new AtlassianApiError(code, (err as Error).message, 0);
    }
  }

  private isRetryable(status: number): boolean {
    return status === 429 || status >= 500;
  }

  private getBackoffDelay(attempt: number, response: Response): number {
    const retryAfter = response.headers.get('retry-after');
    if (retryAfter) return parseInt(retryAfter, 10) * 1000;
    return BASE_DELAY_MS * Math.pow(2, attempt);
  }

  private async parseResponse<T>(response: Response): Promise<T> {
    const text = await response.text();
    if (!text) return undefined as T;
    return JSON.parse(text) as T;
  }

  private extractHeaders(response: Response): Record<string, string> {
    const headers: Record<string, string> = {};
    response.headers.forEach((value, key) => { headers[key] = value; });
    return headers;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/** Typed error with AtlassianErrorCode for upstream handling */
export class AtlassianApiError extends Error {
  constructor(
    public readonly code: AtlassianErrorCode,
    message: string,
    public readonly status: number
  ) {
    super(message);
    this.name = 'AtlassianApiError';
  }
}