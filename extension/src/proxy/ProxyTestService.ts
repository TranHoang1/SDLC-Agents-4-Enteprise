/**
 * ProxyTestService — Proxy connectivity testing.
 * Uses temporary ProxyAgent built from unsaved form values (BR-09).
 * Timeout: 10s. Measures latency.
 */

import { ProxyAgent } from "undici";
import type { ProxyTestInput, ProxyTestResult, ProxyCredentials } from "../models/ProxyModels";
import type { ProxyDetectionService } from "./ProxyDetectionService";
import { VscodeProxyResolverService } from "./VscodeProxyResolverService";
import { CurlTransport } from "./CurlTransport";

const TEST_URL = "https://httpbin.org/get";
const TEST_TIMEOUT_MS = 10_000;

/**
 * Tests proxy connectivity using unsaved form values.
 * Creates a temporary ProxyAgent, sends GET request, measures latency.
 */
export class ProxyTestService {
  private readonly resolver: VscodeProxyResolverService;

  constructor(private readonly detectionService: ProxyDetectionService) {
    this.resolver = new VscodeProxyResolverService(detectionService);
  }

  /**
   * Test proxy connectivity using form values.
   * @param input - Unsaved form values for proxy configuration
   * @returns Result with success status, message, and optional latency
   */
  async testConnection(input: ProxyTestInput): Promise<ProxyTestResult> {
    const targetUrl = input.testUrl || TEST_URL;
    // Curl mode: test via curl.exe subprocess
    if (input.mode === "curl") {
      return this.testViaCurl(input, targetUrl);
    }
    const proxyUrl = await this.resolveTestProxyUrl(input);
    if (!proxyUrl) {
      return { success: false, message: "No proxy URL to test" };
    }

    let agent: ProxyAgent | null = null;
    try {
      agent = this.buildTemporaryAgent(proxyUrl, input);
      const { response, latencyMs } = await this.sendTestRequest(agent, targetUrl);
      return this.interpretResponse(response, latencyMs);
    } catch (err: unknown) {
      return this.mapErrorToResult(err as Error);
    } finally {
      agent?.close();
    }
  }

  private async resolveTestProxyUrl(input: ProxyTestInput): Promise<string | null> {
    if (input.mode === "manual") {
      if (!input.host) { return null; }
      return `http://${input.host}:${input.port}`;
    }
    // mode === "system" — resolve per-URL through VS Code's proxy resolution
    const targetUrl = input.testUrl || TEST_URL;
    const resolved = await this.resolver.resolveByUrl(targetUrl);
    return resolved.url ?? null;
  }

  private buildTemporaryAgent(
    proxyUrl: string,
    input: ProxyTestInput
  ): ProxyAgent {
    const creds: ProxyCredentials | undefined =
      input.username && input.password
        ? { username: input.username, password: input.password }
        : undefined;

    const opts: Record<string, unknown> = { uri: proxyUrl };
    if (creds) {
      const encoded = Buffer.from(
        `${creds.username}:${creds.password}`
      ).toString("base64");
      opts.token = `Basic ${encoded}`;
    }
    return new ProxyAgent(opts as unknown as ConstructorParameters<typeof ProxyAgent>[0]);
  }

  private async sendTestRequest(
    agent: ProxyAgent,
    targetUrl: string
  ): Promise<{ response: Response; latencyMs: number }> {
    const start = Date.now();
    const response = await fetch(targetUrl, {
      dispatcher: agent,
      signal: AbortSignal.timeout(TEST_TIMEOUT_MS),
    } as RequestInit);
    const latencyMs = Date.now() - start;
    return { response, latencyMs };
  }

  private interpretResponse(
    response: Response,
    latencyMs: number
  ): ProxyTestResult {
    if (response.ok) {
      return { success: true, message: "Proxy connection successful", latencyMs };
    }
    if (response.status === 407) {
      return { success: false, message: "Proxy requires authentication — enter credentials" };
    }
    return {
      success: false,
      message: `HTTP ${response.status}: ${response.statusText}`,
      latencyMs,
    };
  }

  private mapErrorToResult(err: Error): ProxyTestResult {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ECONNREFUSED") {
      return { success: false, message: "Connection refused — verify proxy host and port" };
    }
    if (code === "ENOTFOUND") {
      return { success: false, message: "Cannot resolve proxy hostname" };
    }
    if (err.name === "TimeoutError" || code === "UND_ERR_CONNECT_TIMEOUT") {
      return { success: false, message: "Connection timed out — proxy may be unreachable" };
    }
    if (err.message.includes("SSL") || code?.startsWith("ERR_TLS")) {
      return { success: false, message: "SSL error — proxy may require specific certificate configuration" };
    }
    return { success: false, message: `Connection failed: ${err.message}` };
  }

  /**
   * Test connectivity via curl.exe subprocess.
   * Supports NTLM SSO or explicit proxy credentials.
   */
  private async testViaCurl(
    input: ProxyTestInput,
    targetUrl: string
  ): Promise<ProxyTestResult> {
    const isAvailable = await CurlTransport.isAvailable();
    if (!isAvailable) {
      return { success: false, message: "curl.exe not found — install curl or use another proxy mode" };
    }
    const proxyUrl = input.host ? `http://${input.host}:${input.port}` : null;
    const proxyAuth = (input.username && input.password)
      ? `${input.username}:${input.password}`
      : null;
    const transport = new CurlTransport(proxyUrl);
    try {
      const latencyMs = await transport.testConnection(targetUrl, proxyUrl || undefined, proxyAuth);
      return { success: true, message: "Curl proxy connection successful", latencyMs };
    } catch (err: unknown) {
      return { success: false, message: (err as Error).message };
    }
  }
}
