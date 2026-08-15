/**
 * Unit tests for OfflineQueue — bounded queue, drain semantics, requeue on failure.
 */

import { describe, it, expect, vi } from "vitest";
import { OfflineQueue } from "../OfflineQueue";
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

function makeUploader(overrides: Partial<{ uploadBatch: ReturnType<typeof vi.fn> }> = {}) {
  const uploadBatch = overrides.uploadBatch ?? vi.fn(async () => ({ accepted: 1, skipped: 0, errors: [] }));
  return { uploadBatch };
}

describe("OfflineQueue", () => {
  it("starts empty and not draining", () => {
    const queue = new OfflineQueue(makeUploader() as never);
    expect(queue.pending).toBe(0);
    expect(queue.isDraining).toBe(false);
  });

  it("enqueue adds files", () => {
    const queue = new OfflineQueue(makeUploader() as never);
    queue.enqueue([payload("a.ts"), payload("b.ts")]);
    expect(queue.pending).toBe(2);
  });

  it("drops the oldest item when exceeding the 1000 cap", () => {
    const queue = new OfflineQueue(makeUploader() as never);
    for (let i = 0; i < 1001; i++) {
      queue.enqueue([payload(`f${i}.ts`)]);
    }
    expect(queue.pending).toBe(1000);
  });

  it("drain uploads all pending batches and empties the queue", async () => {
    const uploader = makeUploader();
    const queue = new OfflineQueue(uploader as never);
    const files = Array.from({ length: 250 }, (_, i) => payload(`f${i}.ts`));
    queue.enqueue(files);
    await queue.drain();
    expect(queue.pending).toBe(0);
    expect(uploader.uploadBatch).toHaveBeenCalledTimes(3);
  });

  it("re-queues a fully-failed batch and stops draining", async () => {
    const uploader = makeUploader({
      uploadBatch: vi.fn(async () => ({ accepted: 0, skipped: 0, errors: ["backend unreachable"] })),
    });
    const queue = new OfflineQueue(uploader as never);
    queue.enqueue([payload("a.ts"), payload("b.ts")]);
    await queue.drain();
    expect(queue.pending).toBe(2);
    expect(uploader.uploadBatch).toHaveBeenCalledTimes(1);
  });

  it("does not drop a partially-failed batch", async () => {
    const uploader = makeUploader({
      uploadBatch: vi.fn(async () => ({ accepted: 1, skipped: 0, errors: ["retry requested"] })),
    });
    const queue = new OfflineQueue(uploader as never);
    queue.enqueue([payload("a.ts"), payload("b.ts")]);
    await queue.drain();
    expect(queue.pending).toBe(0);
  });

  it("drain is a no-op on an empty queue", async () => {
    const uploader = makeUploader();
    const queue = new OfflineQueue(uploader as never);
    await queue.drain();
    expect(uploader.uploadBatch).not.toHaveBeenCalled();
  });

  it("refuses concurrent drains", async () => {
    let resolveUpload: (value: unknown) => void = () => {};
    const uploader = makeUploader({
      uploadBatch: vi.fn(() => new Promise((resolve) => { resolveUpload = resolve; })),
    });
    const queue = new OfflineQueue(uploader as never);
    queue.enqueue([payload("a.ts")]);
    const first = queue.drain();
    const second = queue.drain();
    resolveUpload({ accepted: 1, skipped: 0, errors: [] });
    await Promise.all([first, second]);
    expect(uploader.uploadBatch).toHaveBeenCalledTimes(1);
    expect(queue.isDraining).toBe(false);
  });

  it("clear empties the queue", () => {
    const queue = new OfflineQueue(makeUploader() as never);
    queue.enqueue([payload("a.ts")]);
    queue.clear();
    expect(queue.pending).toBe(0);
  });
});