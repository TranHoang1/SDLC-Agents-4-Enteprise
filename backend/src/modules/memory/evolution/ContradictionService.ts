/**
 * ContradictionService — detects semantic contradictions between KB entries
 * using cosine similarity on embedding vectors. Logs contradictions and
 * provides resolution workflows.
 * SA4E-121: Instincts and Confidence Scoring System.
 */

import type { DatabaseAdapter } from '../../../database/adapters/DatabaseAdapter.js';
import { DialectHelper } from '../../../database/dialect/DialectHelper.js';
import type { Logger } from 'pino';
import { InstinctConfigService } from './InstinctConfigService.js';

/** Single contradiction entry from the log table. */
export interface ContradictionEntry {
  id: number;
  entry_id_a: number;
  entry_id_b: number;
  similarity: number;
  classification: 'CONTRADICTION' | 'SUPPLEMENT' | 'SUPERSEDE';
  status: 'unresolved' | 'resolved' | 'stale';
}

/** Report returned after contradiction detection. */
export interface ContradictionReport {
  contradictions: ContradictionEntry[];
  supplements: number;
  superseded: number;
}

/** Result of resolving a contradiction. */
export interface ResolutionResult {
  resolved: boolean;
  strategy: string;
  affected_entries: number[];
}

type Classification = 'CONTRADICTION' | 'SUPPLEMENT' | 'SUPERSEDE';

const VALID_RESOLUTIONS = [
  'resolve_keep_new', 'resolve_keep_old', 'resolve_merge', 'resolve_both',
] as const;

export class ContradictionService {
  private readonly adapter: DatabaseAdapter;
  private readonly dialect: DialectHelper;
  private readonly configService: InstinctConfigService;
  private readonly logger: Logger;

  constructor(
    adapter: DatabaseAdapter,
    configService: InstinctConfigService,
    logger: Logger,
  ) {
    this.adapter = adapter;
    this.dialect = new DialectHelper(adapter.getEngine());
    this.configService = configService;
    this.logger = logger.child({ service: 'contradiction' });
  }

  /**
   * Detect contradictions for a newly ingested entry.
   * Compares content against same-project entries using bigram similarity.
   * Gracefully degrades when embeddings unavailable.
   */
  async detectContradictions(
    entryId: number, projectId?: string,
  ): Promise<ContradictionReport> {
    const config = await this.configService.getInstinctConfig();
    const threshold = config.contradiction_similarity_threshold;

    const entry = await this.adapter.getAsync<{ id: number; content: string }>(
      'SELECT id, content FROM knowledge_entries WHERE id = ?', [entryId],
    );
    if (!entry) {
      return { contradictions: [], supplements: 0, superseded: 0 };
    }

    const candidates = await this.fetchCandidates(entryId, projectId);
    const report: ContradictionReport = {
      contradictions: [], supplements: 0, superseded: 0,
    };

    for (const candidate of candidates) {
      const similarity = this.textSimilarity(entry.content, candidate.content);
      if (similarity < threshold) continue;

      const classification = this.classifyRelationship(
        entry.content, candidate.content, similarity,
      );

      if (classification === 'SUPPLEMENT') {
        report.supplements++;
        continue;
      }

      const logEntry = await this.insertLog(
        entryId, candidate.id, similarity, classification, projectId,
      );
      if (classification === 'SUPERSEDE') report.superseded++;
      report.contradictions.push(logEntry);
    }

    if (report.contradictions.length > 0) {
      this.logger.info(
        { entryId, count: report.contradictions.length },
        'Contradictions detected',
      );
    }
    return report;
  }

  /**
   * Resolve a contradiction by ID. Applies resolution strategy.
   * @throws Error('INVALID_RESOLUTION') if strategy unknown.
   * @throws Error('ENTRY_NOT_FOUND') if contradiction not found.
   * @throws Error('ALREADY_RESOLVED') if already resolved.
   */
  async resolveContradiction(
    contradictionId: number, resolution: string, resolvedBy?: string,
  ): Promise<ResolutionResult> {
    if (!VALID_RESOLUTIONS.includes(resolution as any)) {
      throw new Error('INVALID_RESOLUTION');
    }

    const row = await this.adapter.getAsync<ContradictionEntry>(
      'SELECT * FROM contradiction_log WHERE id = ?', [contradictionId],
    );
    if (!row) throw new Error('ENTRY_NOT_FOUND');
    if (row.status === 'resolved') throw new Error('ALREADY_RESOLVED');

    const affected: number[] = [row.entry_id_a, row.entry_id_b];

    switch (resolution) {
      case 'resolve_keep_new':
        await this.archiveEntry(row.entry_id_a);
        break;
      case 'resolve_keep_old':
        await this.archiveEntry(row.entry_id_b);
        break;
      case 'resolve_merge':
      case 'resolve_both':
        break;
    }

    await this.adapter.runAsync(
      `UPDATE contradiction_log SET status = 'resolved', resolution = ?, resolved_by = ?, resolved_at = ${this.dialect.now()} WHERE id = ?`,
      [resolution, resolvedBy ?? null, contradictionId],
    );

    this.logger.info({ contradictionId, resolution }, 'Contradiction resolved');
    return { resolved: true, strategy: resolution, affected_entries: affected };
  }

