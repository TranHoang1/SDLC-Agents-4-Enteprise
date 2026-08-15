/**
 * SA4E-158 — PegaIndexer: Phase 1 of separated ingest pipeline.
 * Parses rule → stores raw index entry (no KB, no graph, no enrichment).
 * Returns ruleId for Phase 2 (syncRuleToKb).
 */
import type { MemoryEngine } from '../memory/engine/core.js';
import type { PegaIngestRuleRequest, UnresolvedDependency } from './models.js';
import { PegaParser, type ExtractedPegaSymbol } from './PegaParser.js';
import { PegaRuleAstParser } from './PegaRuleAstParser.js';
import pino from 'pino';

const logger = pino({ name: 'pega-indexer' });

/** Result of indexRule — stored raw rule data */
export interface IndexRuleResult {
  status: 'success' | 'skipped';
  ruleId: number;
  fqn: string;
  isRule: boolean;
  reason?: string;
  dependencies: UnresolvedDependency[];
}

/**
 * Phase 1: Parse + checksum dedup + store raw rule JSON.
 * Does NOT create KB enrichment tasks, graph nodes, or declare registrations.
 */
export async function indexRule(
  memoryEngine: MemoryEngine,
  parser: PegaParser,
  astParser: PegaRuleAstParser,
  req: PegaIngestRuleRequest,
): Promise<IndexRuleResult> {
  // Parse symbol from rule JSON
  let symbol: ExtractedPegaSymbol;
  try {
    symbol = parser.parseSymbol(req.ruleJson);
  } catch (err) {
    const ruleClass = (req.ruleJson as any)?.pxObjClass || 'unknown';
    const ruleName = (req.ruleJson as any)?.pyRuleName || 'unknown';
    logger.warn({ ruleClass, ruleName, err: (err as Error).message },
      'Rule type not supported by parser — skipped');
    return { status: 'skipped', ruleId: -1, fqn: '', isRule: false,
      reason: `parser_skip: ${ruleClass}`, dependencies: [] };
  }

  const deps = parser.extractDependencies(req.ruleJson);

  // Checksum dedup — skip if already indexed with same checksum
  if (req.checksum) {
    const { exists, checksumMatch } = await checkRuleChecksum(
      memoryEngine, req.projectId, symbol.fqn, req.checksum,
    );
    if (exists && checksumMatch) {
      return { status: 'skipped', ruleId: -1, fqn: symbol.fqn,
        isRule: symbol.isRule, reason: 'checksum_match', dependencies: deps };
    }
  }

  // Store raw rule JSON as PEGA_INDEX type (separate from KB entries)
  const adapter = memoryEngine.getAdapter();
  const indexSource = `pega-index:${symbol.fqn}`;
  await adapter.runAsync(
    'DELETE FROM knowledge_entries WHERE source = $1 AND project_id = $2',
    [indexSource, req.projectId],
  );

  const ast = astParser.parse(req.ruleJson);
  const promptCtx = astParser.toPromptContext(ast);
  const summaryText = symbol.logicSummary
    ? `${symbol.fqn}\n${symbol.logicSummary}`
    : `${symbol.isRule ? 'Rule' : 'Data'}: ${symbol.fqn}`;

  const id = await memoryEngine.insert({
    content: JSON.stringify({
      ...req.ruleJson,
      __checksum: req.checksum,
      __version: req.version,
      __ast: ast,
      __promptContext: promptCtx,
    }),
    summary: summaryText,
    type: 'PEGA_INDEX',
    tier: 'SEMANTIC',
    scope: 'PROJECT',
    project_id: req.projectId,
    source: indexSource,
    tags: symbol.isRule ? 'pega,index,rule' : 'pega,index,data',
  });

  return { status: 'success', ruleId: id, fqn: symbol.fqn,
    isRule: symbol.isRule, dependencies: deps };
}

/** Check if rule exists with matching checksum in index or KB. */
async function checkRuleChecksum(
  memoryEngine: MemoryEngine,
  projectId: string,
  fqn: string,
  checksum: string,
): Promise<{ exists: boolean; checksumMatch: boolean }> {
  const adapter = memoryEngine.getAdapter();
  // Check both PEGA_INDEX (new) and PEGA_RULE/PEGA_DATA (legacy)
  const row = await adapter.getAsync<{ content: string }>(
    `SELECT content FROM knowledge_entries
     WHERE project_id = $1
       AND (source = $2 OR source = $3)
       AND type IN ('PEGA_INDEX', 'PEGA_RULE', 'PEGA_DATA')
     LIMIT 1`,
    [projectId, `pega-index:${fqn}`, fqn],
  );
  if (!row) return { exists: false, checksumMatch: false };
  try {
    const parsed = JSON.parse(row.content);
    return { exists: true, checksumMatch: parsed.__checksum === checksum };
  } catch {
    return { exists: true, checksumMatch: false };
  }
}
