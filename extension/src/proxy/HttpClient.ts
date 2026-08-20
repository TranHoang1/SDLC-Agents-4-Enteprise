/**
 * HttpClient — Auth-injecting HTTP wrapper for backend communication.
 * Handles token injection, 401 retry, timeouts, streaming, and proxy routing.
 */

import type { Dispatcher } from "undici";
import type { IAuthManager } from "../types/server-types";
import { getProjectId } from "../extension";
import { ProxyAgentFactory } from "./ProxyAgentFactory";
import { CurlHttpAdapter } from "./CurlHttpAdapter";
import { PowerShellHttpAdapter } from "./PowerShellHttpAdapter";

export class HttpError extends Error {
  constructor(public readonly statusCode: number, message: string) {
    super(message);
    this.name = "HttpError";
  }
}

export interface ToolResult {
  content: Array<{ type: string; text: string }>;
}

export class HttpClient {
  private readonly curlAdapter = new CurlHttpAdapter();
  private readonly pwshAdapter = new PowerShellHttpAdapter();

  constructor(
    private _baseUrl: string,
    private readonly authManager: IAuthManager
  ) {}

  get baseUrl(): string {
    return this._baseUrl;
  }

  set baseUrl(url: string) {
    this._baseUrl = url;
  }

  async getAuthHeaders(): Promise<Record<string, string>> {
    const token = await this.authManager.getAccessToken();
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) {
      headers["Authorization"] = "Bearer " + token;
    }
    const projectId = getProjectId();
    if (projectId) {
      headers["X-Project-Id"] = projectId;
    }
    return headers;
  }

  async get<T>(path: string, timeout?: number, _retried = false): Promise<T> {
    const headers = await this.getAuthHeaders();
    if (!headers["Authorization"] && !path.startsWith("/health")) {
      throw new HttpError(401, "Not authenticated — please login to use this feature.");
    }
    const url = this._baseUrl + path;
    // Curl mode: bypass fetch(), use curl.exe subprocess
    if (this.isCurlMode() && !this.shouldBypassCurl(url)) {
      return this.curlRequest<T>(url, "GET", headers, undefined, timeout);
    }
    // PowerShell mode: bypass fetch(), use Invoke-WebRequest subprocess
    if (this.isPowerShellMode() && !this.shouldBypassPwsh(url)) {
      return this.pwshRequest<T>(url, "GET", headers, undefined, timeout);
    }
    const dispatcher = await this.getProxyDispatcher(url);
    const response = await fetch(url, {
      method: "GET",
      headers,
      signal: AbortSignal.timeout(timeout || 10000),
      ...(dispatcher ? { dispatcher } : {}),
    } as RequestInit);
    if (response.status === 401 && !_retried) {
      await this.authManager.refreshToken();
      return this.get(path, timeout, true);
    }
    if (!response.ok) {
      throw new HttpError(response.status, await response.text());
    }
    return response.json() as Promise<T>;
  }

  async post<T>(path: string, body: unknown, timeout?: number, _retried = false): Promise<T> {
    const headers = await this.getAuthHeaders();
    if (!headers["Authorization"]) {
      throw new HttpError(401, "Not authenticated — please login to use this feature.");
    }
    const url = this._baseUrl + path;
    // Curl mode: bypass fetch(), use curl.exe subprocess
    if (this.isCurlMode() && !this.shouldBypassCurl(url)) {
      return this.curlRequest<T>(url, "POST", headers, JSON.stringify(body), timeout);
    }
    // PowerShell mode: bypass fetch(), use Invoke-WebRequest subprocess
    if (this.isPowerShellMode() && !this.shouldBypassPwsh(url)) {
      return this.pwshRequest<T>(url, "POST", headers, JSON.stringify(body), timeout);
    }
    const dispatcher = await this.getProxyDispatcher(url);
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeout || 10000),
      ...(dispatcher ? { dispatcher } : {}),
    } as RequestInit);
    if (response.status === 401 && !_retried) {
      await this.authManager.refreshToken();
      return this.post(path, body, timeout, true);
    }
    if (!response.ok) {
      throw new HttpError(response.status, await response.text());
    }
    return response.json() as Promise<T>;
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<ToolResult> {
    return this.post<ToolResult>("/mcp/tools/call", { tool_name: name, arguments: args }, 300000);
  }

  async stream(path: string, body: unknown, timeout?: number, _retried = false): Promise<ReadableStream<Uint8Array>> {
    const headers = await this.getAuthHeaders();
    if (!headers["Authorization"]) {
      throw new HttpError(401, "Not authenticated — please login to use this feature.");
    }
    const url = this._baseUrl + path;
    // PowerShell mode: stream via .NET HttpClient subprocess
    if (this.isPowerShellMode() && !this.shouldBypassPwsh(url)) {
      return this.pwshAdapter.streamRequest(url, "POST", headers, JSON.stringify(body), timeout);
    }
    // Note: CurlTransport does not support streaming — fall through to fetch()
    const dispatcher = await this.getProxyDispatcher(url);
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeout || 120000),
      ...(dispatcher ? { dispatcher } : {}),
    } as RequestInit);
    if (response.status === 401 && !_retried) {
      await this.authManager.refreshToken();
      return this.stream(path, body, timeout, true);
    }
    if (!response.ok) {
      throw new HttpError(response.status, await response.text());
    }
    if (!response.body) {
      throw new HttpError(0, "No response body for streaming");
    }
    return response.body;
  }

  /**
   * Simple health check — GET /health, returns true if 200.
   */
  async healthCheck(timeout?: number): Promise<boolean> {
    try {
      const url = this._baseUrl + "/health";
      // Curl mode: use curl for health check too (bypassed URLs skip curl)
      if (this.isCurlMode() && !this.shouldBypassCurl(url)) {
        const response = await this.curlAdapter.request(url, "GET", {}, undefined, timeout || 5000);
        return response.ok;
      }
      // PowerShell mode: use Invoke-WebRequest for health check too
      if (this.isPowerShellMode() && !this.shouldBypassPwsh(url)) {
        const response = await this.pwshAdapter.request(url, "GET", {}, undefined, timeout || 5000);
        return response.ok;
      }
      const dispatcher = await this.getProxyDispatcher(url);
      const response = await fetch(url, {
        method: "GET",
        signal: AbortSignal.timeout(timeout || 5000),
        ...(dispatcher ? { dispatcher } : {}),
      } as RequestInit);
      return response.ok;
    } catch (err) {
      console.debug("[HttpClient] healthCheck failed: " + (err as Error).message);
      return false;
    }
  }

  /**
   * Get proxy dispatcher for a target URL.
   * Returns undefined (direct connection) if proxy not configured or target is bypassed.
   */
  private async getProxyDispatcher(targetUrl: string): Promise<Dispatcher | undefined> {
    try {
      const factory = ProxyAgentFactory.getInstance();
      const config = factory.getConfig();
      // Check bypass list before returning dispatcher
      if (factory.shouldBypass(targetUrl, config.bypass)) {
        return undefined;
      }
      return await factory.getDispatcher(targetUrl);
    } catch {
      // ProxyAgentFactory not initialized or error — fall back to direct
      return undefined;
    }
  }

  /**
   * Check if current proxy mode is "curl" (CurlTransport subprocess).
   * When true, HttpClient delegates to curl.exe instead of fetch().
   */
  private isCurlMode(): boolean {
    return this.curlAdapter.isCurlMode();
  }

  /**
   * Check if a target URL should bypass curl proxy (connect directly via fetch).
   * Uses the same bypass list as manual/system modes.
   */
  private shouldBypassCurl(targetUrl: string): boolean {
    return this.curlAdapter.shouldBypass(targetUrl);
  }

  /**
   * Execute request via CurlTransport (subprocess).
   * Converts response to parsed JSON or throws HttpError.
   */
  private async curlRequest<T>(
    url: string,
    method: string,
    headers: Record<string, string>,
    body?: string,
    timeout?: number
  ): Promise<T> {
    const response = await this.curlAdapter.request(url, method, headers, body, timeout);
    if (response.status === 401) {
      throw new HttpError(401, "Unauthorized");
    }
    if (!response.ok) {
      throw new HttpError(response.status, response.body || response.statusText);
    }
    return JSON.parse(response.body) as T;
  }

  /**
   * Check if current proxy mode is "powershell" (Invoke-WebRequest subprocess).
   * When true, HttpClient delegates to PowerShell instead of fetch().
   */
  private isPowerShellMode(): boolean {
    return this.pwshAdapter.isPowerShellMode();
  }

  /**
   * Check if a target URL should bypass PowerShell proxy (connect directly via fetch).
   * Uses the same bypass list as manual/system modes.
   */
  private shouldBypassPwsh(targetUrl: string): boolean {
    return this.pwshAdapter.shouldBypass(targetUrl);
  }

  /**
   * Execute request via PowerShellTransport (subprocess).
   * Converts response to parsed JSON or throws HttpError.
   */
  private async pwshRequest<T>(
    url: string,
    method: string,
    headers: Record<string, string>,
    body?: string,
    timeout?: number
  ): Promise<T> {
    const response = await this.pwshAdapter.request(url, method, headers, body, timeout);
    if (response.status === 401) {
      throw new HttpError(401, "Unauthorized");
    }
    if (!response.ok) {
      throw new HttpError(response.status, response.body || response.statusText);
    }
    return JSON.parse(response.body) as T;
  }
}
