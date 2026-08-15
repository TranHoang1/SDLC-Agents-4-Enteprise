/**
 * KSA-154 / SA4E-45 — Unit tests for code_callers / code_callees tools against
 * an in-memory SQLite database (files + symbols + relationships schema).
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { SqliteDbAdapter } from '../../../modules/memory/task-queue/SqliteDbAdapter.js';
import { CALL_GRAPH_TOOL_DEFINITIONS, handleCodeCallers, handleCodeCallees } from '../call-graph-tools.js';

const PID = 'proj_call';

const SCHEMA = `
CREATE TABLE files (id INTEGER PRIMARY KEY AUTOINCREMENT, project_id TEXT NOT NULL DEFAULT '',
  path TEXT, relative_path TEXT);
CREATE TABLE symbols (id INTEGER PRIMARY KEY AUTOINCREMENT, project_id TEXT NOT NULL DEFAULT '',
  file_id INTEGER, name TEXT, kind TEXT, signature TEXT, start_line INTEGER, end_line INTEGER,
  parent_symbol TEXT, parent_symbol_id INTEGER, visibility TEXT, doc_comment TEXT);
CREATE TABLE relationships (id INTEGER PRIMARY KEY AUTOINCREMENT, project_id TEXT NOT NULL DEFAULT '',
  source_symbol_id INTEGER NOT NULL, target_symbol TEXT NOT NULL, target_symbol_id INTEGER,
  kind TEXT NOT NULL DEFAULT 'calls', file_path TEXT, line INTEGER, metadata TEXT);
`;

describe('CALL_GRAPH_TOOL_DEFINITIONS', () => {
  it('declares code_callers and code_callees tools', () => {
    const names = CALL_GRAPH_TOOL_DEFINITIONS.map(d => d.name);
    expect(names).toEqual(['code_callers', 'code_callees']);
  });

  it('requires the symbol parameter on both tools', () => {
    for (const def of CALL_GRAPH_TOOL_DEFINITIONS) {
      expect(def.inputSchema.required).toContain('symbol');
    }
  });
});

describe('handleCodeCallers', () => {
  let db: Database.Database;
  beforeEach(() => { db = seedCallersDb(); });
  afterEach(() => { db.close(); });

  it('returns an error JSON when symbol is missing', async () => {
    const out = await handleCodeCallers({}, new SqliteDbAdapter(db), PID);
    const parsed = JSON.parse(out);
    expect(parsed.error).toContain('"symbol" is required');
  });

  it('finds a direct caller with formatted output', async () => {
    const out = await handleCodeCallers({ symbol: 'processData' }, new SqliteDbAdapter(db), PID);
    expect(out).toContain('Callers of "processData" (depth 1):');
    expect(out).toContain('[function] helper');
    expect(out).toContain('files/b.ts:5 (def: L10)');
    expect(out).toContain('Resolved to:');
    expect(out).toContain('[function] files/a.ts:3');
  });

  it('clamps depth to the 1-5 range', async () => {
    const out = await handleCodeCallers({ symbol: 'processData', depth: 0 }, new SqliteDbAdapter(db), PID);
    expect(out).toContain('(depth 1)');
    const deep = await handleCodeCallers({ symbol: 'processData', depth: 99 }, new SqliteDbAdapter(db), PID);
    expect(deep).toContain('(depth 5)');
  });

  it('applies a file filter to results', async () => {
    const out = await handleCodeCallers({ symbol: 'processData', file_filter: 'zap' }, new SqliteDbAdapter(db), PID);
    expect(out).toContain('No callers found for "processData"');
  });

  it('does not surface suggestions for near matches (symbolNotFoundResponse omits them)', async () => {
    db.prepare('INSERT INTO symbols (project_id, file_id, name, kind, start_line) VALUES (?, 1, ?, ?, ?)')
      .run(PID, 'processDataStore', 'function', 30);
    const out = await handleCodeCallers({ symbol: 'processDataS' }, new SqliteDbAdapter(db), PID);
    expect(out).toBe('Symbol "processDataS" not found in index.');
    expect(out).not.toContain('Did you mean');
  });

  it('reports not-found symbols without suggestions', async () => {
    const out = await handleCodeCallers({ symbol: 'zzz_nope' }, new SqliteDbAdapter(db), PID);
    expect(out).toBe('Symbol "zzz_nope" not found in index.');
  });
});

describe('handleCodeCallees', () => {
  let db: Database.Database;
  beforeEach(() => { db = seedCalleesDb(); });
  afterEach(() => { db.close(); });

  it('returns an error JSON when symbol is missing', async () => {
    const out = await handleCodeCallees({}, new SqliteDbAdapter(db), PID);
    expect(JSON.parse(out).error).toBeDefined();
  });

  it('finds a direct callee with formatted output', async () => {
    const out = await handleCodeCallees({ symbol: 'processData' }, new SqliteDbAdapter(db), PID);
    expect(out).toContain('Callees of "processData" (depth 1):');
    expect(out).toContain('[function] util_fn');
    expect(out).toContain('files/c.ts:9 (def: L15)');
  });

  it('excludes external callees when include_external is false', async () => {
    db.prepare(`INSERT INTO relationships (project_id, source_symbol_id, target_symbol, target_symbol_id, kind, file_path, line)
                VALUES (?, 1, 'lodashFn', NULL, 'calls', 'files/a.ts', 40)`).run(PID);
    const without = await handleCodeCallees({ symbol: 'processData', include_external: false }, new SqliteDbAdapter(db), PID);
    expect(without).not.toContain('lodashFn');
    expect(without).toContain('util_fn');
    const withExternal = await handleCodeCallees({ symbol: 'processData', include_external: true }, new SqliteDbAdapter(db), PID);
    expect(withExternal).toContain('lodashFn');
    expect(withExternal).toContain('(external)');
  });
});

function seedCallersDb(): Database.Database {
  const db = new Database(':memory:');
  db.exec(SCHEMA);
  db.prepare("INSERT INTO files (project_id, path, relative_path) VALUES (?, '/a.ts', 'files/a.ts')").run(PID);
  db.prepare("INSERT INTO files (project_id, path, relative_path) VALUES (?, '/b.ts', 'files/b.ts')").run(PID);
  db.prepare("INSERT INTO symbols (project_id, file_id, name, kind, start_line) VALUES (?, 1, 'processData', 'function', 3)").run(PID);
  db.prepare("INSERT INTO symbols (project_id, file_id, name, kind, start_line) VALUES (?, 2, 'helper', 'function', 10)").run(PID);
  db.prepare(`INSERT INTO relationships (project_id, source_symbol_id, target_symbol, target_symbol_id, kind, file_path, line)
              VALUES (?, 2, 'processData', 1, 'calls', 'files/b.ts', 5)`).run(PID);
  return db;
}

function seedCalleesDb(): Database.Database {
  const db = new Database(':memory:');
  db.exec(SCHEMA);
  db.prepare("INSERT INTO files (project_id, path, relative_path) VALUES (?, '/a.ts', 'files/a.ts')").run(PID);
  db.prepare("INSERT INTO files (project_id, path, relative_path) VALUES (?, '/c.ts', 'files/c.ts')").run(PID);
  db.prepare("INSERT INTO symbols (project_id, file_id, name, kind, start_line) VALUES (?, 1, 'processData', 'function', 3)").run(PID);
  db.prepare("INSERT INTO symbols (project_id, file_id, name, kind, start_line) VALUES (?, 2, 'util_fn', 'function', 15)").run(PID);
  db.prepare(`INSERT INTO relationships (project_id, source_symbol_id, target_symbol, target_symbol_id, kind, file_path, line)
              VALUES (?, 1, 'util_fn', 2, 'calls', 'files/a.ts', 9)`).run(PID);
  return db;
}