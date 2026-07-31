/**
 * Evolution Scheduler — manages background job intervals for decay and stagnation.
 * SA4E-53: converted to use DatabaseAdapter (async services).
 * Exports startScheduler/stopScheduler for integration with MemoryModule lifecycle.
 */

import type { DatabaseAdapter } from '../../../database/adapters/DatabaseAdapter.js';
import type { Logger } from 'pino';
import { DecayService } from './DecayService.js';
import { StagnationDetector } from './StagnationDetector.js';
import { runAutoPin } from './AutoPinService.js';

export interface SchedulerHandles {
  decayTimer: ReturnType<typeof setInterval> | null;
  stagnationTimer: ReturnType<typeof setInterval> | null;
  autoPinTimer: ReturnType<typeof setInterval> | null;
}

const MS_PER_HOUR = 3_600_000;
const STAGNATION_INTERVAL_HOURS = 6;
const DEFAULT_DECAY_INTERVAL_HOURS = 24;
/** Auto-pin runs every 2 hours. */
const AUTO_PIN_INTERVAL_HOURS = 2;

export function startScheduler(adapter: DatabaseAdapter, logger: Logger): SchedulerHandles {
  const log = logger.child({ service: 'evolution-scheduler' });

  const decayMs = DEFAULT_DECAY_INTERVAL_HOURS * MS_PER_HOUR;
  const stagnationMs = STAGNATION_INTERVAL_HOURS * MS_PER_HOUR;
  const autoPinMs = AUTO_PIN_INTERVAL_HOURS * MS_PER_HOUR;

  const decayTimer = setInterval(() => {
    runDecayJob(adapter, logger, log);
  }, decayMs);

  const stagnationTimer = setInterval(() => {
    runStagnationJob(adapter, logger, log);
  }, stagnationMs);

  // SA4E-80: Auto-pin high-quality entries periodically
  const autoPinTimer = setInterval(() => {
    runAutoPinJob(adapter, log);
  }, autoPinMs);

  // Run auto-pin once on startup (after 30s delay for modules to settle)
  setTimeout(() => runAutoPinJob(adapter, log), 30_000);

  log.info({ decayIntervalH: DEFAULT_DECAY_INTERVAL_HOURS, stagnationIntervalH: STAGNATION_INTERVAL_HOURS }, 'Scheduler started');
  return { decayTimer, stagnationTimer, autoPinTimer };
}

export function stopScheduler(handles: SchedulerHandles): void {
  if (handles.decayTimer) clearInterval(handles.decayTimer);
  if (handles.stagnationTimer) clearInterval(handles.stagnationTimer);
  if (handles.autoPinTimer) clearInterval(handles.autoPinTimer);
  handles.decayTimer = null;
  handles.stagnationTimer = null;
  handles.autoPinTimer = null;
}

function runDecayJob(adapter: DatabaseAdapter, logger: Logger, log: Logger): void {
  const svc = new DecayService(adapter, logger);
  svc.runDecayCycle().then(result => {
    if (result.decayed_count > 0) {
      log.info(result, 'Scheduled decay cycle completed');
    }
  }).catch((err: unknown) => {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === 'JOB_IN_PROGRESS') return;
    log.error({ err: msg }, 'Scheduled decay cycle failed');
  });
}

function runStagnationJob(adapter: DatabaseAdapter, logger: Logger, log: Logger): void {
  const detector = new StagnationDetector(adapter, logger);
  detector.analyze().then(report => {
    if (report.count > 0) {
      log.info({ stagnantCount: report.count }, 'Stagnation detected');
    }
  }).catch((err: unknown) => {
    const msg = err instanceof Error ? err.message : String(err);
    log.error({ err: msg }, 'Stagnation check failed');
  });
}

/** SA4E-80: Auto-pin entries with quality_score >= 80. */
function runAutoPinJob(adapter: DatabaseAdapter, log: Logger): void {
  runAutoPin(adapter).then(count => {
    if (count > 0) {
      log.info({ pinned: count }, 'Auto-pin completed');
    }
  }).catch((err: unknown) => {
    log.warn({ err: err instanceof Error ? err.message : String(err) }, 'Auto-pin failed (non-fatal)');
  });
}
