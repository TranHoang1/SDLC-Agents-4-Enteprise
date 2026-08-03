/**
 * SA4E-85 — TelemetryService (Task 8.3).
 * Local-only JSONL append logger. Privacy-first: no network calls.
 * Buffers entries in memory and flushes to .code-intel/telemetry.jsonl.
 * Async write with buffer flush on dispose (BR-20).
 */

import * as fs from 'fs';
import * as path from 'path';
import type { ITelemetryService, TelemetryEntry } from './types';

/** Default buffer size before auto-flush */
const BUFFER_FLUSH_SIZE = 10;

/** Default flush interval in milliseconds (5 seconds) */
const FLUSH_INTERVAL_MS = 5_000;

/**
 * TelemetryService — appends JSONL entries to local file.
 * No network calls — all data stays on disk.
 * @implements ITelemetryService
 */
export class TelemetryService implements ITelemetryService {
  private buffer: TelemetryEntry[] = [];
  private readonly filePath: string;
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private flushing = false;

  /**
   * @param workspaceRoot - Workspace root directory path
   */
  constructor(workspaceRoot: string) {
    this.filePath = path.join(workspaceRoot, '.code-intel', 'telemetry.jsonl');
    this.startFlushTimer();
  }

  /** Log a telemetry entry (buffered, fire-and-forget) */
  log(entry: TelemetryEntry): void {
    this.buffer.push(entry);
    if (this.buffer.length >= BUFFER_FLUSH_SIZE) {
      void this.flush();
    }
  }

  /** Flush buffered entries to disk */
  async flush(): Promise<void> {
    if (this.flushing || this.buffer.length === 0) return;
    this.flushing = true;

    const entries = this.buffer.splice(0);
    const lines = entries
      .map((e) => JSON.stringify(e))
      .join('\n') + '\n';

    try {
      await this.ensureDirectory();
      await this.appendToFile(lines);
    } catch {
      // Re-add entries on write failure for next attempt
      this.buffer.unshift(...entries);
    } finally {
      this.flushing = false;
    }
  }

  /** Dispose: flush remaining entries and stop timer */
  async dispose(): Promise<void> {
    this.stopFlushTimer();
    await this.flush();
  }

  /** Ensure .code-intel directory exists */
  private async ensureDirectory(): Promise<void> {
    const dir = path.dirname(this.filePath);
    await fs.promises.mkdir(dir, { recursive: true });
  }

  /** Append JSONL lines to telemetry file */
  private async appendToFile(data: string): Promise<void> {
    await fs.promises.appendFile(this.filePath, data, 'utf-8');
  }

  /** Start periodic flush timer */
  private startFlushTimer(): void {
    this.flushTimer = setInterval(() => {
      void this.flush();
    }, FLUSH_INTERVAL_MS);
  }

  /** Stop periodic flush timer */
  private stopFlushTimer(): void {
    if (this.flushTimer !== null) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
  }
}
