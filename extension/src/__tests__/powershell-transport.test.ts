/**
 * Unit tests for PowerShellTransport — script building, output parsing,
 * error interpretation, and system proxy detection.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock child_process before importing module
vi.mock("child_process", () => ({
  execFile: vi.fn(),
}));
vi.mock("util", () => ({
  promisify: (fn: unknown) => fn,
}));

import { PowerShellTransport, PowerShellTransportError } from "../proxy/PowerShellTransport";
import { execFile } from "child_process";

const mockExecFile = vi.mocked(execFile);

describe("PowerShellTransport", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("parseOutput", () => {
    it("parses successful response with status, headers, body", async () => {
      const mockOutput = [
        "---PWSH_STATUS---",
        "200",
        "---PWSH_STATUS_TEXT---",
        "OK",
        "---PWSH_HEADERS---",
        "content-type: application/json",
        "x-request-id: abc123",
        "---PWSH_BODY---",
        '{"result":"success"}',
      ].join("\n");

      mockExecFile.mockResolvedValueOnce({ stdout: mockOutput, stderr: "" } as never);

      const transport = new PowerShellTransport(null);
      const response = await transport.request("https://example.com/api");

      expect(response.status).toBe(200);
      expect(response.statusText).toBe("OK");
      expect(response.ok).toBe(true);
      expect(response.headers["content-type"]).toBe("application/json");
      expect(response.headers["x-request-id"]).toBe("abc123");
      expect(response.body).toBe('{"result":"success"}');
    });

    it("parses error response (404)", async () => {
      const mockOutput = [
        "---PWSH_STATUS---",
        "404",
        "---PWSH_STATUS_TEXT---",
        "Not Found",
        "---PWSH_HEADERS---",
        "",
        "---PWSH_BODY---",
        "Resource not found",
      ].join("\n");

      mockExecFile.mockResolvedValueOnce({ stdout: mockOutput, stderr: "" } as never);

      const transport = new PowerShellTransport("http://proxy:8080");
      const response = await transport.request("https://example.com/missing");

      expect(response.status).toBe(404);
      expect(response.ok).toBe(false);
      expect(response.body).toBe("Resource not found");
    });

    it("parses response with empty body", async () => {
      const mockOutput = [
        "---PWSH_STATUS---",
        "204",
        "---PWSH_STATUS_TEXT---",
        "No Content",
        "---PWSH_HEADERS---",
        "",
        "---PWSH_BODY---",
        "",
      ].join("\n");

      mockExecFile.mockResolvedValueOnce({ stdout: mockOutput, stderr: "" } as never);

      const transport = new PowerShellTransport(null);
      const response = await transport.request("https://example.com/delete", { method: "DELETE" });

      expect(response.status).toBe(204);
      expect(response.ok).toBe(true);
      expect(response.body).toBe("");
    });

    it("handles Windows CRLF line endings", async () => {
      const mockOutput =
        "---PWSH_STATUS---\r\n200\r\n---PWSH_STATUS_TEXT---\r\nOK\r\n---PWSH_HEADERS---\r\ncontent-type: text/plain\r\n---PWSH_BODY---\r\nhello world";

      mockExecFile.mockResolvedValueOnce({ stdout: mockOutput, stderr: "" } as never);

      const transport = new PowerShellTransport(null);
      const response = await transport.request("https://example.com");

      expect(response.status).toBe(200);
      expect(response.body).toBe("hello world");
    });
  });

  describe("error handling", () => {
    it("throws PowerShellTransportError on exec failure", async () => {
      const error = new Error("timeout") as Error & { stderr: string };
      error.stderr = "Invoke-WebRequest: Operation timed out";
      mockExecFile.mockRejectedValueOnce(error);

      const transport = new PowerShellTransport("http://proxy:9090");
      await expect(
        transport.request("https://example.com")
      ).rejects.toThrow(PowerShellTransportError);
    });

    it("interprets 407 error correctly", async () => {
      const error = new Error("fail") as Error & { stderr: string };
      error.stderr = "407 Proxy Authentication Required";
      mockExecFile.mockRejectedValueOnce(error);

      const transport = new PowerShellTransport("http://proxy:9090");
      await expect(
        transport.request("https://example.com")
      ).rejects.toThrow(/Proxy authentication failed/);
    });

    it("interprets timeout error correctly", async () => {
      const error = new Error("fail") as Error & { stderr: string };
      error.stderr = "The operation has timed out";
      mockExecFile.mockRejectedValueOnce(error);

      const transport = new PowerShellTransport("http://proxy:9090");
      await expect(
        transport.request("https://example.com")
      ).rejects.toThrow(/timed out/);
    });

    it("interprets 503 error correctly", async () => {
      const error = new Error("fail") as Error & { stderr: string };
      error.stderr = "503 Service Unavailable";
      mockExecFile.mockRejectedValueOnce(error);

      const transport = new PowerShellTransport("http://proxy:9090");
      await expect(
        transport.request("https://example.com")
      ).rejects.toThrow(/503/);
    });
  });

  describe("script building", () => {
    it("includes proxy params when proxyUrl provided", async () => {
      mockExecFile.mockResolvedValueOnce({
        stdout: "---PWSH_STATUS---\n200\n---PWSH_STATUS_TEXT---\nOK\n---PWSH_HEADERS---\n\n---PWSH_BODY---\nok",
        stderr: "",
      } as never);

      const transport = new PowerShellTransport("http://10.30.168.246:9090");
      await transport.request("https://example.com");

      const scriptArg = mockExecFile.mock.calls[0][1]![3] as string;
      expect(scriptArg).toContain("Proxy = 'http://10.30.168.246:9090'");
      expect(scriptArg).toContain("ProxyUseDefaultCredentials = $true");
    });

    it("does NOT include proxy params when proxyUrl is null", async () => {
      mockExecFile.mockResolvedValueOnce({
        stdout: "---PWSH_STATUS---\n200\n---PWSH_STATUS_TEXT---\nOK\n---PWSH_HEADERS---\n\n---PWSH_BODY---\nok",
        stderr: "",
      } as never);

      const transport = new PowerShellTransport(null);
      await transport.request("https://example.com");

      const scriptArg = mockExecFile.mock.calls[0][1]![3] as string;
      expect(scriptArg).not.toContain("Proxy =");
      expect(scriptArg).not.toContain("ProxyUseDefaultCredentials");
    });

    it("uses correct HTTP method", async () => {
      mockExecFile.mockResolvedValueOnce({
        stdout: "---PWSH_STATUS---\n200\n---PWSH_STATUS_TEXT---\nOK\n---PWSH_HEADERS---\n\n---PWSH_BODY---\n{}",
        stderr: "",
      } as never);

      const transport = new PowerShellTransport(null);
      await transport.request("https://example.com", { method: "PUT" });

      const scriptArg = mockExecFile.mock.calls[0][1]![3] as string;
      expect(scriptArg).toContain("Method = 'PUT'");
    });

    it("includes body for POST requests", async () => {
      mockExecFile.mockResolvedValueOnce({
        stdout: "---PWSH_STATUS---\n201\n---PWSH_STATUS_TEXT---\nCreated\n---PWSH_HEADERS---\n\n---PWSH_BODY---\n{}",
        stderr: "",
      } as never);

      const transport = new PowerShellTransport(null);
      await transport.request("https://example.com", {
        method: "POST",
        body: '{"name":"test"}',
        headers: { "Content-Type": "application/json" },
      });

      const scriptArg = mockExecFile.mock.calls[0][1]![3] as string;
      expect(scriptArg).toContain("$params.Body = '{\"name\":\"test\"}'");
      expect(scriptArg).toContain("$params.ContentType = 'application/json'");
    });

    it("escapes single quotes in values", async () => {
      mockExecFile.mockResolvedValueOnce({
        stdout: "---PWSH_STATUS---\n200\n---PWSH_STATUS_TEXT---\nOK\n---PWSH_HEADERS---\n\n---PWSH_BODY---\nok",
        stderr: "",
      } as never);

      const transport = new PowerShellTransport(null);
      await transport.request("https://example.com/path?it's=ok");

      const scriptArg = mockExecFile.mock.calls[0][1]![3] as string;
      expect(scriptArg).toContain("it''s=ok");
    });
  });

  describe("detectSystemProxy", () => {
    it("returns proxy URL when .NET detects proxy", async () => {
      mockExecFile.mockResolvedValueOnce({
        stdout: "http://10.30.168.246:9090/\n",
        stderr: "",
      } as never);

      const result = await PowerShellTransport.detectSystemProxy();
      expect(result).toBe("http://10.30.168.246:9090/");
    });

    it("returns null when DIRECT (no proxy)", async () => {
      mockExecFile.mockResolvedValueOnce({
        stdout: "DIRECT\n",
        stderr: "",
      } as never);

      const result = await PowerShellTransport.detectSystemProxy();
      expect(result).toBeNull();
    });

    it("returns null when PowerShell fails", async () => {
      mockExecFile.mockRejectedValueOnce(new Error("pwsh not found"));

      const result = await PowerShellTransport.detectSystemProxy();
      expect(result).toBeNull();
    });
  });

  describe("isAvailable", () => {
    it("returns true when PowerShell responds", async () => {
      mockExecFile.mockResolvedValueOnce({ stdout: "ok\n", stderr: "" } as never);

      const result = await PowerShellTransport.isAvailable();
      expect(result).toBe(true);
    });

    it("returns false when PowerShell not found", async () => {
      mockExecFile.mockRejectedValueOnce(new Error("ENOENT"));

      const result = await PowerShellTransport.isAvailable();
      expect(result).toBe(false);
    });
  });

  describe("testConnection", () => {
    it("returns latency on success", async () => {
      mockExecFile.mockResolvedValueOnce({
        stdout: "---PWSH_STATUS---\n200\n---PWSH_STATUS_TEXT---\nOK\n---PWSH_HEADERS---\n\n---PWSH_BODY---\nok",
        stderr: "",
      } as never);

      const transport = new PowerShellTransport("http://proxy:8080");
      const latency = await transport.testConnection("https://www.google.com");
      expect(latency).toBeGreaterThanOrEqual(0);
    });

    it("accepts redirect responses (301, 302)", async () => {
      mockExecFile.mockResolvedValueOnce({
        stdout: "---PWSH_STATUS---\n302\n---PWSH_STATUS_TEXT---\nFound\n---PWSH_HEADERS---\nlocation: /new\n---PWSH_BODY---\n",
        stderr: "",
      } as never);

      const transport = new PowerShellTransport("http://proxy:8080");
      const latency = await transport.testConnection("https://example.com/old");
      expect(latency).toBeGreaterThanOrEqual(0);
    });

    it("throws on non-OK non-redirect response", async () => {
      mockExecFile.mockResolvedValueOnce({
        stdout: "---PWSH_STATUS---\n503\n---PWSH_STATUS_TEXT---\nService Unavailable\n---PWSH_HEADERS---\n\n---PWSH_BODY---\nblocked",
        stderr: "",
      } as never);

      const transport = new PowerShellTransport("http://proxy:8080");
      await expect(
        transport.testConnection("https://blocked.site.com")
      ).rejects.toThrow(/503/);
    });

    it("passes proxyUrl param to request when provided", async () => {
      mockExecFile.mockResolvedValueOnce({
        stdout: "---PWSH_STATUS---\n200\n---PWSH_STATUS_TEXT---\nOK\n---PWSH_HEADERS---\n\n---PWSH_BODY---\nok",
        stderr: "",
      } as never);

      const transport = new PowerShellTransport(null);
      const latency = await transport.testConnection("https://example.com", "http://alt-proxy:9999");
      expect(latency).toBeGreaterThanOrEqual(0);
    });
  });
});
