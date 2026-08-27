/**
 * SA4E-88 — PegaHashCache: SHA-256 based file change detection.
 * Maintains a JSON cache (.pega-hash-cache.json) mapping file paths
 * to their content hashes, enabling incremental indexing.
 */

import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

/** Shape of the persisted hash cache file. */
export interface HashCacheData {
  version: 1;
  entries: Record<string, string>;
}

/** Result of comparing a file against its cached hash. */
export interface HashCompareResult {
  filePath: string;
  hash: string;
  changed: boolean;
}

/** Abstracts file I/O for testability (DIP). */
export interface FileReader {
  readFile(path: string): Promise<string>;
}

const CACHE_FILENAME = '.pega-hash-cache.json';

/**
 * Compute SHA-256 hash of file content.
 * @param content - Raw file text
 * @returns Hex-encoded SHA-256 digest
 */
export function computeHash(content: string): string {
  return createHash('sha256').update(content, 'utf-8').digest('hex');
}

/**
 * Load the hash cache from workspace root.
 * Returns empty cache if file doesn't exist or is malformed.
 * @param workspaceRoot - Directory containing the cache file
 */
export async function loadHashCache(workspaceRoot: string): Promise<HashCacheData> {
  const cachePath = join(workspaceRoot, CACHE_FILENAME);
  try {
    const raw = await readFile(cachePath, 'utf-8');
    const parsed = JSON.parse(raw) as HashCacheData;
    if (parsed.version === 1 && typeof parsed.entries === 'object') {
      return parsed;
    }
  } catch {
    // Cache missing or corrupted — start fresh
  }
  return { version: 1, entries: {} };
}

/**
 * Persist the hash cache to workspace root.
 * @param workspaceRoot - Directory to write the cache file
 * @param cache - Cache data to persist
 */
export async function saveHashCache(
  workspaceRoot: string, cache: HashCacheData,
): Promise<void> {
  const cachePath = join(workspaceRoot, CACHE_FILENAME);
  await writeFile(cachePath, JSON.stringify(cache, null, 2), 'utf-8');
}

/**
 * Compare a file's current content hash against the cached hash.
 * @param filePath - Relative path (used as cache key)
 * @param content - Current file content
 * @param cache - Loaded cache data
 */
export function compareFileHash(
  filePath: string, content: string, cache: HashCacheData,
): HashCompareResult {
  const hash = computeHash(content);
  const cachedHash = cache.entries[filePath];
  return { filePath, hash, changed: hash !== cachedHash };
}

/**
 * Remove cache entries whose paths were not seen in the current index run.
 * Prevents the on-disk cache from growing unbounded as rules are deleted/renamed.
 * Mutates the given cache in place.
 * @param cache - Loaded cache data to prune
 * @param seenPaths - Set of relative paths present in the current run
 * @returns Number of stale entries removed
 */
export function pruneStaleEntries(cache: HashCacheData, seenPaths: Set<string>): number {
  let removed = 0;
  for (const key of Object.keys(cache.entries)) {
    if (!seenPaths.has(key)) {
      delete cache.entries[key];
      removed++;
    }
  }
  return removed;
}
