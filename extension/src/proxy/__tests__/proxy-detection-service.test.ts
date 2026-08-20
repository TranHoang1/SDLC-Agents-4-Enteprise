/**
 * Unit tests for ProxyDetectionService — env/VS Code/OS-native proxy detection.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ProxyDetectionService } from "../ProxyDetectionService";

vi.mock("child_process", () => ({ execSync: vi.fn() }));
vi.mock("vscode", () => ({ workspace: { getConfiguration: vi.fn() } }));

import { execSync } from "child_process";
import * as vscode from "vscode";

const execSyncMock = vi.mocked(execSync);
const savedEnv: Record<string, string | undefined> = {};

function withEnv(vars: Record<string, string | undefined>): void {
  for (const key of Object.keys(vars)) { process.env[key] = vars[key]; }
}

function clearEnv(): void {
  for (const key of ["HTTPS_PROXY", "https_proxy", "HTTP_PROXY", "http_proxy", "NO_PROXY", "no_proxy"]) {
    if (savedEnv[key] === undefined) { delete process.env[key]; }
  }
}

function configHandle(proxyValue: string): { get: ReturnType<typeof vi.fn> } {
  return {
    get: vi.fn((key: string, _default: unknown) => (key === "proxy" ? proxyValue : undefined)),
  };
}

describe("ProxyDetectionService", () => {
  let service: ProxyDetectionService;

  beforeEach(() => {
    for (const key of ["HTTPS_PROXY", "https_proxy", "HTTP_PROXY", "http_proxy", "NO_PROXY", "no_proxy"]) {
      savedEnv[key] = process.env[key];
    }
    clearEnv();
    execSyncMock.mockReset();
    vi.mocked(vscode.workspace.getConfiguration).mockReturnValue(configHandle("") as never);
    service = new ProxyDetectionService();
  });

  afterEach(() => {
    for (const [key, value] of Object.entries(savedEnv)) {
      if (value === undefined) { delete process.env[key]; }
      else { process.env[key] = value; }
    }
    vi.restoreAllMocks();
  });

  it("detect prioritizes HTTPS_PROXY over HTTP_PROXY", () => {
    withEnv({ HTTPS_PROXY: "http://https-proxy:1", HTTP_PROXY: "http://http-proxy:2" });
    expect(service.detect().url).toBe("http://https-proxy:1");
  });

  it("detect falls back to HTML_PROXY when HTTPS env vars are absent", () => {
    withEnv({ HTTP_PROXY: "http://http-proxy:2" });
    expect(service.detect().url).toBe("http://http-proxy:2");
  });

  it("detect reads lowercase env var forms", () => {
    withEnv({ https_proxy: "http://lower-proxy:9" });
    expect(service.detect().url).toBe("http://lower-proxy:9");
  });

  it("detect returns NO_PROXY as bypass list", () => {
    withEnv({ NO_PROXY: "localhost,127.0.0.1" });
    expect(service.detect().bypass).toBe("localhost,127.0.0.1");
  });

  it("detect falls back to VS Code http.proxy setting when no env vars", () => {
    vi.mocked(vscode.workspace.getConfiguration).mockReturnValue({
      get: vi.fn((key: string, _default: unknown) => (key === "proxy" ? "http://vscode-proxy:3" : undefined)),
    } as never);
    expect(service.detect().url).toBe("http://vscode-proxy:3");
  });

  it("detectOsNative returns nulls when OS command fails", () => {
    execSyncMock.mockImplementation(() => { throw new Error("command not found"); });
    expect(service.detectOsNative()).toEqual({ url: null, bypass: null });
  });

  it("isValidProxyUrl accepts http and https", () => {
    expect(service.isValidProxyUrl("http://host:8080")).toBe(true);
    expect(service.isValidProxyUrl("https://host")).toBe(true);
    expect(service.isValidProxyUrl("ftp://host")).toBe(false);
    expect(service.isValidProxyUrl("not a url")).toBe(false);
    expect(service.isValidProxyUrl("")).toBe(false);
  });

  it("detectWindowsProxy parses a single proxy server", () => {
    execSyncMock.mockImplementation((cmd: unknown) => {
      if (String(cmd).includes("powershell")) { throw new Error("mock: no PowerShell"); }
      return "Proxy Server(s) :  192.168.1.1:8080\r\n";
    });
    const raw = service as unknown as { detectWindowsProxy: () => string | null };
    expect(raw.detectWindowsProxy()).toBe("http://192.168.1.1:8080");
  });

  it("detectWindowsProxy returns null for direct access", () => {
    execSyncMock.mockImplementation((cmd: unknown) => {
      if (String(cmd).includes("powershell")) { throw new Error("mock: no PowerShell"); }
      return "Proxy Server(s) :  (Direct access)\r\n";
    });
    const raw = service as unknown as { detectWindowsProxy: () => string | null };
    expect(raw.detectWindowsProxy()).toBeNull();
  });

  it("detectWindowsProxy prefers https in per-protocol config", () => {
    execSyncMock.mockImplementation((cmd: unknown) => {
      if (String(cmd).includes("powershell")) { throw new Error("mock: no PowerShell"); }
      return "Proxy Server(s) :  http=hp:80;https=sp:443\r\n";
    });
    const raw = service as unknown as { detectWindowsProxy: () => string | null };
    expect(raw.detectWindowsProxy()).toBe("http://sp:443");
  });

  it("detectWindowsProxy falls back to http in per-protocol config", () => {
    execSyncMock.mockImplementation((cmd: unknown) => {
      if (String(cmd).includes("powershell")) { throw new Error("mock: no PowerShell"); }
      return "Proxy Server(s) :  http=hp:80\r\n";
    });
    const raw = service as unknown as { detectWindowsProxy: () => string | null };
    expect(raw.detectWindowsProxy()).toBe("http://hp:80");
  });

  it("detectWindowsBypass joins semicolon-separated entries with commas", () => {
    execSyncMock.mockReturnValue("Bypass List     :  *.local;<local>\r\n");
    const raw = service as unknown as { detectWindowsBypass: () => string | null };
    expect(raw.detectWindowsBypass()).toBe("*.local,<local>");
  });

  it("detectWindowsBypass returns null for (none)", () => {
    execSyncMock.mockReturnValue("Bypass List     :  (none)\r\n");
    const raw = service as unknown as { detectWindowsBypass: () => string | null };
    expect(raw.detectWindowsBypass()).toBeNull();
  });

  it("detectMacOsProxy builds URL from HTTPS settings first", () => {
    execSyncMock.mockReturnValue(
      "HTTPSEnable : 1\nHTTPSProxy : proxy.corp\nHTTPSPort : 443\nHTTPEnable : 1\nHTTPProxy : http.corp\nHTTPPort : 80\n"
    );
    const raw = service as unknown as { detectMacOsProxy: () => string | null };
    expect(raw.detectMacOsProxy()).toBe("http://proxy.corp:443");
  });

  it("detectMacOsProxy falls back to HTTP when HTTPS disabled", () => {
    execSyncMock.mockReturnValue("HTTPSEnable : 0\nHTTPEnable : 1\nHTTPProxy : http.corp\nHTTPPort : 80\n");
    const raw = service as unknown as { detectMacOsProxy: () => string | null };
    expect(raw.detectMacOsProxy()).toBe("http://http.corp:80");
  });

  it("detectMacOsBypass parses the exceptions array", () => {
    execSyncMock.mockReturnValue("ExceptionsList : <array> { 0 : *.local  1 : 169.254/16 }\n");
    const raw = service as unknown as { detectMacOsBypass: () => string | null };
    expect(raw.detectMacOsBypass()).toBe("*.local,169.254/16");
  });

  it("detectLinuxProxy builds URL only when mode is manual", () => {
    execSyncMock.mockImplementation((cmd: string) => {
      if (cmd.includes("mode")) { return "'manual'"; }
      if (cmd.includes("proxy.https host")) { return "'gproxy.corp'"; }
      if (cmd.includes("proxy.https port")) { return "'8080'"; }
      return "";
    });
    const raw = service as unknown as { detectLinuxProxy: () => string | null };
    expect(raw.detectLinuxProxy()).toBe("http://gproxy.corp:8080");
  });

  it("detectLinuxProxy returns null when mode is not manual", () => {
    execSyncMock.mockReturnValue("'none'");
    const raw = service as unknown as { detectLinuxProxy: () => string | null };
    expect(raw.detectLinuxProxy()).toBeNull();
  });

  it("detectLinuxBypass joins quotes list with commas", () => {
    execSyncMock.mockReturnValue("['localhost', '127.0.0.0/8', '::1']");
    const raw = service as unknown as { detectLinuxBypass: () => string | null };
    expect(raw.detectLinuxBypass()).toBe("localhost,127.0.0.0/8,::1");
  });

  it("detectWindowsProxy catches execSync errors silently", () => {
    execSyncMock.mockImplementation(() => { throw new Error("netsh unavailable"); });
    const raw = service as unknown as { detectWindowsProxy: () => string | null };
    expect(raw.detectWindowsProxy()).toBeNull();
  });
});