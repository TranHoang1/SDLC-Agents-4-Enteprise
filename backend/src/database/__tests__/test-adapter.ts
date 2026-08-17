/**
 * Test-only DatabaseAdapter backed by an in-memory better-sqlite3 Database.
 * Normalizes Postgres-style $N placeholders to '?' so repositories that use
 * $1..$n parameters can be exercised against real SQLite storage.
 */

import type { DatabaseAdapter, RunResult } from '../adapters/DatabaseAdapter.js';
import type Database from 'better-sqlite3';

export function makeTestAdapter(db: Database.Database): DatabaseAdapter {
  const normalize = (sql: string): string => sql.replace(/\$(\d+)/g, '?');

  const runSync = (sql: string, params?: unknown[]): RunResult => {
    const r = db.prepare(normalize(sql)).run(...(params ?? []));
    return { changes: r.changes, lastInsertRowid: r.lastInsertRowid };
  };

  const adapter: Record<string, unknown> = {
    connect: async (): Promise<void> => {},
    disconnect: async (): Promise<void> => {},
    isConnected: (): boolean => true,
    getEngine: (): 'sqlite' => 'sqlite',
    getStatus: () => ({ connected: true, engine: 'sqlite' }),
    run: (sql: string, params?: unknown[]): RunResult => runSync(sql, params),
    get: (sql: string, params?: unknown[]) => db.prepare(normalize(sql)).get(...(params ?? [])),
    all: (sql: string, params?: unknown[]) => db.prepare(normalize(sql)).all(...(params ?? [])),
    exec: (sql: string): void => {
      db.exec(sql);
    },
    transaction: <T>(fn: () => T): T => db.transaction(fn)(),
    prepare: (sql: string) => {
      const stmt = db.prepare(normalize(sql));
      return {
        run: (...p: unknown[]): RunResult => {
          const r = stmt.run(...p);
          return { changes: r.changes, lastInsertRowid: r.lastInsertRowid };
        },
        get: <T = unknown>(...p: unknown[]): T | undefined => stmt.get(...p) as T | undefined,
        all: <T = unknown>(...p: unknown[]): T[] => stmt.all(...p) as T[],
      };
    },
    runAsync: async (sql: string, params?: unknown[]): Promise<RunResult> => runSync(sql, params),
    getAsync: async (sql: string, params?: unknown[]) =>
      db.prepare(normalize(sql)).get(...(params ?? [])),
    allAsync: async (sql: string, params?: unknown[]) =>
      db.prepare(normalize(sql)).all(...(params ?? [])),
    execAsync: async (sql: string): Promise<void> => {
      db.exec(sql);
    },
    transactionAsync: <T>(fn: () => Promise<T>): Promise<T> => fn(),
    getVersion: async (): Promise<string> => 'SQLite (test)',
    getTableNames: async (): Promise<string[]> => {
      const rows = db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
        .all() as { name: string }[];
      return rows.map((r) => r.name);
    },
    getRowCount: async (table: string): Promise<number> => {
      const row = db.prepare(`SELECT COUNT(*) as cnt FROM "${table}"`).get() as { cnt: number } | undefined;
      return row?.cnt ?? 0;
    },
    getRawDb: (): Database.Database => db,
  };

  return adapter as unknown as DatabaseAdapter;
}
