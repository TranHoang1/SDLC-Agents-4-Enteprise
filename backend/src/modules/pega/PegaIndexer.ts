/**
 * SA4E-158 — PegaIndexer: Phase 1 of separated ingest pipeline.
 * SA4E-171 (cutover): parses rule → stores into symbols table (via PegaSymbolSync).
 * No longer writes PEGA_INDEX into knowledge_entries — rules live in symbols only.
 * Returns symbolId for Phase 2 (syncIndexedRulesToKb / graph projection).
 */
import type { MemoryEngine } from '../memory/engine/core.js';
import type { PegaIngestRuleRequest, UnresolvedDependency } from './models.js';
import { PegaParser, type ExtractedPegaSymbol } from './PegaParser.js';
import { PegaRuleAstParser } from './PegaRuleAstParser.js';
import { syncRuleToSymbols } from './PegaSymbolSync.js';
import { buildFqn, resolveRuleNameField } from './pega-mapping.js';
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
 * Phase 1: Parse + checksum dedup + store into symbols table.
 * Does NOT create KB entries, TAG_ENRICHMENT tasks, or legacy pega: graph nodes.
 * CODE_ENRICHMENT task is created by syncRuleToSymbols.
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

  // Checksum dedup — skip if already indexed in symbols with matching content hash
  // FQN uses the canonical rule-name fallback (matches PegaSymbolSync signature).
  const canonicalFqn = buildFqn(
    String((req.ruleJson as any)?.pxObjClass || ''),
    String((req.ruleJson as any)?.pyClassName || ''),
    resolveRuleNameField(req.ruleJson),
  );
  if (req.checksum) {
    const { exists, checksumMatch } = await checkRuleChecksum(
      memoryEngine, req.projectId, canonicalFqn, req.checksum,
    );
    if (exists && checksumMatch) {
      return { status: 'skipped', ruleId: -1, fqn: symbol.fqn,
        isRule: symbol.isRule, reason: 'checksum_match', dependencies: deps };
    }
  }

  const ast = astParser.parse(req.ruleJson);
  const promptCtx = astParser.toPromptContext(ast);

  // Store rule into symbols table (virtual file + symbol + body + CODE_ENRICHMENT)
  let result;
  try {
    result = await syncRuleToSymbols(
      memoryEngine.getAdapter(), req.ruleJson, req.projectId, promptCtx,
    );
  } catch (err) {
    logger.warn({ err, fqn: symbol.fqn }, 'Failed to sync rule to symbols — skipped');
    return { status: 'skipped', ruleId: -1, fqn: symbol.fqn,
      isRule: symbol.isRule, reason: 'symbol_sync_error', dependencies: deps };
  }
  if (!result) {
    return { status: 'skipped', ruleId: -1, fqn: symbol.fqn,
      isRule: symbol.isRule, reason: 'symbol_skip', dependencies: deps };
  }

  return { status: 'success', ruleId: result.symbolId, fqn: symbol.fqn,
    isRule: symbol.isRule, dependencies: deps };
}

/** Check if rule exists in symbols with matching content hash. */
async function checkRuleChecksum(
  memoryEngine: MemoryEngine,
  projectId: string,
  fqn: string,
  checksum: string,
): Promise<{ exists: boolean; checksumMatch: boolean }> {
  const adapter = memoryEngine.getAdapter();
  const row = await adapter.getAsync<{ content_hash: string | null }>(
    `SELECT f.content_hash
     FROM symbols s JOIN files f ON f.id = s.file_id
     WHERE s.project_id = $1 AND s.signature = $2 AND s.kind LIKE 'pega_%'
     LIMIT 1`,
    [projectId, fqn],
  );
  if (!row) return { exists: false, checksumMatch: false };
  return { exists: true, checksumMatch: row.content_hash === checksum };
}
