/**
 * ProxyDetectionService — System proxy auto-detection.
 * Reads environment variables and VS Code http.proxy setting.
 * Priority: HTTPS_PROXY > HTTP_PROXY > VS Code http.proxy (BR-11).
 */

import * as vscode from "vscode";

/** Result of system proxy detection */
export interface DetectedProxy {
  url: string | null;
  bypass: string | null;
}

/**
 * Detects system-level proxy configuration from environment
 * and VS Code built-in settings. Stateless — no caching.
 */
export class ProxyDetectionService {
  /**
   * Detect system proxy URL and bypass list.
   * @returns Detected proxy URL and NO_PROXY bypass list
   */
  detect(): DetectedProxy {
    const url = this.detectProxyUrl();
    const bypass = this.detectBypassList();
    return { url, bypass };
  }

  /**
   * Validate that a string is a well-formed proxy URL.
   * @param url - URL string to validate
   * @returns true if url has http: or https: protocol
   */
  isValidProxyUrl(url: string): boolean {
    try {
      const parsed = new URL(url);
      return parsed.protocol === "http:" || parsed.protocol === "https:";
    } catch {
      return false;
    }
  }

  private detectProxyUrl(): string | null {
    // Priority order per FSD BR-11
    const httpsProxy = process.env.HTTPS_PROXY || process.env.https_proxy;
    if (httpsProxy) { return httpsProxy; }

    const httpProxy = process.env.HTTP_PROXY || process.env.http_proxy;
    if (httpProxy) { return httpProxy; }

    const vscodeProxy = vscode.workspace
      .getConfiguration("http")
      .get<string>("proxy", "");
    if (vscodeProxy) { return vscodeProxy; }

    return null;
  }

  private detectBypassList(): string | null {
    return process.env.NO_PROXY || process.env.no_proxy || null;
  }
}
