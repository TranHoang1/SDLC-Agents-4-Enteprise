/**
 * Unit tests for global-fetch-patch — verifies fetch proxy injection behavior.
 * Strategy: We test the patching logic by verifying the patchedFetch wrapper
 * calls originalFetch with/without dispatcher based on ProxyAgentFactory state.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// The module captures `originalFetch = globalThis.fetch` at module-load time.
// To test properly, we must stub globalThis.fetch BEFORE importing the module.
// Use vi.hoisted to ensure fetch stub is in place before module executes.
const fetchSpy = vi.hoisted(() => vi.fn().mockResolvedValue(new Response("ok", { status: 200 })));

vi.hoisted(() => {
  globalThis.fetch = fetchSpy;
});

// Mock ProxyAgentFactory
const mockDispatcher = { type: "mock-proxy-dispatcher" };
const mockFactory = {
  getConfig: vi.fn(() => ({ mode: "manual", host: "proxy.corp", port: 8080, bypass: "localhost,127.0.0.1" })),
  shouldBypass: vi.fn((url: string, bypass: string) => {
    const hostname = new URL(url).hostname.toLowerCase();
    return bypass.split(",").map(e => e.trim()).includes(hostname);
  }),
  getDispatcher: vi.fn(() => Promise.resolve(mockDispatcher)),
};

vi.mock("../ProxyAgentFactory", () => ({
  ProxyAgentFactory: {
    getInstance: () => mockFactory,
  },
}));

import { applyGlobalFetchPatch, removeGlobalFetchPatch } from "../global-fetch-patch";

describe("global-fetch-patch", () => {
  beforeEach(() => {
    removeGlobalFetchPatch();
    fetchSpy.mockClear();
    mockFactory.getConfig.mockReturnValue({ mode: "manual", host: "proxy.corp", port: 8080, bypass: "localhost,127.0.0.1" });
    mockFactory.shouldBypass.mockImplementation((url: string, bypass: string) => {
      const hostname = new URL(url).hostname.toLowerCase();
      return bypass.split(",").map(e => e.trim()).includes(hostname);
    });
    mockFactory.getDispatcher.mockResolvedValue(mockDispatcher);
  });

  afterEach(() => {
    removeGlobalFetchPatch();
  });

  it("injects proxy dispatcher for external URLs", async () => {
    applyGlobalFetchPatch();

    await globalThis.fetch("https://api.example.com/data");

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe("https://api.example.com/data");
    expect((init as any).dispatcher).toBe(mockDispatcher);
  });

  it("does NOT inject dispatcher for bypassed URLs (localhost)", async () => {
    applyGlobalFetchPatch();

    await globalThis.fetch("http://localhost:48721/health");

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe("http://localhost:48721/health");
    // originalFetch called with original args — no dispatcher
    expect(init).toBeUndefined();
  });

  it("does NOT inject dispatcher for bypassed URLs (127.0.0.1)", async () => {
    applyGlobalFetchPatch();

    await globalThis.fetch("http://127.0.0.1:9181/mcp");

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [, init] = fetchSpy.mock.calls[0];
    expect(init).toBeUndefined();
  });

  it("does NOT override existing dispatcher in init options", async () => {
    applyGlobalFetchPatch();
    const customDispatcher = { type: "custom-dispatcher" };

    await globalThis.fetch("https://api.example.com/data", { dispatcher: customDispatcher } as any);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [, init] = fetchSpy.mock.calls[0];
    // Caller's dispatcher preserved — passed through to originalFetch
    expect((init as any).dispatcher).toBe(customDispatcher);
  });

  it("does NOT inject dispatcher when mode is 'none'", async () => {
    mockFactory.getConfig.mockReturnValue({ mode: "none", bypass: "" });
    applyGlobalFetchPatch();

    await globalThis.fetch("https://api.example.com/data");

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [, init] = fetchSpy.mock.calls[0];
    expect(init).toBeUndefined();
  });

  it("does NOT inject dispatcher when mode is 'curl'", async () => {
    mockFactory.getConfig.mockReturnValue({ mode: "curl", bypass: "" });
    applyGlobalFetchPatch();

    await globalThis.fetch("https://api.example.com/data");

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [, init] = fetchSpy.mock.calls[0];
    expect(init).toBeUndefined();
  });

  it("only patches once even if called multiple times", () => {
    applyGlobalFetchPatch();
    const patchedRef = globalThis.fetch;
    applyGlobalFetchPatch(); // second call — no-op

    expect(globalThis.fetch).toBe(patchedRef);
  });

  it("removeGlobalFetchPatch restores original fetch", () => {
    applyGlobalFetchPatch();
    expect(globalThis.fetch).not.toBe(fetchSpy);

    removeGlobalFetchPatch();
    // After removing patch, globalThis.fetch should be the original (our fetchSpy)
    expect(globalThis.fetch).toBe(fetchSpy);
  });

  it("handles URL object input correctly", async () => {
    applyGlobalFetchPatch();

    await globalThis.fetch(new URL("https://external.api.com/resource"));

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [, init] = fetchSpy.mock.calls[0];
    expect((init as any).dispatcher).toBe(mockDispatcher);
  });

  it("falls through gracefully when ProxyAgentFactory throws", async () => {
    mockFactory.getConfig.mockImplementation(() => { throw new Error("Not initialized"); });
    applyGlobalFetchPatch();

    await globalThis.fetch("https://api.example.com/data");

    // Should still call originalFetch without dispatcher (graceful fallback)
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [, init] = fetchSpy.mock.calls[0];
    expect(init).toBeUndefined();
  });
});
