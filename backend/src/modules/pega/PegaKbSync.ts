/**
 * SA4E-158 — PegaKbSync: Phase 2 of separated ingest pipeline.
 * Reads indexed rules → inserts into KB (knowledge_entries) + graph + enrichment.
 * Handles: KB entries, AST entries, enrichment tasks, graph projection, Declare Expressions.
 */
import type { MemoryEngine } from '../memory/engine/core.js';
import type { UnresolvedDependency } from './models.js';
import { PegaParser } from './PegaParser.js';
import { PegaDeclarativeEngine } from './PegaDeclarativeEngine.js';
import { projectRuleToGraphNode, createDependencyEdges } from './PegaGraphProjector.js';
import pino from 'pino';

const logger = pino({ name: 'pega-kb-sync' });

/** Result of syncing a single indexed rule to KB */
export interface SyncRuleResult {
  status: 'success' | 'error';
  fqn: string;
  kbEntryId: number;
  astEntryId: number;
  error?: string;
}

/** Summary of batch sync operation */
export interface SyncBatchResult {
  synced: number;
  skipped: number;
  errors: number;
  details: SyncRuleResult[];
}

/**
 * Sync a single indexed rule to KB + graph + enrichment.
 * Reads from PEGA_INDEX entry, creates PEGA_RULE/PEGA_DATA + PEGA_AST entries.
 */
export async function syncRuleToKb(
  memoryEngine: MemoryEngine,
  parser: PegaParser,
  declarativeEngine: PegaDeclarativeEngine,
  indexedContent: Record<string, unknown>,
  projectId: string,
): Promise<SyncRuleResult> {
  const adapter = memoryEngine.getAdapter();

  // Extract stored metadata from indexed content
  const ruleJson = extractRuleJson(indexedContent);
  const ast = indexedContent.__ast as Record<string, unknown> | undefined;
  const promptCtx = (indexedContent.__promptContext as string) || '';
  const checksum = indexedContent.__checksum as string | undefined;
  const version = indexedContent.__version as string | undefined;
  const pxObjClass = (ruleJson as any)?.pxObjClass || '';

  // Re-parse symbol for FQN and type classification
  let fqn: string;
  let isRule: boolean;
  try {
    const sym = parser.parseSymbol(ruleJson);
    fqn = sym.fqn;
    isRule = sym.isRule;
  } catch (err) {
    return { status: 'error', fqn: '', kbEntryId: -1, astEntryId: -1,
      error: `parser_skip: ${pxObjClass}` };
  }

  const deps = parser.extractDependencies(ruleJson);

  // Register Declare Expressions into Declarative Engine
  registerDeclareExpression(declarativeEngine, pxObjClass, ruleJson, deps);

  // Insert/update main KB entry (PEGA_RULE or PEGA_DATA)
  await adapter.runAsync(
    'DELETE FROM knowledge_entries WHERE source = $1 AND project_id = $2',
    [fqn, projectId],
  );
  const summaryText = buildSummary(fqn, isRule, ruleJson);
  const baseTags = isRule ? 'pega,rule' : 'pega,data';
  const kbId = await memoryEngine.insert({
    content: JSON.stringify({ ...ruleJson, __checksum: checksum, __version: version }),
    summary: summaryText,
    type: isRule ? 'PEGA_RULE' : 'PEGA_DATA',
    tier: 'SEMANTIC', scope: 'PROJECT', project_id: projectId,
    source: fqn, tags: baseTags,
  });

  // Create enrichment task for LLM tagging
  await createEnrichmentTask(adapter, kbId, promptCtx || summaryText, baseTags);

  // Insert AST as separate KB entry
  const astSource = `pega-ast:${fqn}`;
  await adapter.runAsync('DELETE FROM knowledge_entries WHERE source = $1', [astSource]);
  const astId = await memoryEngine.insert({
    content: JSON.stringify(ast || {}),
    summary: promptCtx,
    type: 'PEGA_AST',
    tier: 'SEMANTIC', scope: 'PROJECT', project_id: projectId,
    source: astSource, tags: 'pega,ast',
  });

  // Create enrichment task for AST entry
  await createEnrichmentTask(adapter, astId, promptCtx, 'pega,ast');

  // Project into graph_nodes + dependency edges
  await projectToGraph(adapter, fqn, pxObjClass, projectId, deps);

  return { status: 'success', fqn, kbEntryId: kbId, astEntryId: astId };
}

/**
 * Sync all indexed-but-not-synced rules in a project to KB.
 * Strategy:
 * 1. Find PEGA_INDEX entries without corresponding PEGA_RULE/PEGA_DATA → sync them
 * 2. If no PEGA_INDEX entries exist (legacy data), re-enrich existing PEGA_RULE/PEGA_DATA entries
 */
