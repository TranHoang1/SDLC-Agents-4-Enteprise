/**
 * TaskWorker — SA4E-44 / SA4E-47
 * Background polling worker for pending tasks.
 * Non-blocking start, exponential backoff, graceful shutdown.
 * Supports context chain + structured_map persistence.
 */

import type { Logger } from 'pino';
import type { DatabaseAdapter } from '../../../database/adapters/DatabaseAdapter.js';
import type { TagAnalyzerService, TagAnalysisResult } from '../llm/analyzer.js';
import type { EmbeddingService } from '../../../engine/parsers/embedding/EmbeddingService.js';
import { PendingTaskRepository } from './PendingTaskRepository.js';
import { TaskType } from './models.js';
import type { PendingTask } from './models.js';
import type { TaskWorkerConfig } from './TaskWorkerConfig.js';
import { DEFAULT_TASK_WORKER_CONFIG } from './TaskWorkerConfig.js';
import type { MemoryEngine } from '../engine/index.js';
import type { ContextChainInput, StructuredMapData } from '../llm/types.js';
import { safeParseStructuredMap } from '../llm/types.js';
import type { CodeEnrichmentHandler } from '../../../engine/enrichment/CodeEnrichmentHandler.js';

export interface TaskWorkerStats {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  isRunning: boolean;
  lastPollAt: string | null;
}

export class TaskWorker {
  private readonly repo: PendingTaskRepository;
  private readonly config: TaskWorkerConfig;
  private readonly logger: Logger;
  private readonly engine: MemoryEngine;
  private tagAnalyzer?: TagAnalyzerService;
  private embeddingService?: EmbeddingService;
  private llmService?: { getConfig(): { model: string } };
  private running = false;
  private pollTimer: ReturnType<typeof setTimeout> | null = null;
  private consecutiveEmpty = 0;
  private lastPollAt: string | null = null;
  private processing = false;
  private shutdownResolve: (() => void) | null = null;
  /** SA4E-101: Track current processing task for status bar progress. */
  private currentTaskInfo: { file: string; type: string; current: number; total: number } | null = null;
  /** SA4E-155: Adaptive concurrency — reduces on LLM errors, recovers on success. */
  private activeConcurrency: number = 0;
  private consecutiveErrors = 0;

  constructor(
    db: DatabaseAdapter,
    engine: MemoryEngine,
    logger: Logger,
    config?: Partial<TaskWorkerConfig>,
  ) {
    this.repo = new PendingTaskRepository(db);
    this.engine = engine;
    this.logger = logger.child({ component: 'TaskWorker' });
    this.config = { ...DEFAULT_TASK_WORKER_CONFIG, ...config };
  }

  setTagAnalyzer(analyzer: TagAnalyzerService): void { this.tagAnalyzer = analyzer; }
  setEmbeddingService(service: EmbeddingService): void { this.embeddingService = service; }
  setLlmService(service: { getConfig(): { model: string } }): void { this.llmService = service; }
  /** SA4E-107: Inject code enrichment handler for CODE_ENRICHMENT tasks. */
  private codeEnrichmentHandler?: CodeEnrichmentHandler;
  setCodeEnrichmentHandler(handler: CodeEnrichmentHandler): void { this.codeEnrichmentHandler = handler; }

  /**
   * Update mutable config fields at runtime — no restart needed.
   * Called when admin changes taskWorker config via Admin UI.
   * Supported keys: concurrency (1-8), baseInterval, maxInterval.
   */
  updateConfig(patch: Partial<Pick<TaskWorkerConfig, 'concurrency' | 'baseInterval' | 'maxInterval'>>): void {
    if (patch.concurrency !== undefined) {
      (this.config as any).concurrency = Math.max(1, Math.min(patch.concurrency, 8));
    }
    if (patch.baseInterval !== undefined) (this.config as any).baseInterval = patch.baseInterval;
    if (patch.maxInterval !== undefined) (this.config as any).maxInterval = patch.maxInterval;
    this.logger.info(
      { concurrency: this.config.concurrency, baseInterval: this.config.baseInterval },
      '[TaskWorker] Config updated live',
    );
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.logger.info('TaskWorker started');
    // On startup: reset any PROCESSING tasks from previous run (crash/restart recovery)
    this.resetProcessingOnStartup().catch(err =>
      this.logger.warn({ err }, 'TaskWorker: startup reset failed (non-fatal)'),
    );
    // Delay first poll by 6s to allow LLM health check + tagAnalyzer init to complete.
    // LLMInitializer is fire-and-forget async (5s timeout) — 6s ensures it's ready.
    this.schedulePoll(6000);
  }

