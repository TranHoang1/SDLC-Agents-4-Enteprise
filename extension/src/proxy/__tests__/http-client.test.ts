/**
 * Unit tests for HttpClient — auth header injection, 401 retry, error mapping.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { HttpClient, HttpError } from "../HttpClient";

vi.mock("../../extension", () => ({ getProjectId: vi.fn(() => ""), setProjectId: vi.fn() }));

import { getProjectId } from "../../extension";

class MockAuthManager {
  isAuthenticated = false;
  getAccessToken = vi.fn<() => Promise<string | null>>();
  getTokenSync = vi.fn(() => "");
  refreshToken = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
}

function okResponse(body: unknown, status = 200): Response {
  return {
    status,
    ok: status >= 200 && status < 300,
    text: async () => JSON.stringify(body),
    json: async () => body,
    body: new ReadableStream(),
  } as unknown as Response;
}

describe("HttpClient", () => {
  let client: HttpClient;
  let auth: MockAuthManager;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    auth = new MockAuthManager();
    auth.getAccessToken.mockResolvedValue("tok-123");
    client = new HttpClient("http://backend:48721", auth);
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    vi.mocked(getProjectId).mockReturnValue("");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("exposes baseUrl getter and setter", () => {
    expect(client.baseUrl).toBe("http://backend:48721");
    client.baseUrl = "http://new:1";
    expect(client.baseUrl).toBe("http://new:1");
  });

  it("injects Bearer Authorization header from auth manager", async () => {
    const headers = await client.getAuthHeaders();
    expect(headers["Authorization"]).toBe("Bearer tok-123");
    expect(headers["Content-Type"]).toBe("application/json");
  });

  it("omits Authorization header when no token", async () => {
    auth.getAccessToken.mockResolvedValue(null);
    const headers = await client.getAuthHeaders();
    expect(headers["Authorization"]).toBeUndefined();
  });

  it("adds X-Project-Id when project id is set and not default", async () => {
    vi.mocked(getProjectId).mockReturnValue("project-42");
    const headers = await client.getAuthHeaders();
    expect(headers["X-Project-Id"]).toBe("project-42");
  });

  it("does not add X-Project-Id when projectId is empty", async () => {
    vi.mocked(getProjectId).mockReturnValue("");
    const headers = await client.getAuthHeaders();
    expect(headers["X-Project-Id"]).toBeUndefined();
  });

  it("get returns parsed JSON on success", async () => {
    fetchMock.mockResolvedValue(okResponse({ data: 42 }));
    const result = await client.get<{ data: number }>("/mcp/tools/list");
    expect(result.data).toBe(42);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://backend:48721/mcp/tools/list",
      expect.objectContaining({ method: "GET" })
    );
  });

  it("get throws HttpError 401 when unauthenticated and not a health path", async () => {
    auth.getAccessToken.mockResolvedValue(null);
    await expect(client.get("/api/data")).rejects.toThrow(/Not authenticated/);
    await expect(client.get("/api/data")).rejects.toMatchObject({ statusCode: 401 });
  });

  it("get allows /health without auth header", async () => {
    auth.getAccessToken.mockResolvedValue(null);
    fetchMock.mockResolvedValue(okResponse({ status: "ok" }));
    await expect(client.get("/health", 500)).resolves.toBeDefined();
  });

  it("get retries once on 401 and refreshes token", async () => {
    fetchMock.mockResolvedValueOnce({ status: 401, ok: false } as unknown as Response)
      .mockResolvedValueOnce(okResponse({ refreshed: true }));
    const result = await client.get<{ refreshed: boolean }>("/api/data");
    expect(result.refreshed).toBe(true);
    expect(auth.refreshToken).toHaveBeenCalledTimes(1);
  });

  it("get throws HttpError with body text for non-2xx responses", async () => {
    fetchMock.mockResolvedValue({
      status: 500,
      ok: false,
      text: async () => "server exploded",
    } as unknown as Response);
    const err = await client.get("/api/data").catch((e: unknown) => e as HttpError);
    expect(err).toBeInstanceOf(HttpError);
    expect(err.statusCode).toBe(500);
    expect(err.message).toBe("server exploded");
  });

  it("post sends JSON body and returns parsed result", async () => {
    fetchMock.mockResolvedValue(okResponse({ done: true }));
    const result = await client.post<{ done: boolean }>("/api/run", { step: 1 });
    expect(result.done).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://backend:48721/api/run",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ step: 1 }) })
    );
  });

  it("post throws HttpError 401 when unauthenticated", async () => {
    auth.getAccessToken.mockResolvedValue(null);
    await expect(client.post("/api/run", {})).rejects.toMatchObject({ statusCode: 401 });
  });

  it("post retries once on 401 and refreshes token", async () => {
    fetchMock.mockResolvedValueOnce({ status: 401, ok: false } as unknown as Response)
      .mockResolvedValueOnce(okResponse({ retried: true }));
    const result = await client.post<{ retried: boolean }>("/api/run", {});
    expect(result.retried).toBe(true);
    expect(auth.refreshToken).toHaveBeenCalledTimes(1);
  });

  it("callTool posts to /mcp/tools/call with tool name and args", async () => {
    fetchMock.mockResolvedValue(okResponse({ content: [{ type: "text", text: "ok" }] }));
    await client.callTool("code_intel_upload", { file: "a.ts" });
    const [, options] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(options.body as string)).toEqual({
      tool_name: "code_intel_upload",
      arguments: { file: "a.ts" },
    });
  });

  it("stream returns response body on success", async () => {
    const body = new ReadableStream();
    fetchMock.mockResolvedValue({ status: 200, ok: true, body } as unknown as Response);
    const result = await client.stream("/api/events", {});
    expect(result).toBe(body);
  });

  it("stream throws HttpError on non-ok status", async () => {
    fetchMock.mockResolvedValue({
      status: 400,
      ok: false,
      text: async () => "bad request",
      body: null,
    } as unknown as Response);
    await expect(client.stream("/api/events", {})).rejects.toMatchObject({ statusCode: 400 });
  });

  it("stream throws HttpError(0) when no response body", async () => {
    fetchMock.mockResolvedValue({ status: 200, ok: true, body: null } as unknown as Response);
    await expect(client.stream("/api/events", {})).rejects.toMatchObject({ statusCode: 0 });
  });

  it("healthCheck returns true on 200", async () => {
    fetchMock.mockResolvedValue(okResponse({}, 200));
    await expect(client.healthCheck()).resolves.toBe(true);
  });

  it("healthCheck returns false on non-ok status", async () => {
    fetchMock.mockResolvedValue({ status: 503, ok: false } as unknown as Response);
    await expect(client.healthCheck()).resolves.toBe(false);
  });

  it("healthCheck returns false when fetch rejects", async () => {
    fetchMock.mockRejectedValue(new Error("ECONNREFUSED"));
    await expect(client.healthCheck()).resolves.toBe(false);
  });

  it("works when ProxyAgentFactory is not initialized (direct connection)", async () => {
    fetchMock.mockResolvedValue(okResponse({ data: 1 }));
    await client.get<{ data: number }>("/api/data");
    const [, options] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(options.dispatcher).toBeUndefined();
  });
});