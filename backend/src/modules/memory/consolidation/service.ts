import type { DatabaseAdapter } from '../../../database/adapters/DatabaseAdapter.js';
import type { ConsolidationResult } from '../models.js';
import { DialectHelper } from '../../../database/dialect/DialectHelper.js';

const TIER_ORDER: Record<string, number> = { WORKING: 0, EPISODIC: 1, SEMANTIC: 2 };
const TIER_NAMES = ['WORKING', 'EPISODIC', 'SEMANTIC'];

export interface ConsolidationConfig {
  workingToEpisodicMinHours: number;
  workingToEpisodicMinAccess: number;
  workingToEpisodicMinQuality: number;
  episodicToSemanticMinDays: number;
  episodicToSemanticMinAccess: number;
  episodicToSemanticMinQuality: number;
  batchSize: number;
}

export const DEFAULT_CONSOLIDATION_CONFIG: ConsolidationConfig = {
  workingToEpisodicMinHours: 24,
  workingToEpisodicMinAccess: 3,
  workingToEpisodicMinQuality: 50,
  episodicToSemanticMinDays: 7,
  episodicToSemanticMinAccess: 10,
  episodicToSemanticMinQuality: 70,
  batchSize: 100,
};

export class TierConsolidationService {
  private adapter: DatabaseAdapter;
  private dialect: DialectHelper;

  constructor(
    adapter: DatabaseAdapter,
    private config: ConsolidationConfig = DEFAULT_CONSOLIDATION_CONFIG,
  ) {
    this.adapter = adapter;
    this.dialect = new DialectHelper(adapter.getEngine());
  }

  getConfig(): ConsolidationConfig { return this.config; }

  updateConfig(partial: Partial<ConsolidationConfig>): void {
    this.config = { ...this.config, ...partial };
  }

  async runConsolidation(dryRun = false, targetTier?: string): Promise<ConsolidationResult> {
    const result: ConsolidationResult = { promoted: 0, demoted: 0, expired: 0 };

    const tiersToProcess = targetTier
      ? TIER_NAMES.slice(0, TIER_ORDER[targetTier] ?? TIER_NAMES.length)
      : TIER_NAMES;

    for (let i = 0; i < tiersToProcess.length; i++) {
      const fromTier = tiersToProcess[i];
      const toTierIdx = TIER_ORDER[fromTier] + 1;
      if (toTierIdx >= TIER_NAMES.length) continue;
      const toTier = TIER_NAMES[toTierIdx];
      if (targetTier && TIER_ORDER[toTier] > TIER_ORDER[targetTier]) continue;
      const promoted = await this.promoteTier(fromTier, toTier, dryRun);
      result.promoted += promoted;
    }

    if (!targetTier) {
      const demoted = await this.demoteStale(dryRun);
      result.demoted += demoted;
      const expired = await this.archiveExpired(dryRun);
      result.expired += expired;
    }

    return result;
  }

  private async promoteTier(fromTier: string, toTier: string, dryRun: boolean): Promise<number> {
    let candidates: any[] = [];

    if (fromTier === 'WORKING' && toTier === 'EPISODIC') {
      candidates = await this.adapter.allAsync<any>(
        `SELECT id, tier, access_count, quality_score, created_at FROM knowledge_entries
         WHERE tier = ? AND archived = 0
           AND quality_score >= ?
           AND access_count >= ?
           AND ${this.dialect.dateColumnCompare('created_at', '<= now -', `-${this.config.workingToEpisodicMinHours} hours`)}
         LIMIT ?`,
        [fromTier, this.config.workingToEpisodicMinQuality, this.config.workingToEpisodicMinAccess,
         this.config.batchSize],
      );
    } else if (fromTier === 'EPISODIC' && toTier === 'SEMANTIC') {
      candidates = await this.adapter.allAsync<any>(
        `SELECT id, tier, access_count, quality_score, structured_map, created_at FROM knowledge_entries
         WHERE tier = ? AND archived = 0
           AND quality_score >= ?
           AND access_count >= ?
           AND structured_map != '{}'
           AND ${this.dialect.dateColumnCompare('created_at', '<= now -', `-${this.config.episodicToSemanticMinDays} days`)}
         LIMIT ?`,
        [fromTier, this.config.episodicToSemanticMinQuality, this.config.episodicToSemanticMinAccess,
         this.config.batchSize],
      );
    }

    if (candidates.length === 0) return 0;
    if (dryRun) return candidates.length;

    const ids = candidates.map((c: any) => c.id);
    const now = this.dialect.now();

    await this.adapter.runAsync(
      `UPDATE knowledge_entries SET tier = ?, updated_at = ${now} WHERE id IN (${ids.join(',')})`,
      [toTier],
    );

    for (const c of candidates) {
      await this.adapter.runAsync(
        `INSERT INTO consolidation_log (entry_id, from_tier, to_tier, reason) VALUES (?, ?, ?, ?)`,
        [c.id, fromTier, toTier, `auto-promote: meets ${fromTier}→${toTier} criteria`],
      );
    }

    return candidates.length;
  }

  private async demoteStale(dryRun: boolean): Promise<number> {
    const candidates = await this.adapter.allAsync<any>(
      `SELECT id, tier, access_count, last_accessed_at, created_at FROM knowledge_entries
       WHERE tier IN ('EPISODIC', 'SEMANTIC') AND archived = 0
         AND last_accessed_at IS NOT NULL
         AND ${this.dialect.dateColumnCompare('last_accessed_at', '<= now -', '-30 days')}
         AND access_count < 2
       LIMIT ?`,
      [this.config.batchSize],
    );

    if (candidates.length === 0) return 0;
    if (dryRun) return candidates.length;

    for (const c of candidates) {
      const currentTier = c.tier as string;
      const idx = TIER_ORDER[currentTier] ?? 1;
      const targetTier = TIER_NAMES[Math.max(0, idx - 1)];
      if (targetTier === currentTier) continue;

      await this.adapter.runAsync(
        `UPDATE knowledge_entries SET tier = ?, updated_at = ${this.dialect.now()} WHERE id = ?`,
        [targetTier, c.id],
      );
      await this.adapter.runAsync(
        `INSERT INTO consolidation_log (entry_id, from_tier, to_tier, reason) VALUES (?, ?, ?, ?)`,
        [c.id, currentTier, targetTier, 'auto-demote: stale (30d no access, <2 total)'],
      );
    }

    return candidates.length;
  }

  private async archiveExpired(dryRun: boolean): Promise<number> {
    const candidates = await this.adapter.allAsync<any>(
      `SELECT id FROM knowledge_entries
       WHERE archived = 0 AND expires_at IS NOT NULL
         AND ${this.dialect.dateColumnCompare('expires_at', '<= now')}
       LIMIT ?`,
      [this.config.batchSize],
    );

    if (candidates.length === 0) return 0;
    if (dryRun) return candidates.length;

    const ids = candidates.map((c: any) => c.id);
    await this.adapter.runAsync(
      `UPDATE knowledge_entries SET archived = 1, updated_at = ${this.dialect.now()} WHERE id IN (${ids.join(',')})`,
    );

    for (const c of candidates) {
      await this.adapter.runAsync(
        `INSERT INTO consolidation_log (entry_id, from_tier, to_tier, reason) VALUES (?, ?, ?, ?)`,
        [c.id, 'any', 'archived', 'auto-archive: expired'],
      );
    }

    return candidates.length;
  }
}
