/**
 * Unit tests — rate-limiter middleware (sliding window, 1 req watershed).
 * Verifies per-IP counting, header emission, TRUST_PROXY forwarding, and 429
 * responses with Retry-After when the window is exhausted.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';

function makeContext(headers: Record<string, string | undefined> = {}) {
  const header = vi.fn();
  const json = vi.fn((body: unknown, init: unknown) => ({ body, init }));
  const c: any = {
    req: { header: (name: string) => headers[name] },
    header,
    json,
  };
  return { c, header, json };
}

async function loadRateLimiter(nodeEnv: string | undefined) {
  vi.resetModules();
  if (nodeEnv === undefined) delete (process.env as any).NODE_ENV;
  else process.env.NODE_ENV = nodeEnv;
  return await import('../rate-limiter.js');
}

describe('rateLimiter', () => {
  afterEach(() => {
    delete (process.env as any).NODE_ENV;
    delete (process.env as any).TRUST_PROXY;
  });

  it('allows the first request and sets limit headers', async () => {
    const { rateLimiter } = await loadRateLimiter('test');
    const next = vi.fn();
    const { c, header, json } = makeContext();
    await rateLimiter(c, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(json).not.toHaveBeenCalled();
    expect(header).toHaveBeenCalledWith('X-RateLimit-Limit', '10000');
    expect(header).toHaveBeenCalledWith('X-RateLimit-Remaining', '9999');
    expect(header).toHaveBeenCalledWith('X-RateLimit-Reset', expect.any(String));
  });

  it('shares one bucket across requests when no proxy', async () => {
    const { rateLimiter } = await loadRateLimiter('test');
    const next = vi.fn();
    for (let i = 0; i < 3; i++) {
      const { header } = makeContext();
      await rateLimiter({ req: { header: () => undefined }, header: header as any, json: vi.fn() } as any, next);
    }
    expect(next).toHaveBeenCalledTimes(3);
  });

  it('uses X-Forwarded-For first value when TRUST_PROXY=true', async () => {
    process.env.TRUST_PROXY = 'true';
    const { rateLimiter } = await loadRateLimiter('test');
    const headers = { 'x-forwarded-for': '8.8.8.8, 1.2.3.4' };
    const c: any = { req: { header: (n: string) => headers[n] }, header: vi.fn(), json: vi.fn() };
    await rateLimiter(c, vi.fn());
  });

  it('counts per-IP separately when TRUST_PROXY=true', async () => {
    process.env.TRUST_PROXY = 'true';
    const { rateLimiter } = await loadRateLimiter('test');
    const nextA = vi.fn();
    const { header } = makeContext();
    await rateLimiter({ req: { header: (n: string) => (n === 'x-forwarded-for' ? '1.1.1.1' : undefined) }, header: header as any, json: vi.fn() } as any, nextA);
    expect(nextA).toHaveBeenCalledTimes(1);
  });

  it('returns 429 with Retry-After once the window limit is hit', async () => {
    process.env.NODE_ENV = 'production';
    process.env.TRUST_PROXY = 'true';
    const { rateLimiter } = await loadRateLimiter('production');
    const headers = { 'x-forwarded-for': '9.9.9.9' };
    const json = vi.fn((body: unknown, init: unknown) => ({ body, init }));
    for (let i = 0; i < 100; i++) {
      const c: any = { req: { header: (n: string) => headers[n] }, header: vi.fn(), json };
      await rateLimiter(c, vi.fn());
    }
    const next = vi.fn();
    const c: any = { req: { header: (n: string) => headers[n] }, header: vi.fn(), json };
    const res = await rateLimiter(c, next);
    expect(res.init.status).toBe(429);
    expect(res.body.error).toBe('Too many requests');
    expect(res.body.retryAfter).toBeGreaterThanOrEqual(0);
    expect(res.init.headers['Retry-After']).toBe(String(res.body.retryAfter));
    expect(next).not.toHaveBeenCalled();
  });
});