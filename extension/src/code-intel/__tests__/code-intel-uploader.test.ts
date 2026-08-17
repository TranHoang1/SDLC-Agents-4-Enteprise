/**
 * Unit tests for CodeIntelUploader — batching, chunking, response parsing.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { CodeIntelUploader } from "../CodeIntelUploader";
import type { FileUploadPayload } from "../models";

function payload(filePath: string): FileUploadPayload {
  return {
    filePath,
    language: "typescript",
    hash: "h-" + filePath,
    timestamp: "2026-01-01T00:00:00Z",
    symbols: [],
    imports: [],
    exports: [],
  };
}

function mcpeResponse(accepted: number, skipped: number, errors: string[] = []): string {
  return JSON.stringify({
    content: [{ type: "text", text: JSON.stringify({ accepted, skipped, errors }) }],
  });
}

function makeClient(overrides: Partial<{ invokeTool: ReturnType<typeof vi.fn> }> = {}) {
  const invokeTool = overrides.invokeTool ?? vi.fn(async () => mcpeResponse(1, 0));
  return { invokeTool };
}

describe("CodeIntelUploader", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns an empty result for an empty batch without calling the client", async () => {
    const client = makeClient();
    const uploader = new CodeIntelUploader(client as never, "proj-1");
    await expect(uploader.uploadBatch([])).resolves.toEqual({ accepted: 0, skipped: 0, errors: [] });
    expect(client.invokeTool).not.toHaveBeenCalled();
  });

  it("sends the whole batch through code_intel_upload with the project id", async () => {
    const client = makeClient();
    const uploader = new CodeIntelUploader(client as never, "proj-1");
    const files = [payload("a.ts"), payload("b.ts")];
    await uploader.uploadBatch(files);
    expect(client.invokeTool).toHaveBeenCalledWith("code_intel_upload", { projectId: "proj-1", files });
  });

  it("parses a nested content/text response", async () => {
    const client = makeClient({ invokeTool: vi.fn(async () => mcpeResponse(3, 1)) });
    const uploader = new CodeIntelUploader(client as never, "proj-1");
    const result = await uploader.uploadBatch([payload("a.ts")]);
    expect(result).toEqual({ accepted: 3, skipped: 1, errors: [] });
  });

  it("parses a flat response without content blocks", async () => {
    const client = makeClient({
      invokeTool: vi.fn(async () => JSON.stringify({ accepted: 5, skipped: 0, errors: [] })),
    });
    const uploader = new CodeIntelUploader(client as never, "proj-1");
    const result = await uploader.uploadBatch([payload("a.ts")]);
    expect(result).toEqual({ accepted: 5, skipped: 0, errors: [] });
  });

  it("chunks batches larger than 100 files and merges results", async () => {
    const invokeTool = vi.fn(async () => mcpeResponse(50, 0));
    const client = makeClient({ invokeTool });
    const uploader = new CodeIntelUploader(client as never, "proj-1");
    const files = Array.from({ length: 150 }, (_, i) => payload(`f${i}.ts`));
    const result = await uploader.uploadBatch(files);
    expect(invokeTool).toHaveBeenCalledTimes(2);
    expect(result.accepted).toBe(100);
    expect(result.skipped).toBe(0);
    expect(result.errors).toEqual([]);
  });

  it("aggregates errors across chunks", async () => {
    const invokeTool = vi.fn(async () => JSON.stringify({ accepted: 0, skipped: 0, errors: ["chunk failed"] }));
    const client = makeClient({ invokeTool });
    const uploader = new CodeIntelUploader(client as never, "proj-1");
    const files = Array.from({ length: 250 }, (_, i) => payload(`f${i}.ts`));
    const result = await uploader.uploadBatch(files);
    expect(invokeTool).toHaveBeenCalledTimes(3);
    expect(result.errors).toEqual(["chunk failed", "chunk failed", "chunk failed"]);
  });

  it("reports an error when the tool call rejects", async () => {
    const client = makeClient({
      invokeTool: vi.fn(async () => { throw new Error("Connection refused"); }),
    });
    const uploader = new CodeIntelUploader(client as never, "proj-1");
    const result = await uploader.uploadBatch([payload("a.ts")]);
    expect(result).toEqual({ accepted: 0, skipped: 0, errors: ["Connection refused"] });
  });

  it("falls back to a generic error on unparseable tool output", async () => {
    const client = makeClient({ invokeTool: vi.fn(async () => "not-json") });
    const uploader = new CodeIntelUploader(client as never, "proj-1");
    const result = await uploader.uploadBatch([payload("a.ts")]);
    expect(result).toEqual({ accepted: 0, skipped: 0, errors: ["Invalid response format"] });
  });

  it("keeps partial results when one chunk fails", async () => {
    const invokeTool = vi.fn(async () => {
      throw new Error("boom");
    });
    const client = makeClient({ invokeTool });
    const uploader = new CodeIntelUploader(client as never, "proj-1");
    const result = await uploader.uploadBatch(Array.from({ length: 150 }, (_, i) => payload(`f${i}.ts`)));
    expect(result.errors.length).toBe(2);
    expect(result.accepted).toBe(0);
  });
});