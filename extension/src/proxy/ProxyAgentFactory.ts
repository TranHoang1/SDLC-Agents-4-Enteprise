/**
 * ProxyAgentFactory — Singleton factory for undici ProxyAgent.
 * Creates dispatcher based on current proxy configuration.
 * Invalidated and rebuilt on config change (BR-13: no restart needed).
 */

import { ProxyAgent } from "undici";
import type { Dispatcher } from "undici";
import type { ProxyConfig, ProxyCredentials } from "../models/ProxyModels";
import type { ProxyConfigService } from "./ProxyConfigService";
import type { ProxyDetectionService } from "./ProxyDetectionService";

/** Module-level singleton instance */
let instance: ProxyAgentFactory | null = null;

/**
 * Manages undici ProxyAgent lifecycle. Ensures all HttpClient instances
 * share the same agent and supports instant reconfiguration.
 */
export class ProxyAgentFactory {
  private currentAgent: ProxyAgent | null = null;
  private currentUri: string | null = null;

  private constructor(
    private readonly configService: ProxyConfigService,
    private readonly detectionService: ProxyDetectionService
  ) {}

  /** Initialize singleton (called at extension activation) */
  static initialize(
    configService: ProxyConfigService,
    detectionService: ProxyDetectionService
  ): void {
    instance = new ProxyAgentFactory(configService, detectionService);
  }

  /** Get the singleton instance */
  static getInstance(): ProxyAgentFactory {
    if (!instance) {
      throw new Error("ProxyAgentFactory not initialized");
    }
    return instance;
  }

  /** Expose config for bypass checking by HttpClient */
  getConfig(): ProxyConfig {
    return this.configService.getConfig();
  }

  /**
   * Get the current dispatcher for fetch() calls.
   * Returns ProxyAgent if proxy configured, undefined for direct connection.
   */
  async getDispatcher(): Promise<Dispatcher | undefined> {
    const config = this.configService.getConfig();
    if (config.mode === "none") { return undefined; }

    const proxyUrl = this.resolveProxyUrl(config);
    if (!proxyUrl) { return undefined; }

    // Rebuild agent if URL changed or agent doesn't exist
    if (!this.currentAgent || this.currentUri !== proxyUrl) {
      await this.rebuildAgent(proxyUrl);
    }
    return this.currentAgent ?? undefined;
  }

  /**
   * Check if a target URL should bypass the proxy.
   * Supports wildcards: *.domain.com matches sub.domain.com
   */
  shouldBypass(targetUrl: string, bypassList: string): boolean {
    if (!bypassList || !targetUrl) { return false; }
    try {
      const hostname = new URL(targetUrl).hostname.toLowerCase();
      const entries = bypassList.split(",").map((e) => e.trim().toLowerCase());
      return entries.some((entry) => this.matchBypassEntry(hostname, entry));
    } catch {
      return false;
    }
  }

  /** Invalidate cached agent (called after config save) */
  invalidate(): void {
    this.currentAgent?.close();
    this.currentAgent = null;
    this.currentUri = null;
  }

  /** Create a temporary ProxyAgent for testing (not cached) */
  createTemporaryAgent(
    proxyUrl: string,
    credentials?: ProxyCredentials
  ): ProxyAgent {
    const opts: Record<string, unknown> = { uri: proxyUrl };
    if (credentials) {
      opts.token = this.buildBasicToken(credentials);
    }
    return new ProxyAgent(opts as unknown as ConstructorParameters<typeof ProxyAgent>[0]);
  }

  /** Reset singleton (for testing) */
  static reset(): void {
    instance?.invalidate();
    instance = null;
  }

  private resolveProxyUrl(config: ProxyConfig): string | null {
    if (config.mode === "manual") {
      if (!config.host) { return null; }
      return `http://${config.host}:${config.port}`;
    }
    // mode === "system"
    const detected = this.detectionService.detect();
    return detected.url;
  }

  private async rebuildAgent(proxyUrl: string): Promise<void> {
    this.currentAgent?.close();
    const creds = await this.configService.getCredentials();
    const opts: Record<string, unknown> = { uri: proxyUrl };
    if (creds) {
      opts.token = this.buildBasicToken(creds);
    }
    this.currentAgent = new ProxyAgent(
      opts as unknown as ConstructorParameters<typeof ProxyAgent>[0]
    );
    this.currentUri = proxyUrl;
  }

  private buildBasicToken(creds: ProxyCredentials): string {
    const encoded = Buffer.from(
      `${creds.username}:${creds.password}`
    ).toString("base64");
    return `Basic ${encoded}`;
  }

  private matchBypassEntry(hostname: string, entry: string): boolean {
    if (entry === hostname) { return true; }
    // Wildcard: *.domain.com or .domain.com
    if (entry.startsWith("*.")) {
      const suffix = entry.slice(1); // .domain.com
      return hostname.endsWith(suffix);
    }
    if (entry.startsWith(".")) {
      return hostname.endsWith(entry);
    }
    return false;
  }
}
