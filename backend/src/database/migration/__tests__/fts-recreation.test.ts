/**
 * Unit tests for fts-recreation — SQLite FTS5 rebuild against a real
 * in-memory DB plus mocked postgresql/mysql adapters.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SqliteAdapter } from '../../adapters/SqliteAdapter.js';
import { recreateFtsInfrastructure } from '../fts-recreation.js';

let adapter: SqliteAdapter;

beforeEach(async () => {
  adapter = new SqliteAdapter(':memory:');
  await adapter.connect();
  adapter.exec(`CREATE TABLE knowledge_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    content TEXT NOT NULL,
    summary TEXT NOT NULL,
    tags TEXT NOT NULL DEFAULT '',
    source TEXT,
    source_ref TEXT,
    archived INTEGER NOT NULL DEFAULT 0
  )`);
  adapter.run(
    'INSERT INTO knowledge_entries (content, summary, tags, source, source_ref, archived) VALUES (?, ?, ?, ?, ?, ?)',
    ['alpha body', 'alpha', 'a', 's1', 'r1', 0],
  );
  adapter.run(
    'INSERT INTO knowledge_entries (content, summary, tags, source, source_ref, archived) VALUES (?, ?, ?, ?, ?, ?)',
    ['beta body', 'beta', 'b', 's2', 'r2', 0],
  );
  adapter.run(
    'INSERT INTO knowledge_entries (content, summary, tags, source, source_ref, archived) VALUES (?, ?, ?, ?, ?, ?)',
    ['archived body', 'archived', 'x', 's3', 'r3', 1],
  );
});

afterEach(async () => {
  if (adapter.isConnected()) await adapter.disconnect();
});

describe('fts-recreation', () => {
  it('recreates the SQLite FTS5 table with only non-archived entries', async () => {
    await recreateFtsInfrastructure(adapter);
    const tables = await adapter.getTableNames();
    expect(tables).toContain('knowledge_fts');
    expect(await adapter.getRowCount('knowledge_fts')).toBe(2);
  });

  it('is idempotent across repeated calls', async () => {
    await recreateFtsInfrastructure(adapter);
    await recreateFtsInfrastructure(adapter);
    expect(await adapter.getRowCount('knowledge_fts')).toBe(2);
  });

  it('creates the postgresql tsvector infrastructure', async () => {
    const runAsync = vi.fn().mockResolvedValue({ changes: 0, lastInsertRowid: 0 });
    const pg = { getEngine: () => 'postgresql', runAsync } as never;
    await recreateFtsInfrastructure(pg as never);
    const calls = runAsync.mock.calls.map((c) => String(c[0]));
    expect(calls.some((sql) => sql.includes('ADD COLUMN IF NOT EXISTS tsvector_content'))).toBe(true);
    expect(calls.some((sql) => sql.includes('CREATE INDEX IF NOT EXISTS idx_ke_tsvector'))).toBe(true);
    expect(calls.some((sql) => sql.includes('CREATE OR REPLACE FUNCTION ke_tsvector_update'))).toBe(true);
    expect(calls.some((sql) => sql.includes('CREATE TRIGGER trg_ke_tsvector'))).toBe(true);
  });

  it('is a no-op for unsupported engines', async () => {
    const runAsync = vi.fn();
    const mysql = { getEngine: () => 'mysql', runAsync } as never;
    await expect(recreateFtsInfrastructure(mysql as never)).resolves.toBeUndefined();
    expect(runAsync).not.toHaveBeenCalled();
  });
});