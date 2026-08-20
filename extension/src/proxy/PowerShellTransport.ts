/**
 * PowerShellTransport — PowerShell subprocess HTTP driver for corporate proxy environments.
 *
 * Uses Invoke-WebRequest (PowerShell 5.1+) to make HTTP requests through corporate proxies.
 * PowerShell inherits system proxy settings and NTLM credentials automatically on Windows.
 */

import { execFile, spawn } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

/** Response from PowerShell transport */
export interface PwshResponse {
  status: number;
  statusText: string;
  ok: boolean;
  headers: Record<string, string>;
  body: string;
}

/** Options for PowerShell request */
export interface PwshRequestOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  timeout?: number;
}

/**
 * HTTP transport using PowerShell subprocess.
 * Leverages system proxy settings and Windows NTLM/Kerberos authentication.
 */
export class PowerShellTransport {
  private readonly proxyUrl: string | null;

  constructor(proxyUrl: string | null) {
    this.proxyUrl = proxyUrl;
  }

  /**
   * Detect system proxy via PowerShell .NET WebRequest.GetSystemWebProxy().
   * Returns proxy URL, or null if direct connection or DIRECT.
   */
  static async detectSystemProxy(): Promise<string | null> {
    const script = `
      $proxy = [System.Net.WebRequest]::GetSystemWebProxy()
      $testUrl = [System.Uri]'https://api.anthropic.com'
      $proxyUri = $proxy.GetProxy($testUrl)
      if ($proxyUri -and $proxyUri.AbsoluteUri -ne $testUrl.AbsoluteUri) {
        Write-Output $proxyUri.AbsoluteUri
      } else {
        Write-Output 'DIRECT'
      }
    `;
    try {
      const { stdout } = await execFileAsync(
        PowerShellTransport.getPwshBinary(),
        ["-NoProfile", "-NonInteractive", "-Command", script],
        { timeout: 10000 }
      );
      const result = stdout.trim();
      if (!result || result === "DIRECT") { return null; }
      return result;
    } catch {
      return null;
    }
  }

  /** Execute HTTP request via PowerShell Invoke-WebRequest */
  async request(url: string, options: PwshRequestOptions = {}): Promise<PwshResponse> {
    const method = (options.method || "GET").toUpperCase();
    const timeout = options.timeout || 10000;
    const timeoutSec = Math.ceil(timeout / 1000);
    const script = this.buildRequestScript(url, method, timeoutSec, options);

    try {
      const { stdout } = await execFileAsync(
        PowerShellTransport.getPwshBinary(),
        ["-NoProfile", "-NonInteractive", "-Command", script],
        { timeout: timeout + 5000, maxBuffer: 20 * 1024 * 1024 }
      );
      return this.parseOutput(stdout);
    } catch (err: unknown) {
      const error = err as Error & { stderr?: string };
      throw new PowerShellTransportError(this.interpretError(error));
    }
  }

  /** Execute streaming HTTP request via .NET HttpClient in PowerShell */
  streamRequest(url: string, options: PwshRequestOptions = {}): ReadableStream<Uint8Array> {
    const method = (options.method || "POST").toUpperCase();
    const timeout = options.timeout || 120000;
    const timeoutSec = Math.ceil(timeout / 1000);
    const script = this.buildStreamScript(url, method, timeoutSec, options);
    const encoder = new TextEncoder();

    return new ReadableStream<Uint8Array>({
      start: (controller) => {
        const proc = spawn(
          PowerShellTransport.getPwshBinary(),
          ["-NoProfile", "-NonInteractive", "-Command", script],
          { stdio: ["pipe", "pipe", "pipe"] }
        );
        proc.stdout.on("data", (chunk: Buffer) => {
          controller.enqueue(encoder.encode(chunk.toString("utf-8")));
        });
        proc.on("close", () => { controller.close(); });
        proc.on("error", (e) => {
          controller.error(new PowerShellTransportError(`Stream error: ${e.message}`));
        });
        if (options.body) { proc.stdin.write(options.body); }
        proc.stdin.end();
      },
    });
  }

