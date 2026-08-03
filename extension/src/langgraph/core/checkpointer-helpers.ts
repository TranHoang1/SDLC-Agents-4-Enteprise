/**
 * Checkpointer helpers — metadata sanitization.
 * [v3.1] Persistence moved to RemoteCheckpointer (Backend KB); the
 * fs-based helpers (listPersistedPipelines/cleanupPipelines) were removed.
 * Backend owns retention; local filesystem state no longer exists.
 */
import type { CheckpointMetadata } from "@langchain/langgraph";

const SENSITIVE_PATTERNS = [/token/i, /key/i, /secret/i, /password/i, /credential/i];

/** Strip sensitive keys (token/key/secret/password/credential) from metadata. */
export function sanitizeMetadata(metadata: CheckpointMetadata): CheckpointMetadata {
  if (!metadata || typeof metadata !== "object") { return metadata; }
  const sanitized = structuredClone(metadata) as Record<string, unknown>;
  deepSanitize(sanitized);
  return sanitized as CheckpointMetadata;
}

function deepSanitize(obj: Record<string, unknown>): void {
  for (const key of Object.keys(obj)) {
    if (SENSITIVE_PATTERNS.some(p => p.test(key))) { delete obj[key]; }
    else if (obj[key] && typeof obj[key] === "object" && !Array.isArray(obj[key])) {
      deepSanitize(obj[key] as Record<string, unknown>);
    }
  }
}
