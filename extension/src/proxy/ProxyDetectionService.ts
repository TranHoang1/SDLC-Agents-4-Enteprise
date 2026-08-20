/**
 * ProxyDetectionService — Cross-platform system proxy auto-detection.
 * Priority: HTTPS_PROXY > HTTP_PROXY > VS Code http.proxy > OS-native detection.
 * OS-native: Windows (netsh), macOS (scutil), Linux (gsettings).
 */

import * as vscode from "vscode";
import { execSync } from "child_process";

/** Result of system proxy detection */
export interface DetectedProxy {
  url: string | null;
  bypass: string | null;
}

/**
 * Detects system-level proxy configuration from environment,
 * VS Code built-in settings, and OS-native proxy config.
 * Stateless — no caching.
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
   * Detect OS-native proxy ONLY (no env vars, no VS Code settings).
   * Used as the system-resolution callback for @vscode/proxy-agent,
   * which already handles env vars and http.proxy settings itself.
   */
  detectOsNative(): DetectedProxy {
    const url = this.detectOsNativeProxy();
    const bypass = this.detectOsNativeBypass();
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
    // Priority 1: Environment variables (highest — explicit user intent)
    const httpsProxy = process.env.HTTPS_PROXY || process.env.https_proxy;
    if (httpsProxy) { return httpsProxy; }

    const httpProxy = process.env.HTTP_PROXY || process.env.http_proxy;
    if (httpProxy) { return httpProxy; }

    // Priority 2: VS Code built-in setting
    const vscodeProxy = vscode.workspace
      .getConfiguration("http")
      .get<string>("proxy", "");
    if (vscodeProxy) { return vscodeProxy; }

    // Priority 3: OS-native proxy detection
    return this.detectOsNativeProxy();
  }

  private detectBypassList(): string | null {
    const envBypass = process.env.NO_PROXY || process.env.no_proxy || null;
    if (envBypass) { return envBypass; }

    // OS-native bypass list
    return this.detectOsNativeBypass();
  }

  /**
   * Detect proxy URL from OS-native configuration.
   * Cross-platform: Windows (PowerShell .NET), macOS (scutil), Linux (gsettings).
   */
  private detectOsNativeProxy(): string | null {
    switch (process.platform) {
      case "win32": return this.detectWindowsProxy();
      case "darwin": return this.detectMacOsProxy();
      case "linux": return this.detectLinuxProxy();
      default: return null;
    }
  }

  /** Detect bypass list from OS-native configuration. */
  private detectOsNativeBypass(): string | null {
    switch (process.platform) {
      case "win32": return this.detectWindowsBypass();
      case "darwin": return this.detectMacOsBypass();
      case "linux": return this.detectLinuxBypass();
      default: return null;
    }
  }

  // --- Windows: PowerShell .NET WebRequest proxy resolution ---

  private detectWindowsProxy(): string | null {
    try {
      // Use PowerShell to call .NET WebRequest.GetSystemWebProxy()
      // This detects WPAD/PAC auto-configured proxies that netsh misses
      const script = [
        "$proxy = [System.Net.WebRequest]::GetSystemWebProxy()",
        "$uri = [Uri]'https://www.google.com'",
        "$proxyUri = $proxy.GetProxy($uri)",
        "if ($proxyUri.AbsoluteUri -eq $uri.AbsoluteUri) { Write-Output 'DIRECT' }",
        "else { Write-Output $proxyUri.AbsoluteUri }",
      ].join("; ");
      const output = this.execQuiet(
        `powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -Command "${script.replace(/"/g, '\\"')}"`
      );
      const result = output.trim();
      if (!result || result === "DIRECT") { return null; }
      return result;
    } catch {
      // Fallback to netsh if PowerShell fails
      return this.detectWindowsProxyNetsh();
    }
  }

  /** Fallback: netsh winhttp (only works when proxy is explicitly set) */
  private detectWindowsProxyNetsh(): string | null {
    try {
      const output = this.execQuiet("netsh winhttp show proxy");
      const match = output.match(/Proxy Server\(s\)\s*:\s*(.+)/i);
      if (!match) { return null; }
      const server = match[1].trim();
      if (server.toLowerCase().includes("direct access")) { return null; }
      if (server.includes("=")) { return this.parsePerProtocolProxy(server); }
      return `http://${server}`;
    } catch {
      return null;
    }
  }

  private detectWindowsBypass(): string | null {
    try {
      const output = this.execQuiet("netsh winhttp show proxy");
      // Parse: "Bypass List     :  *.local;<local>"
      const match = output.match(/Bypass List\s*:\s*(.+)/i);
      if (!match) { return null; }
      const bypass = match[1].trim();
      if (bypass.toLowerCase() === "(none)") { return null; }
      return bypass.split(";").map((s) => s.trim()).filter(Boolean).join(",");
    } catch {
      return null;
    }
  }

  // --- macOS: scutil --proxy ---

  private detectMacOsProxy(): string | null {
    try {
      const output = this.execQuiet("scutil --proxy");
      // Check HTTPS first, then HTTP
      const httpsEnabled = /HTTPSEnable\s*:\s*1/i.test(output);
      if (httpsEnabled) {
        const host = output.match(/HTTPSProxy\s*:\s*(\S+)/i)?.[1];
        const port = output.match(/HTTPSPort\s*:\s*(\d+)/i)?.[1];
        if (host) { return `http://${host}${port ? `:${port}` : ""}`; }
      }
      const httpEnabled = /HTTPEnable\s*:\s*1/i.test(output);
      if (httpEnabled) {
        const host = output.match(/HTTPProxy\s*:\s*(\S+)/i)?.[1];
        const port = output.match(/HTTPPort\s*:\s*(\d+)/i)?.[1];
        if (host) { return `http://${host}${port ? `:${port}` : ""}`; }
      }
      return null;
    } catch {
      return null;
    }
  }

  private detectMacOsBypass(): string | null {
    try {
      const output = this.execQuiet("scutil --proxy");
      // ExceptionsList : <array> { 0 : *.local  1 : 169.254/16 }
      const match = output.match(/ExceptionsList\s*:\s*<array>\s*\{([^}]+)\}/i);
      if (!match) { return null; }
      const entries = match[1].match(/\d+\s*:\s*(\S+)/g);
      if (!entries) { return null; }
      const list = entries.map((e) => e.replace(/^\d+\s*:\s*/, "").trim());
      return list.join(",");
    } catch {
      return null;
    }
  }

  // --- Linux: gsettings (GNOME) ---

  private detectLinuxProxy(): string | null {
    try {
      const mode = this.execQuiet("gsettings get org.gnome.system.proxy mode")
        .trim().replace(/'/g, "");
      if (mode !== "manual") { return null; }
      // Try HTTPS first, then HTTP
      const httpsHost = this.gsettingsGet("org.gnome.system.proxy.https", "host");
      const httpsPort = this.gsettingsGet("org.gnome.system.proxy.https", "port");
      if (httpsHost) { return `http://${httpsHost}${httpsPort ? `:${httpsPort}` : ""}`; }
      const httpHost = this.gsettingsGet("org.gnome.system.proxy.http", "host");
      const httpPort = this.gsettingsGet("org.gnome.system.proxy.http", "port");
      if (httpHost) { return `http://${httpHost}${httpPort ? `:${httpPort}` : ""}`; }
      return null;
    } catch {
      // gsettings not available (non-GNOME desktop or headless server)
      return null;
    }
  }

  private detectLinuxBypass(): string | null {
    try {
      const output = this.execQuiet("gsettings get org.gnome.system.proxy ignore-hosts");
      // Format: ['localhost', '127.0.0.0/8', '::1']
      const entries = output.match(/'([^']+)'/g);
      if (!entries) { return null; }
      return entries.map((e) => e.replace(/'/g, "")).join(",");
    } catch {
      return null;
    }
  }

  // --- Shared helpers ---

  /**
   * Parse per-protocol proxy string (e.g. "http=host1:80;https=host2:443").
   * Prefers https, falls back to http.
   */
  private parsePerProtocolProxy(server: string): string | null {
    const entries = server.split(";").map((s) => s.trim());
    const map = new Map<string, string>();
    for (const entry of entries) {
      const [protocol, address] = entry.split("=", 2);
      if (protocol && address) { map.set(protocol.toLowerCase(), address); }
    }
    const httpsAddr = map.get("https");
    if (httpsAddr) { return `http://${httpsAddr}`; }
    const httpAddr = map.get("http");
    if (httpAddr) { return `http://${httpAddr}`; }
    return null;
  }

  /** Read a gsettings key, strip quotes, return null if empty or "0". */
  private gsettingsGet(schema: string, key: string): string | null {
    try {
      const val = this.execQuiet(`gsettings get ${schema} ${key}`)
        .trim().replace(/'/g, "");
      return (val && val !== "0") ? val : null;
    } catch {
      return null;
    }
  }

  /** Execute a command quietly — returns stdout, throws on error. */
  private execQuiet(cmd: string): string {
    return execSync(cmd, { encoding: "utf-8", timeout: 3000, windowsHide: true });
  }
}
