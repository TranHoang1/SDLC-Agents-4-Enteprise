/**
 * PowerShellTransport — PowerShell subprocess HTTP driver for corporate proxy environments.
 *
 * Uses Invoke-WebRequest (PowerShell 5.1+) or .NET HttpClient (PowerShell 7+)
 * to make HTTP requests through corporate proxies. PowerShell inherits system
 * proxy settings and NTLM credentials automatically on Windows.
 *
 * Key benefits over Node.js native HTTP:
 * - Inherits IE/WinHTTP proxy settings (WPAD, PAC)
 * - NTLM/Kerberos SSO via Windows credential store
 * - Not blocked by EDR policies targeting node.exe
 */

import { execFile, spawn } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

/** Response from PowerShell transport */
export interface PwshResponse {
  status: number;
  statusText: string;
  ok: boolean;
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
   * Returns proxy URL or null if direct connection.
   */
  static async detectSystemProxy(): Promise<string | null> {
    const script = `
      $proxy = [System.Net.WebRequest]::GetSystemWebProxy()
      $testUrl = [System.Uri]'https://api.anthropic.com'
      $proxyUri = $proxy.GetProxy($testUrl)
      if ($proxyUri -and $proxyUri.AbsoluteUri -ne $testUrl.AbsoluteUri) {
        Write-Output $proxyUri.AbsoluteUri
      }
    `;
    try {
      const { stdout } = await execFileAsync(
        PowerShellTransport.getPwshBinary(),
        ["-NoProfile", "-NonInteractive", "-Command", script],
        { timeout: 10000 }
      );
      const url = stdout.trim();
      return url.length > 0 ? url : null;
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
      const error = err as Error;
      throw new PowerShellTransportError(
        this.interpretError(error)
      );
    }
  }

  /**
   * Execute streaming HTTP request via .NET HttpClient in PowerShell.
   * Returns a ReadableStream that pipes response chunks.
   */
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

        proc.on("close", () => {
          controller.close();
        });

        proc.on("error", (err) => {
          controller.error(new PowerShellTransportError(`Stream error: ${err.message}`));
        });

