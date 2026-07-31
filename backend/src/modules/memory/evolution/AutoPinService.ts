/**
 * AutoPinService — SA4E-80: Auto-pin KB entries with computed quality >= threshold.
 * Computes quality on-the-fly (content length + tags + summary + recency).
 * Uses DialectHelper for all SQL (no native queries).
 */

import type { DatabaseAdapter } from '../../../database/adapters/DatabaseAdapter.js';
import { DialectHelper } from '../../../database/dialect/DialectHelper.js';
import pino from 'pino';

const logger = pino({ name: 'auto-pin-service' });

/** Default quality threshold for auto-pinning. */
const DEFAULT_QUALITY_THRESHOLD = 80;
/** Max entries to evaluate per scan. */
const MAX_EVAL_BATCH = 500;
/** Max entries to pin per scan. */
const MAX_PIN_BATCH = 50;

/** Compute quality score (0-100) for an entry — same formula as AnalyticsModule. */
function computeScore(entry: {
  content: string; summary: string | null;
  tags: string | null; created_at: string | null;
}): number {
  const contentLength = (entry.content || '').length;
  const hasContent = contentLength > 50;
  const tagCount = entry.tags ? entry.tags.split(',').filter(Boolean).length : 0;
  const hasSummary = Boolean(entry.summary && entry.summary.length > 10);
  const ageMs = entry.created_at ? Date.now() - new Date(entry.created_at).getTime() : 0;
  const ageScore = Math.max(0, 1 - ageMs / (365 * 86_400_000));
  return Math.min(100, Math.round(
    (hasContent ? 40 : 0) +
    Math.min(20, contentLength / 200) +
    Math.min(20, tagCount * 5) +
    (hasSummary ? 10 : 0) +
    ageScore * 10,
  ));
}

/**
 * Scans unpinned entries, computes quality, pins those >= threshold.
 * @param adapter - Database adapter
 * @param threshold - Quality score threshold (default: 80)
 * @returns Count of newly pinned entries
 */
export async function runAutoPin(
  adapter: DatabaseAdapter,
  threshold = DEFAULT_QUALITY_THRESHOLD,
): Promise<number> {
  const dialect = new DialectHelper(adapter.getEngine());

  // Fetch unpinned, non-archived entries with substantial content (likely high quality)
  // Exclude PEGA_RULE/PEGA_DATA — high volume, not intended for pinning
  const candidates = await adapter.allAsync<{
    id: number; content: string; summary: string | null;
    tags: string | null; created_at: string | null;
  }>(
    `SELECT id, content, summary, tags, created_at FROM knowledge_entries
     WHERE pinned = 0 AND archived = 0
       AND type NOT IN ('PEGA_RULE', 'PEGA_DATA', 'PEGA_AST', 'PEGA_SCHEMA')
     ORDER BY LENGTH(COALESCE(tags, '')) DESC, LENGTH(content) DESC
     LIMIT ?`,
    [MAX_EVAL_BATCH],
  );

  // Compute quality and filter
  const toPin = candidates
    .filter(e => computeScore(e) >= threshold)
    .slice(0, MAX_PIN_BATCH);

  if (toPin.length === 0) {
    logger.info({ evaluated: candidates.length, threshold, maxScore: candidates.length > 0 ? Math.max(...candidates.map(computeScore)) : 0 }, 'Auto-pin: no entries qualify');
    return 0;
  }

  // Pin qualifying entries
  const ids = toPin.map(e => e.id);
  const placeholders = ids.map(() => '?').join(',');
  await adapter.runAsync(
    `UPDATE knowledge_entries SET pinned = 1, updated_at = ${dialect.now()}
     WHERE id IN (${placeholders}) AND pinned = 0`,
    ids,
  );

  logger.info({ count: toPin.length, threshold }, 'Auto-pinned high-quality entries');
  return toPin.length;
}
