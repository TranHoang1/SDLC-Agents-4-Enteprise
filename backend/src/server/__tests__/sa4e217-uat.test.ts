/**
 * SA4E-217 UAT — real execution of production route + JWT middleware.
 * Uses Hono app.request() against the actual handlers (jwt-auth, rate-limit-config-routes).
 * DB adapter is mocked (config_entries write). JWT is signed with a real HS256 secret.
 */
import { describe, it, expect, beforeAll, vi } from 'vitest';
import { createHmac } from 'crypto';

// Must set env BEFORE importing middleware (module reads consts at load time)
process.env.KB_TOKEN_SECRET = 'uattestsecret';
process.env.CODE_INTEL_REQUIRE_AUTH = 'true';

const SECRET = 'uattestsecret';

function makeJwt(payload: Record<string, any>): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const pl = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = createHmac('sha256', SECRET).update(`${header}.${pl}`).digest('base64url');
  return `${header}.${pl}.${sig}`;
}

// Mock DB adapter used by rate-limit-config-routes
const writes: any[] = [];
vi.mock('../../admin/db/core.js', () => ({
  getDbAdapter: () => ({
    run: async (sql: string, params: any[]) => {
      writes.push({ sql, params });
      return { lastID: 1, changes: 1 };
    },
    isConnected: () => true,
  }),
}));

describe('SA4E-217 UAT (real route + auth execution)', () => {
  let app: any;
  let validToken: string;
  let expiredToken: string;
  let badSigToken: string;

  beforeAll(async () => {
    const { Hono } = await import('hono');
    const { jwtAuth } = await import('../middleware/jwt-auth.js');
    const { createRateLimitConfigRoutes } = await import('../routes/rate-limit-config-routes.js');
    const { bus } = await import('../../shared/EventBus.js');
    const broadcasts: any[] = [];
    bus.on('ratelimit:config:changed', (p: any) => broadcasts.push(p));
    (globalThis as any).__broadcasts = broadcasts;

    app = new Hono();
    app.use('/api/v1/*', jwtAuth);
    app.route('/api/v1', createRateLimitConfigRoutes(console as any));
    // a protected enrichment-status route to test 403->401
    app.get('/api/v1/enrichment/status', jwtAuth, (c) =>
      c.json({ status: 'ok', data: { indexed: 10 } }),
    );

    const now = Math.floor(Date.now() / 1000);
    validToken = makeJwt({ sub: 'u', wid: 'ws1', pid: 'p1', exp: now + 3600 });
    expiredToken = makeJwt({ sub: 'u', wid: 'ws1', exp: now - 10 });
    const good = makeJwt({ sub: 'u', wid: 'ws1', exp: now + 3600 });
    const [h, p] = good.split('.');
    badSigToken = `${h}.${p}.invalidsignature`;
  });

  it('TC-1: valid JWT -> 200 enrichment status', async () => {
    const res = await app.request('/api/v1/enrichment/status', {
      headers: { Authorization: `Bearer ${validToken}`, 'X-Project-Id': 'p1' },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('ok');
  });

  it('TC-3 / TC-10: no token -> 401 (not 403)', async () => {
    const res = await app.request('/api/v1/enrichment/status', {
      headers: { 'X-Project-Id': 'p1' },
    });
    expect(res.status).toBe(401);
    expect(res.status).not.toBe(403);
  });

  it('TC-3: invalid signature -> 401', async () => {
    const res = await app.request('/api/v1/enrichment/status', {
      headers: { Authorization: `Bearer ${badSigToken}`, 'X-Project-Id': 'p1' },
    });
    expect(res.status).toBe(401);
  });

  it('TC-2: expired token -> 401 (client must refresh+retry)', async () => {
    const res = await app.request('/api/v1/enrichment/status', {
      headers: { Authorization: `Bearer ${expiredToken}`, 'X-Project-Id': 'p1' },
    });
    expect(res.status).toBe(401);
  });

  it('TC-4: POST config valid -> 200 + persisted + broadcast', async () => {
    writes.length = 0;
    const res = await app.request('/api/v1/rate-limit/config', {
      method: 'POST',
      headers: { Authorization: `Bearer ${validToken}`, 'Content-Type': 'application/json', 'X-Project-Id': 'p1' },
      body: JSON.stringify({ maxRPM: 200, hardCap: 100 }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.maxRPM).toBe(200);
    expect(body.hardCap).toBe(100);
    expect(body.broadcastSent).toBe(true);
    expect(writes.length).toBe(2); // maxRpm + hardCap upserts
    expect((globalThis as any).__broadcasts.length).toBe(1);
  });

  it('TC-11: invalid payload (maxRPM=0) -> 400', async () => {
    const res = await app.request('/api/v1/rate-limit/config', {
      method: 'POST',
      headers: { Authorization: `Bearer ${validToken}`, 'Content-Type': 'application/json', 'X-Project-Id': 'p1' },
      body: JSON.stringify({ maxRPM: 0 }),
    });
    expect(res.status).toBe(400);
  });

  it('TC-11: malformed JSON -> 400/500', async () => {
    const res = await app.request('/api/v1/rate-limit/config', {
      method: 'POST',
      headers: { Authorization: `Bearer ${validToken}`, 'Content-Type': 'application/json', 'X-Project-Id': 'p1' },
      body: 'not-json',
    });
    expect([400, 500]).toContain(res.status);
  });

  it('TC-3: config without token -> 401', async () => {
    const res = await app.request('/api/v1/rate-limit/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Project-Id': 'p1' },
      body: JSON.stringify({ maxRPM: 200 }),
    });
    expect(res.status).toBe(401);
  });
});
