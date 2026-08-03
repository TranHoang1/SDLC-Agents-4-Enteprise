/**
 * SA4E-85 — Context Store.
 * Tracks token usage, context window files, and prune suggestions.
 * Derives usage percentage for UI progress indicators.
 */

import { writable, derived } from 'svelte/store';
import type { ContextFile } from '../../chat/types';

/** Suggestion to prune a file from context to free tokens */
export interface PruneSuggestion {
  filePath: string;
  tokensSaved: number;
  reason: string;
}

/** Internal state for context window tracking */
interface ContextState {
  tokenCount: number;
  maxTokens: number;
  files: ContextFile[];
  pruneSuggestions: PruneSuggestion[];
}

const initialState: ContextState = {
  tokenCount: 0,
  maxTokens: 128000,
  files: [],
  pruneSuggestions: [],
};

/** Core writable store for context state */
export const contextState = writable<ContextState>(initialState);

/** Derived: usage percentage (0-100) */
export const usagePercent = derived(contextState, ($s) =>
  $s.maxTokens > 0 ? Math.round(($s.tokenCount / $s.maxTokens) * 100) : 0
);

/** Derived: context files list */
export const contextFiles = derived(contextState, ($s) => $s.files);

/** Derived: token count */
export const tokenCount = derived(contextState, ($s) => $s.tokenCount);

/** Derived: prune suggestions */
export const pruneSuggestions = derived(contextState, ($s) => $s.pruneSuggestions);

/** Update context from Extension Host CONTEXT_UPDATE message */
export function updateContext(
  tokenCount: number,
  maxTokens: number,
  files: ContextFile[]
): void {
  contextState.update((s) => ({
    ...s,
    tokenCount,
    maxTokens,
    files,
  }));
}

/** Set prune suggestions (computed by Extension Host) */
export function setPruneSuggestions(suggestions: PruneSuggestion[]): void {
  contextState.update((s) => ({ ...s, pruneSuggestions: suggestions }));
}

/** Reset context state */
export function resetContext(): void {
  contextState.set(initialState);
}
