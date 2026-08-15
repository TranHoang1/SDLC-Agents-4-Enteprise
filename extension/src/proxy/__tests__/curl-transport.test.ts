/**
 * Unit tests for CurlTransport — curl.exe subprocess driver, arg building, output parsing.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { CurlTransport } from "../CurlTransport";

vi.mock("child_process", () => {
  const execFile = vi.fn();
  (execFile as unknown as Record<symbol, unknown>)[Symbol.for("nodejs.util.promisify.custom")] = (
    file: string,
    args?: string[],
    opts?: { maxBuffer?: number; timeout?: number }
  ) =>
    new Promise((resolve, reject) => {
      execFile(file, args, opts, (err: unknown, stdout?: string, stderr?: string) => {
        if (err) { reject(err); }
        else { resolve({ stdout, stderr }); }
      });
    });
  return { execFile };
});

import { execFile } from "child_process";

const execFileMock = vi.mocked(execFile);

function runWithStdout(stdout: string): void {
  execFileMock.mockImplementation((_cmd, _args, _opts, cb: unknown) => {
    (cb as (err: Error | null, stdout: string, stderr: string) => void)(null, stdout, "");
    return {} as never;
  });
}

function runWithError(error: Error): void {
  execFileMock.mockImplementation((_cmd, _args, _opts, cb: unknown) => {
    (cb as (err: Error | null) => void)(error);
    return {} as never;
  });
}

describe("CurlTransport", () => {
  let transport: CurlTransport;

  beforeEach(() => {
    execFileMock.mockReset();
    transport = new CurlTransport("http://proxy.local:8080", 15000, false);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("parses a successful response with headers and body", async () => {
    runWithStdout(
      "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nX-Trace: t1\r\n\r\n{\"ok\":true}"
    );
    const response = await transport.request("https://api.test.com/");
    expect(response.status).toBe(200);
    expect(response.statusText).toBe("OK");
    expect(response.ok).toBe(true);
    expect(response.headers["content-type"]).toBe("application/json");
    expect(response.headers["x-trace"]).toBe("t1");
    expect(response.body).toBe('{"ok":true}');
  });

  it("skips NTLM 407 and CONNECT 200 intermediate blocks", async () => {
    runWithStdout(
      "HTTP/1.1 407 Proxy Authentication Required\r\nProxy-Authenticate: NTLM\r\n\r\n" +
        "HTTP/1.1 200 Connection Established\r\n\r\n" +
        "HTTP/1.1 200 OK\r\nX-Proxied: true\r\n\r\nhello body"
    );
    const response = await transport.request("https://api.test.com/");
    expect(response.status).toBe(200);
    expect(response.ok).toBe(true);
    expect(response.headers["x-proxied"]).toBe("true");
    expect(response.body).toBe("hello body");
  });

  it("uses NTLM SSO args by default (no explicit auth)", async () => {
    runWithStdout("HTTP/1.1 200 OK\r\n\r\n");
    await transport.request("https://api.test.com/", {});
    const args = execFileMock.mock.calls[0]![1] as string[];
    expect(args).toContain("--proxy-ntlm");
    expect(args).toContain("-U");
    expect(args).toContain(":");
    expect(args).toContain("-x");
    expect(args).toContain("http://proxy.local:8080");
  });

  it("uses explicit credentials with basic auth style args", async () => {
    runWithStdout("HTTP/1.1 200 OK\r\n\r\n");
    await transport.request("https://api.test.com/", { proxyAuth: "user:pass" });
    const args = execFileMock.mock.calls[0]![1] as string[];
    const idxX = args.indexOf("-x");
    const idxU = args.indexOf("-U");
    expect(idxX).toBeGreaterThanOrEqual(0);
    expect(args[idxU + 1]).toBe("user:pass");
  });

  it("builds POST body args with -X method and --data-raw", async () => {
    runWithStdout("HTTP/1.1 200 OK\r\n\r\n");
    await transport.request("https://api.test.com/", {
      method: "POST",
      body: "{\"a\":1}",
      headers: { Authorization: "Bearer x" },
    });
    const args = execFileMock.mock.calls[0]![1] as string[];
    expect(args).toContain("-i");
    expect(args).toContain("-X");
    expect(args).toContain("POST");
    expect(args).toContain("--data-raw");
    expect(args).toContain("{\"a\":1}");
    expect(args).toContain("-H");
    expect(args).toContain("Authorization: Bearer x");
  });

  it("issues -I for HEAD and never -X HEAD", async () => {
    runWithStdout("HTTP/1.1 200 OK\r\n\r\n");
    await transport.request("https://api.test.com/", { method: "HEAD" });
    const args = execFileMock.mock.calls[0]![1] as string[];
    expect(args).toContain("-I");
    expect(args).not.toContain("-X");
  });

  it("adds -k for insecure and -L for redirects", async () => {
    runWithStdout("HTTP/1.1 200 OK\r\n\r\n");
    await transport.request("https://api.test.com/", { followRedirects: true, insecure: true });
    const args = execFileMock.mock.calls[0]![1] as string[];
    expect(args).toContain("-k");
    expect(args).toContain("-L");
  });

  it("throws CurlTransportError with friendly message for timeouts (28)", async () => {
    runWithError(Object.assign(new Error("curl: (28) Operation timed out after 10001 milliseconds"), { code: "28" }));
    await expect(transport.request("https://api.test.com/")).rejects.toThrow(
      "Connection timed out — proxy may be unreachable"
    );
  });

  it("throws CurlTransportError for connection refused (7)", async () => {
    runWithError(Object.assign(new Error("curl: (7) Failed to connect to proxy"), { code: "7" }));
    await expect(transport.request("https://api.test.com/")).rejects.toThrow(
      "Connection refused — verify proxy host and port"
    );
  });

  it("throws CurlTransportError carrying the process error code", async () => {
    runWithError(Object.assign(new Error("curl: (56) Recv failure"), { code: "56" }));
    await expect(transport.request("https://api.test.com/")).rejects.toMatchObject({
      name: "CurlTransportError",
      code: "56",
    });
  });

  it("testConnection returns latency for OK responses", async () => {
    runWithStdout("HTTP/1.1 200 OK\r\n\r\n");
    const latency = await transport.testConnection("https://api.test.com/");
    expect(latency).toBeGreaterThanOrEqual(0);
  });

  it("testConnection accepts 301/302 redirects", async () => {
    runWithStdout("HTTP/1.1 302 Found\r\nLocation: /new\r\n\r\n");
    await expect(transport.testConnection("https://api.test.com/")).resolves.toBeGreaterThanOrEqual(0);
  });

  it("testConnection throws when a non-2xx non-redirect status is returned", async () => {
    runWithStdout("HTTP/1.1 500 Internal Server Error\r\n\r\n");
    await expect(transport.testConnection("https://api.test.com/")).rejects.toThrow(
      "HTTP 500: Internal Server Error"
    );
  });

  it("isAvailable returns true when curl resolves", async () => {
    execFileMock.mockImplementation((_cmd, _args, _opts, cb: unknown) => {
      (cb as (err: Error | null, stdout: string) => void)(null, "curl 8.0.0", "");
      return {} as never;
    });
    await expect(CurlTransport.isAvailable()).resolves.toBe(true);
  });

  it("isAvailable returns false when curl is missing", async () => {
    runWithError(new Error("spawn curl.exe ENOENT"));
    await expect(CurlTransport.isAvailable()).resolves.toBe(false);
  });

  it("buildArgs sets --max-time from timeout in seconds", async () => {
    const raw = transport as unknown as {
      buildArgs: (url: string, method: string, timeout: number, proxy: string | null, options: unknown) => string[];
    };
    const args = raw.buildArgs("https://api.test.com/", "GET", 10000, null, {});
    expect(args).toContain("--max-time");
    expect(args).toContain("10");
  });
});