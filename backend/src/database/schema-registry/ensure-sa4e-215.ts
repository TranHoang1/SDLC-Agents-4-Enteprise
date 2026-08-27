/**
 * SA4E-215 — Idempotent schema bootstrap (ALIGNED TO REAL sa4e_db).
 *
 * Creates the two tables SA4E-215 owns (mcp_servers, decisions) if they do
 * not exist. DDL is generated from the canonical TableDef definitions in
 * ./sa4e-215.js so it never drifts from the schema registry.
 *
 * Called once at server startup (after initAdapters) for BOTH engines
 * (SQLite + PostgreSQL), via getDbAdapter().execAsync().
 */
import pino from 'pino';
import type { ColumnDef, DatabaseEngine, TableDef } from './types.js';
import { getDbAdapter, getActiveEngine } from '../../admin/db/core.js';
import { SA4E_215_TABLES } from './sa4e-215.js';

const logger = pino({ name: 'sa4e-215-schema' });

/** Resolve a possibly per-engine column type to a concrete SQL type string. */
function resolveType(type: ColumnDef['type']): string {
  if (typeof type === 'string') return type; // already a SQL type (text/integer/real/timestamp)
  const engine = getActiveEngine() as DatabaseEngine;
  return type[engine] || type.sqlite;
}

/** Resolve a possibly per-engine default to a concrete literal string. */
function resolveDefault(def: ColumnDef['default']): string | undefined {
  if (def === undefined) return undefined;
  if (typeof def === 'string') return def;
  const engine = getActiveEngine() as DatabaseEngine;
  return def[engine] ?? def.sqlite ?? def.postgresql ?? def.mysql;
}

function columnSql(col: ColumnDef): string {
  const sqlType = resolveType(col.type);
  const parts = [`"${col.name}"`, sqlType];
  if (col.primaryKey) parts.push('PRIMARY KEY');
  if (col.notNull) parts.push('NOT NULL');
  const def = resolveDefault(col.default);
  if (def !== undefined) {
    // Numeric columns must use a bare literal (PG rejects DEFAULT '0' on INTEGER).
    const numeric = sqlType === 'integer' || sqlType === 'real' || sqlType === 'boolean';
    const raw = String(def).replace(/^'|'$/g, '');
    const isNum = /^-?\d+(\.\d+)?$/.test(raw);
    const value = numeric && isNum ? raw : def;
    parts.push(`DEFAULT ${value}`);
  }
  return parts.join(' ');
}

function buildCreateTable(table: TableDef): string {
  const cols = table.columns.map(columnSql).join(',\n    ');
  let sql = `CREATE TABLE IF NOT EXISTS "${table.name}" (\n    ${cols}\n);`;
  for (const idx of table.indexes || []) {
    const unique = idx.unique ? 'UNIQUE ' : '';
    const colsList = idx.columns.map((c) => `"${c}"`).join(', ');
    sql += `\nCREATE ${unique}INDEX IF NOT EXISTS "${idx.name}" ON "${table.name}" (${colsList});`;
  }
  return sql;
}

/** Ensure SA4E-215 tables exist. Idempotent and safe to call on every boot. */
export async function ensureSa4e215Tables(): Promise<void> {
  const adapter = getDbAdapter();
  for (const table of SA4E_215_TABLES) {
    const ddl = buildCreateTable(table);
    try {
      await adapter.execAsync(ddl);
      logger.info({ table: table.name }, '[sa4e-215] table ensured');
    } catch (err) {
      logger.error({ err, table: table.name }, '[sa4e-215] failed to ensure table');
      throw err;
    }
  }
}
