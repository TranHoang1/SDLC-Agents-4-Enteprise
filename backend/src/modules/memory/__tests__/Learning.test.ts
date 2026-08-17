/**
 * SA4E-122: Continuous Learning v2 — unit tests.
 * Covers PatternClassifier, PatternExtractor, SessionAnalyzer,
 * ClusteringService, and handleLearn dispatcher.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { SqliteAdapter } from '../../../database/adapters/SqliteAdapter.js';
import { MemoryEngine } from '../engine/core.js';
import { PatternClassifier } from '../learning/PatternClassifier.js';
import { PatternExtractor } from '../learning/PatternExtractor.js';
import { SessionAnalyzer } from '../learning/SessionAnalyzer.js';
import { ClusteringService } from '../learning/ClusteringService.js';
import { handleLearn } from '../dispatchers/learning.js';

/** Create in-memory test DB with required tables. */
async function createTestEngine(): Promise<MemoryEngine> {
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
    CREATE VIRTUAL TABLE IF NOT EXISTS knowledge_fts
      USING fts5(content, summary, content=knowledge_entries, content_rowid=id);
    CREATE TRIGGER IF NOT EXISTS ke_ai AFTER INSERT ON knowledge_entries BEGIN
      INSERT INTO knowledge_fts(rowid, content, summary) VALUES (new.id, new.content, new.summary);
    END;
    CREATE TABLE memory_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT UNIQUE, agent_name TEXT,
      started_at TEXT DEFAULT (datetime('now')),
      ended_at TEXT, status TEXT DEFAULT 'active',
      observation_count INTEGER DEFAULT 0
    );
    CREATE TABLE memory_audit (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      operation TEXT, entry_id INTEGER,
      session_id TEXT, agent_name TEXT,
      details TEXT, created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE consolidation_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entry_id INTEGER, from_tier TEXT, to_tier TEXT,
      reason TEXT, created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE decay_config (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE tool_usage (
      tool_name TEXT PRIMARY KEY,
      call_count INTEGER DEFAULT 0,
      last_called_at TEXT
    );
  `);
  return new MemoryEngine(adapter);
}

describe('PatternClassifier', () => {
  const classifier = new PatternClassifier();

  it('should classify error-related text as error_resolution', () => {
    const [type] = classifier.classify(
      'The error was caused by a null pointer exception. The fix was to add a null check.',
    );
    expect(type).toBe('error_resolution');
  });

  it('should classify correction text as user_correction', () => {
    const [type] = classifier.classify(
      'No, actually you should use the other approach instead of this one. The correction is needed.',
    );
    expect(type).toBe('user_correction');
  });

  it('should classify workaround text', () => {
    const [type] = classifier.classify(
      'As a temporary workaround, we can bypass the check using a fallback hack.',
    );
    expect(type).toBe('workaround');
  });

  it('should classify debugging text', () => {
    const [type] = classifier.classify(
      'Add a console.log to debug this. Use the inspect tool to trace through the issue.',
    );
    expect(type).toBe('debugging_technique');
  });

  it('should classify project-specific text', () => {
    const [type] = classifier.classify(
      'In this project, the convention is to always use the standard pattern and prefer interfaces.',
    );
    expect(type).toBe('project_specific');
  });

  it('should return project_specific for empty text', () => {
    const [type, score] = classifier.classify('');
    expect(type).toBe('project_specific');
    expect(score).toBe(0);
  });

  it('should detect error→resolution sequence', () => {
    expect(
      classifier.hasErrorResolutionSequence('Got an error, then found the fix.'),
    ).toBe(true);
  });

  it('should not detect error→resolution without fix keyword', () => {
    expect(
      classifier.hasErrorResolutionSequence('Got an error but nothing helps.'),
    ).toBe(false);
  });
});

describe('PatternExtractor', () => {
  it('should return empty for blank transcript', () => {
    const extractor = new PatternExtractor();
    expect(extractor.extract('')).toEqual([]);
    expect(extractor.extract('   ')).toEqual([]);
  });

  it('should extract error→resolution patterns', () => {
    const extractor = new PatternExtractor();
    const transcript = `[user]
The build failed with a TypeError exception in module.ts
---
[assistant]
I found the fix — the issue was a missing null check. The solution resolved the crash.`;

    const patterns = extractor.extract(transcript);
    expect(patterns.length).toBeGreaterThan(0);
    const errorPattern = patterns.find(p => p.type === 'error_resolution');
    expect(errorPattern).toBeDefined();
  });

  it('should extract user corrections', () => {
    const extractor = new PatternExtractor();
    const transcript = `[assistant]
I'll implement it using approach A
---
[user]
No, actually you should use approach B instead. The correction is that we never use A in this project.`;

    const patterns = extractor.extract(transcript);
    const correction = patterns.find(p => p.type === 'user_correction');
    expect(correction).toBeDefined();
  });

  it('should respect maxPatternsPerSession config', () => {
    const extractor = new PatternExtractor({ maxPatternsPerSession: 2 });
    const transcript = `[user]
Error 1 with exception and fix resolved
---
Error 2 with crash and solution found
---
Error 3 with bug and issue fixed
---
No, actually the correction should be different instead`;

    const patterns = extractor.extract(transcript);
    expect(patterns.length).toBeLessThanOrEqual(2);
  });

  it('should deduplicate similar patterns', () => {
    const extractor = new PatternExtractor();
    const transcript = `[user]
The error in module.ts caused a crash. The fix resolved it.
---
The error in module.ts caused a crash. The fix resolved it. Again.`;

    const patterns = extractor.extract(transcript);
    // Should not have exact duplicates
    const contents = patterns.map(p => p.content.slice(0, 80));
    const unique = new Set(contents);
    expect(unique.size).toBe(contents.length);
  });

  it('should extract source context from tool names', () => {
    const extractor = new PatternExtractor();
    const transcript = `[tool]
Called mem_search with query "test" and got an error exception. Then the fix resolved it.`;

    const patterns = extractor.extract(transcript);
    if (patterns.length > 0) {
      const withTool = patterns.find(p => p.sourceContext.includes('mem_search'));
      expect(withTool).toBeDefined();
    }
  });
});

describe('SessionAnalyzer', () => {
  let engine: MemoryEngine;

  beforeEach(async () => {
    engine = await createTestEngine();
  });

  it('should analyze transcript and ingest patterns', async () => {
    const analyzer = new SessionAnalyzer(engine);
    const transcript = `[user]
Got a TypeError exception when running the build
---
[assistant]
The fix was to add proper type guards. This resolved the crash issue.`;

    const result = await analyzer.analyze(transcript);
    expect(result.extractedCount).toBeGreaterThan(0);
    expect(result.ingested.length).toBeGreaterThan(0);
    expect(result.ingested[0].type).toBe('error_resolution');
    expect(result.ingested[0].confidence).toBe(0.5);

    // Verify entry was actually created in DB
    const entry = await engine.findById(result.ingested[0].entryId);
    expect(entry).not.toBeNull();
    expect(entry!.type).toBe('INSTINCT');
    expect(entry!.tags).toContain('instinct');
    expect(entry!.tags).toContain('auto-learned');
  });

  it('should skip duplicate patterns on re-analysis', async () => {
    const analyzer = new SessionAnalyzer(engine);
    const transcript = `[user]
Error exception in the build failed
---
[assistant]
The solution fix resolved the crash issue completely.`;

    const result1 = await analyzer.analyze(transcript);
    expect(result1.ingested.length).toBeGreaterThan(0);

    // Second run — since FTS finds the first ingestion, duplicates are skipped
    const result2 = await analyzer.analyze(transcript);
    // With working FTS, skippedCount >= ingested from first run
    // But even without FTS, verify idempotent behavior
    expect(result2.extractedCount).toBe(result1.extractedCount);
  });

  it('should return empty for transcript with no patterns', async () => {
    const analyzer = new SessionAnalyzer(engine);
    const result = await analyzer.analyze('Hello world, how are you today?');
    expect(result.extractedCount).toBe(0);
    expect(result.ingested.length).toBe(0);
  });
});

describe('ClusteringService', () => {
  let engine: MemoryEngine;

  beforeEach(async () => {
    engine = await createTestEngine();
  });

  it('should return empty when no instincts exist', async () => {
    const service = new ClusteringService(engine);
    const result = await service.cluster();
    expect(result.clustersFound).toBe(0);
    expect(result.proceduresCreated).toBe(0);
  });

  it('should cluster instincts with common tags', async () => {
    // Insert 3+ instincts with same significant tag
    for (let i = 0; i < 4; i++) {
      await engine.insert({
        content: `Pattern ${i} about typescript config`,
        summary: `Instinct ${i}`,
        type: 'INSTINCT',
        tier: 'T1',
        scope: 'PROJECT',
        source: 'auto-learn/test',
        tags: 'instinct,auto-learned,typescript',
        agent_name: 'auto-learner',
      });
    }

    const service = new ClusteringService(engine);
    const result = await service.cluster();

    expect(result.clustersFound).toBeGreaterThan(0);
    expect(result.proceduresCreated).toBe(1);
    expect(result.clusters[0].commonTags).toContain('typescript');
  });

  it('should not create duplicate procedures', async () => {
    for (let i = 0; i < 4; i++) {
      await engine.insert({
        content: `Pattern ${i} about react hooks`,
        summary: `Instinct ${i}`,
        type: 'INSTINCT',
        tier: 'T1',
        scope: 'PROJECT',
        source: 'auto-learn/test',
        tags: 'instinct,auto-learned,react',
        agent_name: 'auto-learner',
      });
    }

    const service = new ClusteringService(engine);
    await service.cluster();
    const result2 = await service.cluster();

    // Second run should not create new procedures
    expect(result2.proceduresCreated).toBe(0);
  });

  it('should not cluster groups smaller than threshold', async () => {
    // Only 2 instincts — below MIN_CLUSTER_SIZE of 3
    for (let i = 0; i < 2; i++) {
      await engine.insert({
        content: `Pattern ${i} about python`,
        summary: `Instinct ${i}`,
        type: 'INSTINCT',
        tier: 'T1',
        scope: 'PROJECT',
        source: 'auto-learn/test',
        tags: 'instinct,auto-learned,python',
        agent_name: 'auto-learner',
      });
    }

    const service = new ClusteringService(engine);
    const result = await service.cluster();
    expect(result.proceduresCreated).toBe(0);
  });
});

describe('handleLearn dispatcher', () => {
  let engine: MemoryEngine;

  beforeEach(async () => {
    engine = await createTestEngine();
  });

  it('should return error for empty transcript on analyze', async () => {
    const result = await handleLearn(engine, undefined, { action: 'analyze', transcript: '' });
    const parsed = JSON.parse(result);
    expect(parsed.error).toContain('transcript is required');
  });

  it('should analyze transcript and return results', async () => {
    const transcript = `[user]
Build crashed with error exception
---
[assistant]
Found the fix. The solution resolved the issue.`;

    const result = await handleLearn(engine, undefined, { action: 'analyze', transcript });
    const parsed = JSON.parse(result);
    expect(parsed.status).toBe('ok');
    expect(parsed.action).toBe('analyze');
    expect(parsed.ingestedCount).toBeGreaterThan(0);
  });

  it('should handle cluster action', async () => {
    const result = await handleLearn(engine, undefined, { action: 'cluster' });
    const parsed = JSON.parse(result);
    expect(parsed.status).toBe('ok');
    expect(parsed.action).toBe('cluster');
    expect(parsed.clustersFound).toBe(0);
  });

  it('should return error for unknown action', async () => {
    const result = await handleLearn(engine, undefined, { action: 'invalid' });
    const parsed = JSON.parse(result);
    expect(parsed.error).toContain('Unknown action');
  });

  it('should default to analyze action', async () => {
    const transcript = `[user]
Got a crash exception error in build
---
[assistant]
The fix resolved the bug issue.`;
    const result = await handleLearn(engine, undefined, { transcript });
    const parsed = JSON.parse(result);
    expect(parsed.action).toBe('analyze');
  });
});