  stop(): Promise<void> {
    if (!this.running) return Promise.resolve();
    this.running = false;
    if (this.pollTimer) { clearTimeout(this.pollTimer); this.pollTimer = null; }
    if (!this.processing) { this.logger.info('TaskWorker stopped'); return Promise.resolve(); }
    return new Promise<void>(resolve => { this.shutdownResolve = resolve; });
  }

  /**
   * Reset ALL tasks stuck in PROCESSING to PENDING on startup.
   * Called once at start() — handles server restart/crash recovery immediately,
   * no need to wait for staleThreshold timeout.
   */
  async resetProcessingOnStartup(): Promise<number> {
    const result = await this.repo.resetAllProcessing();
    if (result > 0) this.logger.info({ reset: result }, 'TaskWorker: reset stuck PROCESSING tasks on startup');
    return result;
  }

  async recoverStaleTasks(): Promise<number> {
    const recovered = await this.repo.recoverStaleTasks(this.config.staleThreshold);
    if (recovered > 0) this.logger.info({ recovered }, 'Recovered stale tasks');
    return recovered;
  }

  async getStats(): Promise<TaskWorkerStats> {
    const dbStats = await this.repo.getStats();
    return { ...dbStats, isRunning: this.running, lastPollAt: this.lastPollAt };
  }

  /** SA4E-101: Get current task progress for status bar display. */
  async getProgress(): Promise<{ phase: string; file: string; current: number; total: number; percent: number } | null> {
    if (!this.processing || !this.currentTaskInfo) return null;
    const stats = await this.repo.getStats();
    const total = stats.pending + stats.processing + stats.completed;
    const current = stats.completed;
    const percent = total > 0 ? Math.round((current / total) * 100) : 0;
    return {
      phase: this.currentTaskInfo.type,
      file: this.currentTaskInfo.file,
      current,
      total,
      percent,
    };
  }

  getRepository(): PendingTaskRepository { return this.repo; }

  // ── Private ──

  private schedulePoll(delayMs: number): void {
    if (!this.running) return;
    this.pollTimer = setTimeout(() => this.poll(), delayMs);
  }

  private async poll(): Promise<void> {
    if (!this.running) { this.finishShutdown(); return; }
    this.lastPollAt = new Date().toISOString();
    try {
      // SA4E-155: Adaptive concurrency — use activeConcurrency (adjusted by LLM error rate)
      const maxConcurrency = this.config.concurrency ?? 1;
      if (this.activeConcurrency === 0) this.activeConcurrency = maxConcurrency;
      const claimCount = this.activeConcurrency;
      const tasks = await this.repo.claimBatch(claimCount);
      if (tasks.length === 0) {
        this.consecutiveEmpty++;
        if (this.consecutiveEmpty <= 3 || this.consecutiveEmpty % 10 === 0) {
          this.logger.info({ consecutiveEmpty: this.consecutiveEmpty, claimCount },
            '[TaskWorker] poll: no tasks claimed');
        }
        const delay = Math.min(
          this.config.baseInterval * Math.pow(2, this.consecutiveEmpty),
          this.config.maxInterval);
        this.schedulePoll(delay);
        return;
      }
      this.logger.info({ claimed: tasks.length, taskIds: tasks.map(t => t.id).slice(0, 3) },
        '[TaskWorker] poll: claimed tasks');
      this.consecutiveEmpty = 0;
      this.processing = true;
      // Run all claimed tasks concurrently
      const errorsBefore = this.consecutiveErrors;
      await Promise.allSettled(tasks.map(task => this.processTask(task)));
      // SA4E-155: processTask catches errors internally (marks task FAILED).
      // Detect failures by checking if consecutiveErrors was incremented during processing.
      const errorsThisCycle = this.consecutiveErrors - errorsBefore;
      if (errorsThisCycle > 0) {
        // Halve concurrency on errors, minimum 1
        this.activeConcurrency = Math.max(1, Math.floor(this.activeConcurrency / 2));
        this.logger.warn({ failures: errorsThisCycle, activeConcurrency: this.activeConcurrency, component: 'TaskWorker' },
          'LLM errors detected — reducing concurrency');
      } else {
        this.consecutiveErrors = 0;
        // Recover: increment towards max (slow ramp-up)
        if (this.activeConcurrency < maxConcurrency) {
          this.activeConcurrency = Math.min(maxConcurrency, this.activeConcurrency + 1);
        }
      }
      this.processing = false;
      if (!this.running) { this.finishShutdown(); return; }
      // Backoff delay if errors persist
      const delay = this.consecutiveErrors >= 3
        ? this.config.baseInterval * 3
        : this.config.baseInterval;
      this.schedulePoll(delay);
    } catch (err) {
      this.processing = false;
      this.logger.error({ err }, 'Poll cycle error');
      this.activeConcurrency = 1;
      this.schedulePoll(this.config.baseInterval * 2);
    }
  }

