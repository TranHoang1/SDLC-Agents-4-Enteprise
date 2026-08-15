/**
 * In-memory DatabaseAdapter double with canned-route matching on SQL substrings.
 * Implements the full interface so stores and analysis services run unchanged.
 */

import type {
  DatabaseAdapter,
  DatabaseEngine,
  RunResult,
  PreparedStatement,
} from '../../../../database/adapters/DatabaseAdapter.js';

export interface FakeAdapter extends DatabaseAdapter {
  routeAll(match: string, rows: unknown[]): void;
  routeGet(match: string, row: unknown): void;
  routeFailAll(match: string): void;
  calls: string[];
  writes: Array<{ sql: string; params: unknown[] }>;
}

export function makeFakeAdapter(engine: DatabaseEngine = 'sqlite'): FakeAdapter {
  const allRoutes: Array<[string, unknown[]]> = [];
  const getRoutes: Array<[string, unknown]> = [];
  const failAllRoutes: string[] = [];
  const calls: string[] = [];
  const writes: Array<{ sql: string; params: unknown[] }> = [];

  const adapter: FakeAdapter = {
    routeAll(match, rows) { allRoutes.push([match, rows]); },
    routeGet(match, row) { getRoutes.push([match, row]); },
    routeFailAll(match) { failAllRoutes.push(match); },
    calls,
    writes,
    connect: async () => {},
    disconnect: async () => {},
    isConnected: () => false,
    getStatus: () => ({ connected: false, engine }),
    getEngine: () => engine,
    run: (sql, params = []) => { writes.push({ sql, params }); return { changes: 1, lastInsertRowid: 1 }; },
    get: <T>(sql: string) => { calls.push(sql); const r = getRoutes.find(([m]) => sql.includes(m)); return r?.[1] as T | undefined; },
    all: <T>(sql: string) => { calls.push(sql); const r = allRoutes.find(([m]) => sql.includes(m)); return (r?.[1] ?? []) as T[]; },
    exec: () => {},
    transaction: <T>(fn: () => T) => fn(),
    prepare: (): PreparedStatement => ({
      run: (...params: unknown[]): RunResult => {
        writes.push({ sql: 'prepared', params });
        return { changes: 0, lastInsertRowid: 0 };
      },
      get: <T = unknown>() => undefined as T | undefined,
      all: <T = unknown>() => [] as T[],
    }),
    runAsync: async (sql, params = []) => { writes.push({ sql, params }); return { changes: 1, lastInsertRowid: 1 }; },
    getAsync: async <T>(sql: string) => adapter.get<T>(sql),
    allAsync: async <T>(sql: string) => {
      if (failAllRoutes.some((m) => sql.includes(m))) throw new Error(`forced failure: ${sql.slice(0, 60)}`);
      return adapter.all<T>(sql);
    },
    execAsync: async () => {},
    transactionAsync: async <T>(fn: () => Promise<T>) => fn(),
    getVersion: async () => 'sqlite',
    getTableNames: async () => [],
    getRowCount: async () => 0,
  };
  return adapter;
}