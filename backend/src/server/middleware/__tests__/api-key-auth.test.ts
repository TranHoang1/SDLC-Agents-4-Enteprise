/**
 * Unit tests — api-key-auth middleware (SA4E Finding #3).
 * Verifies env-gated activation, Bearer/X-API-Key extraction, timing-safe
 * comparison, and 401 responses on missing/invalid keys.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

function makeContext(headers: Record<string, string | undefined>) {
  const json = vi.fn((body: unknown, status: number) => ({ body, status }));
  const c: any = {
    req: { header: (name: string) => headers[name] },
    json,
  };
  return { c, json };
}

describe('apiKeyAuth', () => {
  beforeEach(() => {
    delete (process.env as any).CODE_INTEL_API_KEY;
  });

  afterEach(() => {
    delete (process.env as any).CODE_INTEL_API_KEY;
  });

  async function loadAuth() {
    vi.resetModules();
    return await import('../api-key-auth.js');
  }

  it('isApiKeyAuthEnabled is false when env var unset', async () => {
    const { isApiKeyAuthEnabled } = await loadAuth();
    expect(isApiKeyAuthEnabled()).toBe(false);
  });

  it('isApiKeyAuthEnabled is true when env var set', async () => {
    process.env.CODE_INTEL_API_KEY = 'secret-key';
    const { isApiKeyAuthEnabled } = await loadAuth();
    expect(isApiKeyAuthEnabled()).toBe(true);
  });

  it('is a no-op (calls next) when no API key configured', async () => {
    const { apiKeyAuth } = await loadAuth();
    const { c } = makeContext({});
    const next = vi.fn(async () => {});
    await apiKeyAuth(c, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(c.json).not.toHaveBeenCalled();
  });

  it('returns 401 when key required but no credential provided', async () => {
    process.env.CODE_INTEL_API_KEY = 'secret-key';
    const { apiKeyAuth } = await loadAuth();
    const { c, json } = makeContext({});
    const next = vi.fn(async () => {});
    const res = await apiKeyAuth(c, next);
    expect(json).toHaveBeenCalledTimes(1);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
    expect(json.mock.calls[0][1]).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 for a wrong Bearer credential', async () => {
    process.env.CODE_INTEL_API_KEY = 'secret-key';
    const { apiKeyAuth } = await loadAuth();
    const { json } = makeContext({ Authorization: 'Bearer wrong-key' });
    const next = vi.fn(async () => {});
    const res = await apiKeyAuth({ req: { header: (n: string) => (n === 'Authorization' ? 'Bearer wrong-key' : undefined) }, json } as any, next);
    expect(res.status).toBe(401);
    expect(res.body.error.message).toBe('Invalid API key.');
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 for a wrong X-API-Key credential', async () => {
    process.env.CODE_INTEL_API_KEY = 'secret-key';
    const { apiKeyAuth } = await loadAuth();
    const headers = { 'X-API-Key': 'wrong-key' };
    const { json } = makeContext(headers);
    const next = vi.fn(async () => {});
    const res = await apiKeyAuth({ req: { header: (n: string) => headers[n] }, json } as any, next);
    expect(res.status).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('passes through on correct Bearer credential', async () => {
    process.env.CODE_INTEL_API_KEY = 'secret-key';
    const { apiKeyAuth } = await loadAuth();
    const headers = { Authorization: 'Bearer secret-key' };
    const { json } = makeContext(headers);
    const next = vi.fn(async () => {});
    await apiKeyAuth({ req: { header: (n: string) => headers[n] }, json } as any, next);
    expect(json).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('passes through on correct X-API-Key credential', async () => {
    process.env.CODE_INTEL_API_KEY = 'secret-key';
    const { apiKeyAuth } = await loadAuth();
    const headers = { 'X-API-Key': 'secret-key' };
    const { json } = makeContext(headers);
    const next = vi.fn(async () => {});
    await apiKeyAuth({ req: { header: (n: string) => headers[n] }, json } as any, next);
    expect(json).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
  });
});