  private finishShutdown(): void {
    this.logger.info('TaskWorker stopped');
    this.shutdownResolve?.();
    this.shutdownResolve = null;
  }

  private async processTask(task: PendingTask): Promise<void> {
    try {
      // SA4E-107: CODE_ENRICHMENT uses symbols table, not knowledge_entries
      if (task.task_type === TaskType.CODE_ENRICHMENT) {
        this.currentTaskInfo = { file: `symbol-${task.entry_id}`, type: task.task_type, current: 0, total: 0 };
        await this.processCodeEnrichment(task);
        return;
      }
      const entry = await this.engine.findById(task.entry_id);
      if (!entry) { await this.repo.markFailed(task.id, 'entry_not_found'); return; }
      let payload: any;
      try { payload = JSON.parse(task.payload); }
      catch { this.repo.markFailed(task.id, 'invalid_json_payload'); return; }
      // SA4E-101: Track current task for progress reporting
      const file = (entry as any).source || `entry-${task.entry_id}`;
      this.currentTaskInfo = { file, type: task.task_type, current: 0, total: 0 };
      switch (task.task_type) {
        case TaskType.TAG_ENRICHMENT:
          await this.processTagEnrichment(task, payload);
          break;
        case TaskType.VECTOR_EMBEDDING:
          await this.processVectorEmbedding(task, payload);
          break;
        default:
          await this.repo.markFailed(task.id, `unknown_task_type: ${task.task_type}`);
      }
    } catch (err: any) { await this.handleTaskError(task, err); }
  }

  // ── SA4E-47: Enhanced Tag Enrichment ──

