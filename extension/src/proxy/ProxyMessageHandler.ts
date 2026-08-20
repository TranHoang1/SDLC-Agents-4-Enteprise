/**
 * ProxyMessageHandler — Handles proxy-specific webview messages.
 * Composed by SettingsMessageHandler (delegation pattern).
 * Manages 7 message types for proxy configuration UI.
 */

import * as vscode from "vscode";
import { ProxyConfigService } from "./ProxyConfigService";
import { ProxyDetectionService } from "./ProxyDetectionService";
import { ProxyTestService } from "./ProxyTestService";
import { PowerShellHttpAdapter } from "./PowerShellHttpAdapter";
import { ProxyAgentFactory } from "./ProxyAgentFactory";
import type { ProxyMode } from "../models/ProxyModels";

/** All proxy-related message type identifiers */
export const PROXY_MESSAGE_TYPES = [
  "getProxyState",
  "setProxyMode",
  "saveProxy",
  "saveProxyCredentials",
  "clearProxyCredentials",
  "testProxyConnection",
  "detectSystemProxy",
] as const;

/**
 * Handles all proxy webview messages. Composes config, detection,
 * test services and coordinates ProxyAgentFactory invalidation.
 */
export class ProxyMessageHandler {
  private readonly configService: ProxyConfigService;
  private readonly detectionService: ProxyDetectionService;
  private readonly testService: ProxyTestService;

  constructor(
    secrets: vscode.SecretStorage,
    private readonly postMessage: (msg: unknown) => void
  ) {
    this.configService = new ProxyConfigService(secrets);
    this.detectionService = new ProxyDetectionService();
    this.testService = new ProxyTestService(this.detectionService);
  }

  /** Route message to appropriate handler */
  async handle(msg: Record<string, unknown>): Promise<void> {
    switch (msg.type) {
      case "getProxyState":
        await this.handleGetProxyState();
        break;
      case "setProxyMode":
        await this.handleSetProxyMode(msg.mode as ProxyMode);
        break;
      case "saveProxy":
        await this.handleSaveProxy(msg);
        break;
      case "saveProxyCredentials":
        await this.handleSaveProxyCredentials(msg);
        break;
      case "clearProxyCredentials":
        await this.handleClearProxyCredentials();
        break;
      case "testProxyConnection":
        await this.handleTestProxyConnection(msg);
        break;
      case "detectSystemProxy":
        await this.handleDetectSystemProxy();
        break;
    }
  }

  private async handleGetProxyState(): Promise<void> {
    const detected = this.detectionService.detect();
    const state = await this.configService.getState(
      detected.url,
      detected.bypass
    );
    this.postMessage({ type: "proxyState", ...state });
  }

  private async handleSetProxyMode(mode: ProxyMode): Promise<void> {
    try {
      await this.configService.setMode(mode);
      this.invalidateFactory();
      this.postMessage({ type: "proxyModeChanged", mode, success: true });
      await this.handleGetProxyState();
    } catch (err: unknown) {
      const message = (err as Error).message;
      this.postMessage({
        type: "proxyModeChanged",
        mode,
        success: false,
        error: message,
      });
    }
  }

  private async handleSaveProxy(
    msg: Record<string, unknown>
  ): Promise<void> {
    const host = msg.host as string;
    const port = msg.port as number;
    const bypass = (msg.bypass as string) || "";

    if (!host || host.trim().length === 0) {
      this.postMessage({
        type: "proxySaved",
        success: false,
        error: "Proxy host is required",
      });
      return;
    }
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      this.postMessage({
        type: "proxySaved",
        success: false,
        error: "Port must be 1\u201365535",
      });
      return;
    }
    try {
      await this.configService.saveProxy(host.trim(), port, bypass);
      this.invalidateFactory();
      this.postMessage({ type: "proxySaved", success: true });
    } catch (err: unknown) {
      this.postMessage({
        type: "proxySaved",
        success: false,
        error: (err as Error).message,
      });
    }
  }

  private async handleSaveProxyCredentials(
    msg: Record<string, unknown>
  ): Promise<void> {
    const username = msg.username as string;
    const password = msg.password as string;
    if (!username || !password) {
      this.postMessage({
        type: "proxyCredentialsSaved",
        success: false,
        error: "Username and password required",
      });
      return;
    }
    try {
      await this.configService.saveCredentials(username, password);
      this.invalidateFactory();
      this.postMessage({ type: "proxyCredentialsSaved", success: true });
    } catch (err: unknown) {
      this.postMessage({
        type: "proxyCredentialsSaved",
        success: false,
        error: (err as Error).message,
      });
    }
  }

  private async handleClearProxyCredentials(): Promise<void> {
    try {
      await this.configService.clearCredentials();
      this.invalidateFactory();
      this.postMessage({ type: "proxyCredentialsCleared", success: true });
    } catch (err: unknown) {
      this.postMessage({
        type: "proxyCredentialsCleared",
        success: false,
        error: (err as Error).message,
      });
    }
  }

  private async handleTestProxyConnection(
    msg: Record<string, unknown>
  ): Promise<void> {
    const result = await this.testService.testConnection({
      mode: (msg.mode as ProxyMode) || "manual",
      host: (msg.host as string) || "",
      port: (msg.port as number) || 8080,
      username: msg.username as string | undefined,
      password: msg.password as string | undefined,
      testUrl: (msg.testUrl as string) || undefined,
    });
    this.postMessage({ type: "proxyTestResult", ...result });
  }

  private async handleDetectSystemProxy(): Promise<void> {
    // Try sync detection first (env vars, VS Code settings, PowerShell .NET)
    const detected = this.detectionService.detect();
    if (detected.url) {
      this.postMessage({
        type: "systemProxyDetected",
        url: detected.url,
        bypass: detected.bypass,
      });
      return;
    }
    // Fallback 1: async PowerShell detection (handles WPAD/PAC better)
    try {
      const { PowerShellTransport } = await import("./PowerShellTransport");
      const proxyUrl = await PowerShellTransport.detectSystemProxy();
      if (proxyUrl) {
        this.postMessage({
          type: "systemProxyDetected",
          url: proxyUrl,
          bypass: detected.bypass,
        });
        return;
      }
    } catch {
      // PowerShell unavailable or failed — continue to next fallback
    }
    // Fallback 2: Corporate proxy discovery (DNS + TCP port probe)
    // Detects McAfee/Skyhigh Web Gateway and similar inline proxies
    try {
      const { discoverCorporateProxy } = await import("./CorporateProxyDiscovery");
      const discovered = await discoverCorporateProxy();
      if (discovered) {
        this.postMessage({
          type: "systemProxyDetected",
          url: discovered.url,
          bypass: detected.bypass,
        });
        return;
      }
    } catch {
      // Discovery failed — report no proxy
    }
    this.postMessage({
      type: "systemProxyDetected",
      url: null,
      bypass: null,
    });
  }

  /** Safely invalidate the proxy agent factory */
  private invalidateFactory(): void {
    try {
      ProxyAgentFactory.getInstance().invalidate();
    } catch {
      // Factory not yet initialized — ignore
    }
    // Also invalidate PowerShell adapter's cached system proxy
    PowerShellHttpAdapter.invalidateCache();
  }
}
