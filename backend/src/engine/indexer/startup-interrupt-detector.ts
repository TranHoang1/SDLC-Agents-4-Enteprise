/**
 * SA4E-101 — StartupInterruptDetector: runs during server initialization
 * (before accepting HTTP requests). Marks stale `running` records as
 * `interrupted` so the extension can surface a "backend restarted" state
 * instead of a permanently-spinning progress bar.
 *
 * On DB error: logs CRITICAL and continues startup (graceful degradation, EF-04).
 */

import pino from 'pino';
import { IndexOperationRepository } from '../../database/repositories/IndexOperationRepository.js';

const logger = pino({ name: 'startup-interrupt-detector' });

/** Records not updated within this window at boot are considered interrupted. */
const STALE_THRESHOLD_SECONDS = 60;

export async function runStartupInterruptDetection(): Promise<void> {
  try {
    const repo = new IndexOperationRepository();
    const stale = await repo.findStaleRunning(STALE_THRESHOLD_SECONDS);
    if (stale.length === 0) {
      logger.info('[startup-interrupt] no stale running operations');
      return;
    }
    for (const op of stale) {
      await repo.updateStatus(op.id, 'interrupted');
    }
    logger.warn(
      { count: stale.length },
      '[startup-interrupt] marked stale running operations as interrupted',
    );
  } catch (err) {
    logger.error(
      { err },
      '[startup-interrupt] CRITICAL: detection failed, continuing startup (graceful degradation)',
    );
  }
}
