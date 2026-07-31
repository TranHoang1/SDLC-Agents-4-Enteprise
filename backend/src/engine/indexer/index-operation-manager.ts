/**
 * SA4E-78 — IndexOperationManager (SRP: operation lifecycle tracking).
 * Manages active index operations with AbortControllers and progress state.
 * Separated from IndexingEngine so engine focuses on indexing logic only.
 */

import { randomUUID } from 'crypto';
import type { IndexingEngine } from './indexing-engine.js';
import type { IndexScope } from './index-scope.js';
import type { ProgressPhase, OperationStatus, ProgressEvent } from './types.js';

/** Tracks a single active index operation. */
export interface IndexOperation {
  operationId: string;
  projectId: string;
  status: OperationStatus;
  phase: ProgressPhase;
  current: number;
  total: number;
  startedAt: Date;
  abortController: AbortController;
  error?: string;
}

/** Auto-cleanup delay after operation completes (ms). */
const CLEANUP_DELAY_MS = 60_000;

/**
 * Manages index operation lifecycle: start, cancel, progress tracking.
 * One operation per projectId at a time — enforced by internal Map.
 */
export class IndexOperationManager {
  private operations = new Map<string, IndexOperation>();

  constructor(private readonly engine: IndexingEngine) {}

  /**
   * Start a new full index operation for the given project.
   * @param projectId - Tenant identifier
   * @param scope - Workspace scope for the index run
   * @returns The created operation, or null if already running (409)
   */
  startOperation(projectId: string, scope: IndexScope): IndexOperation | null {
    if (this.operations.has(projectId)) return null;

    const op: IndexOperation = {
      operationId: `idx-${randomUUID().slice(0, 8)}`,
      projectId,
      status: 'running',
      phase: 'scanning',
      current: 0,
      total: 0,
      startedAt: new Date(),
      abortController: new AbortController(),
    };
    this.operations.set(projectId, op);

    // Fire-and-forget: engine runs in background
    this.engine.runFullIndex(scope, op.abortController.signal)
      .then(() => { op.status = 'completed'; op.phase = 'complete'; })
      .catch((err: unknown) => {
        op.status = 'failed';
        op.phase = 'error';
        op.error = String(err);
      })
      .finally(() => {
        setTimeout(() => this.operations.delete(projectId), CLEANUP_DELAY_MS);
      });

    return op;
  }

  /**
   * Cancel a running index operation via AbortSignal.
   * @param projectId - Tenant identifier
   * @returns The cancelled operation, or null if not found/not running (404)
   */
  cancelOperation(projectId: string): IndexOperation | null {
    const op = this.operations.get(projectId);
    if (!op || op.status !== 'running') return null;
    op.abortController.abort();
    op.status = 'cancelled';
    op.phase = 'cancelled';
    return op;
  }

  /**
   * Get current progress snapshot for a project.
   * @param projectId - Tenant identifier
   * @returns Progress event (idle if no active operation)
   */
  getProgress(projectId: string): ProgressEvent {
    const op = this.operations.get(projectId);
    if (!op) {
      return {
        operationId: '', phase: 'idle',
        current: 0, total: 0, percentage: 0,
        startedAt: '', elapsedMs: 0,
      };
    }
    const elapsed = Date.now() - op.startedAt.getTime();
    const pct = op.total > 0 ? Math.round((op.current / op.total) * 100) : 0;
    return {
      operationId: op.operationId,
      phase: op.phase,
      current: op.current,
      total: op.total,
      percentage: pct,
      startedAt: op.startedAt.toISOString(),
      elapsedMs: elapsed,
    };
  }

  /** Check if a project has an active running operation. */
  isRunning(projectId: string): boolean {
    return this.operations.get(projectId)?.status === 'running';
  }

  /**
   * Called by IndexingEngine to update progress state at batch boundaries.
   * @param projectId - Tenant identifier
   * @param phase - Current phase
   * @param current - Files processed so far
   * @param total - Total files to process
   */
  updateProgress(
    projectId: string, phase: ProgressPhase,
    current: number, total: number,
  ): void {
    const op = this.operations.get(projectId);
    if (op) {
      op.phase = phase;
      op.current = current;
      op.total = total;
    }
  }
}
