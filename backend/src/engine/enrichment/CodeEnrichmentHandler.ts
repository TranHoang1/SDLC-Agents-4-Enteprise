/**
 * SA4E-107: Code Enrichment Handler.
 * Main handler: loads symbol context, calls LLM, parses response, stores results.
 * Strategy pattern selects enrichment approach per symbol kind.
 */

import type { Logger } from 'pino';
import type { DatabaseAdapter } from '../../database/adapters/DatabaseAdapter.js';
import type { LLMService } from '../../modules/memory/llm/LLMService.js';
import type { PendingTask } from '../../modules/memory/task-queue/models.js';
import { CodeEnrichmentPromptBuilder } from './CodeEnrichmentPromptBuilder.js';
import { CodeEnrichmentPayloadSchema } from './types.js';
import type { CodeEnrichmentPayload, EnrichmentStrategy, SymbolContext, CodeEnrichmentLLMResponse } from './types.js';
import { validateTags } from './tag-validator.js';
import { isPegaKind } from '../../modules/pega/pega-mapping.js';

/** LLM call timeout in milliseconds (BR-02). */
const LLM_TIMEOUT_MS = 30_000;
/** Max pseudo code length (BR-05). */
const MAX_PSEUDO_CODE_LENGTH = 2000;

// Strategy selection: which symbol kinds map to which enrichment strategy
const CLASS_KINDS = new Set(['class', 'interface', 'enum']);
const FUNCTION_KINDS = new Set(['function', 'method', 'arrow_function', 'generator']);

/**
 * Orchestrates LLM enrichment for a single code symbol.
 * Injected into TaskWorker via setCodeEnrichmentHandler().
 */
export class CodeEnrichmentHandler {
  private readonly promptBuilder: CodeEnrichmentPromptBuilder;

  constructor(
    private readonly adapter: DatabaseAdapter,
    private readonly llmService: LLMService,
    private readonly logger: Logger,
  ) {
    this.promptBuilder = new CodeEnrichmentPromptBuilder();
  }

  /**
   * Enrich a single symbol from a CODE_ENRICHMENT task.
   * @param task - The pending task with payload
   */
  async enrichSymbol(task: PendingTask): Promise<void> {
    const parsed = CodeEnrichmentPayloadSchema.safeParse(JSON.parse(task.payload));
    if (!parsed.success) {
      throw new Error(`invalid_payload: ${parsed.error.message}`);
    }
    const payload = parsed.data;
    const context = await this.loadContext(payload);
    const strategy = this.selectStrategy(payload.symbolKind, payload.workspaceType);
    const messages = this.promptBuilder.build(strategy, context);
    const raw = await this.callLLMWithTimeout(messages);
    const response = this.parseResponse(raw, strategy);
    await this.storeResults(payload.symbolId, response, strategy);
  }

  private selectStrategy(kind: string, workspaceType: string): EnrichmentStrategy {
    // SA4E-171: use isPegaKind() for all 16+ pega kinds (replaces static set)
    if (workspaceType === 'pega' && isPegaKind(kind)) return 'PEGA_SUMMARY';
    if (FUNCTION_KINDS.has(kind)) return 'FUNCTION_SUMMARY';
    if (CLASS_KINDS.has(kind)) return 'CLASS_SUMMARY';
    return 'CLASS_SUMMARY'; // Fallback
  }

  private async loadContext(payload: CodeEnrichmentPayload): Promise<SymbolContext> {
    const sym = await this.adapter.getAsync<{
      name: string; kind: string; signature: string | null;
      doc_comment: string | null; parent_symbol: string | null;
    }>(
      'SELECT name, kind, signature, doc_comment, parent_symbol FROM symbols WHERE id = ?',
      [payload.symbolId],
    );
    if (!sym) throw new Error(`symbol_not_found: ${payload.symbolId}`);

    const bodyText = await this.loadBodyText(payload.symbolId);
    const childMembers = await this.loadChildMembers(payload.symbolId);
    const existingPseudoCode = await this.loadExistingPseudoCode(payload.symbolId);

    return {
      name: sym.name,
      kind: sym.kind,
      signature: sym.signature,
      docComment: sym.doc_comment,
      bodyText,
      childMembers,
      existingPseudoCode,
      // SA4E-106: Pega class from payload or parent_symbol; ruleset from payload
      pegaClass: payload.pegaClass || sym.parent_symbol || undefined,
      pegaRuleset: payload.pegaRuleset || undefined,
    };
  }

