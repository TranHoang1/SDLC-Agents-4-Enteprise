/**
 * SA4E-95 - CacheManifest tracks generated schema versions for incremental regeneration.
 * Persisted as .cache-manifest.json alongside generated schemas.
 */

/** Single entry tracking one rule type's generated schema */
export interface CacheEntry {
  ruleType: string;
  harnessInsKey: string;
  updateDateTime: string;
  schemaHash: string;
  schemaPath: string;
}

/** Top-level cache manifest structure */
export interface CacheManifest {
  version: string;
  generatedAt: string;
  entries: CacheEntry[];
}
