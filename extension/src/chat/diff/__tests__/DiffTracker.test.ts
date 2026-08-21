/**
 * SA4E-183 — DiffTracker unit tests.
 * Tests: record, merge, evict, clear, debounce, net-zero, sensitive files.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DiffTracker } from '../DiffTracker';
import type { RecordChangeInput } from '../IDiffTracker';

describe('DiffTracker', () => {
  let tracker: DiffTracker;
  let mockBridge: { postToWebview: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.useFakeTimers();
    mockBridge = { postToWebview: vi.fn() };
    tracker = new DiffTracker(mockBridge as any, true);
  });

  afterEach(() => {
    tracker.dispose();
    vi.useRealTimers();
  });

  function makeInput(overrides: Partial<RecordChangeInput> = {}): RecordChangeInput {
    return {
      filePath: 'src/main.ts',
      operation: 'modified',
      linesAdded: 5,
      linesRemoved: 2,
      diffContent: '+added\n-removed',
      ...overrides,
    };
  }

  it('records a change and updates file count', () => {
    tracker.recordChange(makeInput());
    expect(tracker.getFileCount()).toBe(1);
  });

  it('ignores empty filePath', () => {
    tracker.recordChange(makeInput({ filePath: '' }));
    expect(tracker.getFileCount()).toBe(0);
  });

  it('merges changes to the same file (last write wins)', () => {
    tracker.recordChange(makeInput({ linesAdded: 3 }));
    tracker.recordChange(makeInput({ linesAdded: 10 }));
    expect(tracker.getFileCount()).toBe(1);
    const summary = tracker.getSummary();
    expect(summary.entries[0].linesAdded).toBe(10);
  });

  it('returns correct summary aggregation', () => {
    tracker.recordChange(makeInput({ filePath: 'a.ts', operation: 'added', linesAdded: 5, linesRemoved: 0 }));
    tracker.recordChange(makeInput({ filePath: 'b.ts', operation: 'modified', linesAdded: 3, linesRemoved: 1 }));
    tracker.recordChange(makeInput({ filePath: 'c.ts', operation: 'deleted', linesAdded: 0, linesRemoved: 10 }));

    const summary = tracker.getSummary();
    expect(summary.totalFiles).toBe(3);
    expect(summary.totalAdded).toBe(1);
    expect(summary.totalModified).toBe(1);
    expect(summary.totalDeleted).toBe(1);
    expect(summary.totalLinesAdded).toBe(8);
    expect(summary.totalLinesRemoved).toBe(11);
  });

  it('evicts oldest entry when exceeding 100 files', () => {
    for (let i = 0; i < 100; i++) {
      tracker.recordChange(makeInput({ filePath: `file-${i}.ts` }));
      vi.advanceTimersByTime(1); // ensure different timestamps
    }
    expect(tracker.getFileCount()).toBe(100);

    // Adding the 101st should evict file-0.ts
    tracker.recordChange(makeInput({ filePath: 'file-new.ts' }));
    expect(tracker.getFileCount()).toBe(100);
    expect(tracker.getOriginalContent('file-0.ts')).toBeUndefined();
  });

  it('net-zero: added then deleted removes entry entirely', () => {
    tracker.recordChange(makeInput({ filePath: 'temp.ts', operation: 'added' }));
    expect(tracker.getFileCount()).toBe(1);
    tracker.recordChange(makeInput({ filePath: 'temp.ts', operation: 'deleted' }));
    expect(tracker.getFileCount()).toBe(0);
  });

  it('clearSession removes all entries', () => {
    tracker.recordChange(makeInput({ filePath: 'a.ts' }));
    tracker.recordChange(makeInput({ filePath: 'b.ts' }));
    tracker.clearSession();
    expect(tracker.getFileCount()).toBe(0);
    expect(tracker.getSummary().totalFiles).toBe(0);
  });

  it('debounces badge update with 100ms delay', () => {
    tracker.recordChange(makeInput({ filePath: 'a.ts' }));
    tracker.recordChange(makeInput({ filePath: 'b.ts' }));
    tracker.recordChange(makeInput({ filePath: 'c.ts' }));

    // No postMessage yet (within debounce window)
    expect(mockBridge.postToWebview).not.toHaveBeenCalled();

    // After 100ms, single badge update fires
    vi.advanceTimersByTime(100);
    expect(mockBridge.postToWebview).toHaveBeenCalledTimes(1);
    expect(mockBridge.postToWebview).toHaveBeenCalledWith({
      type: 'DIFF_COUNT_UPDATED',
      count: 3,
    });
  });

  it('does nothing when disabled', () => {
    const disabledTracker = new DiffTracker(mockBridge as any, false);
    disabledTracker.recordChange(makeInput());
    expect(disabledTracker.getFileCount()).toBe(0);
    disabledTracker.dispose();
  });

  it('stores and retrieves originalContent', () => {
    tracker.recordChange(makeInput({ originalContent: 'const x = 1;' }));
    expect(tracker.getOriginalContent('src/main.ts')).toBe('const x = 1;');
  });

  it('redacts sensitive file diff content', () => {
    tracker.recordChange(makeInput({ filePath: '.env.local', diffContent: 'SECRET=abc123' }));
    const entry = tracker.getSummary().entries[0];
    expect(entry.diffContent).toBe('[content redacted — sensitive file]');
  });

  it('truncates diff content exceeding 2MB', () => {
    const largeDiff = 'x'.repeat(3 * 1024 * 1024);
    tracker.recordChange(makeInput({ diffContent: largeDiff }));
    const entry = tracker.getSummary().entries[0];
    expect(entry.diffContent.length).toBeLessThan(largeDiff.length);
    expect(entry.diffContent).toContain('[diff truncated');
  });
});
