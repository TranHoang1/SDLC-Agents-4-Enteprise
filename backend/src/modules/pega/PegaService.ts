/**
 * PegaService — Logic nghiệp vụ cho Pega Rule & Data Indexing & Schema Storage.
 * SA4E-158: Separated into indexRule (Phase 1) + syncRuleToKb (Phase 2).
 */
import type { MemoryEngine } from '../memory/engine/core.js';
import type {
  PegaCheckRuleRequest,
  PegaCheckRuleResponse,
  PegaIngestRuleRequest,
  PegaIngestRuleResponse,
  UnresolvedDependency,
} from './models.js';
import { PegaParser, type ExtractedPegaSymbol } from './PegaParser.js';
import { PegaSchemaLoader } from './PegaSchemaLoader.js';
import type { PegaRuleKbSchema } from './strategies/KbDrivenPegaParserStrategy.js';
import { PegaDeclarativeEngine } from './PegaDeclarativeEngine.js';
import { PegaRuleAstParser } from './PegaRuleAstParser.js';
import { extractTagValueCsv, pxObjClassToGraphType } from './pega-utils.js';
import { indexRule, type IndexRuleResult } from './PegaIndexer.js';
import { syncRuleToKb, syncAllIndexedRules, type SyncRuleResult, type SyncBatchResult } from './PegaKbSync.js';
import type { DatabaseAdapter } from '../../database/adapters/DatabaseAdapter.js';
import pino from 'pino';

const logger = pino({ name: 'pega-service' });

/** SA4E-163: Upsert params for knowledge_entries. */
interface UpsertEntryParams {
  source: string;
  projectId: string;
  content: string;
  summary: string;
  type: string;
  tags: string;
}

/**
 * SA4E-163: UPSERT a knowledge_entry by (source, project_id).
 * Preserves the row ID so pending_tasks FK references remain valid.
 * On conflict: updates content, summary, tags, enrichment_status.
 * @returns The entry ID (existing or newly inserted).
 */
async function upsertKnowledgeEntry(adapter: DatabaseAdapter, p: UpsertEntryParams): Promise<number> {
  const engine = adapter.getEngine();
  if (engine === 'postgresql') {
    const row = await adapter.getAsync<{ id: number }>(`
      INSERT INTO knowledge_entries
        (content, summary, type, tier, scope, project_id, source, tags, enrichment_status)
      VALUES ($1, $2, $3, 'SEMANTIC', 'PROJECT', $4, $5, $6, 'pending')
      ON CONFLICT (source, project_id) WHERE source IS NOT NULL
      DO UPDATE SET
        content = EXCLUDED.content,
        summary = EXCLUDED.summary,
        tags = EXCLUDED.tags,
        enrichment_status = 'pending',
        updated_at = NOW()
      RETURNING id
    `, [p.content, p.summary, p.type, p.projectId, p.source, p.tags]);
    return row?.id ?? 0;
  }
  // SQLite: INSERT...ON CONFLICT with partial unique index
  const row = await adapter.getAsync<{ id: number }>(`
    INSERT INTO knowledge_entries
      (content, summary, type, tier, scope, project_id, source, tags, enrichment_status)
    VALUES (?, ?, ?, 'SEMANTIC', 'PROJECT', ?, ?, ?, 'pending')
    ON CONFLICT (source, project_id) WHERE source IS NOT NULL
    DO UPDATE SET
      content = excluded.content,
      summary = excluded.summary,
      tags = excluded.tags,
      enrichment_status = 'pending',
      updated_at = datetime('now')
    RETURNING id
  `, [p.content, p.summary, p.type, p.projectId, p.source, p.tags]);
  return row?.id ?? 0;
}

export class PegaService {
  private parser: PegaParser;
  private declarativeEngine: PegaDeclarativeEngine;
  private astParser: PegaRuleAstParser;

  constructor(private memoryEngine: MemoryEngine) {
    this.parser = new PegaParser();
    this.declarativeEngine = new PegaDeclarativeEngine();
    this.astParser = new PegaRuleAstParser();
    this.initSchemasInDb().catch((err) => { logger.debug({ err }, '[PegaService] Schema init failed (non-fatal)'); });
  }

