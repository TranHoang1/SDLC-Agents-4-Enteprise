/**
 * CurlHttpAdapter — Adapts CurlTransport for use by HttpClient.
 * Encapsulates curl mode detection, bypass checking, and request execution.
 * Separates curl-specific logic from the main HttpClient class.
 */

import { CurlTransport } from "./CurlTransport";
import { ProxyAgentFactory } from "./ProxyAgentFactory";

/** Simplified response for curl adapter consumers */
export interface CurlAdapterResponse {
  status: number;
  ok: boolean;
  body: string;
  statusText: string;
}

/**
 * Adapter between HttpClient and CurlTransport.
 * Reads proxy config from ProxyAgentFactory to determine proxy URL and bypass.
 */
export class CurlHttpAdapter {
  /** Check if current proxy mode is "curl" */
  isCurlMode(): boolean {
    try {
      const factory = ProxyAgentFactory.getInstance();
      return factory.getConfig().mode === "curl";
    } catch {
      return false;
    }
  }

  /** Check if target URL should bypass curl (connect directly) */
  shouldBypass(targetUrl: string): boolean {
    try {
      const factory = ProxyAgentFactory.getInstance();
      const config = factory.getConfig();
      return factory.shouldBypass(targetUrl, config.bypass);
    } catch {
      return false;
    }
  }

  /** Execute HTTP request via curl.exe subprocess */
  async request(
    url: string,
    method: string,
    headers: Record<string, string>,
    body?: string,
    timeout?: number
  ): Promise<CurlAdapterResponse> {
    const transport = this.buildTransport();
    const response = await transport.request(url, {
      method,
      headers,
      body,
      timeout: timeout || 10000,
    });
    return {
      status: response.status,
      ok: response.ok,
      body: response.body,
      statusText: response.statusText,
    };
  }

  /** Build CurlTransport with proxy URL from config (or null for NTLM SSO) */
  private buildTransport(): CurlTransport {
    try {
      const factory = ProxyAgentFactory.getInstance();
      const config = factory.getConfig();
      const proxyUrl = config.host
        ? `http://${config.host}:${config.port}`
        : null;
      return new CurlTransport(proxyUrl);
    } catch {
      return new CurlTransport(null);
    }
  }
}
