/**
 * Unit tests for addon-download-helpers — verifies downloadFile uses fetch() (proxy-patched).
 * Focus: fetch is called correctly, error handling, cancellation. Stream piping tested via
 * integration with real Node streams.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("vscode", () => ({
  workspace: {
    getConfiguration: () => ({ get: (_k: string, def?: unknown) => def }),
  },
}));

// Mock fs — createWriteStream returns a Writable with .close() (like real fs.WriteStream)
vi.mock("fs", () => {
  const { Writable } = require("stream");
  return {
    createWriteStream: vi.fn(() => {
      const w = new Writable({ write(_chunk: any, _enc: any, cb: any) { cb(); } });
      // fs.WriteStream has .close() which emits 'finish' then 'close'
      (w as any).close = function () { this.end(); };
      return w;
    }),
    existsSync: vi.fn(() => false),
    unlinkSync: vi.fn(),
  };
});

import * as fs from "fs";
import { downloadFile } from "../addon-download-helpers";

/** Helper: create a web ReadableStream from chunks */
function createWebStream(chunks: Buffer[]): ReadableStream<Uint8Array> {
  let index = 0;
  return new ReadableStream({
    pull(controller) {
      if (index < chunks.length) {
        controller.enqueue(new Uint8Array(chunks[index]));
        index++;
      } else {
        controller.close();
      }
    },
  });
}

describe("addon-download-helpers — downloadFile proxy-compliant fetch", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let progress: { report: ReturnType<typeof vi.fn> };
  let token: { isCancellationRequested: boolean; onCancellationRequested: ReturnType<typeof vi.fn> };
  let outputChannel: { appendLine: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    progress = { report: vi.fn() };
    token = { isCancellationRequested: false, onCancellationRequested: vi.fn(() => ({ dispose: vi.fn() })) };
    outputChannel = { appendLine: vi.fn() };
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("calls fetch with the download URL, User-Agent, and redirect:follow", async () => {
    const data = Buffer.alloc(512, "x");
    const body = createWebStream([data]);
    fetchMock.mockResolvedValue({
      ok: true,
      body,
      headers: new Headers({ "content-length": "512" }),
    });

    await downloadFile(
      "https://github.com/releases/addon-v1.0.tar.gz",
      "/tmp/addon.tar.gz",
      512,
      progress as any,
      token as any,
      undefined,
      outputChannel as any,
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://github.com/releases/addon-v1.0.tar.gz");
    expect(init.headers["User-Agent"]).toBe("kiro-sdlc-agents/1.0");
    expect(init.redirect).toBe("follow");
    expect(init.signal).toBeDefined();
  });

  it("reports progress during download", async () => {
    // Two chunks: 500 + 500 = 1000 bytes total
    const body = createWebStream([Buffer.alloc(500), Buffer.alloc(500)]);
    fetchMock.mockResolvedValue({
      ok: true,
      body,
      headers: new Headers({ "content-length": "1000" }),
    });

    await downloadFile(
      "https://example.com/file.bin",
      "/tmp/file.bin",
      1000,
      progress as any,
      token as any,
      undefined,
      outputChannel as any,
    );

    // Progress should have been reported at least once
    expect(progress.report).toHaveBeenCalled();
  });

  it("throws on non-ok HTTP response", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 404,
      body: null,
      headers: new Headers(),
    });

    await expect(
      downloadFile(
        "https://example.com/missing.tar.gz",
        "/tmp/addon.tar.gz",
        1024,
        progress as any,
        token as any,
        undefined,
        outputChannel as any,
      ),
    ).rejects.toThrow("HTTP 404");
  });

  it("throws immediately if cancellation already requested", async () => {
    token.isCancellationRequested = true;

    await expect(
      downloadFile(
        "https://example.com/file.tar.gz",
        "/tmp/addon.tar.gz",
        1024,
        progress as any,
        token as any,
        undefined,
        outputChannel as any,
      ),
    ).rejects.toThrow("Cancelled");

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("throws when response has no body", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      body: null,
      headers: new Headers({ "content-length": "1024" }),
    });

    await expect(
      downloadFile(
        "https://example.com/file.tar.gz",
        "/tmp/addon.tar.gz",
        1024,
        progress as any,
        token as any,
        undefined,
        outputChannel as any,
      ),
    ).rejects.toThrow("No response body");
  });

  it("throws on network error and cleans up partial file", async () => {
    fetchMock.mockRejectedValue(new Error("ECONNRESET"));
    (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true);

    await expect(
      downloadFile(
        "https://example.com/file.tar.gz",
        "/tmp/addon.tar.gz",
        1024,
        progress as any,
        token as any,
        undefined,
        outputChannel as any,
      ),
    ).rejects.toThrow("ECONNRESET");

    expect(fs.unlinkSync).toHaveBeenCalledWith("/tmp/addon.tar.gz");
  });
});
