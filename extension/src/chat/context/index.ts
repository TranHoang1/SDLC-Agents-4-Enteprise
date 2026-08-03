/**
 * SA4E-85 — Context Management barrel export.
 * Exposes IdeContextManager, pruning algorithm, and types.
 */

export { IdeContextManager } from './IdeContextManager';
export type { IContextManager, ContextState, ContextFile } from './types';
export { suggestPrune, computeFreedThreshold } from './pruningAlgorithm';
export type { PrunableFile, PruneCandidate } from './pruningAlgorithm';
