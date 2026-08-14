/**
 * global-fetch-patch.ts — Patches globalThis.fetch to route through proxy.
 *
 * Called ONCE at extension activation (after ProxyAgentFactory.initialize()).
 * All subsequent fetch() calls anywhere in the extension process will
 * automatically use the configured proxy dispatcher.
 *
 * Rules:
 * - Bypass list is respected (localhost, 127.0.0.1, etc.)
 * - If proxy mode is "none" or "curl", no dispatcher is injected
 * - If fetch already has a dispatcher option, it's NOT overridden
 * - Curl mode is NOT patched here (HttpClient handles curl separately)
 */

import type { Dispatcher } from "undici";
import { ProxyAgentFactory } from "./ProxyAgentFactory";

/** Original unpatched fetch — preserved for bypass/fallback */
const originalFetch = globalThis.fetch;

/** Whether the patch has been applied */
let patched = false;

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
    // If caller already specified a dispatcher, respect it (don't override)
    if (init && (init as any).dispatcher) {
      return originalFetch(input, init);
    }

    // Resolve target URL from input
    const targetUrl = resolveUrl(input);
    if (!targetUrl) {
      return originalFetch(input, init);
    }

    // Get proxy dispatcher for this URL
    const dispatcher = await getProxyDispatcher(targetUrl);
    if (!dispatcher) {
      return originalFetch(input, init);
    }

    // Inject dispatcher into request options
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

/** Get dispatcher from ProxyAgentFactory, respecting bypass list */
async function getProxyDispatcher(targetUrl: string): Promise<Dispatcher | undefined> {
  try {
    const factory = ProxyAgentFactory.getInstance();
    const config = factory.getConfig();

    // No proxy modes — skip
    if (config.mode === "none" || config.mode === "curl") {
      return undefined;
    }

    // Check bypass list
    if (factory.shouldBypass(targetUrl, config.bypass)) {
      return undefined;
    }

    return await factory.getDispatcher(targetUrl);
  } catch {
    // ProxyAgentFactory not initialized or error — direct connection
    return undefined;
  }
}
