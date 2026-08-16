/**
 * SA4E-121: Instincts and Confidence Scoring System — unit tests.
 * Covers InstinctConfigService, ContradictionService, InstinctPromotionService,
 * and InstinctIngestionHandler.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { SqliteAdapter } from '../../../database/adapters/SqliteAdapter.js';
import { InstinctConfigService } from '../evolution/InstinctConfigService.js';
import { ContradictionService } from '../evolution/ContradictionService.js';
import { InstinctPromotionService } from '../evolution/InstinctPromotionService.js';
import { InstinctIngestionHandler } from '../handlers/InstinctIngestionHandler.js';
import pino from 'pino';

const logger = pino({ level: 'silent' });

/** Create in-memory test DB with required tables. */
async function createTestDb(): Promise<SqliteAdapter> {
  const adapter = new SqliteAdapter(':memory:');
  await adapter.connect();
  adapter.exec(`
    CREATE TABLE knowledge_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      content TEXT NOT NULL,
      summary TEXT DEFAULT '',
      type TEXT DEFAULT 'CONTEXT',
      tier TEXT DEFAULT 'T1',
      scope TEXT DEFAULT 'USER',
      user_id TEXT, workspace_id TEXT, project_id TEXT,
      source TEXT, source_ref TEXT, tags TEXT DEFAULT '',
      confidence REAL DEFAULT 1.0,
      access_count INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      last_accessed_at TEXT,
      expires_at TEXT, pinned INTEGER DEFAULT 0,
      pin_order INTEGER DEFAULT 0,
      structured_map TEXT DEFAULT '{}',
      quality_score REAL, archived INTEGER DEFAULT 0,
      agent_name TEXT, owner TEXT,
      needs_verification INTEGER DEFAULT 0,
      epoch_id TEXT, superseded_by INTEGER,
      enrichment_status TEXT DEFAULT 'done',
      enriched_by TEXT, enriched_at TEXT
    );
    CREATE TABLE decay_config (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE entry_outcomes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entry_id INTEGER NOT NULL,
      outcome TEXT NOT NULL CHECK (outcome IN ('success', 'fail', 'partial')),
      agent_name TEXT, context TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (entry_id) REFERENCES knowledge_entries(id) ON DELETE CASCADE
    );
    CREATE TABLE contradiction_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entry_id_a INTEGER NOT NULL,
      entry_id_b INTEGER NOT NULL,
      similarity REAL NOT NULL,
      classification TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'unresolved',
      resolution TEXT, resolved_by TEXT,
      detected_at TEXT DEFAULT (datetime('now')),
      resolved_at TEXT, project_id TEXT,
      FOREIGN KEY (entry_id_a) REFERENCES knowledge_entries(id) ON DELETE CASCADE,
      FOREIGN KEY (entry_id_b) REFERENCES knowledge_entries(id) ON DELETE CASCADE
    );
  `);
  return adapter;
}

describe('InstinctConfigService', () => {
  let adapter: SqliteAdapter;
  let svc: InstinctConfigService;

  beforeEach(async () => {
    adapter = await createTestDb();
    svc = new InstinctConfigService(adapter);
    await svc.seedDefaults();
  });

  it('should seed and read default config', async () => {
    const config = await svc.getInstinctConfig();
    expect(config.instinct_initial_confidence).toBe(0.5);
    expect(config.instinct_confidence_floor).toBe(0.3);
    expect(config.instinct_confidence_ceiling).toBe(0.9);
    expect(config.instinct_decay_rate).toBe(0.08);
    expect(config.instinct_boost_factor).toBe(1.1);
    expect(config.instinct_fail_factor).toBe(0.9);
    expect(config.instinct_access_threshold_days).toBe(14);
    expect(config.instinct_promotion_threshold).toBe(3);
    expect(config.contradiction_similarity_threshold).toBe(0.85);
  });

  it('should update config partially', async () => {
    const updated = await svc.setInstinctConfig({
      instinct_decay_rate: 0.12,
      instinct_boost_factor: 1.2,
    });
    expect(updated.instinct_decay_rate).toBe(0.12);
    expect(updated.instinct_boost_factor).toBe(1.2);
    // Others unchanged
    expect(updated.instinct_initial_confidence).toBe(0.5);
  });

  it('should not overwrite existing config on re-seed', async () => {
    await svc.setInstinctConfig({ instinct_decay_rate: 0.2 });
    await svc.seedDefaults();
    const config = await svc.getInstinctConfig();
    expect(config.instinct_decay_rate).toBe(0.2);
  });
});