export async function syncAllIndexedRules(
  memoryEngine: MemoryEngine,
  parser: PegaParser,
  declarativeEngine: PegaDeclarativeEngine,
  projectId: string,
): Promise<SyncBatchResult> {
  const adapter = memoryEngine.getAdapter();

  // Strategy 1: Find PEGA_INDEX entries that need syncing to KB
  const rows = await adapter.allAsync<{ source: string; content: string }>(
    `SELECT source, content FROM knowledge_entries
     WHERE project_id = $1 AND type = 'PEGA_INDEX'
       AND REPLACE(source, 'pega-index:', '') NOT IN (
         SELECT source FROM knowledge_entries
         WHERE project_id = $1 AND type IN ('PEGA_RULE', 'PEGA_DATA')
       )`,
    [projectId],
  );

  const result: SyncBatchResult = { synced: 0, skipped: 0, errors: 0, details: [] };

  if (rows.length > 0) {
    // New-style: sync PEGA_INDEX → PEGA_RULE/PEGA_DATA + graph + enrichment
    for (const row of rows) {
      try {
        const content = JSON.parse(row.content);
        const syncResult = await syncRuleToKb(
          memoryEngine, parser, declarativeEngine, content, projectId,
        );
        if (syncResult.status === 'success') { result.synced++; }
        else { result.errors++; }
        result.details.push(syncResult);
      } catch (err) {
        result.errors++;
        logger.warn({ err, source: row.source }, 'Failed to sync indexed rule to KB');
      }
    }
    return result;
  }

  // Strategy 2: Legacy — no PEGA_INDEX entries, re-enrich existing PEGA_RULE/PEGA_DATA
  return reEnrichExistingRules(memoryEngine, projectId);
}

/**
 * Legacy fallback: re-create enrichment tasks for existing PEGA_RULE/PEGA_DATA entries
 * that don't have pending enrichment tasks. Ensures LLM summary + pseudocode gets generated.
 */
async function reEnrichExistingRules(
  memoryEngine: MemoryEngine,
  projectId: string,
): Promise<SyncBatchResult> {
  const adapter = memoryEngine.getAdapter();
  const result: SyncBatchResult = { synced: 0, skipped: 0, errors: 0, details: [] };

  // Find PEGA_RULE/PEGA_DATA entries without pending enrichment tasks
  const rows = await adapter.allAsync<{ id: number; source: string; summary: string; tags: string }>(
    `SELECT id, source, summary, tags FROM knowledge_entries
     WHERE project_id = $1 AND type IN ('PEGA_RULE', 'PEGA_DATA')
       AND id NOT IN (
         SELECT entry_id FROM pending_tasks WHERE status IN ('pending', 'processing')
       )`,
    [projectId],
  );

  if (rows.length === 0) {
    return result;
  }

  for (const row of rows) {
    try {
      await createEnrichmentTask(adapter, row.id, row.summary || '', row.tags || 'pega');
      result.synced++;
    } catch (err) {
      result.errors++;
      logger.warn({ err, source: row.source }, 'Failed to create enrichment task for legacy rule');
    }
  }

  return result;
}

/** Strip internal metadata fields, return raw rule JSON. */
function extractRuleJson(indexed: Record<string, unknown>): Record<string, unknown> {
  const { __checksum, __version, __ast, __promptContext, ...ruleJson } = indexed;
  return ruleJson;
}

/** Build summary text for KB entry. */
function buildSummary(fqn: string, isRule: boolean, ruleJson: Record<string, unknown>): string {
  const logicSummary = (ruleJson as any)?.logicSummary;
  return logicSummary
    ? `${fqn}\n${logicSummary}`
    : `${isRule ? 'Rule' : 'Data'}: ${fqn}`;
}

/** Register Declare Expression if applicable. */
function registerDeclareExpression(
  engine: PegaDeclarativeEngine,
  pxObjClass: string,
  ruleJson: Record<string, unknown>,
  deps: UnresolvedDependency[],
): void {
  if (pxObjClass !== 'Rule-Declare-Expressions') return;
  const targetProp = (ruleJson as any)?.pyTargetProperty
    || (ruleJson as any)?.pyPropertyName || '';
  const formula = (ruleJson as any)?.pyExpression || '';
  const inputs = deps.map(d => d.ruleName);
  if (targetProp) {
    engine.registerExpression(targetProp, formula, inputs);
  }
}

/** Create LLM enrichment task (non-fatal on failure). */
async function createEnrichmentTask(
  adapter: any,
  entryId: number,
  content: string,
  existingTags: string,
): Promise<void> {
  try {
    const { PendingTaskRepository } = await import('../memory/task-queue/PendingTaskRepository.js');
    const { TaskType } = await import('../memory/task-queue/models.js');
    const taskRepo = new PendingTaskRepository(adapter);
    await taskRepo.create({
      task_type: TaskType.TAG_ENRICHMENT,
      entry_id: entryId,
      payload: { entry_id: entryId, content, existing_tags: existingTags,
        options: { threshold: 0.6, autoApply: true } },
    });
  } catch (err) {
    logger.debug({ err }, 'Failed to create enrichment task (non-fatal)');
  }
}

/** Project rule into graph_nodes + create dependency edges (non-fatal). */
async function projectToGraph(
  adapter: any,
  fqn: string,
  pxObjClass: string,
  projectId: string,
  deps: UnresolvedDependency[],
): Promise<void> {
  try {
    const graphNodeId = await projectRuleToGraphNode(adapter, fqn, pxObjClass, projectId);
    await createDependencyEdges(adapter, graphNodeId, deps);
  } catch (err) {
    logger.warn({ err }, 'Failed to project rule into graph (non-fatal)');
  }
}
