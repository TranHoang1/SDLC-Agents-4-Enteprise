/**
 * ScopePromotionService — Hybrid auto-promotion logic (Option D).
 *
 * Rules:
 * 1. Agent can ingest directly as USER (default) or PROJECT (explicit)
 * 2. Background scan detects high-value USER entries → auto-suggest to PROJECT
 * 3. PROJECT → SHARED: ALWAYS requires admin approval (cross-project impact)
 *
 * Auto-promotion criteria (USER → PROJECT):
 * - citations >= 2 (cross-agent usage)
 * - access_count >= 5 (frequently accessed)
 * - quality_score >= 70 (if scored)
 * - age >= 24h (not transient working memory)
 *
 * Entries matching ANY 2 of these → queued for PROJECT promotion.
 */

import type Database from 'better-sqlite3';
import type { Logger } from 'pino';
import type { KBScope } from './models.js';

export interface PromotionCandidate {
  entryId: number;
  currentScope: KBScope;
  targetScope: KBScope;
  reason: string;
  score: number;
}

export interface PromotionConfig {
  /** Min citations for auto-suggest (default: 2) */
  minCitations: number;
  /** Min access count (default: 5) */
  minAccessCount: number;
  /** Min quality score 0-100 (default: 70) */
  minQualityScore: number;
  /** Min age in hours before eligible (default: 24) */
  minAgeHours: number;
  /** Min criteria met for auto-suggest (default: 2) */
  minCriteriaMet: number;
  /** Auto-approve USER→PROJECT or require manual review (default: false) */
  autoApproveToProject: boolean;
}

const DEFAULT_CONFIG: PromotionConfig = {
  minCitations: 2,
  minAccessCount: 5,
  minQualityScore: 70,
  minAgeHours: 24,
  minCriteriaMet: 2,
  autoApproveToProject: false,
};

export class ScopePromotionService {
  private readonly db: Database.Database;
  private readonly logger: Logger;
  private readonly config: PromotionConfig;

  constructor(db: Database.Database, logger: Logger, config?: Partial<PromotionConfig>) {
    this.db = db;
    this.logger = logger.child({ service: 'scope-promotion' });
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.ensurePromotionQueueTable();
  }