  /** Quick connectivity test — returns latency in ms */
  async testConnection(url: string, _proxyUrl?: string | null): Promise<number> {
    const start = Date.now();
    const response = await this.request(url, { method: "GET", timeout: 10000 });
    if (!response.ok && response.status !== 301 && response.status !== 302) {
      throw new PowerShellTransportError(`HTTP ${response.status}: ${response.statusText}`);
    }
    return Date.now() - start;
  }

  /** Check if PowerShell is available */
  static async isAvailable(): Promise<boolean> {
    try {
      await execFileAsync(
        PowerShellTransport.getPwshBinary(),
        ["-NoProfile", "-NonInteractive", "-Command", "Write-Output ok"],
        { timeout: 5000 }
      );
      return true;
    } catch { return false; }
  }

  /** Build Invoke-WebRequest script with structured output delimiters */
  private buildRequestScript(
    url: string, method: string, timeoutSec: number, options: PwshRequestOptions
  ): string {
    const escapedUrl = url.replace(/'/g, "''");
    const lines: string[] = [];
    lines.push("$ProgressPreference = 'SilentlyContinue'");
    lines.push("[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12");
    lines.push("$params = @{");
    lines.push(`  Uri = '${escapedUrl}'`);
    lines.push(`  Method = '${method}'`);
    lines.push(`  TimeoutSec = ${timeoutSec}`);
    lines.push("  UseBasicParsing = $true");
    if (this.proxyUrl) {
      lines.push(`  Proxy = '${this.proxyUrl}'`);
      lines.push("  ProxyUseDefaultCredentials = $true");
    }
    lines.push("}");
    if (options.headers && Object.keys(options.headers).length > 0) {
      lines.push("$params.Headers = @{");
      for (const [k, v] of Object.entries(options.headers)) {
        if (k.toLowerCase() === "content-type") { continue; }
        lines.push(`  '${k}' = '${v.replace(/'/g, "''")}'`);
      }
      lines.push("}");
    }
    if (options.body && method !== "GET" && method !== "HEAD") {
      lines.push(`$params.Body = '${options.body.replace(/'/g, "''")}'`);
      const ct = options.headers?.["Content-Type"] || options.headers?.["content-type"];
      if (ct) { lines.push(`$params.ContentType = '${ct}'`); }
    }
    lines.push("try {");
    lines.push("  $r = Invoke-WebRequest @params");
    lines.push("  Write-Output '---PWSH_STATUS---'");
    lines.push("  Write-Output $r.StatusCode");
    lines.push("  Write-Output '---PWSH_STATUS_TEXT---'");
    lines.push("  Write-Output $r.StatusDescription");
    lines.push("  Write-Output '---PWSH_HEADERS---'");
    lines.push("  foreach ($h in $r.Headers.GetEnumerator()) { Write-Output \"$($h.Key): $($h.Value)\" }");
    lines.push("  Write-Output '---PWSH_BODY---'");
    lines.push("  Write-Output $r.Content");
    lines.push("} catch {");
    lines.push("  $ex = $_.Exception");
    lines.push("  if ($ex.Response) {");
    lines.push("    Write-Output '---PWSH_STATUS---'");
    lines.push("    Write-Output ([int]$ex.Response.StatusCode)");
    lines.push("    Write-Output '---PWSH_STATUS_TEXT---'");
    lines.push("    Write-Output $ex.Response.StatusDescription");
    lines.push("    Write-Output '---PWSH_HEADERS---'");
    lines.push("    Write-Output ''");
    lines.push("    Write-Output '---PWSH_BODY---'");
    lines.push("    Write-Output $ex.Message");
    lines.push("  } else {");
    lines.push("    Write-Error $ex.Message");
    lines.push("    exit 1");
    lines.push("  }");
    lines.push("}");
    return lines.join("\n");
  }

  /** Build streaming script using .NET HttpClient */
  private buildStreamScript(
    url: string, method: string, timeoutSec: number, options: PwshRequestOptions
  ): string {
    const lines: string[] = [];
    lines.push("$ProgressPreference = 'SilentlyContinue'");
    lines.push("$handler = [System.Net.Http.HttpClientHandler]::new()");
    if (this.proxyUrl) {
      lines.push(`$handler.Proxy = [System.Net.WebProxy]::new('${this.proxyUrl}')`);
      lines.push("$handler.UseDefaultCredentials = $true");
    }
    lines.push("$client = [System.Net.Http.HttpClient]::new($handler)");
    lines.push(`$client.Timeout = [TimeSpan]::FromSeconds(${timeoutSec})`);
    lines.push(`$req = [System.Net.Http.HttpRequestMessage]::new([System.Net.Http.HttpMethod]::${this.dotNetMethod(method)}, '${url}')`);
    if (options.headers) {
      for (const [k, v] of Object.entries(options.headers)) {
        lines.push(`$req.Headers.TryAddWithoutValidation('${k}', '${v.replace(/'/g, "''")}') | Out-Null`);
      }
    }
    lines.push("$body = [System.Console]::In.ReadToEnd()");
    lines.push("if ($body.Length -gt 0) { $req.Content = [System.Net.Http.StringContent]::new($body, [System.Text.Encoding]::UTF8, 'application/json') }");
    lines.push("$resp = $client.SendAsync($req, [System.Net.Http.HttpCompletionOption]::ResponseHeadersRead).Result");
    lines.push("$stream = $resp.Content.ReadAsStreamAsync().Result");
    lines.push("$reader = [System.IO.StreamReader]::new($stream)");
    lines.push("while (-not $reader.EndOfStream) { [Console]::WriteLine($reader.ReadLine()) }");
    lines.push("$reader.Dispose(); $client.Dispose()");
    return lines.join("\n");
  }

  /** Parse structured PowerShell output into response object */
  private parseOutput(stdout: string): PwshResponse {
    const lines = stdout.split(/\r?\n/);
    let status = 0;
    let statusText = "";
    const headers: Record<string, string> = {};
    const bodyLines: string[] = [];
    let section: "none" | "status" | "statusText" | "headers" | "body" = "none";

    for (const line of lines) {
      if (line === "---PWSH_STATUS---") { section = "status"; continue; }
      if (line === "---PWSH_STATUS_TEXT---") { section = "statusText"; continue; }
      if (line === "---PWSH_HEADERS---") { section = "headers"; continue; }
      if (line === "---PWSH_BODY---") { section = "body"; continue; }
      switch (section) {
        case "status": status = parseInt(line.trim(), 10) || 0; break;
        case "statusText": statusText = line.trim(); break;
        case "headers": {
          const idx = line.indexOf(":");
          if (idx > 0) { headers[line.slice(0, idx).trim().toLowerCase()] = line.slice(idx + 1).trim(); }
          break;
        }
        case "body": bodyLines.push(line); break;
      }
    }
    while (bodyLines.length > 0 && bodyLines[bodyLines.length - 1] === "") { bodyLines.pop(); }
    return { status, statusText, ok: status >= 200 && status < 300, headers, body: bodyLines.join("\n") };
  }

  /** Map HTTP method to .NET HttpMethod property name */
  private dotNetMethod(method: string): string {
    return ({ GET: "Get", POST: "Post", PUT: "Put", DELETE: "Delete", PATCH: "Patch", HEAD: "Head" })[method] || "Post";
  }

  /** Interpret PowerShell errors into user-friendly messages */
  private interpretError(err: Error & { stderr?: string }): string {
    const s = err.stderr || err.message || "";
    if (s.includes("407")) { return "Proxy authentication failed — 407 Proxy Authentication Required"; }
    if (s.includes("timed out") || s.includes("TimeoutSec")) { return "Connection timed out — proxy may be unreachable"; }
    if (s.includes("Unable to connect")) { return "Connection refused — verify proxy host and port"; }
    if (s.includes("503")) { return "HTTP 503 — Service Unavailable"; }
    if (s.includes("SSL") || s.includes("certificate")) { return "SSL certificate error"; }
    return `PowerShell error: ${s}`;
  }

  /** Get PowerShell binary */
  private static getPwshBinary(): string {
    return process.platform === "win32" ? "powershell.exe" : "pwsh";
  }
}

/** Error class for PowerShell transport */
export class PowerShellTransportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PowerShellTransportError";
  }
}
