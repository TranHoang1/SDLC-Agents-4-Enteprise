/**
 * SA4E-6 — In-memory session registry with TTL tracking (TDD §4.2, AD-3).
 * Sessions are ephemeral — no persistence across backend restarts.
 */

import type { Session, SessionInfo } from './models.js';

export class SessionStore {
  private map = new Map<string, Session>();

  set(session: Session): void {
    this.map.set(session.sessionId, session);
  }

  get(sessionId: string): Session | undefined {
    return this.map.get(sessionId);
  }

  delete(sessionId: string): void {
    this.map.delete(sessionId);
  }

  count(): number {
    return this.map.size;
  }

  all(): Session[] {
    return Array.from(this.map.values());
  }

  touch(sessionId: string): void {
    const session = this.map.get(sessionId);
    if (session) session.lastActivity = new Date();
  }

  list(): SessionInfo[] {
    const now = Date.now();
    return this.all().map((s) => ({
      sessionId: s.sessionId,
      mode: s.mode,
      status: s.status,
      baseImage: s.baseImage,
      createdAt: s.createdAt.toISOString(),
      lastActivity: s.lastActivity.toISOString(),
      idleSeconds: Math.floor((now - s.lastActivity.getTime()) / 1000),
      ttl: s.ttl,
      networkEnabled: s.networkEnabled,
      containerId: s.containerId,
    }));
  }

  /** Sessions whose idle time (now - lastActivity) exceeds their TTL. */
  getExpired(now: number): Session[] {
    return this.all().filter((s) => now - s.lastActivity.getTime() > s.ttl * 1000);
  }
}
