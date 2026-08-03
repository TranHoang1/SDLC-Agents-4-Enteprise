/**
 * Unit tests for proxy resolution — VscodeProxyResolverService + ProxyAgentFactory.
 * Covers: system mode uses per-URL resolution, manual/none modes, bypass.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { ProxyAgentFactory } from "../proxy/ProxyAgentFactory";
import { ProxyDetectionService } from "../proxy/ProxyDetectionService";
import { VscodeProxyResolverService } from "../proxy/VscodeProxyResolverService";
import type { ProxyConfig } from "../models/ProxyModels";

vi.mock("vscode", () => ({
  workspace: {
    getConfiguration: vi.fn(() => ({
      get: vi.fn((_key: string, defaultValue: unknown) => defaultValue),
      update: vi.fn(),
    })),
  },
  ConfigurationTarget: { Global: 1 },
}));

class StubConfigService {
  private config: ProxyConfig;

  constructor(config: Partial<ProxyConfig>) {
    this.config = {
      mode: "system",
      host: "",
      port: 8080,
      bypass: "localhost,127.0.0.1,::1",
      ...config,
    };
  }

  getConfig(): ProxyConfig {
    return this.config;
  }

  async getCredentials(): Promise<null> {
    return null;
  }
}

class StubDetectionService {
  private osNativeUrl: string | null;

  constructor(osNativeUrl: string | null) {
    this.osNativeUrl = osNativeUrl;
  }

  detect() {
    return { url: this.osNativeUrl, bypass: null };
  }

  detectOsNative() {
    return { url: this.osNativeUrl, bypass: null };
  }
}

describe("VscodeProxyResolverService", () => {
  it("returns direct (undefined) when no proxy is configured", async () => {
    const detection = new StubDetectionService(null);
    const resolver = new VscodeProxyResolverService(detection as unknown as ProxyDetectionService);
    const result = await resolver.resolveByUrl("https://api.example.com/v1");
    expect(result.url).toBeUndefined();
    expect(result.source).toBeDefined();
  });

  it("falls back to OS-native detection for system resolution", async () => {
    const detection = new StubDetectionService("http://corp-proxy:8080");
    const resolver = new VscodeProxyResolverService(detection as unknown as ProxyDetectionService);
    const result = await resolver.resolveByUrl("https://api.example.com/v1");
    expect(result.url).toBe("http://corp-proxy:8080");
  });
});

describe("ProxyAgentFactory per-URL routing", () => {
  let factory: ProxyAgentFactory;

  beforeEach(() => {
    ProxyAgentFactory.reset();
  });

  afterEach(() => {
    ProxyAgentFactory.reset();
  });

  function init(
    config: Partial<ProxyConfig>,
    osNativeUrl: string | null
  ): ProxyAgentFactory {
    ProxyAgentFactory.initialize(
      new StubConfigService(config) as never,
      new StubDetectionService(osNativeUrl) as unknown as ProxyDetectionService
    );
    return ProxyAgentFactory.getInstance();
  }

  it("returns undefined (direct) for mode=none", async () => {
    factory = init({ mode: "none" }, "http://corp-proxy:8080");
    const dispatcher = await factory.getDispatcher("https://api.example.com/v1");
    expect(dispatcher).toBeUndefined();
  });

  it("uses manual host:port for mode=manual", async () => {
    factory = init({ mode: "manual", host: "proxy.local", port: 3128 }, null);
    const dispatcher = await factory.getDispatcher("https://api.example.com/v1");
    expect(dispatcher).toBeDefined();
    // Dispatcher should be an undici ProxyAgent
    expect(dispatcher?.constructor.name).toBe("ProxyAgent");
  });

  it("returns direct when system resolution yields no proxy", async () => {
    factory = init({ mode: "system" }, null);
    const dispatcher = await factory.getDispatcher("https://api.example.com/v1");
    expect(dispatcher).toBeUndefined();
  });

  it("creates a ProxyAgent when system resolution finds a proxy", async () => {
    factory = init({ mode: "system" }, "http://corp-proxy:8080");
    const dispatcher = await factory.getDispatcher("https://api.example.com/v1");
    expect(dispatcher).toBeDefined();
    expect(dispatcher?.constructor.name).toBe("ProxyAgent");
  });

  it("caches agent per resolved proxy URL", async () => {
    factory = init({ mode: "system" }, "http://corp-proxy:8080");
    const a = await factory.getDispatcher("https://api.example.com/v1");
    const b = await factory.getDispatcher("https://api.example.com/v2");
    expect(a).toBe(b);
  });

  it("bypass check respects wildcard entries", () => {
    factory = init({ mode: "system" }, null);
    const bypass = "*.internal.com,10.0.0.0/8,localhost";
    expect(factory.shouldBypass("https://api.internal.com/v1", bypass)).toBe(true);
    expect(factory.shouldBypass("https://api.public.com/v1", bypass)).toBe(false);
  });
});
