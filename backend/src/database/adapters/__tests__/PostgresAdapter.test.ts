/**
 * Unit tests for PostgresAdapter — lifecycle, parameter translation, RETURNING
 * handling, transactions and metadata, all against a mocked pg Pool.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PostgresAdapter } from '../PostgresAdapter.js';

const pgMocks = vi.hoisted(() => ({
  pool: {
    query: vi.fn(),
    end: vi.fn().mockResolvedValue(undefined),
    connect: vi.fn(),
  },
}));

vi.mock('pg', () => ({
  Pool: vi.fn(function () {
    return pgMocks.pool;
  }),
}));

let client: { query: ReturnType<typeof vi.fn>; release: ReturnType<typeof vi.fn> };

beforeEach(() => {
  vi.clearAllMocks();
  client = {
    query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
    release: vi.fn(),
  };
  pgMocks.pool.query.mockResolvedValue({ rows: [], rowCount: 0 });
  pgMocks.pool.connect.mockResolvedValue(client);
});

afterEach(() => vi.clearAllMocks());

function makeAdapter(): PostgresAdapter {
  return new PostgresAdapter({
    host: 'localhost', port: 5432, username: 'u', password: 'p',
    database: 'sa4e', ssl: false, pool: { min: 1, max: 3 },
  });
}

describe('PostgresAdapter', () => {
  it('connects, reads the server version and reports status', async () => {
    pgMocks.pool.query.mockResolvedValue({ rows: [{ version: 'PostgreSQL 16.0' }], rowCount: 1 });
    const adapter = makeAdapter();
    await adapter.connect();
    expect(adapter.isConnected()).toBe(true);
    expect(adapter.getEngine()).toBe('postgresql');
    expect(await adapter.getVersion()).toBe('PostgreSQL 16.0');
    const status = adapter.getStatus();
    expect(status.connected).toBe(true);
    expect(status.engine).toBe('postgresql');
    expect((status.details as { host: string }).host).toBe('localhost');
  });

  it('disconnect releases the pool', async () => {
    const adapter = makeAdapter();
    await adapter.connect();
    await adapter.disconnect();
    expect(pgMocks.pool.end).toHaveBeenCalled();
    expect(adapter.isConnected()).toBe(false);
  });

  it('runAsync appends RETURNING id for inserts and translates params', async () => {
    pgMocks.pool.query.mockResolvedValue({ rows: [{ id: 7 }], rowCount: 1 });
    const adapter = makeAdapter();
    await adapter.connect();
    const res = await adapter.runAsync('INSERT INTO users (name, email) VALUES (?, ?)', ['a', 'e']);
    expect(pgMocks.pool.query).toHaveBeenCalledWith(
      'INSERT INTO users (name, email) VALUES ($1, $2) RETURNING id',
      ['a', 'e'],
    );
    expect(res).toEqual({ changes: 1, lastInsertRowid: 7 });
  });

  it('runAsync falls back without RETURNING when the table has no id column', async () => {
    const adapter = makeAdapter();
    await adapter.connect();
    // First call (RETURNING id) fails
    pgMocks.pool.query
      .mockRejectedValueOnce(new Error('column "id" does not exist'));
    // Fallback uses pool.connect() → client.query() with fresh connection
    pgMocks.pool.connect.mockResolvedValueOnce(client);
    client.query.mockResolvedValueOnce({ rows: [], rowCount: 1 });
    const res = await adapter.runAsync('INSERT INTO settings (key) VALUES (?)', ['k']);
    expect(client.query).toHaveBeenCalledWith('INSERT INTO settings (key) VALUES ($1)', ['k']);
    expect(client.release).toHaveBeenCalled();
    expect(res).toEqual({ changes: 1, lastInsertRowid: 0 });
  });

  it('runAsync returns rowCount for non-insert statements', async () => {
    pgMocks.pool.query.mockResolvedValue({ rows: [], rowCount: 3 });
    const adapter = makeAdapter();
    await adapter.connect();
    const res = await adapter.runAsync('UPDATE users SET email = ? WHERE id = ?', ['e', 1]);
    expect(pgMocks.pool.query).toHaveBeenCalledWith('UPDATE users SET email = $1 WHERE id = $2', ['e', 1]);
    expect(res).toEqual({ changes: 3, lastInsertRowid: 0 });
  });

  it('getAsync and allAsync return queried rows', async () => {
    const adapter = makeAdapter();
    await adapter.connect();
    pgMocks.pool.query.mockResolvedValue({ rows: [{ id: 1, name: 'a' }], rowCount: 1 });
    expect(await adapter.getAsync('SELECT * FROM users WHERE id = ?', [1])).toEqual({ id: 1, name: 'a' });
    expect(pgMocks.pool.query).toHaveBeenLastCalledWith('SELECT * FROM users WHERE id = $1', [1]);

    pgMocks.pool.query.mockResolvedValue({ rows: [{ id: 1 }, { id: 2 }], rowCount: 2 });
    expect(await adapter.allAsync('SELECT id FROM users')).toHaveLength(2);
  });

  it('execAsync runs raw SQL without parameter translation', async () => {
    const adapter = makeAdapter();
    await adapter.connect();
    await adapter.execAsync('CREATE TABLE t (id SERIAL PRIMARY KEY)');
    expect(pgMocks.pool.query).toHaveBeenCalledWith('CREATE TABLE t (id SERIAL PRIMARY KEY)');
  });

  it('transactionAsync commits successful work and scopes queries to the client', async () => {
    const adapter = makeAdapter();
    await adapter.connect();
    pgMocks.pool.query.mockResolvedValue({ rows: [], rowCount: 0 });
    client.query.mockResolvedValue({ rows: [], rowCount: 0 });
    const result = await adapter.transactionAsync(async () => {
      await adapter.runAsync('INSERT INTO t (id) VALUES (?)', [1]);
      return 'committed';
    });
    expect(result).toBe('committed');
    const clientSql = client.query.mock.calls.map((c) => c[0]);
    expect(clientSql[0]).toBe('BEGIN');
    expect(clientSql.some((sql) => String(sql).includes('INSERT INTO t (id) VALUES ($1)'))).toBe(true);
    expect(clientSql.some((sql) => String(sql).includes('COMMIT'))).toBe(true);
  });

  it('transactionAsync rolls back when the fn throws', async () => {
    const adapter = makeAdapter();
    await adapter.connect();
    await expect(
      adapter.transactionAsync(async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    const clientSql = client.query.mock.calls.map((c) => c[0]);
    expect(clientSql).toContain('ROLLBACK');
  });

  it('getTableNames and getRowCount query pg metadata', async () => {
    const adapter = makeAdapter();
    await adapter.connect();
    pgMocks.pool.query
      .mockResolvedValueOnce({ rows: [{ tablename: 'users' }, { tablename: 'files' }], rowCount: 2 })
      .mockResolvedValueOnce({ rows: [{ cnt: '42' }], rowCount: 1 });
    expect(await adapter.getTableNames()).toEqual(['users', 'files']);
    expect(await adapter.getRowCount('users')).toBe(42);
  });

  it('sync stubs throw to force async usage', async () => {
    const adapter = makeAdapter();
    expect(() => adapter.run('SELECT 1')).toThrow('Use runAsync');
    expect(() => adapter.get('SELECT 1')).toThrow('Use getAsync');
    expect(() => adapter.all('SELECT 1')).toThrow('Use allAsync');
    expect(() => adapter.exec('SELECT 1')).toThrow('Use execAsync');
    expect(() => adapter.transaction(() => 1)).toThrow('Use transactionAsync');
    expect(() => adapter.prepare('SELECT 1')).toThrow('Use async methods');
  });
});