  private async loadBodyText(symbolId: number): Promise<string | null> {
    const row = await this.adapter.getAsync<{ embedding: Buffer }>(
      'SELECT embedding FROM body_embeddings WHERE symbol_id = ? AND chunk_index = 0',
      [symbolId],
    );
    if (!row?.embedding) return null;
    return Buffer.from(row.embedding).toString('utf-8');
  }

  private async loadChildMembers(symbolId: number): Promise<string[] | null> {
    const rows = await this.adapter.allAsync<{ name: string; kind: string }>(
      'SELECT name, kind FROM symbols WHERE parent_symbol_id = ? LIMIT 30',
      [symbolId],
    );
    if (rows.length === 0) return null;
    return rows.map(r => `${r.kind}:${r.name}`);
  }

  private async loadExistingPseudoCode(symbolId: number): Promise<string | null> {
    const row = await this.adapter.getAsync<{ pseudo_code: string | null }>(
      'SELECT pseudo_code FROM symbols WHERE id = ?', [symbolId],
    );
    return row?.pseudo_code ?? null;
  }

  /** Call LLM with 30s timeout via Promise.race (BR-02). */
  private async callLLMWithTimeout(messages: { role: string; content: string }[]): Promise<string> {
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('llm_timeout')), LLM_TIMEOUT_MS),
    );
    const result = await Promise.race([
      this.llmService.complete(messages as any),
      timeout,
    ]);
    return result.content;
  }

  /** Parse LLM response with regex fallback on JSON parse failure. */
  private parseResponse(raw: string, strategy: EnrichmentStrategy): CodeEnrichmentLLMResponse {
    // Attempt 1: direct JSON parse
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.summary === 'string') return parsed;
    } catch { /* fallback below */ }

    // Attempt 2: extract from markdown code fence
    const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenceMatch) {
      try {
        const parsed = JSON.parse(fenceMatch[1].trim());
        if (parsed && typeof parsed.summary === 'string') return parsed;
      } catch { /* fallback below */ }
    }

    // Attempt 3: regex extraction of individual fields
    return this.regexFallbackParse(raw, strategy);
  }

  private regexFallbackParse(raw: string, strategy: EnrichmentStrategy): CodeEnrichmentLLMResponse {
    const summaryMatch = raw.match(/"summary"\s*:\s*"([^"]+)"/);
    const pseudoMatch = raw.match(/"pseudo_code"\s*:\s*"([^"]+)"/);
    const tagsMatch = raw.match(/"tags"\s*:\s*\[([^\]]*)\]/);

    const summary = summaryMatch?.[1] ?? raw.slice(0, 200).replace(/["\n]/g, ' ').trim();
    const result: CodeEnrichmentLLMResponse = { summary };

    if ((strategy === 'FUNCTION_SUMMARY' || strategy === 'PEGA_SUMMARY') && pseudoMatch) {
      result.pseudo_code = pseudoMatch[1];
    }
    if (tagsMatch) {
      const tagStrs = tagsMatch[1].match(/"([^"]+)"/g)?.map(s => s.replace(/"/g, ''));
      result.tags = tagStrs ?? [];
    }
    return result;
  }

  /** Persist enrichment results to symbols table (last-write-wins, BR-07). */
  private async storeResults(
    symbolId: number, response: CodeEnrichmentLLMResponse, strategy: EnrichmentStrategy,
  ): Promise<void> {
    const tags = validateTags(response.tags);
    const tagsJson = tags.length > 0 ? JSON.stringify(tags) : null;

    // SA4E-171: store pseudo_code for both FUNCTION and PEGA strategies
    let pseudoCode: string | null = null;
    if ((strategy === 'FUNCTION_SUMMARY' || strategy === 'PEGA_SUMMARY') && response.pseudo_code) {
      pseudoCode = response.pseudo_code.length > MAX_PSEUDO_CODE_LENGTH
        ? response.pseudo_code.slice(0, MAX_PSEUDO_CODE_LENGTH) + '...'
        : response.pseudo_code;
    }

    const now = new Date().toISOString();
    await this.adapter.runAsync(
      `UPDATE symbols SET summary = ?, pseudo_code = COALESCE(?, pseudo_code),
       llm_tags = ?, enrichment_status = 'COMPLETED', enriched_at = ? WHERE id = ?`,
      [response.summary, pseudoCode, tagsJson, now, symbolId],
    );
  }
}
