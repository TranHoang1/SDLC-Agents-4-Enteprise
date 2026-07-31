/**
 * ProxyTestService — Proxy connectivity testing.
 * Uses temporary ProxyAgent built from unsaved form values (BR-09).
 * Timeout: 10s. Measures latency.
 */

import { ProxyAgent } from "undici";
import type { ProxyTestInput, ProxyTestResult, ProxyCredentials } from "../models/ProxyModels";
import type { ProxyDetectionService } from "./ProxyDetectionService";

const TEST_URL = "https://httpbin.org/get";
const TEST_TIMEOUT_MS = 10_000;

/**
 * Tests proxy connectivity using unsaved form values.
 * Creates a temporary ProxyAgent, sends GET request, measures latency.
 */
export class ProxyTestService {
  constructor(private readonly detectionService: ProxyDetectionService) {}

  /**
   * Test proxy connectivity using form values.
   * @param input - Unsaved form values for proxy configuration
   * @returns Result with success status, message, and optional latency
   */
  async testConnection(input: ProxyTestInput): Promise<ProxyTestResult> {
    const proxyUrl = this.resolveTestProxyUrl(input);
    if (!proxyUrl) {
      return { success: false, message: "No proxy URL to test" };
    }

    const targetUrl = input.testUrl || TEST_URL;
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

  private resolveTestProxyUrl(input: ProxyTestInput): string | null {
    if (input.mode === "manual") {
      if (!input.host) { return null; }
      return `http://${input.host}:${input.port}`;
    }
    // mode === "system"
    const detected = this.detectionService.detect();
    return detected.url;
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
}
