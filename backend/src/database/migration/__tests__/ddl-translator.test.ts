/**
 * Unit tests for the pure DDL translation helpers — dialect conversion,
 * FTS table detection and foreign-key stripping.
 */

import { describe, it, expect } from 'vitest';
import { translateCreateTable, isFtsTable, removeForeignKeys } from '../ddl-translator.js';

const SAMPLE = `CREATE TABLE files (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  path TEXT NOT NULL,
  data BLOB,
  score REAL,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (x) REFERENCES y(id)
);`;

describe('ddl-translator', () => {
  it('returns identity for the sqlite dialect', () => {
    expect(translateCreateTable(SAMPLE, 'sqlite')).toBe(SAMPLE);
  });

  it('translates to the postgresql dialect', () => {
    const ddl = translateCreateTable(SAMPLE, 'postgresql');
    expect(ddl).toContain('SERIAL PRIMARY KEY');
    expect(ddl).toContain('BYTEA');
    expect(ddl).toContain('DOUBLE PRECISION');
    expect(ddl).toContain('DEFAULT NOW()');
    expect(ddl).not.toContain('AUTOINCREMENT');
  });

  it('translates to the mysql dialect', () => {
    const ddl = translateCreateTable(SAMPLE, 'mysql');
    expect(ddl).toContain('INTEGER PRIMARY KEY AUTO_INCREMENT');
    expect(ddl).toContain('LONGBLOB');
    expect(ddl).toContain('DEFAULT CURRENT_TIMESTAMP');
  });

  it('isFtsTable detects FTS-related table names', () => {
    expect(isFtsTable('symbols_fts')).toBe(true);
    expect(isFtsTable('symbols_content')).toBe(true);
    expect(isFtsTable('symbols_segments')).toBe(true);
    expect(isFtsTable('symbols_segdir')).toBe(true);
    expect(isFtsTable('files')).toBe(false);
    expect(isFtsTable('knowledge_entries')).toBe(false);
  });

  it('removeForeignKeys strips FOREIGN KEY lines and trailing commas', () => {
    const ddl = removeForeignKeys(SAMPLE);
    expect(ddl).not.toContain('FOREIGN KEY');
    expect(ddl).toContain('path TEXT NOT NULL');
    expect(ddl).not.toMatch(/,\n\s*\)/);
  });
});