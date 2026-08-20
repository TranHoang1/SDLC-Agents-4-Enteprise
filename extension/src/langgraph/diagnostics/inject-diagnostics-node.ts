/**
 * Inject Diagnostics Node — SA4E-185
 * LangGraph node factory that pulls the read-once feed summary and writes it to the diagnosticsContext channel.
 * Implements UC-02 (BR-7) — single-writer of the new diagnosticsContext channel.
 */

import { PipelineState } from "../core/state";
import type { DiagnosticsFeedService } from "./diagnostics-feed-service";

/**
 * Creates the inject_diagnostics LangGraph node.
 * When feed is null/undefined (not wired, tests, old call sites), the node no-ops —
 * graph behaves exactly as today (backward compatibility).
 */
export function createInjectDiagnosticsNode(
  feed: DiagnosticsFeedService | null
): (state: PipelineState) => Promise<Partial<PipelineState>> {
  return async (_state: PipelineState) => {
    if (!feed) return {}; // E-8: not wired → no-op

    const summary = feed.takePendingSummary(); // read-once at source (BR-7)
    return summary ? { diagnosticsContext: summary } : {}; // {} → no channel churn
  };
}