describe('ContradictionService', () => {
  let adapter: SqliteAdapter;
  let configSvc: InstinctConfigService;
  let svc: ContradictionService;

  beforeEach(async () => {
    adapter = await createTestDb();
    configSvc = new InstinctConfigService(adapter);
    await configSvc.seedDefaults();
    // Lower threshold to make detection easier in tests
    await configSvc.setInstinctConfig({ contradiction_similarity_threshold: 0.5 });
    svc = new ContradictionService(adapter, configSvc, logger);
  });

  it('should detect no contradictions for unique content', async () => {
    await adapter.runAsync(
      `INSERT INTO knowledge_entries (content, summary) VALUES (?, ?)`,
      ['The sky is blue', 'sky color'],
    );
    await adapter.runAsync(
      `INSERT INTO knowledge_entries (content, summary) VALUES (?, ?)`,
      ['Dogs are loyal animals', 'dogs'],
    );
    const report = await svc.detectContradictions(2);
    expect(report.contradictions.length).toBe(0);
  });

  it('should detect contradiction for very similar content', async () => {
    const text = 'The recommended approach for error handling is to use try-catch blocks with specific error types';
    await adapter.runAsync(
      `INSERT INTO knowledge_entries (content, summary) VALUES (?, ?)`,
      [text, 'error handling v1'],
    );
    // Nearly identical content
    await adapter.runAsync(
      `INSERT INTO knowledge_entries (content, summary) VALUES (?, ?)`,
      [text + ' and log them', 'error handling v2'],
    );
    const report = await svc.detectContradictions(2);
    expect(report.contradictions.length + report.superseded).toBeGreaterThan(0);
  });

  it('should resolve contradiction', async () => {
    // Insert a contradiction manually
    await adapter.runAsync(
      `INSERT INTO knowledge_entries (content, summary) VALUES ('A', 'a')`,
    );
    await adapter.runAsync(
      `INSERT INTO knowledge_entries (content, summary) VALUES ('B', 'b')`,
    );
    await adapter.runAsync(
      `INSERT INTO contradiction_log (entry_id_a, entry_id_b, similarity, classification) VALUES (1, 2, 0.9, 'CONTRADICTION')`,
    );

    const result = await svc.resolveContradiction(1, 'resolve_keep_new');
    expect(result.resolved).toBe(true);
    expect(result.strategy).toBe('resolve_keep_new');
  });

  it('should throw ALREADY_RESOLVED on double-resolve', async () => {
    await adapter.runAsync(`INSERT INTO knowledge_entries (content, summary) VALUES ('A', 'a')`);
    await adapter.runAsync(`INSERT INTO knowledge_entries (content, summary) VALUES ('B', 'b')`);
    await adapter.runAsync(
      `INSERT INTO contradiction_log (entry_id_a, entry_id_b, similarity, classification, status) VALUES (1, 2, 0.9, 'CONTRADICTION', 'resolved')`,
    );
    await expect(svc.resolveContradiction(1, 'resolve_both')).rejects.toThrow('ALREADY_RESOLVED');
  });

  it('should throw INVALID_RESOLUTION for unknown strategy', async () => {
    await adapter.runAsync(`INSERT INTO knowledge_entries (content, summary) VALUES ('A', 'a')`);
    await adapter.runAsync(`INSERT INTO knowledge_entries (content, summary) VALUES ('B', 'b')`);
    await adapter.runAsync(
      `INSERT INTO contradiction_log (entry_id_a, entry_id_b, similarity, classification) VALUES (1, 2, 0.9, 'CONTRADICTION')`,
    );
    await expect(svc.resolveContradiction(1, 'invalid_strategy')).rejects.toThrow('INVALID_RESOLUTION');
  });

  it('should return warnings for entries with unresolved contradictions', async () => {
    await adapter.runAsync(`INSERT INTO knowledge_entries (content, summary) VALUES ('A', 'a')`);
    await adapter.runAsync(`INSERT INTO knowledge_entries (content, summary) VALUES ('B', 'b')`);
    await adapter.runAsync(
      `INSERT INTO contradiction_log (entry_id_a, entry_id_b, similarity, classification) VALUES (1, 2, 0.9, 'CONTRADICTION')`,
    );
    const warnings = await svc.getWarnings([1, 2, 999]);
    expect(warnings.has(1)).toBe(true);
    expect(warnings.has(2)).toBe(true);
    expect(warnings.has(999)).toBe(false);
  });
});

