/**
 * PostgreSQL Adapter — wraps node-postgres (pg) Pool.
 * Uses async methods for all DB operations.
 * Implements: SA4E-33
 */

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

  // Async methods
  async runAsync(sql: string, params?: unknown[]): Promise<RunResult> {
    const translated = this.translateParams(sql);
    // SA4E-104: If INSERT without RETURNING, add RETURNING id to get lastInsertRowid
    const isInsert = /^\s*INSERT/i.test(sql);
    const hasReturning = /RETURNING/i.test(sql);
    if (isInsert && !hasReturning) {
      const withReturning = translated + ' RETURNING id';
      try {
        const r = await this.pool.query(withReturning, params);
        const insertedId = r.rows?.[0]?.id ?? 0;
        return { changes: r.rowCount ?? 0, lastInsertRowid: insertedId };
      } catch {
        // Fallback: table may not have 'id' column — run without RETURNING
        const r = await this.pool.query(translated, params);
        return { changes: r.rowCount ?? 0, lastInsertRowid: 0 };
      }
    }
    const r = await this.pool.query(translated, params);
    return { changes: r.rowCount ?? 0, lastInsertRowid: 0 };
  }

  async getAsync<T = unknown>(sql: string, params?: unknown[]): Promise<T | undefined> {
    const r = await this.pool.query(this.translateParams(sql), params);
    return r.rows[0] as T | undefined;
  }

  async allAsync<T = unknown>(sql: string, params?: unknown[]): Promise<T[]> {
    const r = await this.pool.query(this.translateParams(sql), params);
    return r.rows as T[];
  }

  async execAsync(sql: string): Promise<void> {
    await this.pool.query(sql);
  }

  async transactionAsync<T>(fn: () => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      // Temporarily override pool.query to use this client for all calls within fn()
      const originalQuery = this.pool.query.bind(this.pool);
      (this.pool as any).query = client.query.bind(client);
      const r = await fn();
      (this.pool as any).query = originalQuery;
      await client.query('COMMIT');
      return r;
    } catch (err) {
      try { await client.query('ROLLBACK'); } catch { /* ignore rollback error */ }
      throw err;
    } finally {
      // Restore pool.query in case it wasn't restored above (error path)
      client.release();
    }
  }

  getEngine(): DatabaseEngine { return 'postgresql'; }
  async getVersion(): Promise<string> { return this.serverVersion; }

  async getTableNames(): Promise<string[]> {
    const r = await this.pool.query("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename");
    return r.rows.map((row: any) => row.tablename);
  }

  async getRowCount(table: string): Promise<number> {
    const r = await this.pool.query(`SELECT COUNT(*) as cnt FROM "${table}"`);
    return parseInt(r.rows[0]?.cnt || '0', 10);
  }

  private translateParams(sql: string): string {
    let idx = 0;
    return sql.replace(/\?/g, () => `$${++idx}`);
  }
}

