/**
 * SA4E-85 — ApprovalEventLog.
 * Appends approval events to a JSONL file for debug/audit trail.
 * Equivalent to open-design's per-run events.jsonl pattern.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

/** Shape of a single audit event written to the JSONL log */
export interface ApprovalEvent {
  id: number;
  event: 'request' | 'approve' | 'reject' | 'timeout' | 'dispose' | 'retry';
  toolCallId: string;
  timestamp: number;
  data?: Record<string, unknown>;
}

/** Configuration options for the event log */
export interface ApprovalEventLogOptions {
  /** Absolute path to JSONL file. If null, logging is disabled (no-op). */
  logFilePath: string | null;
}

/**
 * Append-only JSONL audit log for tool approval events.
 * Best-effort writes — failures are silently ignored to avoid
 * disrupting the approval flow.
 */
export class ApprovalEventLog {
  private nextId = 1;
  private readonly logFilePath: string | null;
  private closed = false;

  constructor(options: ApprovalEventLogOptions) {
    this.logFilePath = options.logFilePath;
    if (this.logFilePath) {
      this.ensureDirectory(this.logFilePath);
    }
  }

  /**
   * Append event to JSONL. Best-effort — failures are silently ignored.
   * @param event - Event data without id/timestamp (auto-assigned)
   */
  emit(event: Omit<ApprovalEvent, 'id' | 'timestamp'>): void {
    if (this.closed || !this.logFilePath) return;
    const full: ApprovalEvent = {
      ...event,
      id: this.nextId++,
      timestamp: Date.now(),
    };
    this.appendLine(full);
  }

  /**
   * Read all events from the log file (for diagnostics/test).
   * @returns Array of events, or empty array if file missing/unreadable
   */
  readAll(): ApprovalEvent[] {
    if (!this.logFilePath) return [];
    try {
      const content = fs.readFileSync(this.logFilePath, 'utf-8');
      return content
        .trim()
        .split('\n')
        .filter(Boolean)
        .map((line) => JSON.parse(line) as ApprovalEvent);
    } catch {
      return [];
    }
  }

  /** Close the log — prevent further writes after dispose */
  close(): void {
    this.closed = true;
  }

  // --- Private helpers ---

  /** Create parent directory if it doesn't exist */
  private ensureDirectory(filePath: string): void {
    try {
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
    } catch {
      // Best-effort — ignore if dir creation fails
    }
  }

  /** Append a single JSON line to the log file */
  private appendLine(event: ApprovalEvent): void {
    try {
      fs.appendFileSync(this.logFilePath!, JSON.stringify(event) + '\n');
    } catch {
      // Best-effort — silent on write failure
    }
  }
}
