/**
 * Unit tests for FileChangeWatcher — save/create/delete events, debounce, hash dedup.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { FileChangeWatcher } from "../FileChangeWatcher";
import { CodeIntelScanner } from "../CodeIntelScanner";
import { HashCache } from "../HashCache";

vi.mock("vscode", () => ({
  workspace: {
    onDidSaveTextDocument: vi.fn((_cb: unknown) => ({ dispose: vi.fn() })),
    onDidCreateFiles: vi.fn((_cb: unknown) => ({ dispose: vi.fn() })),
    onDidDeleteFiles: vi.fn((_cb: unknown) => ({ dispose: vi.fn() })),
  },
}));

vi.mock("fs/promises", () => ({ readFile: vi.fn() }));

import * as vscode from "vscode";

async function importFsPromises() {
  return (await import("fs/promises")) as { readFile: ReturnType<typeof vi.fn> };
}

interface Harness {
  watcher: FileChangeWatcher;
  context: { subscriptions: unknown[] };
  uploader: { uploadBatch: ReturnType<typeof vi.fn> };
  offlineQueue: { enqueue: ReturnType<typeof vi.fn> };
  outputChannel: { appendLine: ReturnType<typeof vi.fn> };
  scanner: CodeIntelScanner;
  hashCache: HashCache;
}

function buildHarness(): Harness {
  const scanner = new CodeIntelScanner();
  const hashCache = new HashCache();
  const uploader = { uploadBatch: vi.fn(async () => ({ accepted: 1, skipped: 0, errors: [] })) };
  const offlineQueue = { enqueue: vi.fn() };
  const outputChannel = { appendLine: vi.fn() };
  const timestampResolver = { resolve: vi.fn(async () => "2026-01-01T00:00:00Z") };
  const context = { subscriptions: [] as unknown[] };
  const watcher = new FileChangeWatcher(
    "/root",
    scanner as never,
    uploader as never,
    hashCache,
    timestampResolver as never,
    offlineQueue as never,
    outputChannel as never
  );
  watcher.activate(context as never);
  return { watcher, context, uploader, offlineQueue, outputChannel, scanner, hashCache };
}

describe("FileChangeWatcher", () => {
  let harness: Harness;
  let saveCb: (doc: { uri: { fsPath: string } }) => void;
  let createCb: (event: { files: Array<{ fsPath: string }> }) => void;
  let deleteCb: (event: { files: Array<{ fsPath: string }> }) => void;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    harness = buildHarness();
    saveCb = vi.mocked(vscode.workspace.onDidSaveTextDocument).mock.calls[0]?.[0] as never;
    createCb = vi.mocked(vscode.workspace.onDidCreateFiles).mock.calls[0]?.[0] as never;
    deleteCb = vi.mocked(vscode.workspace.onDidDeleteFiles).mock.calls[0]?.[0] as never;
  });

  afterEach(() => {
    harness.watcher.dispose();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("registers itself as a context subscription on activate", () => {
    expect(harness.context.subscriptions).toContain(harness.watcher);
  });

  it("scans and uploads a saved file after the debounce", async () => {
    const { readFile } = await importFsPromises();
    vi.mocked(readFile).mockResolvedValue("const saved = 1;" as never);
    saveCb({ uri: { fsPath: "/root/src/feature.ts" } });
    await vi.advanceTimersByTimeAsync(1000);
    expect(harness.uploader.uploadBatch).toHaveBeenCalledTimes(1);
    const [[files]] = harness.uploader.uploadBatch.mock.calls as unknown as [[unknown[]]];
    expect(files).toHaveLength(1);
  });

  it("ignores unsupported file extensions", async () => {
    saveCb({ uri: { fsPath: "/root/README.md" } });
    await vi.advanceTimersByTimeAsync(1000);
    expect(harness.uploader.uploadBatch).not.toHaveBeenCalled();
  });

  it("skips processing when the file hash is unchanged", async () => {
    const { readFile } = await importFsPromises();
    vi.mocked(readFile).mockResolvedValue("same content" as never);
    saveCb({ uri: { fsPath: "/root/src/a.ts" } });
    await vi.advanceTimersByTimeAsync(1000);
    expect(harness.uploader.uploadBatch).toHaveBeenCalledTimes(1);
    saveCb({ uri: { fsPath: "/root/src/a.ts" } });
    await vi.advanceTimersByTimeAsync(1000);
    expect(harness.uploader.uploadBatch).toHaveBeenCalledTimes(1);
  });

  it("debounces rapid saves into a single processing pass", async () => {
    const { readFile } = await importFsPromises();
    vi.mocked(readFile).mockResolvedValue("version A" as never);
saveCb({ uri: { fsPath: "/root/src/b.ts" } });
    vi.advanceTimersByTime(500);
    saveCb({ uri: { fsPath: "/root/src/b.ts" } });
    await vi.advanceTimersByTimeAsync(1000);
    expect(harness.uploader.uploadBatch).toHaveBeenCalledTimes(1);
  });

  it("queues uploads for offline when the backend upload fails", async () => {
    const { readFile } = await importFsPromises();
    vi.mocked(readFile).mockResolvedValue("content" as never);
    harness.uploader.uploadBatch.mockRejectedValue(new Error("backend down"));
    saveCb({ uri: { fsPath: "/root/src/c.ts" } });
    await vi.advanceTimersByTimeAsync(1000);
    expect(harness.offlineQueue.enqueue).toHaveBeenCalledWith(expect.any(Array));
  });

  it("logs processing errors to the output channel", async () => {
    const { readFile } = await importFsPromises();
    vi.mocked(readFile).mockRejectedValue(new Error("EPERM: read denied") as never);
    saveCb({ uri: { fsPath: "/root/src/d.ts" } });
    await vi.advanceTimersByTimeAsync(1000);
    expect(harness.outputChannel.appendLine).toHaveBeenCalledWith(
      expect.stringContaining("EPERM: read denied")
    );
    expect(harness.uploader.uploadBatch).not.toHaveBeenCalled();
  });

  it("processes files from the create-files event", async () => {
    const { readFile } = await importFsPromises();
    vi.mocked(readFile).mockResolvedValue("new file content" as never);
    createCb({ files: [{ fsPath: "/root/src/created.ts" }] });
    await vi.advanceTimersByTimeAsync(1000);
    expect(harness.uploader.uploadBatch).toHaveBeenCalledTimes(1);
  });

  it("evicts the hash cache when a file is deleted", () => {
    harness.hashCache.set("src/gone.ts", "some-hash");
    deleteCb({ files: [{ fsPath: "/root/src/gone.ts" }] });
    expect(harness.hashCache.has("src/gone.ts")).toBe(false);
  });

  it("does not delete hashes outside the workspace root", () => {
    harness.hashCache.set("src/keep.ts", "some-hash");
    deleteCb({ files: [{ fsPath: "/elsewhere/src/keep.ts" }] });
    expect(harness.hashCache.has("src/keep.ts")).toBe(true);
  });

  it("dispose cancels pending debounce timers", async () => {
    const { readFile } = await importFsPromises();
    vi.mocked(readFile).mockResolvedValue("content" as never);
    saveCb({ uri: { fsPath: "/root/src/e.ts" } });
    harness.watcher.dispose();
    await vi.advanceTimersByTimeAsync(2000);
    expect(harness.uploader.uploadBatch).not.toHaveBeenCalled();
  });
});
