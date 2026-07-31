/**
 * EnrichmentObserver — SA4E-79
 * Observer pattern: detects pending_hits in mem_search responses and
 * orchestrates background client-side LLM enrichment.
 * Non-blocking: fires enrichment async, never blocks the pipeline (BR-07).
 *
 * Fixes applied from TA-TECHNICAL-REVIEW:
 * - TA-01: Global concurrency throttle (max 3 concurrent across all batches)
 * - TA-02: Promise lifecycle tracking for graceful shutdown
 * - TA-05: 409 "already enriched" not counted as failure
 */

import type { McpBridge } from "../core/mcp-bridge";
import type { LlmProvider } from "../core/llm-provider";
import { EnrichmentDedup } from "./EnrichmentDedup";
import { ENRICHMENT_SYSTEM_PROMPT, buildEnrichmentUserPrompt } from "./prompts";

/** Parsed pending entry from mem_search response. */
interface PendingHit {
  id: number;
  source: string;
  content: string;
}

/** TA-01: Global max concurrent enrichment operations across all batches. */
const MAX_GLOBAL_CONCURRENT = 3;
/** Max entries enriched per batch to limit LLM load. */
const MAX_ENTRIES_PER_BATCH = 3;
/** LLM timeout for a single enrichment call. */
const LLM_TIMEOUT_MS = 30_000;
/** Max consecutive failures before auto-disable with backoff. */
const MAX_CONSECUTIVE_FAILURES = 3;
/** TA-05: Backoff ceiling (5 minutes). */
const MAX_BACKOFF_MS = 300_000;

/**
 * Observes kbSearch responses, detects pending entries, and enriches them
 * via client-side LLM in the background.
 */
export class EnrichmentObserver {
  private dedup = new EnrichmentDedup();
  private consecutiveFailures = 0;
  /** TA-01: Track global in-flight count for throttling. */
  private activeCount = 0;
  /** TA-02: Track active enrichment promises for graceful shutdown. */
  private activePromises: Set<Promise<void>> = new Set();
  /** TA-05: Auto-disable flag with backoff re-enable. */
  private enabled = true;
  /** TA-02: Abort controller for extension shutdown. */
  private shutdownController = new AbortController();

  constructor(
    private readonly mcpBridge: McpBridge,
    private readonly llmProvider: LlmProvider | undefined,
  ) {}

  /**
   * Called after every kbSearch response.
   * Parses pending_hits and fires background enrichment (non-blocking).
   * @param responseText - Raw text response from mem_search
   */
  onSearchResponse(responseText: string): void {
    if (!this.enabled) return;
    const pendingHits = this.parsePendingHits(responseText);
    if (pendingHits.length === 0) return;
    const promise = this.enrichInBackground(pendingHits);
    this.trackPromise(promise);
  }

  /**
   * TA-02: Graceful shutdown — waits for in-flight enrichments (max 10s).
   * Call from extension deactivate() lifecycle hook.
   */
  async shutdown(): Promise<void> {
    this.shutdownController.abort();
    if (this.activePromises.size === 0) return;
    await Promise.race([
      Promise.allSettled([...this.activePromises]),
      new Promise(resolve => setTimeout(resolve, 10_000)),
    ]);
  }

  /** Parse pending entries from the delimited section of search response. */
  private parsePendingHits(text: string): PendingHit[] {
    const idx = text.indexOf("--- Pending Entries");
    if (idx === -1) return [];
    const section = text.slice(idx);
    const regex = /\[PENDING #\d+\] ID: (\d+) \| Source: (.+)\n\s+Content: (.+)/g;
    const hits: PendingHit[] = [];
    let match: RegExpExecArray | null;
    while ((match = regex.exec(section)) !== null) {
      hits.push({ id: parseInt(match[1], 10), source: match[2].trim(), content: match[3].trim() });
    }
    return hits;
  }

  /** Enrich entries in background — filters dedup, throttles globally (TA-01). */
  private async enrichInBackground(hits: PendingHit[]): Promise<void> {
    if (!this.llmProvider || !(await this.llmProvider.isAvailable())) return;
    // TA-01: Global concurrency throttle — skip if at capacity
    const available = MAX_GLOBAL_CONCURRENT - this.activeCount;
    if (available <= 0) return;

    const toProcess = hits
      .filter(h => this.dedup.canProcess(h.id))
      .slice(0, Math.min(MAX_ENTRIES_PER_BATCH, available));
    if (toProcess.length === 0) return;

    for (const h of toProcess) this.dedup.markInFlight(h.id);
    this.activeCount += toProcess.length;
    try {
      const results = await Promise.allSettled(
        toProcess.map(h => this.enrichSingle(h)),
      );
      this.updateFailureTracking(results);
    } finally {
      this.activeCount -= toProcess.length;
      for (const h of toProcess) this.dedup.release(h.id);
    }
  }

  /** TA-05: Update failure tracking — 409 "already enriched" is NOT a failure. */
  private updateFailureTracking(results: PromiseSettledResult<boolean>[]): void {
    const successes = results.filter(r => r.status === "fulfilled" && r.value).length;
    if (successes > 0) { this.consecutiveFailures = 0; return; }
    this.consecutiveFailures += results.length;
    if (this.consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
      this.disableWithBackoff();
    }
  }

  /** TA-05: Disable enrichment with exponential backoff, auto re-enable. */
  private disableWithBackoff(): void {
    this.enabled = false;
    const backoffMs = Math.min(MAX_BACKOFF_MS, Math.pow(2, this.consecutiveFailures) * 5_000);
    console.warn(`[EnrichmentObserver] Disabled after ${this.consecutiveFailures} failures. Re-enabling in ${backoffMs / 1000}s`);
    setTimeout(() => { this.enabled = true; this.consecutiveFailures = 0; }, backoffMs);
  }

  /** Enrich a single entry via LLM + mem_enrich call. */
  private async enrichSingle(hit: PendingHit): Promise<boolean> {
    try {
      const response = await this.callLlm(hit.content);
      const metadata = JSON.parse(response);
      if (!metadata.summary || metadata.summary.length === 0) return false;
      const summary = String(metadata.summary).slice(0, 500);
      const tags = String(metadata.tags || "").slice(0, 500);
      const result = await this.mcpBridge.callTool("mem_enrich", {
        entry_id: hit.id, summary, tags,
        structured_map: metadata.structured_map || undefined,
      }, LLM_TIMEOUT_MS);
      // TA-05: "already enriched" is expected race condition, NOT a failure
      if (result.includes("already enriched")) return true;
      return !result.includes("Error:");
    } catch (err) {
      console.debug(`[EnrichmentObserver] enrichSingle failed: ${(err as Error).message}`);
      return false; // Silent failure per BR-09
    }
  }

  /** Call LLM with enrichment prompts + shutdown-aware signal (TA-02). */
  private async callLlm(content: string): Promise<string> {
    if (this.shutdownController.signal.aborted) throw new Error("shutdown");
    const messages = [
      { role: "system" as const, content: ENRICHMENT_SYSTEM_PROMPT },
      { role: "user" as const, content: buildEnrichmentUserPrompt(content) },
    ];
    return this.llmProvider!.chat(messages, {
      maxTokens: 1000,
      temperature: 0.3,
      signal: AbortSignal.timeout(LLM_TIMEOUT_MS),
    });
  }

  /** TA-02: Track promise for shutdown coordination. */
  private trackPromise(promise: Promise<void>): void {
    this.activePromises.add(promise);
    promise.finally(() => this.activePromises.delete(promise));
  }
}
