/**
 * PostgreSQL Adapter — wraps node-postgres (pg) Pool.
 * Uses async methods for all DB operations.
 * SA4E-104: AsyncLocalStorage for concurrent-safe transactions.
 * Implements: SA4E-33
 */

import { AsyncLocalStorage } from 'node:async_hooks';
import type {
  DatabaseAdapter,
  DatabaseEngine,
  RunResult,
  ConnectionStatus,
  PreparedStatement,
} from './DatabaseAdapter.js';

export interface PostgresConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
  ssl: boolean;
  pool?: { min?: number; max?: number };
}

/** AsyncLocalStorage to scope queries to a dedicated client during transactions. */
const txClientStorage = new AsyncLocalStorage<{ query: (sql: string, params?: unknown[]) => Promise<any> }>();

export class PostgresAdapter implements DatabaseAdapter {
  private pool: any = null;
  private connected = false;
  private serverVersion = '';

  constructor(private readonly config: PostgresConfig) {}

  async connect(): Promise<void> {
    const { Pool } = await import('pg');
    this.pool = new Pool({
      host: this.config.host,
      port: this.config.port,
      user: this.config.username,
      password: this.config.password,
      database: this.config.database,
      ssl: this.config.ssl ? { rejectUnauthorized: false } : false,
      min: this.config.pool?.min ?? 2,
      max: this.config.pool?.max ?? 10,
    });
    // Evict idle clients that encounter errors — prevents poisoned connections in pool
    if (this.pool.on) {
      this.pool.on('error', (err: Error) => {
        console.error('[PostgresAdapter] Pool idle client error (evicted):', err.message);
      });
    }
    const res = await this.pool.query('SELECT version()');
    this.serverVersion = res.rows[0]?.version || 'PostgreSQL';
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    if (this.pool) { await this.pool.end(); this.pool = null; this.connected = false; }
  }

  isConnected(): boolean { return this.connected; }

  getStatus(): ConnectionStatus {
    return { connected: this.connected, engine: 'postgresql', version: this.serverVersion,
      details: { host: this.config.host, port: this.config.port, database: this.config.database } };
  }

  // Sync stubs — not usable for PG, use async variants
  run(sql: string, params?: unknown[]): RunResult { throw new Error('Use runAsync'); }
  get<T = unknown>(sql: string, params?: unknown[]): T | undefined { throw new Error('Use getAsync'); }
  all<T = unknown>(sql: string, params?: unknown[]): T[] { throw new Error('Use allAsync'); }
  exec(sql: string): void { throw new Error('Use execAsync'); }
  transaction<T>(fn: () => T): T { throw new Error('Use transactionAsync'); }
  prepare(sql: string): PreparedStatement { throw new Error('Use async methods'); }

  /**
   * Get the active query function — either the transaction client (from AsyncLocalStorage)
   * or the pool itself. This ensures queries inside transactionAsync() go through
   * the dedicated client without monkey-patching pool.query.
   */
  private getQueryFn(): (sql: string, params?: unknown[]) => Promise<any> {
    const txClient = txClientStorage.getStore();
    return txClient ? txClient.query : this.pool.query.bind(this.pool);
  }

  // Async methods
  async runAsync(sql: string, params?: unknown[]): Promise<RunResult> {
    const translated = this.translateParams(sql);
    const queryFn = this.getQueryFn();
    const inTransaction = !!txClientStorage.getStore();
    // SA4E-104: If INSERT without RETURNING, add RETURNING id to get lastInsertRowid
    const isInsert = /^\s*INSERT/i.test(sql);
    const hasReturning = /RETURNING/i.test(sql);
    if (isInsert && !hasReturning) {
      const withReturning = translated + ' RETURNING id';
      if (inTransaction) {
        // Inside transaction: attempt RETURNING id — if table has no 'id' column,
        // suppress that specific error and retry without RETURNING on same client.
        // PostgreSQL aborts tx on error, BUT "column does not exist" is a planning error
        // that does NOT actually abort the transaction in all PG versions.
        // If it does abort: the error propagates → transactionAsync() ROLLBACK is correct.
        try {
          const r = await queryFn(withReturning, params);
          const insertedId = r.rows?.[0]?.id ?? 0;
          return { changes: r.rowCount ?? 0, lastInsertRowid: insertedId };
        } catch (err: any) {
          // Re-throw all errors — let transactionAsync() handle ROLLBACK.
          // DO NOT attempt fallback inside aborted transaction.
          throw err;
        }
      }
      // Outside transaction: attempt RETURNING id with dedicated client fallback.
      // BUG FIX: pool.query() uses implicit transaction — if RETURNING id fails,
      // the connection is "poisoned" (aborted tx). We MUST use a fresh client for fallback.
      try {
        const r = await queryFn(withReturning, params);
        const insertedId = r.rows?.[0]?.id ?? 0;
        return { changes: r.rowCount ?? 0, lastInsertRowid: insertedId };
      } catch (err) {
        // Fallback: table may not have 'id' column — use dedicated client to avoid poisoned connection.
        const client = await this.pool.connect();
        try {
          const r = await client.query(translated, params);
          return { changes: r.rowCount ?? 0, lastInsertRowid: 0 };
        } finally {
          client.release();
        }
      }
    }
    const r = await queryFn(translated, params);
    return { changes: r.rowCount ?? 0, lastInsertRowid: 0 };
  }

  async getAsync<T = unknown>(sql: string, params?: unknown[]): Promise<T | undefined> {
    const r = await this.getQueryFn()(this.translateParams(sql), params);
    return r.rows[0] as T | undefined;
  }

  async allAsync<T = unknown>(sql: string, params?: unknown[]): Promise<T[]> {
    const r = await this.getQueryFn()(this.translateParams(sql), params);
    return r.rows as T[];
  }

  async execAsync(sql: string): Promise<void> {
    await this.getQueryFn()(sql);
  }

  /**
   * Execute fn() within a PostgreSQL transaction using a dedicated client.
   * Uses AsyncLocalStorage to scope all queries within fn() to the same client —
   * no monkey-patching, fully concurrent-safe.
   */
  async transactionAsync<T>(fn: () => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await txClientStorage.run(
        { query: client.query.bind(client) },
        fn,
      );
      await client.query('COMMIT');
      return result;
    } catch (err) {
      try { await client.query('ROLLBACK'); } catch (err) { console.debug('[PostgresAdapter] ignore rollback error :', (err as Error).message); }
      throw err;
    } finally {
      client.release();
    }
  }

  getEngine(): DatabaseEngine { return 'postgresql'; }
  async getVersion(): Promise<string> { return this.serverVersion; }

  async getTableNames(): Promise<string[]> {
    const r = await this.getQueryFn()("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename");
    return r.rows.map((row: any) => row.tablename);
  }

  async getRowCount(table: string): Promise<number> {
    const r = await this.getQueryFn()(`SELECT COUNT(*) as cnt FROM "${table}"`);
    return parseInt(r.rows[0]?.cnt || '0', 10);
  }

  private translateParams(sql: string): string {
    let idx = 0;
    return sql.replace(/\?/g, () => `$${++idx}`);
  }
}

