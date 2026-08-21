/**
 * SA4E-183 — DiffTracker concrete implementation.
 * Session-scoped singleton that records file changes, manages eviction,
 * handles net-zero removal, and debounces badge updates to the webview.
 */

import type {
  IDiffTracker,
  ChangeEntry,
  DiffSummary,
  RecordChangeInput,
} from './IDiffTracker';
import type { IPostMessageBridge } from '../bridge/IPostMessageBridge';
import { isSensitiveFile, truncateDiff } from './diff-utils';

/** Maximum tracked files per session (BR-03) */
const MAX_ENTRIES = 100;

/** Badge postMessage debounce interval in ms (BR-06) */
const DEBOUNCE_MS = 100;

/** Redaction message for sensitive files */
const REDACTED_CONTENT = '[content redacted — sensitive file]';

/**
 * Concrete DiffTracker: in-memory Map-based storage with debounced badge.
 * Implements net-zero removal (added then deleted → remove entry).
 * Evicts oldest entries when MAX_ENTRIES exceeded.
 */
export class DiffTracker implements IDiffTracker {
  private readonly entries = new Map<string, ChangeEntry>();
  private readonly originals = new Map<string, string>();
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly bridge: IPostMessageBridge | null;
  private enabled: boolean;

  /**
   * @param bridge - PostMessage bridge for badge updates (nullable for testing)
   * @param enabled - Feature flag (sa4e183.diffTracker.enabled)
   */
  constructor(bridge: IPostMessageBridge | null, enabled = true) {
    this.bridge = bridge;
    this.enabled = enabled;
  }

  /** @inheritdoc */
  recordChange(input: RecordChangeInput): void {
    if (!this.enabled) return;
    if (!input.filePath) return;

    // Net-zero: added then deleted → remove entirely
    if (input.operation === 'deleted') {
      const existing = this.entries.get(input.filePath);
      if (existing?.operation === 'added') {
        this.entries.delete(input.filePath);
        this.originals.delete(input.filePath);
        this.scheduleBadgeUpdate();
        return;
      }
    }

    // Evict oldest if at capacity
    if (!this.entries.has(input.filePath) && this.entries.size >= MAX_ENTRIES) {
      this.evictOldest();
    }

    // Build and store entry
    const diffContent = isSensitiveFile(input.filePath)
      ? REDACTED_CONTENT
      : truncateDiff(input.diffContent);

    const entry: ChangeEntry = {
      filePath: input.filePath,
      operation: input.operation,
      linesAdded: input.linesAdded,
      linesRemoved: input.linesRemoved,
      diffContent,
      timestamp: Date.now(),
      originalContent: input.originalContent,
    };

    this.entries.set(input.filePath, entry);
    if (input.originalContent !== undefined) {
      this.originals.set(input.filePath, input.originalContent);
    }

    this.scheduleBadgeUpdate();
  }

  /** @inheritdoc */
  getSummary(): DiffSummary {
    const entries = Array.from(this.entries.values());
    let totalAdded = 0, totalModified = 0, totalDeleted = 0;
    let totalLinesAdded = 0, totalLinesRemoved = 0;

    for (const e of entries) {
      if (e.operation === 'added') totalAdded++;
      else if (e.operation === 'modified') totalModified++;
      else totalDeleted++;
      totalLinesAdded += e.linesAdded;
      totalLinesRemoved += e.linesRemoved;
    }

    return {
      totalFiles: entries.length,
      totalAdded,
      totalModified,
      totalDeleted,
      totalLinesAdded,
      totalLinesRemoved,
      entries,
    };
  }

  /** @inheritdoc */
  getFileCount(): number {
    return this.entries.size;
  }

  /** @inheritdoc */
  getOriginalContent(filePath: string): string | undefined {
    return this.originals.get(filePath);
  }

  /** @inheritdoc */
  clearSession(): void {
    this.entries.clear();
    this.originals.clear();
    this.scheduleBadgeUpdate();
  }

  /** @inheritdoc */
  dispose(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
  }

  /** Enable/disable at runtime (feature flag toggle) */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /** Debounced badge update — prevents UI flicker on rapid changes */
  private scheduleBadgeUpdate(): void {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      this.bridge?.postToWebview({
        type: 'DIFF_COUNT_UPDATED',
        count: this.entries.size,
      });
      this.debounceTimer = null;
    }, DEBOUNCE_MS);
  }

  /** Evict the oldest entry by timestamp to make room */
  private evictOldest(): void {
    let oldestKey: string | null = null;
    let oldestTs = Infinity;

    for (const [key, entry] of this.entries) {
      if (entry.timestamp < oldestTs) {
        oldestTs = entry.timestamp;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.entries.delete(oldestKey);
      this.originals.delete(oldestKey);
    }
  }
}
