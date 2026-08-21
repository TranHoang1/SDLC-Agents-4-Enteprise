/**
 * SA4E-183 — DiffTracker module barrel export.
 */

export type {
  IDiffTracker,
  ChangeEntry,
  DiffSummary,
  RecordChangeInput,
  OperationType,
  DiffSummaryPayload,
  ChangeEntryPayload,
} from './IDiffTracker';
export { DiffTracker } from './DiffTracker';
export { DiffOriginalProvider } from './DiffOriginalProvider';
export {
  computeUnifiedDiff,
  countDiffLines,
  truncateDiff,
  isSensitiveFile,
  DIFF_TRACKED_TOOLS,
} from './diff-utils';