  private async processTagEnrichment(task: PendingTask, payload: any): Promise<void> {
    if (!this.tagAnalyzer) { this.repo.resetForRetry(task.id); return; }

    // SA4E-79: Check if already enriched by client (BR-12, BR-13)
    const entry = await this.engine.findById(task.entry_id);
    if (!entry) { await this.repo.markFailed(task.id, 'entry_not_found'); return; }
    if ((entry as any).enrichment_status === 'done') {
      this.logger.info({ entry_id: task.entry_id }, 'Skipping TAG_ENRICHMENT — already enriched');
      await this.repo.markCompleted(task.id);
      return;
    }

    const context = this.config.enableContextChain
      ? await this.loadPreviousContext(task.entry_id, payload.source)
      : null;

    if (context) {
      this.logger.debug({ entry_id: task.entry_id, prev_section_id: context.previous_section_id,
        component: 'TaskWorker' }, 'Context chain applied');
    }

    const result = await this.tagAnalyzer.analyzeTags(payload.content, payload.options, context);

    // SA4E-155: Quality gate — if LLM failed (fallback used), ALWAYS mark failed.
    // LLM must succeed for enrichment to be considered done.
    if (result.fallbackUsed) {
      this.consecutiveErrors++;
      const reason = result.fallbackReason || 'unknown';
      const errorMsg = `llm_enrichment_failed: ${reason}`;
      this.logger.warn({ entry_id: task.entry_id, task_id: task.id, reason, component: 'TaskWorker' },
        'LLM enrichment failed — marking task FAILED (not done)');
      await this.repo.markFailed(task.id, errorMsg);
      // Write error details into structured_map so it's queryable/visible in Admin UI
      const errorMap = JSON.stringify({
        error: errorMsg,
        error_at: new Date().toISOString(),
        task_id: task.id,
        retry_count: task.retry_count,
        fallback_used: true,
        extraction_meta: {
          model: this.llmService?.getConfig()?.model || 'unknown',
          timestamp: new Date().toISOString(),
          fallback_used: true,
          error: reason,
        },
      });
      await this.engine.getAdapter().runAsync(
        `UPDATE knowledge_entries SET enrichment_status = 'failed', structured_map = ? WHERE id = ? AND enrichment_status = 'pending'`,
        [errorMap, task.entry_id],
      );
      return;
    }

    // TA-08: Re-check status after LLM call — client may have enriched during processing
    const currentEntry = await this.engine.findById(task.entry_id);
    if (!currentEntry || (currentEntry as any).enrichment_status === 'done') {
      this.logger.info({ entry_id: task.entry_id }, 'Client enriched during LLM processing — discarding result');
      await this.repo.markCompleted(task.id);
      return;
    }

    if (result.appliedTags.length > 0) {
      const existing = payload.existing_tags
        ? payload.existing_tags.split(',').map((t: string) => t.trim()).filter(Boolean)
        : [];
      const merged = [...new Set([...existing, ...result.appliedTags])];
      // NEW-03: Conditional update — only apply if still pending (race guard)
      await this.engine.getAdapter().runAsync(
        `UPDATE knowledge_entries SET tags = ? WHERE id = ? AND enrichment_status = 'pending'`,
        [merged.join(','), task.entry_id],
      );
    }

    // NEW-03: Conditional structured_map update — only if still pending
    await this.updateEntryStructuredMapConditional(task.entry_id, result, context);

    // SA4E-79: Mark entry as enriched by backend LLM (atomic — changes=0 if client won)
    const now = new Date().toISOString();
    const updateResult = await this.engine.getAdapter().runAsync(
      `UPDATE knowledge_entries
       SET enrichment_status = 'done', enriched_by = 'backend_llm', enriched_at = ?
       WHERE id = ? AND enrichment_status = 'pending'`,
      [now, task.entry_id],
    );

    if (updateResult.changes === 0) {
      this.logger.info({ entry_id: task.entry_id }, 'Client enriched during tag/map update — discarding');
    }

    // SA4E-165: Always mark task completed — entry sync is best-effort above
    await this.repo.markCompleted(task.id);
  }

  private async loadPreviousContext(
    entryId: number,
    source: string | null,
  ): Promise<ContextChainInput | null> {
    if (!source) return null;
    try {
      const prevEntry = await this.engine.getAdapter().getAsync<{ id: number; structured_map: string | null }>(
        'SELECT id, structured_map FROM knowledge_entries WHERE source = ? AND id < ? ORDER BY id DESC LIMIT 1',
        [source, entryId],
      );
      if (!prevEntry) {
        this.logger.debug({ entry_id: entryId, component: 'TaskWorker' },
          'No previous section found');
        return null;
      }
      const map = safeParseStructuredMap(prevEntry.structured_map);
      if (!map.summary && (!map.business_entities || map.business_entities.length === 0)) {
        this.logger.debug({ entry_id: entryId, component: 'TaskWorker' },
          'Previous section has no extractable data');
        return null;
      }
      return {
        previous_section_id: prevEntry.id,
        summary: (map.summary || '').slice(0, this.config.contextChainMaxLength),
        business_entities: (map.business_entities || []).slice(0, 5),
        actors: (map.actors || []).slice(0, 5),
        business_rules: (map.business_rules || []).slice(0, 10),
      };
    } catch (err) {
      this.logger.warn({ entry_id: entryId, err, component: 'TaskWorker' },
        'Failed to load previous context');
      return null;
    }
  }

