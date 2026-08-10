/**
 * PegaService — Logic nghiệp vụ cho Pega Rule & Data Indexing & Schema Storage.
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
import { projectRuleToGraphNode, createDependencyEdges } from './PegaGraphProjector.js';

export class PegaService {
  private parser: PegaParser;
  private declarativeEngine: PegaDeclarativeEngine;
  private astParser: PegaRuleAstParser;

  constructor(private memoryEngine: MemoryEngine) {
    this.parser = new PegaParser();
    this.declarativeEngine = new PegaDeclarativeEngine();
    this.astParser = new PegaRuleAstParser();
    this.initSchemasInDb().catch(() => {});
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
    } catch { /* non-fatal */ }
  }

  public async getSchemasFromDb(): Promise<PegaRuleKbSchema[]> {
    const adapter = this.memoryEngine.getAdapter();
    const rows = await adapter.allAsync<{ content: string }>(
      "SELECT content FROM knowledge_entries WHERE type = 'PEGA_SCHEMA'",
      [],
    );
    return rows.map((r) => {
      try { return JSON.parse(r.content) as PegaRuleKbSchema; }
      catch { return null; }
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
    } catch { /* not JSON or no __checksum field */ }
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
    try { content = JSON.parse(row.content); } catch { content = {}; }
    return { cached: true, ruleId: row.id, updatedAt: row.updated_at, content };
  }

  public parseRuleToSymbol(ruleJson: Record<string, unknown>): { fqn: string; isRule: boolean } | null {
    try {
      return this.parser.parseSymbol(ruleJson);
    } catch {
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
      } catch { /* skip */ }
    }
    return count;
  }

  public async ingestRule(req: PegaIngestRuleRequest): Promise<PegaIngestRuleResponse> {
    let symbol: ExtractedPegaSymbol;
    try {
      symbol = this.parser.parseSymbol(req.ruleJson);
    } catch {
      // Rule type not supported by parser — skip gracefully instead of crashing stream
      return { status: 'success', ruleId: -1, unresolvedDependencies: [] };
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
    await adapter.runAsync('DELETE FROM knowledge_entries WHERE source = $1 AND project_id = $2', [symbol.fqn, req.projectId]);
    const summaryText = symbol.logicSummary
      ? `${symbol.fqn}\n${symbol.logicSummary}`
      : `${symbol.isRule ? 'Rule' : 'Data'}: ${symbol.fqn}`;
    // Tags: only meaningful categories — checksum/version stored in content, not as tags
    const baseTags = symbol.isRule ? 'pega,rule' : 'pega,data';
    const id = await this.memoryEngine.insert({
      content: JSON.stringify({ ...req.ruleJson, __checksum: req.checksum, __version: req.version }),
      summary: summaryText,
      type: symbol.isRule ? 'PEGA_RULE' : 'PEGA_DATA',
      tier: 'SEMANTIC', scope: 'PROJECT', project_id: req.projectId,
      source: symbol.fqn, tags: baseTags,
    });

    // Index AST as a separate knowledge entry for LLM querying
    const astSource = `pega-ast:${symbol.fqn}`;
    await adapter.runAsync('DELETE FROM knowledge_entries WHERE source = $1', [astSource]);
    await this.memoryEngine.insert({
      content: JSON.stringify(ast),
      summary: promptCtx,
      type: 'PEGA_AST',
      tier: 'SEMANTIC',
      scope: 'PROJECT',
      project_id: req.projectId,
      source: astSource,
      tags: 'pega,ast',
    });

    // Project into graph_nodes + create dependency edges
    try {
      const graphNodeId = await projectRuleToGraphNode(adapter, symbol.fqn, pxObjClass, req.projectId);
      await createDependencyEdges(adapter, graphNodeId, deps);
    } catch { /* non-fatal graph projection */ }

    return { status: 'success', ruleId: id, unresolvedDependencies: deps };
  }
}
