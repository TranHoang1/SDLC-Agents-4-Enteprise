/**
 * Diagnostics Context Channel Tests — SA4E-185
 * Covers STC-31: diagnosticsContext channel reducer + consume-once
 *
 * NOTE: rewritten for @langchain/langgraph >= 1.4 (Annotation.Root no longer
 * exposes .State / .channels accessors). Channel semantics (default "",
 * last-write-wins, clear-to-"") are exercised through a real compiled graph.
 */

import { describe, it, expect } from "vitest";
import { Annotation, StateGraph, START, END } from "@langchain/langgraph";

// Mirrors the channel contracts in core/state.ts (kbContext pattern, BR-7).
const TestPipelineAnnotation = Annotation.Root({
  kbContext: Annotation<string>({ reducer: (_e, u) => u, default: () => "" }),
  diagnosticsContext: Annotation<string>({ reducer: (_e, u) => u, default: () => "" }),
});

type TestState = { kbContext: string; diagnosticsContext: string };

/** Run a single-node graph whose node returns the given channel patch. */
async function runPatch(patch: Record<string, unknown>, input: Record<string, unknown>): Promise<TestState> {
  const graph = new StateGraph(TestPipelineAnnotation)
    .addNode("apply", () => patch)
    .addEdge(START, "apply")
    .addEdge("apply", END);
  return (await graph.compile().invoke(input)) as unknown as TestState;
}

describe("diagnosticsContext channel (STC-31)", () => {
  it("default value is empty string", async () => {
    // Omit diagnosticsContext from input -> reducer default "" fills the channel
    const state = await runPatch({}, { kbContext: "" });
    expect(state.diagnosticsContext).toBe("");
  });

  it("last-write-wins reducer", async () => {
    // "S1" in input is replaced by "S2" returned by the node (reducer (_e,u)=>u)
    const state = await runPatch({ diagnosticsContext: "S2" }, { kbContext: "", diagnosticsContext: "S1" });
    expect(state.diagnosticsContext).toBe("S2");
  });

  it("can be cleared to empty string (consume-once writable)", async () => {
    const state = await runPatch({ diagnosticsContext: "" }, { kbContext: "", diagnosticsContext: "some summary" });
    expect(state.diagnosticsContext).toBe("");
  });

  it("fresh default per invocation (no cross-invocation leak)", async () => {
    const graph = new StateGraph(TestPipelineAnnotation)
      .addNode("apply", () => ({}))
      .addEdge(START, "apply")
      .addEdge("apply", END)
      .compile();

    const invocation1 = (await graph.invoke({ kbContext: "" })) as unknown as TestState;
    const invocation2 = (await graph.invoke({ kbContext: "" })) as unknown as TestState;
    expect(invocation1.diagnosticsContext).toBe("");
    expect(invocation2.diagnosticsContext).toBe("");
  });
});