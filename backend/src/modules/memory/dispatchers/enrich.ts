/**
 * enrich.ts — SA4E-79: mem_enrich MCP tool handler.
 * Accepts client-generated enrichment metadata for pending KB entries.
 * Uses atomic UPDATE WHERE for race condition safety (BR-13).
 */

import type { MemoryEngine } from '../engine/core.js';
import type { ScopeContext } from '../models.js';
import type { DatabaseAdapter } from '../../../database/adapters/DatabaseAdapter.js';
import {
  validateEntryId, validateSummary, validateTags,
  validateStructuredMap, sanitizeText,
} from './enrich-validation.js';
import pino from 'pino';

const logger = pino({ name: 'mem-enrich-dispatcher' });

type Args = Record<string, unknown>;

/**
 * Handle mem_enrich tool call — validates input, performs atomic enrichment.
 * @param engine - MemoryEngine for DB operations
 * @param scopeCtx - Caller's scope context for authorization
 * @param a - Tool call arguments
 * @param dbAdapter - Database adapter for raw SQL
 * @returns Response message string
 */
export async function handleEnrich(
  engine: MemoryEngine,
  scopeCtx: ScopeContext | undefined,
  a: Args,
  dbAdapter: DatabaseAdapter,
): Promise<string> {
  // --- Input validation ---
  const idErr = validateEntryId(a.entry_id);
  if (idErr) return idErr;
  const summaryErr = validateSummary(a.summary);
  if (summaryErr) return summaryErr;
  const tagsErr = validateTags(a.tags);
  if (tagsErr) return tagsErr;
  const mapErr = validateStructuredMap(a.structured_map);
  if (mapErr) return mapErr;

  const entryId = a.entry_id as number;

  // --- Entry existence check ---
  const entry = await engine.findById(entryId);
  if (!entry) return `Error: Entry #${entryId} not found`;

  // --- Scope check (F-03 + NEW-07) ---
  // Fail-closed for PROJECT entries; allow USER-scoped entries without projectId
  if (entry.project_id && !scopeCtx?.projectId) {
    return 'Error: Project scope required for enrichment';
  }
  if (entry.project_id && scopeCtx?.projectId && entry.project_id !== scopeCtx.projectId) {
    return `Error: Entry #${entryId} not accessible in current scope`;
  }

  // --- Sanitize inputs (F-01) ---
  const summary = sanitizeText(a.summary as string);
  const tags = sanitizeText((a.tags as string) || '');
  const structuredMap = a.structured_map as object | undefined;

  // --- Atomic status transition (BR-13: first-to-complete wins) ---
  const result = await performAtomicEnrichment(
    dbAdapter, entryId, summary, tags, structuredMap, entry.structured_map,
  );

  if (result.changes === 0) {
    return `Error: Entry #${entryId} already enriched (status=done)`;
  }

  // SA4E-99: Propagate summary to graph_nodes.label for meaningful KB Graph display
  if (summary && summary.length > 0) {
    try {
      await dbAdapter.runAsync(
        `UPDATE graph_nodes SET label = ? WHERE entry_id = ?`,
        [summary.slice(0, 60), `doc-${entryId}`],
      );
    } catch { /* non-fatal — graph node may not exist */ }
  }

  // --- Mark related TAG_ENRICHMENT task as COMPLETED ---
  await markRelatedTaskCompleted(dbAdapter, entryId);
  await engine.auditLog('ENRICH_CLIENT', entryId);

  return `Entry #${entryId} enriched successfully. Status: done. Enriched by: client_llm.`;
}

/** Atomic UPDATE with WHERE enrichment_status='pending' — race-safe. */
async function performAtomicEnrichment(
  dbAdapter: DatabaseAdapter,
  entryId: number,
  summary: string,
  tags: string,
  structuredMap: object | undefined,
  existingMap: string,
): Promise<{ changes: number }> {
  const now = new Date().toISOString();
  const mapJson = structuredMap ? JSON.stringify(structuredMap) : existingMap;

  return dbAdapter.runAsync(
    `UPDATE knowledge_entries
     SET summary = ?, tags = ?, structured_map = ?,
         enrichment_status = 'done', enriched_by = 'client_llm',
         enriched_at = ?, updated_at = ?
     WHERE id = ? AND enrichment_status = 'pending'`,
    [summary, tags, mapJson, now, now, entryId],
  );
}

/** Mark related TAG_ENRICHMENT pending_task as COMPLETED (non-fatal). */
async function markRelatedTaskCompleted(
  dbAdapter: DatabaseAdapter,
  entryId: number,
): Promise<void> {
  const now = new Date().toISOString();
  try {
    await dbAdapter.runAsync(
      `UPDATE pending_tasks SET status = 'COMPLETED', completed_at = ?
       WHERE entry_id = ? AND task_type = 'TAG_ENRICHMENT'
       AND status IN ('PENDING', 'PROCESSING')`,
      [now, entryId],
    );
  } catch (err) {
    logger.warn({ entryId, err }, '[mem_enrich] Task mark failed (non-fatal)');
  }
}
