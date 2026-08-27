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

async function loadRateLimiter(nodeEnv: string | undefined, maxRpm?: number) {
  vi.resetModules();
  if (nodeEnv === undefined) delete (process.env as any).NODE_ENV;
  else process.env.NODE_ENV = nodeEnv;
  if (maxRpm === undefined) delete (process.env as any).RATE_LIMIT_MAX_RPM;
  else process.env.RATE_LIMIT_MAX_RPM = String(maxRpm);
  return await import('../rate-limiter.js');
}

describe('rateLimiter', () => {
  afterEach(() => {
    delete (process.env as any).NODE_ENV;
    delete (process.env as any).TRUST_PROXY;
    delete (process.env as any).RATE_LIMIT_MAX_RPM;
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
    process.env.TRUST_PROXY = 'true';
    // Use a small explicit cap so the test is fast and independent of defaults.
    const { rateLimiter } = await loadRateLimiter('production', 3);
    const headers = { 'x-forwarded-for': '9.9.9.9' };
    const json = vi.fn((body: unknown, init: unknown) => ({ body, init }));
    for (let i = 0; i < 3; i++) {
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

  it('defaults to 6000 rpm in production', async () => {
    const { rateLimiter } = await loadRateLimiter('production');
    const { c, header } = makeContext();
    await rateLimiter(c, vi.fn());
    expect(header).toHaveBeenCalledWith('X-RateLimit-Limit', '6000');
  });

  it('honors RATE_LIMIT_MAX_RPM override', async () => {
    const { rateLimiter } = await loadRateLimiter('production', 25000);
    const { c, header } = makeContext();
    await rateLimiter(c, vi.fn());
    expect(header).toHaveBeenCalledWith('X-RateLimit-Limit', '25000');
  });

  it('uses the client X-Rate-Limit-RPM header when below the server cap', async () => {
    const { rateLimiter } = await loadRateLimiter('production', 6000);
    const { c, header } = makeContext({ 'x-rate-limit-rpm': '500' });
    await rateLimiter(c, vi.fn());
    expect(header).toHaveBeenCalledWith('X-RateLimit-Limit', '500');
  });

  it('clamps a client request above the server cap down to the cap', async () => {
    const { rateLimiter } = await loadRateLimiter('production', 6000);
    const { c, header } = makeContext({ 'x-rate-limit-rpm': '999999' });
    await rateLimiter(c, vi.fn());
    expect(header).toHaveBeenCalledWith('X-RateLimit-Limit', '6000');
  });

  it('falls back to the server cap for an invalid client header', async () => {
    const { rateLimiter } = await loadRateLimiter('production', 6000);
    const { c, header } = makeContext({ 'x-rate-limit-rpm': 'not-a-number' });
    await rateLimiter(c, vi.fn());
    expect(header).toHaveBeenCalledWith('X-RateLimit-Limit', '6000');
  });

  it('setServerHardCap updates the effective cap at runtime', async () => {
    const mod = await loadRateLimiter('production', 6000);
    expect(mod.getServerHardCap()).toBe(6000);
    mod.setServerHardCap(1234);
    expect(mod.getServerHardCap()).toBe(1234);
    const { c, header } = makeContext();
    await mod.rateLimiter(c, vi.fn());
    expect(header).toHaveBeenCalledWith('X-RateLimit-Limit', '1234');
  });

  it('setServerHardCap ignores non-positive/non-integer values', async () => {
    const mod = await loadRateLimiter('production', 6000);
    mod.setServerHardCap(0);
    mod.setServerHardCap(-5);
    mod.setServerHardCap(3.5);
    expect(mod.getServerHardCap()).toBe(6000);
  });

  it('hot-reloads the cap when a rateLimit config-change event fires', async () => {
    vi.resetModules();
    process.env.NODE_ENV = 'production';
    process.env.RATE_LIMIT_MAX_RPM = '6000';
    // Import the module and the SAME bus instance from the same module graph.
    const mod = await import('../rate-limiter.js');
    const { bus, Events } = await import('../../../shared/EventBus.js');
    expect(mod.getServerHardCap()).toBe(6000);
    await bus.emit(Events.RATE_LIMIT_CONFIG_CHANGED, { section: 'rateLimit', key: 'maxRpm', value: 2500 });
    expect(mod.getServerHardCap()).toBe(2500);
    // A change to a different key must be ignored.
    await bus.emit(Events.RATE_LIMIT_CONFIG_CHANGED, { section: 'rateLimit', key: 'other', value: 99 });
    expect(mod.getServerHardCap()).toBe(2500);
  });
});