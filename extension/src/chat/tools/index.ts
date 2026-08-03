/**
 * SA4E-85 — Tools barrel export.
 * Artifact detection, file hashing, diff types, and tool handler.
 */

export { detectArtifacts, addPattern } from './ArtifactDetector';
export type { ArtifactLink, ArtifactType } from './ArtifactDetector';

export { computeFileHash, hashBuffer, hashesMatch } from './fileHasher';

export { OpenCodeToolHandler } from './OpenCodeToolHandler';
export type { RegeneratePatchFn } from './OpenCodeToolHandler';

export { isDiffStale, STALE_THRESHOLD_MS } from './diffTypes';
export type {
  DiffBlock,
  DiffStatus,
  ApplyResult,
  ApplyError,
  IToolHandler,
} from './diffTypes';
