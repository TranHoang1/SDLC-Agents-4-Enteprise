/**
 * Unit tests for TypeMapper — runtime column type scanning and per-engine DDL
 * generation using an in-memory SQLite source.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SqliteAdapter } from '../../adapters/SqliteAdapter.js';
import { TypeMapper } from '../TypeMapper.js';

let adapter: SqliteAdapter;

beforeEach(async () => {
  adapter = new SqliteAdapter(':memory:');
  await adapter.connect();
  adapter.exec(`CREATE TABLE sample (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    payload BLOB,
    amount NUMERIC,
    score REAL,
    created_at TEXT DEFAULT (datetime('now')),
    mixed INTEGER
  )`);
  adapter.run(
    'INSERT INTO sample (name, payload, amount, score, created_at, mixed) VALUES (?, ?, ?, ?, ?, ?)',
    ['a', Buffer.from([1, 2]), 1.5, 2.5, '2024-01-01 12:00:00', 1],
  );
  adapter.run(
    'INSERT INTO sample (name, payload, amount, score, created_at, mixed) VALUES (?, ?, ?, ?, ?, ?)',
    ['b', Buffer.from([3]), 2.5, 3.5, '2024-01-02 12:00:00', 2],
  );
  adapter.run(
    'INSERT INTO sample (name, payload, amount, score, created_at, mixed) VALUES (?, ?, ?, ?, ?, ?)',
    ['c', Buffer.from([4]), 3.5, 4.5, '2024-01-03 12:00:00', 'not-a-number'],
  );
});

afterEach(async () => {
  if (adapter.isConnected()) await adapter.disconnect();
});

describe('TypeMapper', () => {
  const mapper = (): TypeMapper => new TypeMapper(adapter);

  it('maps PK INTEGER columns per engine', () => {
    expect(mapper().resolveColumnType('sample', 'id', 'INTEGER', 'postgresql', true)).toBe('SERIAL');
    expect(mapper().resolveColumnType('sample', 'id', 'INTEGER', 'mysql', true)).toBe('INT AUTO_INCREMENT');
  });

  it('maps BLOB columns to BYTEA/LONGBLOB', () => {
    expect(mapper().resolveColumnType('sample', 'payload', 'BLOB', 'postgresql', false)).toBe('BYTEA');
    expect(mapper().resolveColumnType('sample', 'payload', 'BLOB', 'mysql', false)).toBe('LONGBLOB');
  });

  it('maps NUMERIC columns per engine', () => {
    expect(mapper().resolveColumnType('sample', 'amount', 'NUMERIC', 'postgresql', false)).toBe('NUMERIC');
    expect(mapper().resolveColumnType('sample', 'amount', 'NUMERIC', 'mysql', false)).toBe('DECIMAL');
  });

  it('maps REAL columns per engine', () => {
    expect(mapper().resolveColumnType('sample', 'score', 'REAL', 'postgresql', false)).toBe('DOUBLE PRECISION');
    expect(mapper().resolveColumnType('sample', 'score', 'REAL', 'mysql', false)).toBe('DOUBLE');
  });

  it('maps INTEGER columns containing text to TEXT', () => {
    expect(mapper().resolveColumnType('sample', 'mixed', 'INTEGER', 'postgresql', false)).toBe('TEXT');
  });

  it('maps plain TEXT columns to TEXT', () => {
    expect(mapper().resolveColumnType('sample', 'name', 'TEXT', 'postgresql', false)).toBe('TEXT');
  });

  it('promotes datetime-default TEXT columns to TIMESTAMP/DATETIME', () => {
    expect(mapper().resolveColumnType('sample', 'created_at', 'TEXT', 'postgresql', false)).toBe('TIMESTAMP');
    expect(mapper().resolveColumnType('sample', 'created_at', 'TEXT', 'mysql', false)).toBe('DATETIME');
  });

  it('generateCreateTable builds engine-specific DDL', () => {
    const ddl = mapper().generateCreateTable('sample', 'postgresql');
    expect(ddl).toContain('CREATE TABLE IF NOT EXISTS "sample"');
    expect(ddl).toContain('"id" SERIAL PRIMARY KEY');
    expect(ddl).toContain('"name" TEXT NOT NULL');
    expect(ddl).toContain('"payload" BYTEA');
    expect(ddl).toContain('"created_at" TIMESTAMP DEFAULT NOW()');
    expect(ddl).toContain('"mixed" TEXT');
  });
});