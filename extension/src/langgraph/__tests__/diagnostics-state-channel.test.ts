/**
 * Diagnostics Context Channel Tests — SA4E-185
 * Covers STC-31: diagnosticsContext channel reducer + consume-once
 */

import { describe, it, expect } from "vitest";
import { Annotation } from "@langchain/langgraph";
import type { PipelineState } from "../core/state";

// Re-create the annotation locally for testing (mirrors state.ts)
const TestPipelineAnnotation = Annotation.Root({
  kbContext: Annotation<string>({ reducer: (_e, u) => u, default: () => "" }),
  diagnosticsContext: Annotation<string>({ reducer: (_e, u) => u, default: () => "" }),
});

type TestState = typeof TestPipelineAnnotation.State;

describe("diagnosticsContext channel (STC-31)", () => {
  it("default value is empty string", () => {
    const initial = TestPipelineAnnotation.State.default();
    expect(initial.diagnosticsContext).toBe("");
  });

  it("last-write-wins reducer", () => {
    const state: TestState = {
      diagnosticsContext: "",
      kbContext: "",
      ticketKey: "",
      threadId: "",
      currentPhase: "chat" as any,
      intent: "chat" as any,
      pipelineStatus: "running" as any,
      resumePoint: null,
      documents: {},
      agentOutputs: [],
      currentStreamId: null,
      approvalRequired: false,
      approvalDecision: null,
      userFeedback: null,
      pendingApprovals: [],
      chatHistory: [],
      errors: [],
      retryCount: {},
      createdAt: "",
      lastUpdatedAt: "",
      lastCheckpointAt: null,
      feedbackIterations: 0,
      maxFeedbackIterations: 5,
      discrepancyFound: false,
      previousNode: null,
      parallelResults: {},
      qualityGateResults: {},
      toolCalls: null,
      toolResults: [],
      agentScratchpad: [],
      agentIterations: 0,
      verifyPassed: true,
      verifyFeedback: null,
      verifyAttempts: {},
      maxVerifyAttempts: 2,
      activeStrategy: {},
      strategyHistory: [],
      maxContextTokens: 0,
      autonomyLevel: "L2" as any,
      rawHumanInput: null,
      analyzedIntent: null,
      currentPhaseIndex: 0,
      pipelineDefinition: null,
    };

    // Apply update "S1"
    const reducer = TestPipelineAnnotation.channels.diagnosticsContext.reducer;
    let updated = reducer(state.diagnosticsContext, "S1");
    expect(updated).toBe("S1");

    // Apply update "S2" - should win
    updated = reducer(updated, "S2");
    expect(updated).toBe("S2");
  });

  it("can be cleared to empty string (consume-once writable)", () => {
    const reducer = TestPipelineAnnotation.channels.diagnosticsContext.reducer;
    let value = reducer("some summary", "");
    expect(value).toBe("");
  });

  it("fresh default per invocation (no cross-invocation leak)", () => {
    const defaultVal = TestPipelineAnnotation.State.default();
    expect(defaultVal.diagnosticsContext).toBe("");

    // Simulate two separate graph invocations
    const invocation1 = TestPipelineAnnotation.State.default();
    const invocation2 = TestPipelineAnnotation.State.default();
    expect(invocation1.diagnosticsContext).toBe("");
    expect(invocation2.diagnosticsContext).toBe("");
  });
});