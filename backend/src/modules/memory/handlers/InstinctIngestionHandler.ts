/**
 * InstinctIngestionHandler — orchestrates instinct-specific ingestion logic.
 * Called by mem_ingest dispatcher when instinct indicators detected.
 * Computes initial confidence, applies instinct tags, and triggers
 * async contradiction detection post-ingest.
 * SA4E-121: Instincts and Confidence Scoring System.
 */

import type { Logger } from 'pino';
import { InstinctConfigService } from '../evolution/InstinctConfigService.js';
import type { ContradictionService, ContradictionReport } from '../evolution/ContradictionService.js';

/** Arguments passed from ingest dispatcher. */
export interface IngestArgs {
  content: string;
  type?: string;
  instinct?: boolean;
  confidence?: number;
  source?: string;
  tags?: string;
  scope?: string;
}

export class InstinctIngestionHandler {
  private readonly configService: InstinctConfigService;
  private readonly contradictionService: ContradictionService;
  private readonly logger: Logger;

  constructor(
    configService: InstinctConfigService,
    contradictionService: ContradictionService,
    logger: Logger,
  ) {
    this.configService = configService;
    this.contradictionService = contradictionService;
    this.logger = logger.child({ handler: 'instinct-ingestion' });
  }

  /** Detect if the ingest args indicate an instinct entry. */
  isInstinct(args: IngestArgs): boolean {
    return args.type === 'INSTINCT' || args.instinct === true;
  }

  /**
   * Compute initial confidence for an instinct entry.
   * Clamps user-provided confidence within floor/ceiling bounds.
   */
  async computeInitialConfidence(args: IngestArgs): Promise<number> {
    const config = await this.configService.getInstinctConfig();
    let confidence = args.confidence ?? config.instinct_initial_confidence;
    confidence = Math.max(config.instinct_confidence_floor, confidence);
    confidence = Math.min(config.instinct_confidence_ceiling, confidence);
    return confidence;
  }

  /** Ensure 'instinct' tag is present in the tags string. */
  applyInstinctTags(existingTags: string): string {
    const tagList = existingTags
      .split(',')
      .map(t => t.trim())
      .filter(Boolean);
    if (!tagList.includes('instinct')) {
      tagList.push('instinct');
    }
    return tagList.join(',');
  }

  /**
   * Run contradiction detection asynchronously (post-ingest).
   * Does not block ingestion — returns null if detection fails.
   */
  async runContradictionDetection(
    entryId: number, projectId?: string,
  ): Promise<ContradictionReport | null> {
    try {
      return await this.contradictionService.detectContradictions(entryId, projectId);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn({ entryId, err: msg }, 'Contradiction detection failed (degraded)');
      return null;
    }
  }
}