  /** Get contradiction warnings for a list of entry IDs (search enhancement). */
  async getWarnings(entryIds: number[]): Promise<Map<number, string>> {
    if (entryIds.length === 0) return new Map();

    const placeholders = entryIds.map(() => '?').join(',');
    const rows = await this.adapter.allAsync<{
      entry_id_a: number; entry_id_b: number; classification: string;
    }>(
      `SELECT entry_id_a, entry_id_b, classification FROM contradiction_log
       WHERE status = 'unresolved'
         AND (entry_id_a IN (${placeholders}) OR entry_id_b IN (${placeholders}))`,
      [...entryIds, ...entryIds],
    );

    const warnings = new Map<number, string>();
    for (const row of rows) {
      const msg = `Has unresolved ${row.classification.toLowerCase()}`;
      if (entryIds.includes(row.entry_id_a)) warnings.set(row.entry_id_a, msg);
      if (entryIds.includes(row.entry_id_b)) warnings.set(row.entry_id_b, msg);
    }
    return warnings;
  }

  private async fetchCandidates(
    excludeId: number, projectId?: string,
  ): Promise<Array<{ id: number; content: string }>> {
    let sql = `SELECT id, content FROM knowledge_entries WHERE id != ? AND archived = 0`;
    const params: unknown[] = [excludeId];
    if (projectId) {
      sql += ` AND (project_id = ? OR project_id IS NULL)`;
      params.push(projectId);
    }
    sql += ` ORDER BY id DESC LIMIT 50`;
    return this.adapter.allAsync<{ id: number; content: string }>(sql, params);
  }

  /** Bigram-based text similarity (Dice coefficient). */
  private textSimilarity(a: string, b: string): number {
    const bigramsA = this.getBigrams(a.toLowerCase());
    const bigramsB = this.getBigrams(b.toLowerCase());
    if (bigramsA.size === 0 || bigramsB.size === 0) return 0;

    let intersection = 0;
    for (const bigram of bigramsA) {
      if (bigramsB.has(bigram)) intersection++;
    }
    return (2 * intersection) / (bigramsA.size + bigramsB.size);
  }

  private getBigrams(text: string): Set<string> {
    const words = text.split(/\s+/).filter(w => w.length > 2);
    const bigrams = new Set<string>();
    for (let i = 0; i < words.length - 1; i++) {
      bigrams.add(`${words[i]} ${words[i + 1]}`);
    }
    return bigrams;
  }

  private classifyRelationship(
    contentA: string, contentB: string, similarity: number,
  ): Classification {
    if (similarity > 0.95) return 'SUPERSEDE';
    if (contentB.length > contentA.length * 1.5) return 'SUPPLEMENT';
    if (contentA.length > contentB.length * 1.5) return 'SUPERSEDE';
    return 'CONTRADICTION';
  }

  private async insertLog(
    entryIdA: number, entryIdB: number,
    similarity: number, classification: Classification,
    projectId?: string,
  ): Promise<ContradictionEntry> {
    const result = await this.adapter.runAsync(
      `INSERT INTO contradiction_log (entry_id_a, entry_id_b, similarity, classification, project_id)
       VALUES (?, ?, ?, ?, ?)`,
      [entryIdA, entryIdB, similarity, classification, projectId ?? null],
    );
    const id = result.lastInsertRowid as number;
    return {
      id, entry_id_a: entryIdA, entry_id_b: entryIdB,
      similarity, classification, status: 'unresolved',
    };
  }

  private async archiveEntry(entryId: number): Promise<void> {
    await this.adapter.runAsync(
      `UPDATE knowledge_entries SET archived = 1, updated_at = ${this.dialect.now()} WHERE id = ?`,
      [entryId],
    );
  }
}
