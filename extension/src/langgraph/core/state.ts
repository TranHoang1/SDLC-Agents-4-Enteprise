/**
 * LangGraph Pipeline State --- KSA-210
 * Typed state channels for the SDLC pipeline StateGraph.
 */

import { Annotation } from "@langchain/langgraph";
import type { LlmToolCall, LlmMessage } from "./llm-provider";
import type { ActiveSteeringRule } from "../steering/frontmatter";

export type { LlmToolCall } from "./llm-provider";
export {
  SDLCPhase, PipelineIntent, PipelineStatus, ApprovalDecision, AutonomyLevel, StreamEventType,
  StrategyEvent, DocumentState, AgentOutput, QualityGateCheckpoint, QualityGateResult,
  ChatMessage, PipelineError, PipelineGraphNode, PersistedPipelineInfo, IntentAnalysis,
  PipelineDefState, PipelineDefPhase,
} from "./state-types";

import type {
  SDLCPhase, PipelineIntent, PipelineStatus, ApprovalDecision, AutonomyLevel,
  StrategyEvent, DocumentState, AgentOutput, QualityGateCheckpoint, QualityGateResult,
  ChatMessage, PipelineError, IntentAnalysis, PipelineDefState,
} from "./state-types";

export const PipelineAnnotation = Annotation.Root({
  ticketKey: Annotation<string>,
  threadId: Annotation<string>,
  currentPhase: Annotation<SDLCPhase>,
  intent: Annotation<PipelineIntent>({ reducer: (_existing, update) => update, default: () => "chat" as PipelineIntent }),
  pipelineStatus: Annotation<PipelineStatus>,
  resumePoint: Annotation<string | null>,
  documents: Annotation<Record<string, DocumentState>>,
  agentOutputs: Annotation<AgentOutput[]>({ reducer: (_existing, update) => update, default: () => [] }),
  currentStreamId: Annotation<string | null>,
  approvalRequired: Annotation<boolean>,
  approvalDecision: Annotation<ApprovalDecision | null>,
  userFeedback: Annotation<string | null>,
  pendingApprovals: Annotation<QualityGateCheckpoint[]>,
  chatHistory: Annotation<ChatMessage[]>({ reducer: (existing, update) => [...existing, ...update].slice(-200), default: () => [] }),
  errors: Annotation<PipelineError[]>,
  retryCount: Annotation<Record<string, number>>,
  createdAt: Annotation<string>,
  lastUpdatedAt: Annotation<string>,
  lastCheckpointAt: Annotation<string | null>,
  feedbackIterations: Annotation<number>({ reducer: (_e, u) => u, default: () => 0 }),
  maxFeedbackIterations: Annotation<number>({ reducer: (_e, u) => u, default: () => 5 }),
  discrepancyFound: Annotation<boolean>({ reducer: (_e, u) => u, default: () => false }),
  previousNode: Annotation<string | null>({ reducer: (_e, u) => u, default: () => null }),
  parallelResults: Annotation<Record<string, string>>({ reducer: (e, u) => ({ ...e, ...u }), default: () => ({}) }),
  qualityGateResults: Annotation<Record<string, QualityGateResult>>({ reducer: (e, u) => ({ ...e, ...u }), default: () => ({}) }),
  toolCalls: Annotation<LlmToolCall[] | null>({ reducer: (_e, u) => u, default: () => null }),
  toolResults: Annotation<Array<{ toolCallId: string; name: string; content: string }>>({ reducer: (e, u) => [...e, ...u], default: () => [] }),
  agentScratchpad: Annotation<LlmMessage[]>({ reducer: (_e, u) => u, default: () => [] }),
  agentIterations: Annotation<number>({ reducer: (_e, u) => u, default: () => 0 }),
  verifyPassed: Annotation<boolean>({ reducer: (_e, u) => u, default: () => true }),
  verifyFeedback: Annotation<string | null>({ reducer: (_e, u) => u, default: () => null }),
  verifyAttempts: Annotation<Record<string, number>>({ reducer: (e, u) => ({ ...e, ...u }), default: () => ({}) }),
  maxVerifyAttempts: Annotation<number>({ reducer: (_e, u) => u, default: () => 2 }),
  activeStrategy: Annotation<Record<string, string>>({ reducer: (e, u) => ({ ...e, ...u }), default: () => ({}) }),
  strategyHistory: Annotation<StrategyEvent[]>({ reducer: (e, u) => [...e, ...u].slice(-20), default: () => [] }),
  maxContextTokens: Annotation<number>({ reducer: (_e, u) => u, default: () => 0 }),
  autonomyLevel: Annotation<AutonomyLevel>({ reducer: (_e, u) => u, default: () => "L2" as AutonomyLevel }),
  rawHumanInput: Annotation<string | null>({ reducer: (_e, u) => u, default: () => null }),
  analyzedIntent: Annotation<IntentAnalysis | null>({ reducer: (_e, u) => u, default: () => null }),
  currentPhaseIndex: Annotation<number>({ reducer: (_e, u) => u, default: () => 0 }),
  pipelineDefinition: Annotation<PipelineDefState | null>({ reducer: (_e, u) => u, default: () => null }),
  kbContext: Annotation<string>({ reducer: (_e, u) => u, default: () => "" }),

  // SA4E-185: realtime LSP diagnostics feed summary; consumed once per turn (BR-7)
  diagnosticsContext: Annotation<string>({ reducer: (_e, u) => u, default: () => "" }),

  // SA4E-187: conditional steering rules (fileMatch/manual) merged by rule id so
  // concurrent tool captures never lose updates (proper channel reducer, not naive LWW)
  activeSteeringRules: Annotation<ActiveSteeringRule[]>({ reducer: mergeActiveSteeringRules, default: () => [] }),
});

export function mergeActiveSteeringRules(
  existing: ActiveSteeringRule[],
  update: ActiveSteeringRule[]
): ActiveSteeringRule[] {
  const byId = new Map<string, ActiveSteeringRule>();
  for (const r of existing) { byId.set(r.id, r); }
  for (const r of update) { byId.set(r.id, r); }
  return [...byId.values()];
}

export type PipelineState = typeof PipelineAnnotation.State;

const DEFAULT_AUTONOMY_LEVEL: AutonomyLevel = "L2";
