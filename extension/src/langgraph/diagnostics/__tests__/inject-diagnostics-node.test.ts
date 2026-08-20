/**
 * Inject Diagnostics Node Unit Tests — SA4E-185
 * Covers STC-29, STC-30
 */

import { describe, it, expect, vi } from "vitest";
import { createInjectDiagnosticsNode } from "../inject-diagnostics-node";
import type { DiagnosticsFeedService } from "../diagnostics-feed-service";
import { PipelineState } from "../../core/state";

describe("createInjectDiagnosticsNode", () => {
  it("STC-29: no-ops when feed is null (backward compat)", async () => {
    const node = createInjectDiagnosticsNode(null);
    const state = {} as PipelineState;
    const result = await node(state);
    expect(result).toEqual({});
  });

  it("STC-29: no-ops when feed is undefined (backward compat)", async () => {
    const node = createInjectDiagnosticsNode(undefined as any);
    const state = {} as PipelineState;
    const result = await node(state);
    expect(result).toEqual({});
  });

  it("STC-30: returns diagnosticsContext when summary available", async () => {
    const mockFeed = {
      takePendingSummary: vi.fn().mockReturnValue("[Diagnostics feed]\nsrc/app.ts:12 error TS2339 msg"),
    } as unknown as DiagnosticsFeedService;

    const node = createInjectDiagnosticsNode(mockFeed);
    const state = {} as PipelineState;
    const result = await node(state);

    expect(result).toEqual({
      diagnosticsContext: "[Diagnostics feed]\nsrc/app.ts:12 error TS2339 msg",
    });
    expect(mockFeed.takePendingSummary).toHaveBeenCalledTimes(1);
  });

  it("STC-30: returns {} when nothing pending (read-once)", async () => {
    const mockFeed = {
      takePendingSummary: vi.fn().mockReturnValue(null),
    } as unknown as DiagnosticsFeedService;

    const node = createInjectDiagnosticsNode(mockFeed);
    const state = {} as PipelineState;

    // First call
    const result1 = await node(state);
    expect(result1).toEqual({});

    // Second call also returns {}
    const result2 = await node(state);
    expect(result2).toEqual({});
    expect(mockFeed.takePendingSummary).toHaveBeenCalledTimes(2);
  });
});