  private async updateEntryStructuredMap(
    entryId: number,
    result: TagAnalysisResult,
    context?: ContextChainInput | null,
  ): Promise<void> {
    try {
      const entry = await this.engine.findById(entryId);
      if (!entry) return;
      const existing = safeParseStructuredMap(entry.structured_map);
      const structuredMap: StructuredMapData = {
        tags: result.appliedTags,
        summary: result.summary || existing.summary || '',
        business_entities: result.business_entities || [],
        actors: result.actors || [],
        business_rules: result.business_rules || [],
        fileCreatedAt: existing.fileCreatedAt,
        fileAuthor: existing.fileAuthor,
        fileVersion: existing.fileVersion,
        context_chain: context ? {
          previous_section_id: context.previous_section_id,
          previous_summary: context.summary,
        } : undefined,
        extraction_meta: {
          model: this.llmService?.getConfig()?.model || 'unknown',
          timestamp: new Date().toISOString(),
          fallback_used: result.fallbackUsed,
          context_chain_enabled: this.config.enableContextChain,
        },
      };
      let jsonStr = JSON.stringify(structuredMap);
      if (jsonStr.length > (this.config.structuredMapMaxSize ?? 102400)) {
        structuredMap.business_rules = (structuredMap.business_rules || []).slice(0, 5);
        structuredMap.actors = (structuredMap.actors || []).slice(0, 3);
        this.logger.warn({ entry_id: entryId, size: jsonStr.length, component: 'TaskWorker' },
          'structured_map truncated due to size limit');
        jsonStr = JSON.stringify(structuredMap);
      }
      await this.engine.updateStructuredMap(entryId, jsonStr);
    } catch (err) {
      this.logger.warn({ entry_id: entryId, err, component: 'TaskWorker' },
        'structured_map update failed');
    }
  }

  /** NEW-03: Conditional structured_map update — only applies if entry still pending. */
  private async updateEntryStructuredMapConditional(
    entryId: number,
    result: TagAnalysisResult,
    context?: ContextChainInput | null,
  ): Promise<void> {
    try {
      const entry = await this.engine.findById(entryId);
      if (!entry) return;
      if ((entry as any).enrichment_status === 'done') return;
      const existing = safeParseStructuredMap(entry.structured_map);
      const structuredMap: StructuredMapData = {
        tags: result.appliedTags,
        summary: result.summary || existing.summary || '',
        business_entities: result.business_entities || [],
        actors: result.actors || [],
        business_rules: result.business_rules || [],
        fileCreatedAt: existing.fileCreatedAt,
        fileAuthor: existing.fileAuthor,
        fileVersion: existing.fileVersion,
        context_chain: context ? {
          previous_section_id: context.previous_section_id,
          previous_summary: context.summary,
        } : undefined,
        extraction_meta: {
          model: this.llmService?.getConfig()?.model || 'unknown',
          timestamp: new Date().toISOString(),
          fallback_used: result.fallbackUsed,
          context_chain_enabled: this.config.enableContextChain,
        },
      };
      let jsonStr = JSON.stringify(structuredMap);
      if (jsonStr.length > (this.config.structuredMapMaxSize ?? 102400)) {
        structuredMap.business_rules = (structuredMap.business_rules || []).slice(0, 5);
        structuredMap.actors = (structuredMap.actors || []).slice(0, 3);
        jsonStr = JSON.stringify(structuredMap);
      }
      await this.engine.getAdapter().runAsync(
        `UPDATE knowledge_entries SET structured_map = ? WHERE id = ? AND enrichment_status = 'pending'`,
        [jsonStr, entryId],
      );
    } catch (err) {
      this.logger.warn({ entry_id: entryId, err, component: 'TaskWorker' },
        'structured_map conditional update failed');
    }
  }

  /** SA4E-107: Process CODE_ENRICHMENT task via injected handler. */
  private async processCodeEnrichment(task: PendingTask): Promise<void> {
    if (!this.codeEnrichmentHandler) { this.repo.resetForRetry(task.id); return; }
    await this.codeEnrichmentHandler.enrichSymbol(task);
    await this.repo.markCompleted(task.id);
  }

  private async processVectorEmbedding(task: PendingTask, payload: any): Promise<void> {
    if (!this.embeddingService) { this.repo.resetForRetry(task.id); return; }
    const vector = await this.embeddingService.generateEmbedding(payload.text);
    const buf = Buffer.from(new Float32Array(vector).buffer);
    await this.engine.getAdapter().runAsync(
      'UPDATE knowledge_entries SET vector = ? WHERE id = ?',
      [buf, task.entry_id],
    );
    await this.repo.markCompleted(task.id);
  }

  private async handleTaskError(task: PendingTask, err: Error): Promise<void> {
    this.consecutiveErrors++;
    const nonRetryable = err.message.includes('invalid_json')
      || err.message.includes('entry_not_found');
    if (nonRetryable || task.retry_count + 1 >= task.max_retries) {
      await this.repo.markFailed(task.id, err.message);
    } else {
      await this.repo.markFailed(task.id, err.message);
      await this.repo.resetForRetry(task.id);
    }
  }
}

