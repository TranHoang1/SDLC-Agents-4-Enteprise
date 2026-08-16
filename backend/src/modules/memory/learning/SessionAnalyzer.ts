/**
 * SA4E-122: SessionAnalyzer — orchestrates pattern extraction,
 * classification, and ingestion into KB as instincts.
 * Facade pattern: simplifies the learning pipeline for consumers.
 */

import type { MemoryEngine } from '../engine/core.js';
import type { ScopeContext, KBScope } from '../models.js';
import { PatternExtractor } from './PatternExtractor.js';
import type { ExtractedPattern, LearningConfig, LearningResult, IngestedPattern } from './types.js';
import { DEFAULT_LEARNING_CONFIG } from './types.js';

/** Ingestion parameters matching the engine's insert interface. */
interface IngestParams {
  content: string;
  summary: string;
  type: string;
  tier: string;
  scope: KBScope;
  source: string;
  tags: string;
  confidence: number;
  user_id: string | null;
  project_id: string | null;
  agent_name: string;
}

export class SessionAnalyzer {
  private readonly engine: MemoryEngine;
  private readonly extractor: PatternExtractor;
  private readonly config: LearningConfig;

  constructor(engine: MemoryEngine, config?: Partial<LearningConfig>) {
    this.engine = engine;
    this.config = { ...DEFAULT_LEARNING_CONFIG, ...config };
    this.extractor = new PatternExtractor(this.config);
  }

  /**
   * Analyze a session transcript: extract patterns and ingest as instincts.
   * @param transcript The full session text to analyze
   * @param scopeCtx Optional scope context for KB isolation
   * @returns Summary of what was learned
   */
  async analyze(transcript: string, scopeCtx?: ScopeContext): Promise<LearningResult> {
    const patterns = this.extractor.extract(transcript);
    const ingested: IngestedPattern[] = [];
    let skippedCount = 0;

    for (const pattern of patterns) {
      const isDuplicate = await this.isDuplicate(pattern);
      if (isDuplicate) {
        skippedCount++;
        continue;
      }

      const entryId = await this.ingestAsInstinct(pattern, scopeCtx);
      ingested.push({
        entryId,
        content: pattern.content,
        type: pattern.type,
        confidence: this.config.initialInstinctConfidence,
      });
    }

    return {
      ingested,
      extractedCount: patterns.length,
      skippedCount,
    };
  }

  /** Ingest a single pattern as an INSTINCT entry in the KB. */
  private async ingestAsInstinct(
    pattern: ExtractedPattern,
    scopeCtx?: ScopeContext,
  ): Promise<number> {
    const params: IngestParams = {
      content: pattern.content,
      summary: this.buildSummary(pattern),
      type: 'INSTINCT',
      tier: 'T1',
      scope: 'PROJECT',
      source: `auto-learn/${pattern.type}`,
      tags: this.buildTags(pattern),
      confidence: this.config.initialInstinctConfidence,
      user_id: scopeCtx?.userId ?? null,
      project_id: scopeCtx?.projectId ?? null,
      agent_name: 'auto-learner',
    };

    return this.engine.insert(params);
  }

  /** Check if a similar pattern already exists in KB. */
  private async isDuplicate(pattern: ExtractedPattern): Promise<boolean> {
    try {
      // Use first few words as search query, sanitized for FTS
      const query = pattern.content
        .replace(/[^\w\s]/g, ' ')
        .trim()
        .split(/\s+/)
        .slice(0, 8)
        .join(' ');
      if (!query) return false;
      const results = await this.engine.search(query, 3, undefined, 'INSTINCT');
      // Consider duplicate if any result has very high text overlap
      return results.some(r => this.textSimilarity(r.entry.content, pattern.content) > 0.8);
    } catch {
      // FTS errors are non-fatal — assume not duplicate
      return false;
    }
  }

  /** Simple Jaccard-like similarity on word sets. */
  private textSimilarity(a: string, b: string): number {
    const wordsA = new Set(a.toLowerCase().split(/\s+/));
    const wordsB = new Set(b.toLowerCase().split(/\s+/));
    const intersection = [...wordsA].filter(w => wordsB.has(w)).length;
    const union = new Set([...wordsA, ...wordsB]).size;
    return union === 0 ? 0 : intersection / union;
  }

  /** Build a concise summary for the instinct entry. */
  private buildSummary(pattern: ExtractedPattern): string {
    const typeLabel = pattern.type.replace('_', ' ');
    const short = pattern.content.slice(0, 80).replace(/\s+/g, ' ');
    return `[Instinct:${typeLabel}] ${short}`;
  }

  /** Build comma-separated tags string. */
  private buildTags(pattern: ExtractedPattern): string {
    const tags = ['instinct', 'auto-learned', ...pattern.tags];
    return [...new Set(tags)].join(',');
  }
}
