/**
 * Unit tests for pg-schema-ensure — guards against wrong engines / closed
 * adapters, and issues idempotent DDL for postgresql adapters without failing.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ensurePostgresIndexSchema } from '../pg-schema-ensure.js';

let execAsync: ReturnType<typeof vi.fn>;
let runAsync: ReturnType<typeof vi.fn>;

beforeEach(() => {
  execAsync = vi.fn().mockResolvedValue(undefined);
  runAsync = vi.fn().mockResolvedValue({ changes: 0, lastInsertRowid: 0 });
});

afterEach(() => vi.clearAllMocks());

function adapter(engine: string, connected: boolean) {
  return {
    getEngine: () => engine,
    isConnected: () => connected,
    execAsync,
    runAsync,
  };
}

describe('pg-schema-ensure', () => {
  it('returns immediately for non-postgresql engines', async () => {
    await ensurePostgresIndexSchema(adapter('sqlite', true) as never);
    await ensurePostgresIndexSchema(adapter('mysql', true) as never);
    expect(execAsync).not.toHaveBeenCalled();
    expect(runAsync).not.toHaveBeenCalled();
  });

  it('returns immediately when the adapter is not connected', async () => {
    await ensurePostgresIndexSchema(adapter('postgresql', false) as never);
    expect(execAsync).not.toHaveBeenCalled();
    expect(runAsync).not.toHaveBeenCalled();
  });

  it('issues table DDL for a connected postgresql adapter', async () => {
    await ensurePostgresIndexSchema(adapter('postgresql', true) as never);
    expect(execAsync).toHaveBeenCalled();
    const sql = execAsync.mock.calls.map((c) => String(c[0]));
    expect(sql.some((s) => s.includes('CREATE TABLE IF NOT EXISTS files'))).toBe(true);
    expect(sql.some((s) => s.includes('CREATE TABLE IF NOT EXISTS symbols'))).toBe(true);
    expect(sql.some((s) => s.includes('CREATE TABLE IF NOT EXISTS body_embeddings'))).toBe(true);
    expect(execAsync.mock.calls.length + runAsync.mock.calls.length).toBeGreaterThan(10);
  });

  it('continues when an ALTER fails (safeExec is non-fatal)', async () => {
    runAsync.mockRejectedValueOnce(new Error('column already exists'));
    await expect(ensurePostgresIndexSchema(adapter('postgresql', true) as never)).resolves.toBeUndefined();
    expect(runAsync).toHaveBeenCalled();
  });
});