/**
 * InstinctPromotionService — handles instinct-to-knowledge promotion.
 * Checks criteria (confidence >= ceiling AND outcomes >= threshold)
 * and performs irreversible promotion (type changes from INSTINCT to KNOWLEDGE).
 * SA4E-121: Instincts and Confidence Scoring System.
 */

import type { DatabaseAdapter } from '../../../database/adapters/DatabaseAdapter.js';
import { DialectHelper } from '../../../database/dialect/DialectHelper.js';
import type { Logger } from 'pino';
import { InstinctConfigService } from './InstinctConfigService.js';

/** Result of a promotion check/execution. */
export interface PromotionResult {
  promoted: boolean;
  entry_id: number;
  new_confidence?: number;
  reason?: string;
}

export class InstinctPromotionService {
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
    this.logger = logger.child({ service: 'instinct-promotion' });
  }

  /**
   * Check if entry meets promotion criteria and promote if so.
   * Criteria: confidence >= ceiling AND successful outcomes >= threshold.
   * Promotion is irreversible — type changes to KNOWLEDGE, confidence = 1.0.
   */
  async checkAndPromote(entryId: number): Promise<PromotionResult> {
    const meets = await this.meetsCriteria(entryId);
    if (!meets) {
      return { promoted: false, entry_id: entryId, reason: 'CRITERIA_NOT_MET' };
    }
    await this.executePromotion(entryId);
    this.logger.info({ entryId }, 'Instinct promoted to knowledge');
    return { promoted: true, entry_id: entryId, new_confidence: 1.0 };
  }

  /**
   * Manual promotion — bypasses criteria check.
   * Used for admin override via mem_verify action='promote'.
   */
  async manualPromote(entryId: number): Promise<PromotionResult> {
    const entry = await this.adapter.getAsync<{ id: number; type: string }>(
      'SELECT id, type FROM knowledge_entries WHERE id = ?', [entryId],
    );
    if (!entry) {
      return { promoted: false, entry_id: entryId, reason: 'ENTRY_NOT_FOUND' };
    }
    await this.executePromotion(entryId);
    this.logger.info({ entryId }, 'Instinct manually promoted');
    return { promoted: true, entry_id: entryId, new_confidence: 1.0 };
  }

  private async meetsCriteria(entryId: number): Promise<boolean> {
    const config = await this.configService.getInstinctConfig();

    const entry = await this.adapter.getAsync<{
      id: number; confidence: number; type: string; tags: string;
    }>(
      'SELECT id, confidence, type, tags FROM knowledge_entries WHERE id = ?',
      [entryId],
    );
    if (!entry) return false;

    // Must be an instinct entry
    const isInstinct = entry.type === 'INSTINCT' || entry.tags.includes('instinct');
    if (!isInstinct) return false;

    // Confidence must be at or above ceiling
    if (entry.confidence < config.instinct_confidence_ceiling) return false;

    // Must have sufficient successful outcomes
    const stats = await this.adapter.getAsync<{ success_count: number }>(
      `SELECT COUNT(*) as success_count FROM entry_outcomes
       WHERE entry_id = ? AND outcome = 'success'`,
      [entryId],
    );
    return (stats?.success_count ?? 0) >= config.instinct_promotion_threshold;
  }

  /** Execute promotion: type=KNOWLEDGE, confidence=1.0, remove instinct tag. */
  private async executePromotion(entryId: number): Promise<void> {
    await this.adapter.runAsync(
      `UPDATE knowledge_entries
       SET type = 'KNOWLEDGE', confidence = 1.0, updated_at = ${this.dialect.now()}
       WHERE id = ?`,
      [entryId],
    );

    // Remove 'instinct' from tags
    const entry = await this.adapter.getAsync<{ tags: string }>(
      'SELECT tags FROM knowledge_entries WHERE id = ?', [entryId],
    );
    if (entry?.tags) {
      const cleaned = entry.tags
        .split(',')
        .filter(t => t.trim() !== 'instinct')
        .join(',');
      await this.adapter.runAsync(
        `UPDATE knowledge_entries SET tags = ? WHERE id = ?`,
        [cleaned, entryId],
      );
    }
  }
}