describe('InstinctPromotionService', () => {
  let adapter: SqliteAdapter;
  let configSvc: InstinctConfigService;
  let svc: InstinctPromotionService;

  beforeEach(async () => {
    adapter = await createTestDb();
    configSvc = new InstinctConfigService(adapter);
    await configSvc.seedDefaults();
    svc = new InstinctPromotionService(adapter, configSvc, logger);
  });

  it('should not promote if criteria not met (low confidence)', async () => {
    await adapter.runAsync(
      `INSERT INTO knowledge_entries (content, summary, type, confidence, tags) VALUES (?, ?, ?, ?, ?)`,
      ['My instinct', 'instinct', 'INSTINCT', 0.5, 'instinct'],
    );
    const result = await svc.checkAndPromote(1);
    expect(result.promoted).toBe(false);
    expect(result.reason).toBe('CRITERIA_NOT_MET');
  });

  it('should not promote if not enough successful outcomes', async () => {
    await adapter.runAsync(
      `INSERT INTO knowledge_entries (content, summary, type, confidence, tags) VALUES (?, ?, ?, ?, ?)`,
      ['My instinct', 'instinct', 'INSTINCT', 0.9, 'instinct'],
    );
    // Only 2 successes, threshold is 3
    await adapter.runAsync(`INSERT INTO entry_outcomes (entry_id, outcome) VALUES (1, 'success')`);
    await adapter.runAsync(`INSERT INTO entry_outcomes (entry_id, outcome) VALUES (1, 'success')`);
    const result = await svc.checkAndPromote(1);
    expect(result.promoted).toBe(false);
  });

  it('should promote when all criteria met', async () => {
    await adapter.runAsync(
      `INSERT INTO knowledge_entries (content, summary, type, confidence, tags) VALUES (?, ?, ?, ?, ?)`,
      ['My instinct', 'instinct', 'INSTINCT', 0.9, 'instinct,dev'],
    );
    // 3 successes = meets threshold
    await adapter.runAsync(`INSERT INTO entry_outcomes (entry_id, outcome) VALUES (1, 'success')`);
    await adapter.runAsync(`INSERT INTO entry_outcomes (entry_id, outcome) VALUES (1, 'success')`);
    await adapter.runAsync(`INSERT INTO entry_outcomes (entry_id, outcome) VALUES (1, 'success')`);

    const result = await svc.checkAndPromote(1);
    expect(result.promoted).toBe(true);
    expect(result.new_confidence).toBe(1.0);

    // Verify entry type changed
    const entry = await adapter.getAsync<{ type: string; tags: string; confidence: number }>(
      'SELECT type, tags, confidence FROM knowledge_entries WHERE id = 1',
    );
    expect(entry?.type).toBe('KNOWLEDGE');
    expect(entry?.confidence).toBe(1.0);
    expect(entry?.tags).not.toContain('instinct');
    expect(entry?.tags).toContain('dev');
  });

  it('should manually promote without criteria check', async () => {
    await adapter.runAsync(
      `INSERT INTO knowledge_entries (content, summary, type, confidence, tags) VALUES (?, ?, ?, ?, ?)`,
      ['Low confidence instinct', 'instinct', 'INSTINCT', 0.3, 'instinct'],
    );
    const result = await svc.manualPromote(1);
    expect(result.promoted).toBe(true);
  });

  it('should return ENTRY_NOT_FOUND for nonexistent entry', async () => {
    const result = await svc.manualPromote(999);
    expect(result.promoted).toBe(false);
    expect(result.reason).toBe('ENTRY_NOT_FOUND');
  });
});

describe('InstinctIngestionHandler', () => {
  let adapter: SqliteAdapter;
  let configSvc: InstinctConfigService;
  let contradictionSvc: ContradictionService;
  let handler: InstinctIngestionHandler;

  beforeEach(async () => {
    adapter = await createTestDb();
    configSvc = new InstinctConfigService(adapter);
    await configSvc.seedDefaults();
    contradictionSvc = new ContradictionService(adapter, configSvc, logger);
    handler = new InstinctIngestionHandler(configSvc, contradictionSvc, logger);
  });

  it('should detect instinct from type=INSTINCT', () => {
    expect(handler.isInstinct({ content: 'test', type: 'INSTINCT' })).toBe(true);
  });

  it('should detect instinct from instinct=true flag', () => {
    expect(handler.isInstinct({ content: 'test', instinct: true })).toBe(true);
  });

  it('should not detect instinct for regular entry', () => {
    expect(handler.isInstinct({ content: 'test', type: 'CONTEXT' })).toBe(false);
  });

  it('should compute initial confidence within bounds', async () => {
    // No user confidence → use default (0.5)
    const conf1 = await handler.computeInitialConfidence({ content: 'x' });
    expect(conf1).toBe(0.5);

    // User confidence below floor → clamp to floor (0.3)
    const conf2 = await handler.computeInitialConfidence({ content: 'x', confidence: 0.1 });
    expect(conf2).toBe(0.3);

    // User confidence above ceiling → clamp to ceiling (0.9)
    const conf3 = await handler.computeInitialConfidence({ content: 'x', confidence: 1.0 });
    expect(conf3).toBe(0.9);

    // User confidence within bounds → use as-is
    const conf4 = await handler.computeInitialConfidence({ content: 'x', confidence: 0.7 });
    expect(conf4).toBe(0.7);
  });

  it('should apply instinct tag to empty tags', () => {
    expect(handler.applyInstinctTags('')).toBe('instinct');
  });

  it('should not duplicate instinct tag', () => {
    expect(handler.applyInstinctTags('instinct,dev')).toBe('instinct,dev');
  });

  it('should add instinct tag to existing tags', () => {
    expect(handler.applyInstinctTags('dev,coding')).toBe('dev,coding,instinct');
  });

  it('should handle contradiction detection gracefully on failure', async () => {
    // Entry doesn't exist → returns null (graceful degradation)
    const result = await handler.runContradictionDetection(999);
    // detectContradictions returns empty report for missing entry
    expect(result).not.toBeNull();
    expect(result!.contradictions.length).toBe(0);
  });
});
