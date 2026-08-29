import { describe, it, expect } from 'vitest';
import { SessionStore } from '../../../src/modules/sandbox/SessionStore.js';
import { generateSessionId, type Session } from '../../../src/modules/sandbox/models.js';

function makeSession(overrides: Partial<Session> = {}): Session {
  const now = new Date();
  return {
    sessionId: generateSessionId(),
    mode: 'local',
    status: 'running',
    baseImage: 'node:20-slim',
    mounts: [],
    resources: { memory: '512m', cpu: '1.0', disk: '1g', pidsLimit: 100 },
    networkEnabled: false,
    createdAt: now,
    lastActivity: now,
    ttl: 1800,
    env: {},
    ...overrides,
  };
}

describe('SessionStore', () => {
  it('set / get / count / delete', () => {
    const s = new SessionStore();
    const sess = makeSession();
    expect(s.count()).toBe(0);
    s.set(sess);
    expect(s.count()).toBe(1);
    expect(s.get(sess.sessionId)).toBe(sess);
    s.delete(sess.sessionId);
    expect(s.get(sess.sessionId)).toBeUndefined();
  });

  it('touch moves lastActivity forward', () => {
    const s = new SessionStore();
    const sess = makeSession({ lastActivity: new Date(Date.now() - 10000) });
    s.set(sess);
    s.touch(sess.sessionId);
    expect(Date.now() - s.get(sess.sessionId)!.lastActivity.getTime()).toBeLessThan(1000);
  });

  it('getExpired respects TTL (TC-06)', () => {
    const s = new SessionStore();
    const expired = makeSession({ ttl: 5, lastActivity: new Date(Date.now() - 10000) });
    const fresh = makeSession({ ttl: 1800, lastActivity: new Date() });
    s.set(expired);
    s.set(fresh);
    const ex = s.getExpired(Date.now()).map((e) => e.sessionId);
    expect(ex).toContain(expired.sessionId);
    expect(ex).not.toContain(fresh.sessionId);
  });

  it('list returns SessionInfo with idleSeconds', () => {
    const s = new SessionStore();
    const sess = makeSession({ lastActivity: new Date(Date.now() - 5000) });
    s.set(sess);
    const list = s.list();
    expect(list[0].idleSeconds).toBeGreaterThanOrEqual(4);
  });
});
