/**
 * global-fetch-patch.ts — Patches globalThis.fetch to route through proxy.
 *
 * Called ONCE at extension activation (after ProxyAgentFactory.initialize()).
 * All subsequent fetch() calls anywhere in the extension process will
 * automatically use the configured proxy transport.
 *
 * Routing strategy (same as HttpClient three-tier):
 * 1. curl mode → CurlHttpAdapter subprocess (NTLM SSO)
 * 2. powershell mode → PowerShellHttpAdapter subprocess
 * 3. system/manual mode → undici ProxyAgent dispatcher
 * 4. none mode → direct connection (no proxy)
 *
 * Rules:
 * - Bypass list is respected for ALL modes
 * - If fetch already has a dispatcher option, it's NOT overridden (modes 3/4 only)
 */

import type { Dispatcher } from "undici";
import { ProxyAgentFactory } from "./ProxyAgentFactory";
import { CurlHttpAdapter } from "./CurlHttpAdapter";
import { PowerShellHttpAdapter } from "./PowerShellHttpAdapter";

/** Original unpatched fetch — preserved for bypass/fallback */
const originalFetch = globalThis.fetch;

/** Whether the patch has been applied */
let patched = false;

/** Shared adapter instances (stateless — safe to reuse) */
const curlAdapter = new CurlHttpAdapter();
const pwshAdapter = new PowerShellHttpAdapter();

/**
 * Apply the global fetch proxy patch.
 * Safe to call multiple times — only patches once.
 */
export function applyGlobalFetchPatch(): void {
  if (patched) { return; }
  patched = true;

  globalThis.fetch = async function patchedFetch(
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> {
    // Resolve target URL from input
    const targetUrl = resolveUrl(input);
    if (!targetUrl) {
      return originalFetch(input, init);
    }

    // Check bypass list — bypassed URLs always go direct
    if (shouldBypass(targetUrl)) {
      return originalFetch(input, init);
    }

    // Curl mode: route through curl.exe subprocess (handles NTLM SSO)
    if (curlAdapter.isCurlMode()) {
      return executeCurl(targetUrl, init);
    }

    // PowerShell mode: route through Invoke-WebRequest subprocess
    if (pwshAdapter.isPowerShellMode()) {
      return executePwsh(targetUrl, init);
    }

    // Defensive fallback: if adapter mode checks failed (e.g. factory threw during
    // isCurlMode/isPowerShellMode), re-check config directly to prevent request leak.
    // Without this, curl/powershell mode requests silently bypass the proxy.
    const activeMode = getActiveProxyMode();
    if (activeMode === "curl") {
      return executeCurl(targetUrl, init);
    }
    if (activeMode === "powershell") {
      return executePwsh(targetUrl, init);
    }

    // System/manual mode: inject undici ProxyAgent dispatcher
    if (init && (init as any).dispatcher) {
      // Caller already specified a dispatcher — respect it
      return originalFetch(input, init);
    }

    const dispatcher = await getProxyDispatcher(targetUrl);
    if (!dispatcher) {
      return originalFetch(input, init);
    }

    const patchedInit = { ...(init || {}), dispatcher } as RequestInit;
    return originalFetch(input, patchedInit);
  };
}

/**
 * Remove the global fetch patch (for testing/deactivation).
 */
export function removeGlobalFetchPatch(): void {
  if (!patched) { return; }
  globalThis.fetch = originalFetch;
  patched = false;
}

/** Extract URL string from fetch input */
function resolveUrl(input: RequestInfo | URL): string | null {
  if (typeof input === "string") { return input; }
  if (input instanceof URL) { return input.href; }
  if (input instanceof Request) { return input.url; }
  return null;
}

/** Check bypass list across all modes */
function shouldBypass(targetUrl: string): boolean {
  try {
    const factory = ProxyAgentFactory.getInstance();
    const config = factory.getConfig();
    if (config.mode === "none") { return true; }
    return factory.shouldBypass(targetUrl, config.bypass);
  } catch {
    return false;
  }
}

/**
 * Read proxy mode directly from ProxyAgentFactory config.
 * Separate path from adapter checks — adapters wrap this in try-catch that may swallow errors.
 * Returns null if factory is not initialized (extension still starting up).
 */
function getActiveProxyMode(): string | null {
  try {
    const factory = ProxyAgentFactory.getInstance();
    return factory.getConfig().mode;
  } catch {
    return null;
  }
}

/** Execute request via curl.exe subprocess, return standard Response */
async function executeCurl(url: string, init?: RequestInit): Promise<Response> {
  const method = init?.method || "GET";
  const headers = extractHeaders(init);
  const body = typeof init?.body === "string" ? init.body : undefined;
  const res = await curlAdapter.request(url, method, headers, body, 30000);
  return new Response(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers: buildResponseHeaders(res.body),
  });
}

/** Execute request via PowerShell subprocess, return standard Response */
async function executePwsh(url: string, init?: RequestInit): Promise<Response> {
  const method = init?.method || "GET";
  const headers = extractHeaders(init);
  const body = typeof init?.body === "string" ? init.body : undefined;
  const res = await pwshAdapter.request(url, method, headers, body, 30000);
  return new Response(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers: buildResponseHeaders(res.body),
  });
}

/** Extract headers Record from RequestInit */
function extractHeaders(init?: RequestInit): Record<string, string> {
  if (!init?.headers) { return {}; }
  if (init.headers instanceof Headers) {
    const result: Record<string, string> = {};
    init.headers.forEach((value, key) => { result[key] = value; });
    return result;
  }
  if (Array.isArray(init.headers)) {
    const result: Record<string, string> = {};
    for (const [key, value] of init.headers) { result[key] = value; }
    return result;
  }
  return init.headers as Record<string, string>;
}

/** Build minimal response headers — detect content type from body */
function buildResponseHeaders(body: string): Record<string, string> {
  // Heuristic: if body starts with { or [ it's likely JSON
  const trimmed = body.trimStart();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    return { "content-type": "application/json" };
  }
  return { "content-type": "text/plain" };
}

/** Get undici ProxyAgent dispatcher for system/manual modes */
async function getProxyDispatcher(targetUrl: string): Promise<Dispatcher | undefined> {
  try {
    const factory = ProxyAgentFactory.getInstance();
    return await factory.getDispatcher(targetUrl);
  } catch {
    return undefined;
  }
}