  public getDeclarativeEngine(): PegaDeclarativeEngine { return this.declarativeEngine; }

  private async initSchemasInDb(): Promise<void> {
    const schemas = await this.getSchemasFromDb();
    if (schemas.length > 0) return;
    try {
      const allSchemas = PegaSchemaLoader.loadAllSchemas();
      for (const item of allSchemas) {
        await this.upsertSchemaInDb(item);
      }
    } catch (err) { logger.debug({ err }, '[PegaService] Failed to load schemas into DB (non-fatal)'); }
  }

  public async getSchemasFromDb(): Promise<PegaRuleKbSchema[]> {
    const adapter = this.memoryEngine.getAdapter();
    const rows = await adapter.allAsync<{ content: string }>(
      "SELECT content FROM knowledge_entries WHERE type = 'PEGA_SCHEMA'",
      [],
    );
    return rows.map((r) => {
      try { return JSON.parse(r.content) as PegaRuleKbSchema; }
      catch (err) { logger.debug({ err }, '[PegaService] Failed to parse PEGA_SCHEMA entry'); return null; }
    }).filter((s): s is PegaRuleKbSchema => s !== null);
  }

  public async upsertSchemaInDb(schema: PegaRuleKbSchema): Promise<void> {
    const adapter = this.memoryEngine.getAdapter();
    const sourceKey = `pega-schema:${schema.targetClass}`;
    await adapter.runAsync("DELETE FROM knowledge_entries WHERE source = $1 AND type = 'PEGA_SCHEMA'", [sourceKey]);
    await this.memoryEngine.insert({
      content: JSON.stringify(schema),
      summary: `Pega Rule Schema: ${schema.targetClass}`,
      type: 'PEGA_SCHEMA',
      tier: 'SEMANTIC',
      scope: 'SHARED',
      project_id: 'SYSTEM',
      source: sourceKey,
      tags: 'pega,schema',
    });
  }

  public async checkRuleWithChecksum(
    projectId: string,
    source: string,
    checksum?: string,
  ): Promise<{ exists: boolean; checksumMatch: boolean }> {
    const adapter = this.memoryEngine.getAdapter();
    const row = await adapter.getAsync<{ content: string; tags: string }>(
      "SELECT content, tags FROM knowledge_entries WHERE project_id = $1 AND source = $2 AND (type = 'PEGA_RULE' OR type = 'PEGA_DATA') LIMIT 1",
      [projectId, source],
    );
    if (!row) return { exists: false, checksumMatch: false };
    if (!checksum) return { exists: true, checksumMatch: false };
    // Check __checksum in content JSON (new format), fallback to tags (legacy)
    try {
      const parsed = JSON.parse(row.content);
      if (parsed.__checksum) return { exists: true, checksumMatch: parsed.__checksum === checksum };
    } catch (err) { logger.debug({ err }, '[PegaService] Content not JSON or missing __checksum field'); }
    const dbChecksum = extractTagValueCsv(row.tags, 'checksum');
    return { exists: true, checksumMatch: dbChecksum === checksum };
  }

  public async checkRule(req: PegaCheckRuleRequest): Promise<PegaCheckRuleResponse> {
    const fqn = `${req.ruleType}:${req.className}:${req.ruleName}`;
    const adapter = this.memoryEngine.getAdapter();
    const row = await adapter.getAsync<{ id: number; content: string; updated_at: string }>(
      'SELECT id, content, updated_at FROM knowledge_entries WHERE source = $1 AND project_id = $2 LIMIT 1',
      [fqn, req.projectId],
    );
    if (!row) return { cached: false };
    let content = {};
    try { content = JSON.parse(row.content); } catch (err) { logger.debug({ err }, '[PegaService] Failed to parse rule content'); content = {}; }
    return { cached: true, ruleId: row.id, updatedAt: row.updated_at, content };
  }

