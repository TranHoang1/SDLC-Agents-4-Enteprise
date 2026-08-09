/**
 * In-memory job store for async Pega ingest (SA4E-94).
 * Stores job state with auto-cleanup after 30 minutes.
 * Thread-safe for single-process Node.js — no external deps.
 */

import { randomUUID } from 'crypto';

/** Possible states for an ingest job */
export type JobStatus = 'processing' | 'done' | 'failed';

/** Progress tracking for a running job */
export interface JobProgress {
  processed: number;
  total: number;
}

/** Result payload when job completes successfully */
export interface JobResult {
  stored: number;
  totalRulesInDb: number;
  totalKbEntriesInDb: number;
  totalGraphNodesInDb: number;
  nextBatch: Array<{ insKey: string; pxObjClass: string; pyClassName: string; pyRuleName: string }>;
}

/** Full job record stored in memory */
export interface Job {
  id: string;
  status: JobStatus;
  progress: JobProgress;
  result: JobResult | null;
  error: string | null;
  createdAt: number;
}

/** Auto-expiry duration: 30 minutes in ms */
const JOB_TTL_MS = 30 * 60 * 1000;

/** Cleanup interval: run every 5 minutes */
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

/**
 * Singleton in-memory job store with TTL-based auto-cleanup.
 * Pattern: Repository — abstracts job data access from route logic.
 */
class PegaJobStore {
  private readonly jobs = new Map<string, Job>();
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.startCleanup();
  }

  /** Create a new job and return its ID */
  createJob(totalLines: number): string {
    const id = randomUUID();
    const job: Job = {
      id,
      status: 'processing',
      progress: { processed: 0, total: totalLines },
      result: null,
      error: null,
      createdAt: Date.now(),
    };
    this.jobs.set(id, job);
    return id;
  }

  /** Retrieve a job by ID (or undefined if expired/missing) */
  getJob(id: string): Job | undefined {
    return this.jobs.get(id);
  }

  /** Update progress counter for a processing job */
  updateProgress(id: string, processed: number): void {
    const job = this.jobs.get(id);
    if (job) job.progress.processed = processed;
  }

  /** Mark job as successfully completed with result */
  complete(id: string, result: JobResult): void {
    const job = this.jobs.get(id);
    if (job) {
      job.status = 'done';
      job.result = result;
    }
  }

  /** Mark job as failed with error message */
  fail(id: string, error: string): void {
    const job = this.jobs.get(id);
    if (job) {
      job.status = 'failed';
      job.error = error;
    }
  }

  /** Remove expired jobs (older than 30 min) */
  private cleanup(): void {
    const now = Date.now();
    for (const [id, job] of this.jobs) {
      if (now - job.createdAt > JOB_TTL_MS) {
        this.jobs.delete(id);
      }
    }
  }

  /** Start periodic cleanup timer */
  private startCleanup(): void {
    this.cleanupTimer = setInterval(() => this.cleanup(), CLEANUP_INTERVAL_MS);
    // Prevent timer from keeping process alive
    if (this.cleanupTimer.unref) this.cleanupTimer.unref();
  }

  /** Stop cleanup timer (for graceful shutdown in tests) */
  dispose(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }
}

/** Singleton instance — shared across all route handlers */
export const pegaJobStore = new PegaJobStore();
