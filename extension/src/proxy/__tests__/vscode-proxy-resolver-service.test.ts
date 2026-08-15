/**
 * Unit tests for VscodeProxyResolverService — per-URL proxy resolution wrapper.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { VscodeProxyResolverService } from "../VscodeProxyResolverService";
import type { ProxyDetectionService } from "../ProxyDetectionService";

vi.mock("@vscode/proxy-agent", () => ({
  createProxyResolver: vi.fn(() => ({
    resolveProxyByURL: vi.fn(async () => ({ url: "http://resolved-proxy:8080", source: "env" })),
  })),
  LogLevel: { Info: "info" },
}));

vi.mock("vscode", () => ({
  workspace: { getConfiguration: vi.fn() },
}));

import * as vscode from "vscode";
import { createProxyResolver } from "@vscode/proxy-agent";

type ResolverOptions = Record<string, unknown>;

class StubDetectionService {
  constructor(private readonly osNativeUrl: string | null) {}
  detect() { return { url: this.osNativeUrl, bypass: null }; }
  detectOsNative() { return { url: this.osNativeUrl, bypass: null }; }
}

function makeConfig(): { get: ReturnType<typeof vi.fn> } {
  return {
    get: vi.fn((key: string, defaultValue?: unknown) => {
      const values: Record<string, unknown> = {
        proxy: "http://cfg-proxy:1111",
        proxySupport: "on",
        noProxy: [],
      };
      return values[key] ?? defaultValue;
    }),
  };
}

function makeService(url: string | null): VscodeProxyResolverService {
  return new VscodeProxyResolverService(
    new StubDetectionService(url) as unknown as ProxyDetectionService
  );
}

describe("VscodeProxyResolverService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(vscode.workspace.getConfiguration).mockReturnValue(makeConfig() as never);
    vi.mocked(createProxyResolver).mockImplementation(() => ({
      resolveProxyByURL: vi.fn(async () => ({ url: "http://resolved-proxy:8080", source: "env" })),
    }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("resolveByUrl returns the resolved proxy URL and source", async () => {
    const result = await makeService(null).resolveByUrl("https://api.example.com/v1");
    expect(result).toEqual({ url: "http://resolved-proxy:8080", source: "env" });
  });

  it("resolveByUrl returns direct connection on resolver error", async () => {
    vi.mocked(createProxyResolver).mockImplementation(() => ({
      resolveProxyByURL: vi.fn(async () => { throw new Error("resolution exploded"); }),
    }));
    const result = await makeService(null).resolveByUrl("https://api.example.com/v1");
    expect(result).toEqual({ url: undefined, source: "error" });
  });

  it("wires getProxyURL callback to the http.proxy setting", () => {
    makeService(null);
    const options = vi.mocked(createProxyResolver).mock.calls[0]?.[0] ?? {};
    expect((options.getProxyURL as () => string | undefined)()).toBe("http://cfg-proxy:1111");
  });

  it("wires getProxySupport to the http.proxySupport setting", () => {
    makeService(null);
    const options = vi.mocked(createProxyResolver).mock.calls[0]?.[0] ?? {};
    expect((options.getProxySupport as () => string)()).toBe("on");
  });

  it("resolveProxy returns PROXY PAC format from OS-native detection", async () => {
    const service = makeService("http://os-proxy:9090");
    const resolveProxy = service["resolveSystemProxy"].bind(service) as (url: string) => Promise<string | undefined>;
    await expect(resolveProxy("https://api.example.com/v1")).resolves.toBe("PROXY os-proxy:9090");
  });

  it("resolveProxy resolves undefined when OS-native detection finds nothing", async () => {
    const service = makeService(null);
    const resolveProxy = service["resolveSystemProxy"].bind(service) as (url: string) => Promise<string | undefined>;
    await expect(resolveProxy("https://api.example.com/v1")).resolves.toBeUndefined();
  });

  it("constructs a resolver with env and vscode settings wired up", () => {
    makeService(null);
    const options = vi.mocked(createProxyResolver).mock.calls[0]?.[0] ?? {};
    expect(options.getProxyURL).toBeTypeOf("function");
    expect(options.getNoProxyConfig).toBeTypeOf("function");
    expect(options.env).toBe(process.env);
  });
});