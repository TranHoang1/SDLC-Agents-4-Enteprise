/**
 * PegaService — Logic nghiệp vụ cho Pega Rule & Data Indexing & Schema Storage.
 */
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import type { MemoryEngine } from '../memory/engine/core.js';
import type {
  PegaCheckRuleRequest,
  PegaCheckRuleResponse,
  PegaIngestRuleRequest,
  PegaIngestRuleResponse,
} from './models.js';
import { PegaParser } from './PegaParser.js';
import { PegaSchemaLoader } from './PegaSchemaLoader.js';
import type { PegaRuleKbSchema } from './strategies/KbDrivenPegaParserStrategy.js';

import { PegaDeclarativeEngine } from './PegaDeclarativeEngine.js';
import { PegaRuleAstParser } from './PegaRuleAstParser.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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

  public getDeclarativeEngine(): PegaDeclarativeEngine {
    return this.declarativeEngine;
  }

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

  public getAstParser(): PegaRuleAstParser {
    return this.astParser;
  }

  public parseRuleToAst(ruleJson: Record<string, unknown>) {
    return this.astParser.parse(ruleJson);
  }

  public ruleToPromptContext(ruleJson: Record<string, unknown>): string {
    const ast = this.parseRuleToAst(ruleJson);
    return this.astParser.toPromptContext(ast);
  }

  public async ingestRule(req: PegaIngestRuleRequest): Promise<PegaIngestRuleResponse> {
    const symbol = this.parser.parseSymbol(req.ruleJson);
    const deps = this.parser.extractDependencies(req.ruleJson);

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
    const id = await this.memoryEngine.insert({
      content: JSON.stringify(req.ruleJson),
      summary: summaryText,
      type: symbol.isRule ? 'PEGA_RULE' : 'PEGA_DATA',
      tier: 'SEMANTIC', scope: 'PROJECT', project_id: req.projectId,
      source: symbol.fqn, tags: symbol.isRule ? 'pega,rule' : 'pega,data',
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

    // Project into graph_nodes for KB Graph visualization
    try {
      const graphNodeId = `pega:${symbol.fqn}`;
      const engine = adapter.getEngine();
      if (engine === 'postgresql') {
        await adapter.runAsync(
          `INSERT INTO graph_nodes (entry_id, label, type, tier, project_id, x, y, z, level, cluster_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           ON CONFLICT (entry_id) DO UPDATE SET label = EXCLUDED.label, type = EXCLUDED.type`,
          [graphNodeId, symbol.fqn, 'CODE_ENTITY', 'SEMANTIC', req.projectId, Math.floor(Math.random() * 400) - 200, Math.floor(Math.random() * 400) - 200, 0, 0, 'pega-cluster']
        );
      } else {
        await adapter.runAsync(
          `INSERT OR REPLACE INTO graph_nodes (entry_id, label, type, tier, project_id, x, y, z, level, cluster_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [graphNodeId, symbol.fqn, 'CODE_ENTITY', 'SEMANTIC', req.projectId, Math.floor(Math.random() * 400) - 200, Math.floor(Math.random() * 400) - 200, 0, 0, 'pega-cluster']
        );
      }
    } catch { /* non-fatal graph projection */ }

    return { status: 'success', ruleId: id, unresolvedDependencies: deps };
  }
}