  public parseRuleToSymbol(ruleJson: Record<string, unknown>): { fqn: string; isRule: boolean } | null {
    try {
      return this.parser.parseSymbol(ruleJson);
    } catch (err) {
      return null;
    }
  }

  public getAstParser(): PegaRuleAstParser { return this.astParser; }
  public parseRuleToAst(ruleJson: Record<string, unknown>) { return this.astParser.parse(ruleJson); }
  public ruleToPromptContext(ruleJson: Record<string, unknown>): string {
    const ast = this.parseRuleToAst(ruleJson);
    return this.astParser.toPromptContext(ast);
  }

  public async reclassifyExistingGraphNodes(): Promise<number> {
    const adapter = this.memoryEngine.getAdapter();
    const rows = await adapter.allAsync<{ source: string; content: string }>(
      `SELECT source, content FROM knowledge_entries
       WHERE type = 'PEGA_RULE' AND source IN (
         SELECT REPLACE(entry_id, 'pega:', '') FROM graph_nodes
         WHERE entry_id LIKE 'pega:%' AND type = 'CODE_ENTITY'
       )`,
    );
    let count = 0;
    for (const row of rows) {
      try {
        const json = JSON.parse(row.content) as Record<string, unknown>;
        const pxObjClass = (json as any)?.pxObjClass || '';
        const graphType = pxObjClassToGraphType(pxObjClass);
        if (row.source) {
          await adapter.runAsync(
            `UPDATE graph_nodes SET type = ? WHERE entry_id = ?`,
            [graphType, `pega:${row.source}`],
          );
          count++;
        }
      } catch (err) { logger.debug({ err }, '[PegaService] Skipped unparseable rule content during reclassification'); }
    }
    return count;
  }

  /**
   * SA4E-158 Phase 1: Index rule — parse + dedup + store raw.
   * No KB entries, no graph, no enrichment tasks.
   */
  public async indexRuleOnly(req: PegaIngestRuleRequest): Promise<IndexRuleResult> {
    return indexRule(this.memoryEngine, this.parser, this.astParser, req);
  }

  /**
   * SA4E-158 Phase 2: Sync all indexed-but-not-synced rules to KB.
   * Creates KB entries, AST entries, enrichment tasks, graph nodes.
   */
  public async syncIndexedRulesToKb(projectId: string): Promise<SyncBatchResult> {
    return syncAllIndexedRules(this.memoryEngine, this.parser, this.declarativeEngine, projectId);
  }

  /** SA4E-158: Expose parser for route-level access. */
  public getParser(): PegaParser { return this.parser; }

  /** SA4E-158: Expose memoryEngine for route-level access. */
  public getMemoryEngine(): MemoryEngine { return this.memoryEngine; }

