/**
 * Evolution dispatcher — handles mem_outcome, mem_verify, mem_configure_decay tool calls.
 * SA4E-53: fully async — all services now use DatabaseAdapter.
 */

import type { MemoryEngine } from '../engine/core.js';
import { OutcomeService } from '../evolution/OutcomeService.js';
import { DecayService } from '../evolution/DecayService.js';
import { EpochService } from '../evolution/EpochService.js';
import { StagnationDetector } from '../evolution/StagnationDetector.js';
import { InstinctConfigService } from '../evolution/InstinctConfigService.js';
import { InstinctPromotionService } from '../evolution/InstinctPromotionService.js';
import { ContradictionService } from '../evolution/ContradictionService.js';
import pino from 'pino';

const logger = pino({ name: 'evolution-dispatcher' });

type Args = Record<string, unknown>;

export async function handleOutcome(engine: MemoryEngine, a: Args): Promise<string> {
  const entryId = a.entry_id as number | undefined;
  if (!entryId) return errorJson('INVALID_OUTCOME', 'entry_id is required');

  const outcome = a.outcome as string | undefined;
  if (!outcome) return errorJson('INVALID_OUTCOME', 'outcome is required');

  const agentName = a.agent_name as string | undefined;
  const context = a.context as string | undefined;

  try {
    const adapter = engine.getAdapter();
    const svc = new OutcomeService(adapter);
    const result = await svc.record(entryId, outcome, agentName, context);

    // SA4E-121: Apply instinct-specific confidence change + check promotion
    let promoted = false;
    const entry = await adapter.getAsync<{ type: string; tags: string; confidence: number }>(
      'SELECT type, tags, confidence FROM knowledge_entries WHERE id = ?', [entryId],
    );
    if (entry && (entry.type === 'INSTINCT' || entry.tags.includes('instinct'))) {
      const configSvc = new InstinctConfigService(adapter);
      await applyInstinctConfidenceChange(adapter, entryId, entry.confidence, outcome, configSvc);
      // Check auto-promotion
      const promotionSvc = new InstinctPromotionService(adapter, configSvc, logger);
      const promoResult = await promotionSvc.checkAndPromote(entryId);
      promoted = promoResult.promoted;
    }

    return JSON.stringify({
      recorded: result.recorded,
      entry_id: entryId,
      new_outcome_factor: round(result.new_outcome_factor),
      total_outcomes: result.total_outcomes,
      promoted,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.warn({ entryId, outcome, err: msg }, 'Outcome recording failed');
    return errorJson(mapOutcomeCode(msg), msg);
  }
}

export async function handleVerify(engine: MemoryEngine, a: Args): Promise<string> {
  const entryId = a.entry_id as number | undefined;
  const action = (a.action as string) ?? 'verify';

  // SA4E-121: Handle 'resolve' and 'promote' actions
  if (action === 'resolve') {
    return handleResolveContradiction(engine, a);
  }
  if (action === 'promote') {
    return handlePromoteInstinct(engine, a);
  }

  if (!entryId) return errorJson('ENTRY_NOT_FOUND', 'entry_id is required');
  const comment = a.comment as string | undefined;

  try {
    const svc = new EpochService(engine.getAdapter(), logger);
    if (action === 'reject') {
      await svc.reject(entryId, comment);
      return await buildVerifyResponse(engine, entryId);
    }
    await svc.verify(entryId, comment);
    return await buildVerifyResponse(engine, entryId);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.warn({ entryId, action, err: msg }, 'Verify failed');
    return errorJson(mapVerifyCode(msg), msg);
  }
}

export async function handleConfigureDecay(engine: MemoryEngine, a: Args): Promise<string> {
  const action = a.action as string | undefined;
  if (!action) return errorJson('INVALID_ACTION', 'action is required');

  try {
    return await dispatchDecayAction(engine, action, a);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.warn({ action, err: msg }, 'Configure decay failed');
    return errorJson(mapDecayCode(msg), msg);
  }
}

async function dispatchDecayAction(engine: MemoryEngine, action: string, a: Args): Promise<string> {
  const adapter = engine.getAdapter();

  switch (action) {
    case 'get_config':
      return JSON.stringify(await new DecayService(adapter, logger).getConfig());

    case 'set_config':
      return await handleSetConfig(engine, a);

    case 'run_decay':
      return JSON.stringify(await new DecayService(adapter, logger).runDecayCycle());

    case 'epoch':
      return await handleEpoch(engine, a);

    case 'stagnation_check':
      return JSON.stringify(await new StagnationDetector(adapter, logger).analyze());

    // SA4E-121: Instinct-specific config actions
    case 'get_instinct_config':
      return JSON.stringify(await new InstinctConfigService(adapter).getInstinctConfig());

    case 'set_instinct_config':
      return await handleSetInstinctConfig(engine, a);

    case 'run_instinct_decay':
      return await handleRunInstinctDecay(engine);

    default:
      return errorJson('INVALID_ACTION', `Unknown action: ${action}`);
  }
}

async function handleSetConfig(engine: MemoryEngine, a: Args): Promise<string> {
  const updates: Partial<Record<string, unknown>> = {};
  if (a.halfLifeDays !== undefined) updates.halfLifeDays = a.halfLifeDays;
  if (a.half_life_days !== undefined) updates.half_life_days = a.half_life_days;
  if (a.decayRate !== undefined) updates.decayRate = a.decayRate;
  if (a.decay_rate !== undefined) updates.decay_rate = a.decay_rate;
  if (a.confidenceFloor !== undefined) updates.confidenceFloor = a.confidenceFloor;
  if (a.confidence_floor !== undefined) updates.confidence_floor = a.confidence_floor;
  if (a.enable_predictive !== undefined) updates.enable_predictive = String(a.enable_predictive);

  const adapter = engine.getAdapter();
  const dialect = engine.getDialect();
  for (const [key, val] of Object.entries(updates)) {
    if (val !== undefined) {
      await adapter.runAsync(
        `UPDATE decay_config SET value = ?, updated_at = ${dialect.now()} WHERE key = ?`,
        [String(val), key],
      );
    }
  }
  return JSON.stringify(await new DecayService(adapter, logger).getConfig());
}

async function handleEpoch(engine: MemoryEngine, a: Args): Promise<string> {
  const scope = a.scope as string;
  const epochId = a.epoch_id as string;
  if (!scope || !epochId) {
    return errorJson('INVALID_CONFIG', 'scope and epoch_id required for epoch action');
  }
  const svc = new EpochService(engine.getAdapter(), logger);
  return JSON.stringify(await svc.trigger(scope, epochId));
}

async function buildVerifyResponse(engine: MemoryEngine, entryId: number): Promise<string> {
  const entry = await engine.findById(entryId);
  return JSON.stringify({
    verified: true,
    entry_id: entryId,
    confidence: (entry as any)?.confidence ?? 0,
    needs_verification: (entry as any)?.needs_verification ?? 0,
  });
}

function errorJson(code: string, message: string): string {
  return JSON.stringify({ error: code, message });
}

function mapOutcomeCode(msg: string): string {
  if (msg === 'ENTRY_NOT_FOUND') return 'ENTRY_NOT_FOUND';
  if (msg === 'INVALID_OUTCOME') return 'INVALID_OUTCOME';
  return 'OUTCOME_WRITE_FAILED';
}

function mapVerifyCode(msg: string): string {
  if (msg === 'ENTRY_NOT_FOUND') return 'ENTRY_NOT_FOUND';
  if (msg === 'NOT_FLAGGED') return 'NOT_FLAGGED';
  return 'VERIFY_FAILED';
}

function mapDecayCode(msg: string): string {
  if (msg === 'JOB_IN_PROGRESS') return 'JOB_IN_PROGRESS';
  if (msg.includes('INVALID')) return 'INVALID_CONFIG';
  return 'DECAY_ERROR';
}

function round(n: number): number {
  return Math.round(n * 10000) / 10000;
}

// ─── SA4E-121: Instinct System Helpers ──────────────────────────────

import type { DatabaseAdapter } from '../../../database/adapters/DatabaseAdapter.js';
import { DialectHelper } from '../../../database/dialect/DialectHelper.js';

/** Apply instinct-specific confidence boost/decay based on outcome. */
async function applyInstinctConfidenceChange(
  adapter: DatabaseAdapter,
  entryId: number, currentConfidence: number, outcome: string,
  configSvc: InstinctConfigService,
): Promise<void> {
  const config = await configSvc.getInstinctConfig();
  const dialect = new DialectHelper(adapter.getEngine());
  let newConfidence: number;

  switch (outcome) {
    case 'success':
      newConfidence = Math.min(currentConfidence * config.instinct_boost_factor, config.instinct_confidence_ceiling);
      break;
    case 'partial':
      newConfidence = Math.min(currentConfidence * 1.05, config.instinct_confidence_ceiling);
      break;
    case 'fail':
      newConfidence = Math.max(currentConfidence * config.instinct_fail_factor, config.instinct_confidence_floor);
      break;
    default:
      return;
  }

  await adapter.runAsync(
    `UPDATE knowledge_entries SET confidence = ?, updated_at = ${dialect.now()} WHERE id = ?`,
    [newConfidence, entryId],
  );
}

/** Set instinct config values. */
async function handleSetInstinctConfig(engine: MemoryEngine, a: Args): Promise<string> {
  const adapter = engine.getAdapter();
  const configSvc = new InstinctConfigService(adapter);
  const updates: Partial<Record<string, unknown>> = {};

  const keys = [
    'instinct_initial_confidence', 'instinct_confidence_floor', 'instinct_confidence_ceiling',
    'instinct_decay_rate', 'instinct_boost_factor', 'instinct_fail_factor',
    'instinct_access_threshold_days', 'instinct_promotion_threshold', 'contradiction_similarity_threshold',
  ];
  for (const key of keys) {
    if (a[key] !== undefined) updates[key] = a[key];
  }

  const result = await configSvc.setInstinctConfig(updates as any);
  return JSON.stringify(result);
}

/** Run instinct-specific decay cycle (separate from standard decay). */
async function handleRunInstinctDecay(engine: MemoryEngine): Promise<string> {
  const adapter = engine.getAdapter();
  const configSvc = new InstinctConfigService(adapter);
  const config = await configSvc.getInstinctConfig();
  const dialect = new DialectHelper(adapter.getEngine());

  const threshold = new Date(
    Date.now() - config.instinct_access_threshold_days * 86_400_000,
  ).toISOString();

  const entries = await adapter.allAsync<{ id: number; confidence: number }>(`
    SELECT id, confidence FROM knowledge_entries
    WHERE (type = 'INSTINCT' OR tags LIKE '%instinct%')
      AND pinned = 0 AND archived = 0
      AND confidence > ?
      AND (last_accessed_at < ? OR last_accessed_at IS NULL)
    ORDER BY id
  `, [config.instinct_confidence_floor, threshold]);

  let decayed = 0;
  for (const entry of entries) {
    const newConf = Math.max(
      entry.confidence * (1 - config.instinct_decay_rate),
      config.instinct_confidence_floor,
    );
    if (newConf < entry.confidence) {
      await adapter.runAsync(
        `UPDATE knowledge_entries SET confidence = ?, updated_at = ${dialect.now()} WHERE id = ?`,
        [newConf, entry.id],
      );
      decayed++;
    }
  }

  return JSON.stringify({ instinct_decayed: decayed, total_checked: entries.length });
}

/** Resolve a contradiction via mem_verify action='resolve'. */
async function handleResolveContradiction(engine: MemoryEngine, a: Args): Promise<string> {
  const contradictionId = a.contradiction_id as number | undefined;
  const resolution = a.resolution as string | undefined;
  if (!contradictionId || !resolution) {
    return errorJson('INVALID_RESOLUTION', 'contradiction_id and resolution required');
  }

  try {
    const adapter = engine.getAdapter();
    const configSvc = new InstinctConfigService(adapter);
    const svc = new ContradictionService(adapter, configSvc, logger);
    const result = await svc.resolveContradiction(contradictionId, resolution, a.resolved_by as string);
    return JSON.stringify(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return errorJson(msg, msg);
  }
}

/** Promote an instinct entry via mem_verify action='promote'. */
async function handlePromoteInstinct(engine: MemoryEngine, a: Args): Promise<string> {
  const entryId = a.entry_id as number | undefined;
  if (!entryId) return errorJson('ENTRY_NOT_FOUND', 'entry_id is required');

  try {
    const adapter = engine.getAdapter();
    const configSvc = new InstinctConfigService(adapter);
    const svc = new InstinctPromotionService(adapter, configSvc, logger);
    const result = await svc.manualPromote(entryId);
    return JSON.stringify(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return errorJson('PROMOTION_FAILED', msg);
  }
}
