/**
 * PegaBfsIndexer — BFS loop: fetch rules → ingest → enqueue discovered relatives.
 * SA4E-156: Replaces PegaProjectIndexer.run() with schema-driven relative discovery.
 * Pattern: Facade — orchestrates fetch, ingest, and queue management in one cohesive loop.
 */

import * as vscode from "vscode";
import * as crypto from "crypto";
import type { CrawlPlanItem } from "../models";
import type { PegaHttpClient } from "./PegaHttpClient";
import { fetchRulesInParallel, saveRuleFile, calibrateFetchConcurrency } from "./PegaCrawlHelper";
import { PegaStreamIngester } from "./PegaStreamIngester";
import { DependencyMapper } from "./DependencyMapper";
import type { UnresolvedDependency } from "./DependencyMapper";

type ProgressReporter = vscode.Progress<{ message?: string }>;
type LogFn = (msg: string) => void;

/** BFS batch size — rules fetched per iteration */
const BATCH_SIZE = 50;

/** Maximum rules BFS will process before forced termination (CWE-400 mitigation) */
const MAX_BFS_ITERATIONS = 10_000;

/** Maximum queue size before BFS stops enqueueing new relatives (CWE-400 mitigation) */
const MAX_QUEUE_SIZE = 50_000;

/** Summary returned after BFS completes */
export interface BfsIndexResult {
  totalIngested: number;
  initialCount: number;
  discoveredCount: number;
  skippedCount: number;
  errorCount: number;
}

/**
 * BFS-driven indexer: fetches rules from Pega, ingests into backend,
 * and enqueues newly-discovered relatives until queue is empty.
 */
export class PegaBfsIndexer {
  private readonly ingester: PegaStreamIngester;

  constructor(
    private readonly pegaClient: PegaHttpClient,
    private readonly backendUrl: string,
    private readonly outputChannel: vscode.OutputChannel | undefined,
    private readonly log: LogFn,
  ) {
    this.ingester = new PegaStreamIngester(backendUrl);
  }

  /**
   * Run BFS indexing loop until queue is empty.
   * Calibrates fetch concurrency first (BR-13), then processes batches.
   * @param projectId - 12-char hex project identifier
   * @param fetchQueue - Mutable array (FIFO) of rules to fetch
   * @param dedupSet - Mutable set of seen dedup keys
   * @param report - VS Code progress reporter
   * @param root - Workspace root for saving rule files
   * @returns Summary with counts
   */
  async run(
    projectId: string,
    fetchQueue: CrawlPlanItem[],
    dedupSet: Set<string>,
    report: ProgressReporter,
    root: string,
  ): Promise<BfsIndexResult> {
    const initialCount = fetchQueue.length;
    const counters = { totalIngested: 0, discoveredCount: 0, skippedCount: 0, errorCount: 0 };
    let processed = 0;

    // BR-13: Calibrate fetch concurrency before BFS loop starts
    await calibrateFetchConcurrency(this.pegaClient, initialCount, this.log);
    this.log(`[BfsIndexer] 🚀 Starting BFS loop: ${initialCount} seeds`);

    while (fetchQueue.length > 0) {
      if (processed >= MAX_BFS_ITERATIONS) {
        this.log(`[BfsIndexer] ⚠️ Hit max iterations (${MAX_BFS_ITERATIONS}). Stopping BFS.`);
        break;
      }
      const batch = fetchQueue.splice(0, BATCH_SIZE);
      processed += batch.length;
      report.report({
        message: `BFS: fetching ${processed}/${processed + fetchQueue.length} (queue: ${fetchQueue.length})`,
      });
      await this.processBatch(batch, projectId, fetchQueue, dedupSet, root, counters);
    }

    this.log(`[BfsIndexer] ✅ BFS complete: ingested=${counters.totalIngested}, discovered=${counters.discoveredCount}, errors=${counters.errorCount}`);
    return { ...counters, initialCount };
  }

  /** Fetch one batch, ingest rules, enqueue discovered relatives. */
  private async processBatch(
    batch: CrawlPlanItem[],
    projectId: string,
    fetchQueue: CrawlPlanItem[],
    dedupSet: Set<string>,
    root: string,
    counters: { totalIngested: number; discoveredCount: number; skippedCount: number; errorCount: number },
  ): Promise<void> {
    const fetchResult = await fetchRulesInParallel(batch, this.pegaClient, this.log);
    if (fetchResult.serverError) {
      this.log(`[BfsIndexer] ⛔ Server error — aborting BFS: ${fetchResult.serverError}`);
      throw new Error(fetchResult.serverError);
    }

    for (const { ruleObj, item } of fetchResult.fetched) {
      saveRuleFile(ruleObj, root, this.log, item.pxObjClass, item.pyRuleName);
      const result = await this.ingestAndDiscover(projectId, ruleObj);
      if (result.ingested) { counters.totalIngested++; } else { counters.skippedCount++; }
      counters.discoveredCount += this.enqueueRelatives(result.relatives, fetchQueue, dedupSet);
    }
    counters.errorCount += batch.length - fetchResult.fetched.length;
  }

  // ─── Private Helpers ────────────────────────────────────────────────────

  /** Ingest one rule and return ingestion status + relatives */
  private async ingestAndDiscover(
    projectId: string,
    ruleJson: Record<string, unknown>,
  ): Promise<{ ingested: boolean; relatives: UnresolvedDependency[] }> {
    try {
      const checksum = this.computeChecksum(ruleJson);
      const version = (ruleJson.pyRuleSetVersion as string) || undefined;

      const result = await this.ingester.ingestSingleRule(projectId, ruleJson, checksum, version);
      const ingested = result.status === 'success' && result.ruleId !== undefined && result.ruleId !== -1;
      return { ingested, relatives: result.unresolvedDependencies || [] };
    } catch (err: any) {
      this.log(`[BfsIndexer] ⚠️ Ingest error (skipping): ${err.message}`);
      return { ingested: false, relatives: [] };
    }
  }

  /** Enqueue relatives not yet seen — returns count of newly added items */
  private enqueueRelatives(
    relatives: UnresolvedDependency[],
    fetchQueue: CrawlPlanItem[],
    dedupSet: Set<string>,
  ): number {
    let count = 0;
    for (const dep of relatives) {
      if (fetchQueue.length >= MAX_QUEUE_SIZE) {
        this.log(`[BfsIndexer] ⚠️ Queue full (${MAX_QUEUE_SIZE}). Skipping remaining relatives.`);
        break;
      }
      const key = DependencyMapper.dedupKey(dep);
      if (!dedupSet.has(key)) {
        dedupSet.add(key);
        fetchQueue.push(DependencyMapper.toCrawlPlanItem(dep));
        count++;
      }
    }
    return count;
  }

  /** Compute SHA-256 checksum of rule JSON for dedup */
  private computeChecksum(rule: Record<string, unknown>): string {
    return crypto.createHash('sha256').update(JSON.stringify(rule)).digest('hex');
  }
}