  /**
   * Legacy ingestRule — backward compatible, runs Phase 1 + Phase 2 in one call.
   * @deprecated Use indexRuleOnly + syncIndexedRulesToKb for SRP separation.
   */
  public async ingestRule(req: PegaIngestRuleRequest): Promise<PegaIngestRuleResponse> {
    let symbol: ExtractedPegaSymbol;
    try {
      symbol = this.parser.parseSymbol(req.ruleJson);
    } catch (err) {
      // SA4E-155: Log skipped rule type instead of silent skip
      const ruleClass = (req.ruleJson as any)?.pxObjClass || 'unknown';
      const ruleName = (req.ruleJson as any)?.pyRuleName || (req.ruleJson as any)?.pyLabel || 'unknown';
      logger.warn({ ruleClass, ruleName, err: (err as Error).message, component: 'PegaService' },
        'Rule type not supported by parser — skipped');
      return { status: 'success', ruleId: -1, reason: `parser_skip: ${ruleClass}`, unresolvedDependencies: [] };
    }
    const deps = this.parser.extractDependencies(req.ruleJson);

    if (req.checksum) {
      const { exists, checksumMatch } = await this.checkRuleWithChecksum(req.projectId, symbol.fqn, req.checksum);
      if (exists && checksumMatch) {
        return { status: 'success', ruleId: -1, unresolvedDependencies: deps };
      }
    }

    // Auto-register Declare Expressions into Declarative Engine
    const pxObjClass = (req.ruleJson as any)?.pxObjClass || '';
    if (pxObjClass === 'Rule-Declare-Expressions') {
      const targetProp = (req.ruleJson as any)?.pyTargetProperty || (req.ruleJson as any)?.pyPropertyName || '';
      const formula = (req.ruleJson as any)?.pyExpression || '';
      const inputs = deps.map(d => d.ruleName);
      if (targetProp) {
        this.declarativeEngine.registerExpression(targetProp, formula, inputs);
      }
    }

    const ast = this.astParser.parse(req.ruleJson);
    const promptCtx = this.astParser.toPromptContext(ast);

    const adapter = this.memoryEngine.getAdapter();
    const summaryText = symbol.logicSummary
      ? `${symbol.fqn}\n${symbol.logicSummary}`
      : `${symbol.isRule ? 'Rule' : 'Data'}: ${symbol.fqn}`;
    // Tags: only meaningful categories — checksum/version stored in content, not as tags
    const baseTags = symbol.isRule ? 'pega,rule' : 'pega,data';
    const contentJson = JSON.stringify({ ...req.ruleJson, __checksum: req.checksum, __version: req.version });

    // SA4E-163: UPSERT instead of DELETE+INSERT to prevent orphan pending_tasks
    const id = await upsertKnowledgeEntry(adapter, {
      source: symbol.fqn,
      projectId: req.projectId,
      content: contentJson,
      summary: summaryText,
      type: symbol.isRule ? 'PEGA_RULE' : 'PEGA_DATA',
      tags: baseTags,
    });

    // Create enrichment task for LLM to generate summary + pseudo code
    try {
      const { PendingTaskRepository } = await import('../memory/task-queue/PendingTaskRepository.js');
      const { TaskType } = await import('../memory/task-queue/models.js');
      const taskRepo = new PendingTaskRepository(adapter);
      await taskRepo.create({
        task_type: TaskType.TAG_ENRICHMENT,
        entry_id: id,
        project_id: req.projectId,
        payload: { entry_id: id, content: promptCtx || summaryText, existing_tags: baseTags, options: { threshold: 0.6, autoApply: true } },
      });
    } catch (err) { logger.debug({ err }, '[PegaService] Failed to create enrichment task (non-fatal)'); }

    // SA4E-163: UPSERT AST entry to preserve entry_id for pending_tasks
    const astSource = `pega-ast:${symbol.fqn}`;
    const astId = await upsertKnowledgeEntry(adapter, {
      source: astSource,
      projectId: req.projectId,
      content: JSON.stringify(ast),
      summary: promptCtx,
      type: 'PEGA_AST',
      tags: 'pega,ast',
    });

    // Create enrichment task for PEGA_AST entry (uses promptCtx as content for LLM)
    try {
      const { PendingTaskRepository } = await import('../memory/task-queue/PendingTaskRepository.js');
      const { TaskType } = await import('../memory/task-queue/models.js');
      const taskRepo = new PendingTaskRepository(adapter);
      await taskRepo.create({
        task_type: TaskType.TAG_ENRICHMENT,
        entry_id: astId,
        project_id: req.projectId,
        payload: { entry_id: astId, content: promptCtx || '', existing_tags: 'pega,ast', options: { threshold: 0.6, autoApply: true } },
      });
    } catch (err) { logger.debug({ err }, '[PegaService] Failed to create AST enrichment task (non-fatal)'); }

    // SA4E-106: Pega rules are stored as code symbols (dual-write) — no "pega:" graph nodes.
    // The rule appears on the graph as a code node after the next project graph sync.
    try {
      const { syncRuleToSymbols } = await import('./PegaSymbolSync.js');
      await syncRuleToSymbols(adapter, req.ruleJson, req.projectId, promptCtx);
    } catch (err) { logger.warn({ err }, '[PegaService] Failed to sync rule to symbols (non-fatal)'); }

    return { status: 'success', ruleId: id, unresolvedDependencies: deps };
  }
}
