/**
 * Unit tests — localhost-only middleware (BR-35/37).
 * Verifies localhost host checks, non-localhost rejection, empty-host allowance,
 * and the CODE_INTEL_HOST=0.0.0.0 bypass.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { localhostOnly } from '../localhost-only.js';

function makeContext(host: string) {
  const json = vi.fn((body: unknown, status: number) => ({ body, status }));
  const c: any = {
    req: { header: (name: string) => (name.toLowerCase() === 'host' ? host : undefined) },
    json,
  };
  return { c, json };
}

describe('localhostOnly', () => {
  afterEach(() => {
    delete (process.env as any).CODE_INTEL_HOST;
  });

  it('allows localhost host', async () => {
    const next = vi.fn(async () => {});
    const { c, json } = makeContext('localhost:48721');
    await localhostOnly(c, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(json).not.toHaveBeenCalled();
  });

  it('allows 127.0.0.1 host', async () => {
    const next = vi.fn(async () => {});
    const { c, json } = makeContext('127.0.0.1:48721');
    await localhostOnly(c, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(json).not.toHaveBeenCalled();
  });

  it('allows IPv6 loopback [::1] host', async () => {
    const next = vi.fn(async () => {});
    const { c, json } = makeContext('[::1]:48721');
    await localhostOnly(c, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(json).not.toHaveBeenCalled();
  });

  it('rejects a remote host with 403 and does not call next', async () => {
    const next = vi.fn(async () => {});
    const { c, json } = makeContext('evil.example.com');
    const res = await localhostOnly(c, next);
    expect(json).toHaveBeenCalledTimes(1);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects a remote IP host with 403', async () => {
    const next = vi.fn(async () => {});
    const { c } = makeContext('192.168.1.50:8080');
    const res = await localhostOnly(c, next);
    expect(res.status).toBe(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('allows empty host header', async () => {
    const next = vi.fn(async () => {});
    const { c, json } = makeContext('');
    await localhostOnly(c, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(json).not.toHaveBeenCalled();
  });

  it('bypasses restriction when CODE_INTEL_HOST=0.0.0.0', async () => {
    process.env.CODE_INTEL_HOST = '0.0.0.0';
    const next = vi.fn(async () => {});
    const { c, json } = makeContext('evil.example.com');
    await localhostOnly(c, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(json).not.toHaveBeenCalled();
  });
});