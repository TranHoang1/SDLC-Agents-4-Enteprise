/**
 * SA4E-183 — DiffTracker Svelte Store.
 * Reactive state for file change tracking in the webview.
 * Updated via DIFF_COUNT_UPDATED and DIFF_SUMMARY_RESPONSE messages.
 */

import { writable, derived } from 'svelte/store';
import type { DiffSummaryPayload, ChangeEntryPayload } from '../../chat/diff/IDiffTracker';

/** Internal state shape for the diff tracker store */
interface DiffTrackerState {
  fileCount: number;
  summary: DiffSummaryPayload | null;
  isExpanded: boolean;
}

const initialState: DiffTrackerState = {
  fileCount: 0,
  summary: null,
  isExpanded: false,
};

/** Core writable store for diff tracker state */
export const diffTrackerState = writable<DiffTrackerState>(initialState);

/** Derived: current file change count for badge display */
export const diffFileCount = derived(diffTrackerState, ($s) => $s.fileCount);

/** Derived: full summary payload when available */
export const diffSummary = derived(diffTrackerState, ($s) => $s.summary);

/** Derived: whether the summary panel is expanded */
export const isDiffExpanded = derived(diffTrackerState, ($s) => $s.isExpanded);

/** Update file count from DIFF_COUNT_UPDATED message */
export function updateDiffCount(count: number): void {
  diffTrackerState.update((s) => ({ ...s, fileCount: count }));
}

/** Set summary from DIFF_SUMMARY_RESPONSE message */
export function setDiffSummary(summary: DiffSummaryPayload): void {
  diffTrackerState.update((s) => ({ ...s, summary, isExpanded: true }));
}

/** Toggle the summary panel expanded state */
export function toggleDiffPanel(): void {
  diffTrackerState.update((s) => ({ ...s, isExpanded: !s.isExpanded }));
}

/** Reset diff tracker state (on session change) */
export function resetDiffTracker(): void {
  diffTrackerState.set(initialState);
}

// Re-export payload types for Svelte component consumption
export type { DiffSummaryPayload, ChangeEntryPayload };