        // Send body via stdin if present
        if (options.body) {
          proc.stdin.write(options.body);
          proc.stdin.end();
        } else {
          proc.stdin.end();
        }
      },
    });
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
    } catch {
      return false;
    }
  }

  /** Build Invoke-WebRequest script for standard requests */
  private buildRequestScript(
    url: string,
    method: string,
    timeoutSec: number,
    options: PwshRequestOptions
  ): string {
    const lines: string[] = [];

    // Suppress progress bar (speeds up significantly)
    lines.push("$ProgressPreference = 'SilentlyContinue'");

    // Build headers hashtable
    if (options.headers && Object.keys(options.headers).length > 0) {
      const entries = Object.entries(options.headers)
        .map(([k, v]) => `'${k}'='${v.replace(/'/g, "''")}'`)
        .join(";");
      lines.push(`$headers = @{${entries}}`);
    }

    // Build Invoke-WebRequest command
    lines.push("try {");
    let cmd = `  $r = Invoke-WebRequest -Uri '${url}' -Method ${method} -TimeoutSec ${timeoutSec} -UseBasicParsing`;

    if (this.proxyUrl) {
      cmd += ` -Proxy '${this.proxyUrl}' -ProxyUseDefaultCredentials`;
    }

    if (options.headers && Object.keys(options.headers).length > 0) {
      cmd += " -Headers $headers";
    }

    if (options.body && method !== "GET" && method !== "HEAD") {
      // Pass body via stdin to avoid escaping issues
      cmd += " -Body ([System.Console]::In.ReadToEnd())";
    }

    lines.push(cmd);
    lines.push("  Write-Output \"STATUS:$($r.StatusCode)\"");
    lines.push("  Write-Output \"STATUSTEXT:$($r.StatusDescription)\"");
    lines.push("  Write-Output \"BODY:$($r.Content)\"");
    lines.push("} catch {");
    lines.push("  $ex = $_.Exception");
    lines.push("  if ($ex.Response) {");
    lines.push("    $code = [int]$ex.Response.StatusCode");
    lines.push("    Write-Output \"STATUS:$code\"");
    lines.push("    Write-Output \"STATUSTEXT:$($ex.Response.StatusDescription)\"");
    lines.push("    Write-Output \"BODY:$($ex.Message)\"");
    lines.push("  } else {");
    lines.push("    Write-Error $ex.Message");
    lines.push("    exit 1");
    lines.push("  }");
    lines.push("}");

    return lines.join("\n");
  }

  /** Build streaming script using .NET HttpClient */
  private buildStreamScript(
    url: string,
    method: string,
    timeoutSec: number,
    options: PwshRequestOptions
  ): string {
    const lines: string[] = [];
    lines.push("$ProgressPreference = 'SilentlyContinue'");
    lines.push(`$client = [System.Net.Http.HttpClient]::new()`);
    lines.push(`$client.Timeout = [TimeSpan]::FromSeconds(${timeoutSec})`);

    if (this.proxyUrl) {
      lines.push(`$handler = [System.Net.Http.HttpClientHandler]::new()`);
      lines.push(`$handler.Proxy = [System.Net.WebProxy]::new('${this.proxyUrl}')`);
      lines.push(`$handler.UseDefaultCredentials = $true`);
      lines.push(`$client = [System.Net.Http.HttpClient]::new($handler)`);
      lines.push(`$client.Timeout = [TimeSpan]::FromSeconds(${timeoutSec})`);
    }

    lines.push(`$request = [System.Net.Http.HttpRequestMessage]::new([System.Net.Http.HttpMethod]::${this.dotNetMethod(method)}, '${url}')`);

    if (options.headers) {
      for (const [k, v] of Object.entries(options.headers)) {
        lines.push(`$request.Headers.TryAddWithoutValidation('${k}', '${v.replace(/'/g, "''")}') | Out-Null`);
      }
    }

    // Body from stdin
    lines.push("$body = [System.Console]::In.ReadToEnd()");
    lines.push("if ($body.Length -gt 0) {");
    lines.push("  $request.Content = [System.Net.Http.StringContent]::new($body, [System.Text.Encoding]::UTF8, 'application/json')");
    lines.push("}");

    // Stream response
    lines.push("$response = $client.SendAsync($request, [System.Net.Http.HttpCompletionOption]::ResponseHeadersRead).Result");
    lines.push("$stream = $response.Content.ReadAsStreamAsync().Result");
    lines.push("$reader = [System.IO.StreamReader]::new($stream)");
    lines.push("while (-not $reader.EndOfStream) {");
    lines.push("  $line = $reader.ReadLine()");
    lines.push("  [Console]::WriteLine($line)");
    lines.push("}");
    lines.push("$reader.Dispose()");
    lines.push("$client.Dispose()");

    return lines.join("\n");
  }

  /** Parse PowerShell output into response object */
  private parseOutput(stdout: string): PwshResponse {
    const lines = stdout.split(/\r?\n/);
    let status = 0;
    let statusText = "";
    const bodyLines: string[] = [];
    let inBody = false;

    for (const line of lines) {
      if (line.startsWith("STATUS:")) {
        status = parseInt(line.slice(7), 10) || 0;
      } else if (line.startsWith("STATUSTEXT:")) {
        statusText = line.slice(11);
      } else if (line.startsWith("BODY:")) {
        inBody = true;
        bodyLines.push(line.slice(5));
      } else if (inBody) {
        bodyLines.push(line);
      }
    }

    return {
      status,
      statusText,
      ok: status >= 200 && status < 300,
      body: bodyLines.join("\n"),
    };
  }

  /** Map HTTP method to .NET HttpMethod property name */
  private dotNetMethod(method: string): string {
    const map: Record<string, string> = {
      GET: "Get", POST: "Post", PUT: "Put",
      DELETE: "Delete", PATCH: "Patch", HEAD: "Head",
      OPTIONS: "Options",
    };
    return map[method] || "Post";
  }

  /** Interpret PowerShell errors into user-friendly messages */
  private interpretError(err: Error): string {
    const msg = err.message || "";
    if (msg.includes("timed out") || msg.includes("TimeoutSec")) {
      return "Connection timed out — proxy may be unreachable";
    }
    if (msg.includes("Unable to connect")) {
      return "Connection refused — verify proxy host and port";
    }
    if (msg.includes("resolve")) {
      return "Cannot resolve hostname";
    }
    if (msg.includes("SSL") || msg.includes("certificate")) {
      return "SSL certificate error — proxy may require CA trust";
    }
    return `PowerShell error: ${msg}`;
  }

  /** Get PowerShell binary path — prefer pwsh (PS7+), fallback to powershell.exe */
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
