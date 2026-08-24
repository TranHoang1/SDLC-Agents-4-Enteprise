/**
 * PowerShellHttpAdapter — Adapts PowerShellTransport for use by HttpClient.
 * Encapsulates powershell mode detection, bypass checking, and request execution.
 * Persistent cookie session stored at {workspace}/.code-intel/pwsh-session.xml.
 */

import { PowerShellTransport } from "./PowerShellTransport";
import { ProxyAgentFactory } from "./ProxyAgentFactory";
import { ProxyDetectionService } from "./ProxyDetectionService";
import * as vscode from "vscode";
import { join } from "path";
import { mkdirSync, existsSync } from "fs";

/** Simplified response for adapter consumers */
export interface PwshAdapterResponse {
  status: number;
  ok: boolean;
  body: string;
  statusText: string;
}

/** Cached proxy URL resolved from system detection */
let cachedSystemProxyUrl: string | null | undefined;

/**
 * Adapter between HttpClient and PowerShellTransport.
 * Reads proxy config from ProxyAgentFactory to determine proxy URL and bypass.
 * Resolves system proxy (including corporate gateway discovery) for mode=system.
 */
export class PowerShellHttpAdapter {
  /** Check if current proxy mode is "powershell" */
  isPowerShellMode(): boolean {
    try {
      const factory = ProxyAgentFactory.getInstance();
      return factory.getConfig().mode === "powershell";
    } catch {
      return false;
    }
  }

  /** Check if target URL should bypass PowerShell (connect directly) */
  shouldBypass(targetUrl: string): boolean {
    try {
      const factory = ProxyAgentFactory.getInstance();
      const config = factory.getConfig();
      return factory.shouldBypass(targetUrl, config.bypass);
    } catch {
      return false;
    }
  }

  /** Execute HTTP request via PowerShell Invoke-WebRequest subprocess */
  async request(
    url: string,
    method: string,
    headers: Record<string, string>,
    body?: string,
    timeout?: number
  ): Promise<PwshAdapterResponse> {
    const transport = await this.buildTransport();
    const response = await transport.request(url, {
      method,
      headers,
      body,
      timeout: timeout || 10000,
      cookieJarPath: this.getCookieJarPath(),
    });
    return {
      status: response.status,
      ok: response.ok,
      body: response.body,
      statusText: response.statusText,
    };
  }

  /** Resolve cookie session path: {workspace}/.code-intel/pwsh-session.xml */
  private getCookieJarPath(): string | undefined {
    try {
      const folder = vscode.workspace.workspaceFolders?.[0];
      if (!folder) { return undefined; }
      const dir = join(folder.uri.fsPath, ".code-intel");
      if (!existsSync(dir)) { mkdirSync(dir, { recursive: true }); }
      return join(dir, "pwsh-session.xml");
    } catch {
      return undefined;
    }
  }

  /**
   * Execute streaming HTTP request via .NET HttpClient subprocess.
   * Returns a ReadableStream that pipes chunks from PowerShell stdout.
   */
  streamRequest(
    url: string,
    method: string,
    headers: Record<string, string>,
    body?: string,
    timeout?: number
  ): ReadableStream<Uint8Array> {
    // Stream uses sync build — proxy must already be resolved
    const transport = this.buildTransportSync();
    return transport.streamRequest(url, {
      method,
      headers,
      body,
      timeout: timeout || 120000,
    });
  }

  /** Invalidate cached system proxy (called on config change) */
  static invalidateCache(): void {
    cachedSystemProxyUrl = undefined;
  }

  /** Build PowerShellTransport with resolved proxy URL (async — runs detection) */
  private async buildTransport(): Promise<PowerShellTransport> {
    const proxyUrl = await this.resolveProxyUrl();
    return new PowerShellTransport(proxyUrl);
  }

  /** Build PowerShellTransport sync (uses cache only — no async detection) */
  private buildTransportSync(): PowerShellTransport {
    try {
      const factory = ProxyAgentFactory.getInstance();
      const config = factory.getConfig();
      if (config.mode === "manual" && config.host) {
        return new PowerShellTransport(`http://${config.host}:${config.port}`);
      }
      // Use cached system proxy if available
      if (config.mode === "system" || config.mode === "powershell") {
        return new PowerShellTransport(cachedSystemProxyUrl ?? null);
      }
      return new PowerShellTransport(null);
    } catch {
      return new PowerShellTransport(null);
    }
  }

  /**
   * Resolve proxy URL based on current config mode.
   * For system mode: env vars → VS Code → corporate discovery (cached).
   */
  private async resolveProxyUrl(): Promise<string | null> {
    try {
      const factory = ProxyAgentFactory.getInstance();
      const config = factory.getConfig();

      // Mode: none → direct connection
      if (config.mode === "none") { return null; }

      // Mode: manual → use configured host:port
      if (config.mode === "manual" && config.host) {
        return `http://${config.host}:${config.port}`;
      }

      // Mode: system or powershell → detect proxy
      return await this.resolveSystemProxy();
    } catch {
      return null;
    }
  }

  /**
   * Resolve system proxy with caching.
   * Priority: env vars → VS Code setting → corporate gateway discovery.
   */
  private async resolveSystemProxy(): Promise<string | null> {
    // Return cached result if already resolved
    if (cachedSystemProxyUrl !== undefined) {
      return cachedSystemProxyUrl;
    }

    // Step 1: Sync detection (env vars, VS Code http.proxy, OS native)
    const detection = new ProxyDetectionService();
    const detected = detection.detect();
    if (detected.url) {
      cachedSystemProxyUrl = detected.url;
      return detected.url;
    }

    // Step 2: Corporate proxy discovery (DNS + TCP probe)
    try {
      const { discoverCorporateProxy } = await import("./CorporateProxyDiscovery");
      const discovered = await discoverCorporateProxy();
      if (discovered) {
        cachedSystemProxyUrl = discovered.url;
        return discovered.url;
      }
    } catch {
      // Discovery unavailable
    }

    // No proxy found
    cachedSystemProxyUrl = null;
    return null;
  }
}