  /** Create kb_promotion_queue if not exists. */
  private ensurePromotionQueueTable(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS kb_promotion_queue (
        promotion_id TEXT PRIMARY KEY,
        entry_id INTEGER NOT NULL,
        source_tier TEXT NOT NULL,
        target_tier TEXT NOT NULL,
        reason TEXT NOT NULL,
        score REAL NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'PENDING',
        review_comment TEXT,
        reviewed_by TEXT,
        reviewed_at TEXT,
        cooldown_until TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (entry_id) REFERENCES knowledge_entries(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_kpq_status ON kb_promotion_queue(status);
      CREATE INDEX IF NOT EXISTS idx_kpq_entry ON kb_promotion_queue(entry_id);
    `);
  }

  /**
   * Scan USER-scope entries and find promotion candidates.
   * Called periodically (e.g., every hour or on-demand via tool).
   */
  scanForPromotionCandidates(limit = 50): PromotionCandidate[] {
    const candidates: PromotionCandidate[] = [];
    const minAge = new Date(Date.now() - this.config.minAgeHours * 3600_000).toISOString();

    // Get USER entries older than minAgeHours, not archived, not already queued
    const entries = this.db.prepare(`
      SELECT ke.id, ke.summary, ke.type, ke.access_count, ke.quality_score, ke.created_at
      FROM knowledge_entries ke
      WHERE ke.scope = 'USER'
        AND ke.archived = 0
        AND ke.created_at <= ?
        AND ke.id NOT IN (
          SELECT entry_id FROM kb_promotion_queue
          WHERE status IN ('PENDING', 'APPROVED')
        )
      ORDER BY ke.access_count DESC
      LIMIT ?
    `).all(minAge, limit) as any[];

    for (const entry of entries) {
      const criteria = this.evaluateCriteria(entry);
      if (criteria.metCount >= this.config.minCriteriaMet) {
        candidates.push({
          entryId: entry.id,
          currentScope: 'USER',
          targetScope: 'PROJECT',
          reason: criteria.reasons.join('; '),
          score: criteria.score,
        });
      }
    }

    this.logger.info({ scanned: entries.length, candidates: candidates.length }, 'Promotion scan complete');
    return candidates;
  }

  /**
   * Evaluate promotion criteria for a single entry.
   */
  private evaluateCriteria(entry: any): { metCount: number; reasons: string[]; score: number } {
    const reasons: string[] = [];
    let metCount = 0;
    let score = 0;

    // Criterion 1: Citations >= threshold
    const citationCount = (this.db.prepare(
      'SELECT COUNT(*) as cnt FROM citations WHERE entry_id = ?'
    ).get(entry.id) as any)?.cnt ?? 0;

    if (citationCount >= this.config.minCitations) {
      metCount++;
      reasons.push(`citations=${citationCount}`);
      score += 30;
    }

    // Criterion 2: Access count >= threshold
    if (entry.access_count >= this.config.minAccessCount) {
      metCount++;
      reasons.push(`access_count=${entry.access_count}`);
      score += 25;
    }

    // Criterion 3: Quality score >= threshold
    if (entry.quality_score !== null && entry.quality_score >= this.config.minQualityScore) {
      metCount++;
      reasons.push(`quality=${entry.quality_score}`);
      score += 25;
    }

    // Criterion 4: Cross-agent usage (cited by different agents)
    const crossAgentCites = (this.db.prepare(
      'SELECT COUNT(DISTINCT cited_by) as cnt FROM citations WHERE entry_id = ?'
    ).get(entry.id) as any)?.cnt ?? 0;

    if (crossAgentCites >= 2) {
      metCount++;
      reasons.push(`cross_agent_cites=${crossAgentCites}`);
      score += 20;
    }

    return { metCount, reasons, score };
  }

  /**
   * Queue candidates for promotion review.
   * If autoApproveToProject is true, USER→PROJECT promotions are applied immediately.
   */
  queueCandidates(candidates: PromotionCandidate[]): { queued: number; autoApproved: number } {
    let queued = 0;
    let autoApproved = 0;

    const insertStmt = this.db.prepare(`
      INSERT OR IGNORE INTO kb_promotion_queue
      (promotion_id, entry_id, source_tier, target_tier, reason, score, status)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const promoteStmt = this.db.prepare(`
      UPDATE knowledge_entries SET scope = ?, updated_at = datetime('now') WHERE id = ?
    `);

    const transaction = this.db.transaction((items: PromotionCandidate[]) => {
      for (const c of items) {
        const promotionId = `promo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

        if (this.config.autoApproveToProject && c.targetScope === 'PROJECT') {
          // Auto-approve: promote directly
          promoteStmt.run(c.targetScope, c.entryId);
          insertStmt.run(promotionId, c.entryId, c.currentScope, c.targetScope, c.reason, c.score, 'APPROVED');
          autoApproved++;
        } else {
          // Queue for manual review
          insertStmt.run(promotionId, c.entryId, c.currentScope, c.targetScope, c.reason, c.score, 'PENDING');
          queued++;
        }
      }
    });

    transaction(candidates);
    this.logger.info({ queued, autoApproved }, 'Promotion candidates processed');
    return { queued, autoApproved };
  }

  /**
   * Run full promotion cycle: scan → queue.
   */
  runPromotionCycle(): string {
    const candidates = this.scanForPromotionCandidates();
    if (candidates.length === 0) {
      return 'No promotion candidates found.';
    }
    const { queued, autoApproved } = this.queueCandidates(candidates);
    return `Promotion cycle: ${candidates.length} candidates found. Queued: ${queued}, Auto-approved: ${autoApproved}.`;
  }

  /** Get pending promotions for admin review. */
  listPending(limit = 20): any[] {
    return this.db.prepare(`
      SELECT pq.*, ke.summary, ke.type, ke.tier, ke.scope
      FROM kb_promotion_queue pq
      JOIN knowledge_entries ke ON ke.id = pq.entry_id
      WHERE pq.status = 'PENDING'
      ORDER BY pq.score DESC, pq.created_at ASC
      LIMIT ?
    `).all(limit) as any[];
  }

  /** Approve a pending promotion. */
  approve(entryId: number, reviewerId: string, comment: string): boolean {
    const promo = this.db.prepare(
      'SELECT * FROM kb_promotion_queue WHERE entry_id = ? AND status = ?'
    ).get(entryId, 'PENDING') as any;
    if (!promo) return false;

    this.db.prepare(`
      UPDATE kb_promotion_queue
      SET status = 'APPROVED', reviewed_by = ?, review_comment = ?, reviewed_at = datetime('now')
      WHERE promotion_id = ?
    `).run(reviewerId, comment, promo.promotion_id);

    this.db.prepare(
      `UPDATE knowledge_entries SET scope = ?, updated_at = datetime('now') WHERE id = ?`
    ).run(promo.target_tier, entryId);

    this.logger.info({ entryId, target: promo.target_tier, reviewer: reviewerId }, 'Promotion approved');
    return true;
  }

  /** Reject a pending promotion (no cooldown — can be re-scanned next cycle). */
  reject(entryId: number, reviewerId: string, comment: string): boolean {
    const promo = this.db.prepare(
      'SELECT * FROM kb_promotion_queue WHERE entry_id = ? AND status = ?'
    ).get(entryId, 'PENDING') as any;
    if (!promo) return false;

    this.db.prepare(`
      UPDATE kb_promotion_queue
      SET status = 'REJECTED', reviewed_by = ?, review_comment = ?, reviewed_at = datetime('now')
      WHERE promotion_id = ?
    `).run(reviewerId, comment, promo.promotion_id);

    this.logger.info({ entryId, reviewer: reviewerId }, 'Promotion rejected (no cooldown)');
    return true;
  }

  /** Request promotion to SHARED scope (always manual). */
  requestSharedPromotion(entryId: number, reason: string): boolean {
    const entry = this.db.prepare(
      'SELECT * FROM knowledge_entries WHERE id = ? AND scope = ?'
    ).get(entryId, 'PROJECT') as any;
    if (!entry) return false;

    const existing = this.db.prepare(
      "SELECT 1 FROM kb_promotion_queue WHERE entry_id = ? AND target_tier = 'SHARED' AND status = 'PENDING'"
    ).get(entryId);
    if (existing) return false;

    const promotionId = `promo-shared-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    this.db.prepare(`
      INSERT INTO kb_promotion_queue (promotion_id, entry_id, source_tier, target_tier, reason, score, status)
      VALUES (?, ?, 'PROJECT', 'SHARED', ?, 0, 'PENDING')
    `).run(promotionId, entryId, reason);

    this.logger.info({ entryId, reason }, 'SHARED promotion requested');
    return true;
  }

  /**
   * Auto-promote all USER entries related to a ticket to PROJECT scope.
   * Triggered when code is merged to main/master or released.
   * This bypasses the scan criteria — merge/release = team-validated knowledge.
   */
  promoteOnMerge(ticketKey: string): { promoted: number; skipped: number } {
    // Find all USER-scope entries tagged with or sourced from this ticket
    const entries = this.db.prepare(`
      SELECT id, scope FROM knowledge_entries
      WHERE scope = 'USER'
        AND archived = 0
        AND (
          tags LIKE ? OR source LIKE ? OR summary LIKE ?
        )
    `).all(`%${ticketKey}%`, `%${ticketKey}%`, `%${ticketKey}%`) as any[];

    let promoted = 0;
    let skipped = 0;

    const promoteStmt = this.db.prepare(
      `UPDATE knowledge_entries SET scope = 'PROJECT', updated_at = datetime('now') WHERE id = ?`
    );
    const logStmt = this.db.prepare(
      `INSERT INTO consolidation_log (entry_id, from_tier, to_tier, reason) VALUES (?, 'USER', 'PROJECT', ?)`
    );

    const transaction = this.db.transaction((items: any[]) => {
      for (const entry of items) {
        if (entry.scope !== 'USER') { skipped++; continue; }
        promoteStmt.run(entry.id);
        logStmt.run(entry.id, `Auto-promoted on merge/release: ${ticketKey}`);
        promoted++;
      }
    });

    transaction(entries);
    this.logger.info({ ticketKey, promoted, skipped, total: entries.length }, 'promoteOnMerge completed');
    return { promoted, skipped };
  }
}
