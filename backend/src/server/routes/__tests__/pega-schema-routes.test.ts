/**
 * SA4E-214 — Pega schema route factory contract (hermetic, no server).
 *
 * Documents and guards the contract:
 *  - createPegaSchemaRoutes(logger) WITHOUT a dbAdapter MUST return 503 for the
 *    persistence endpoints (store/find/update) — this is the exact symptom that
 *    appeared in UAT when HttpServer failed to inject the adapter.
 *  - createPegaSchemaRoutes(logger, dbAdapter) WITH an adapter MUST NOT 503.
 */
import { describe, it, expect } from 'vitest';
import type { Logger } from 'pino';
import { createPegaSchemaRoutes } from '../pega-schema-routes.js';

function makeLogger(): Logger {
  return {
    info: () => {},
    warn: () => {},
    error: () => {},
    debug: () => {},
    fatal: () => {},
    trace: () => {},
    child: () => makeLogger(),
    level: 'silent',
  } as unknown as Logger;
}

function makeFakeAdapter() {
  return {
    getAsync: async () => undefined,
    runAsync: async () => ({ lastID: 1, changes: 1 }),
  };
}

describe('SA4E-214 — dbAdapter wiring contract', () => {
  it('returns 503 (Storage service unavailable) when mounted WITHOUT dbAdapter', async () => {
    const app = createPegaSchemaRoutes(makeLogger());
    const store = await app.request('/pega/schema/store', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    expect(store.status).toBe(503);
    expect((await store.json() as any).error).toMatch(/no DB adapter/i);

    const find = await app.request('/pega/schema/find?ruleType=x');
    expect(find.status).toBe(503);

    const update = await app.request('/pega/schema/update', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    expect(update.status).toBe(503);
  });

  it('does NOT return 503 when mounted WITH a dbAdapter', async () => {
    const app = createPegaSchemaRoutes(makeLogger(), makeFakeAdapter());
    const store = await app.request('/pega/schema/store', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    expect(store.status).not.toBe(503);

    const find = await app.request('/pega/schema/find?ruleType=x');
    expect(find.status).not.toBe(503);

    const update = await app.request('/pega/schema/update', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    expect(update.status).not.toBe(503);
  });
});
