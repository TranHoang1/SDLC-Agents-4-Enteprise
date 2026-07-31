/**
 * VscodeProxyResolverService — Leverages VS Code's own proxy resolution
 * (@vscode/proxy-agent, the same stack VS Code core uses).
 *
 * The resolver reads http.proxy, http.proxySupport, http.noProxy, env vars
 * (HTTPS_PROXY/HTTP_PROXY/NO_PROXY), bypasses localhost automatically, caches
 * per-URL results, and falls back to OS-native detection (netsh/scutil/gsettings)
 * via the provided resolveProxy callback. It also handles WPAD/PAC when the
 * underlying system resolver is configured for auto-detection.
 */

import * as vscode from "vscode";
import { createProxyResolver, LogLevel } from "@vscode/proxy-agent";
import type { ResolvedProxyInfo } from "@vscode/proxy-agent";
import type { ProxyDetectionService } from "./ProxyDetectionService";

/**
 * Result of a per-URL proxy resolution.
 */
export interface VscodeProxyResolveResult {
  /** Resolved proxy URL, or undefined for a direct connection. */
  url: string | undefined;
  /** Which configuration determined the result. */
  source: string;
}

/**
 * Wraps @vscode/proxy-agent's createProxyResolver with VS Code settings.
 * Stateless — the underlying resolver maintains its own per-URL cache.
 */
export class VscodeProxyResolverService {
  private readonly resolver: ReturnType<typeof createProxyResolver>;

  constructor(private readonly detectionService: ProxyDetectionService) {
    this.resolver = createProxyResolver({
      getProxyURL: () =>
        vscode.workspace.getConfiguration("http").get<string>("proxy") || undefined,
      getProxySupport: () =>
        (vscode.workspace.getConfiguration("http").get<string>("proxySupport", "on") ??
          "on") as "override" | "fallback" | "on" | "off",
      getNoProxyConfig: () =>
        vscode.workspace.getConfiguration("http").get<string[]>("noProxy", []),
      isAdditionalFetchSupportEnabled: () => false,
      isWebSocketPatchEnabled: () => false,
      addCertificatesV1: () => false,
      addCertificatesV2: () => false,
      loadSystemCertificatesFromNode: () => undefined,
      loadAdditionalCertificates: async () => [],
      resolveProxy: (url) => this.resolveSystemProxy(url),
      log: {
        trace: () => {},
        debug: (msg: string) => console.debug(`[ProxyResolver] ${msg}`),
        info: (msg: string) => console.info(`[ProxyResolver] ${msg}`),
        warn: (msg: string) => console.warn(`[ProxyResolver] ${msg}`),
        error: (err: string | Error) => {
          const msg = typeof err === "string" ? err : err.message;
          console.warn(`[ProxyResolver] ${msg}`);
        },
      },
      getLogLevel: () => LogLevel.Info,
      proxyResolveTelemetry: () => {},
      isUseHostProxyEnabled: () => true,
      getNetworkInterfaceCheckInterval: () => 30_000,
      env: process.env,
    });
  }

  /**
   * Resolve the effective proxy for a single target URL.
   * @param url - Absolute target URL to reach
   * @returns Proxy URL (undefined = connect directly) plus resolution source
   */
  async resolveByUrl(url: string): Promise<VscodeProxyResolveResult> {
    try {
      const info: ResolvedProxyInfo = await this.resolver.resolveProxyByURL(url);
      return { url: info.url, source: info.source };
    } catch {
      // Resolution failed — connect directly rather than hard-fail the request.
      return { url: undefined, source: "error" };
    }
  }

  /** OS-native detection used as the system/PAC resolution fallback. */
  private resolveSystemProxy(_url: string): Promise<string | undefined> {
    const detected = this.detectionService.detectOsNative();
    if (!detected.url) { return Promise.resolve(undefined); }
    // Return in PAC format (e.g. "PROXY host:port") — that's what
    // @vscode/proxy-agent's getProxyURLFromResolverResult expects.
    const target = detected.url.replace(/^https?:\/\//, "");
    return Promise.resolve(`PROXY ${target}`);
  }
}
