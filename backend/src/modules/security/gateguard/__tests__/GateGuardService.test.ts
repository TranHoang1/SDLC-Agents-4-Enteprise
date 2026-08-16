/**
 * SA4E-167 — GateGuardService unit tests.
 * Tests evaluate(), addPattern(), removePattern(), processOverride(), ReDoS rejection.
 * Uses in-memory mock repository — no real SQLite dependency.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { GateGuardService } from '../GateGuardService.js';
import type { GateGuardRepository } from '../GateGuardRepository.js';
import type { DenyPattern, GateGuardAction, AuditEntry } from '../models.js';
import type { InsertAuditParams } from '../GateGuardRepository.js';
import pino from 'pino';

/** In-memory mock repository — satisfies GateGuardRepository interface */
class MockGateGuardRepository implements Pick<GateGuardRepository,
  'ensureSchema' | 'insertAudit' | 'queryAudit' | 'getPatterns' | 'addPattern' | 'removePattern'
> {
  private patterns: DenyPattern[] = [];
  private auditLog: AuditEntry[] = [];

  ensureSchema(): void { /* no-op for in-memory */ }

  insertAudit(params: InsertAuditParams): void {
    this.auditLog.push({
      id: this.auditLog.length + 1,
      timestamp: new Date().toISOString(),
      command: params.command,
      agent: params.agent,
      patternMatched: params.patternMatched,
      action: params.action,
      overrideBy: params.overrideBy,
      projectId: params.projectId,
      contextJson: params.contextJson,
    });
  }

  queryAudit(
    projectId?: string, limit = 50, actionFilter?: GateGuardAction,
  ): AuditEntry[] {
    let entries = [...this.auditLog];
    if (projectId) entries = entries.filter(e => e.projectId === projectId);
    if (actionFilter) entries = entries.filter(e => e.action === actionFilter);
    return entries.slice(0, limit);
  }

  getPatterns(projectId?: string): DenyPattern[] {
    if (projectId) {
      return this.patterns.filter(
        p => p.projectId === projectId || !p.projectId,
      );
    }
    return [...this.patterns];
  }

  addPattern(pattern: DenyPattern): void {
    this.patterns.push(pattern);
  }

  removePattern(patternId: string): boolean {
    const idx = this.patterns.findIndex(
      p => p.id === patternId && !p.isDefault,
    );
    if (idx === -1) return false;
    this.patterns.splice(idx, 1);
    return true;
  }
}

const logger = pino({ level: 'silent' });

describe('GateGuardService', () => {
  let service: GateGuardService;
  let repo: MockGateGuardRepository;

  beforeEach(() => {
    repo = new MockGateGuardRepository();
    service = new GateGuardService(
      repo as unknown as GateGuardRepository,
      logger,
    );
  });

  describe('evaluate() — safe commands', () => {
    it('allows git commit', () => {
      const result = service.evaluate('git commit -m "fix typo"');
      expect(result.action).toBe('allowed');
    });

    it('allows npm install', () => {
      const result = service.evaluate('npm install express');
      expect(result.action).toBe('allowed');
    });

    it('allows ls -la', () => {
      const result = service.evaluate('ls -la /home/user');
      expect(result.action).toBe('allowed');
    });
  });

  describe('evaluate() — destructive commands blocked', () => {
    it('blocks rm -rf /', () => {
      const result = service.evaluate('rm -rf /');
      expect(result.action).toBe('blocked');
      expect(result.patternMatched).toBeDefined();
    });

    it('blocks rm -rf ~', () => {
      const result = service.evaluate('rm -rf ~');
      expect(result.action).toBe('blocked');
    });

    it('blocks git push --force', () => {
      const result = service.evaluate('git push --force origin main');
      expect(result.action).toBe('blocked');
    });

    it('blocks git push -f', () => {
      const result = service.evaluate('git push -f origin main');
      expect(result.action).toBe('blocked');
    });

    it('blocks DROP TABLE', () => {
      const result = service.evaluate('DROP TABLE users;');
      expect(result.action).toBe('blocked');
    });

    it('blocks DROP DATABASE', () => {
      const result = service.evaluate('DROP DATABASE production;');
      expect(result.action).toBe('blocked');
    });

    it('blocks git reset --hard', () => {
      const result = service.evaluate('git reset --hard HEAD~5');
      expect(result.action).toBe('blocked');
    });

    it('returns overrideHash for blocked commands', () => {
      const result = service.evaluate('DROP TABLE users;');
      expect(result.overrideHash).toBeDefined();
      expect(result.overrideHash!.length).toBe(12);
    });
  });

  describe('addPattern() — custom denylist', () => {
    it('adds custom pattern that blocks matching commands', () => {
      service.addPattern('npm publish', 'Block npm publish');
      service.invalidateCache();
      const result = service.evaluate('npm publish --access public');
      expect(result.action).toBe('blocked');
    });

    it('rejects ReDoS-prone patterns', () => {
      // Catastrophic backtracking pattern
      expect(() => {
        service.addPattern('(a+)+$', 'ReDoS pattern');
      }).toThrow(/Invalid regex/);
    });

    it('rejects invalid regex syntax', () => {
      expect(() => {
        service.addPattern('[unclosed', 'Invalid regex');
      }).toThrow(/Invalid regex/);
    });
  });

  describe('removePattern() — custom pattern removal', () => {
    it('removes a custom pattern', () => {
      const pattern = service.addPattern('npm publish', 'Block publish');
      const removed = service.removePattern(pattern.id);
      expect(removed).toBe(true);
    });

    it('returns false for non-existent pattern', () => {
      const removed = service.removePattern('non-existent-id');
      expect(removed).toBe(false);
    });
  });

  describe('processOverride() — RBAC enforcement', () => {
    it('rejects non-admin users', () => {
      const result = service.processOverride('hash123', 'dev-user', 'developer');
      expect(result).toBe(false);
    });

    it('rejects users with no role', () => {
      const result = service.processOverride('hash123', 'anon-user');
      expect(result).toBe(false);
    });

    it('accepts admin users with gateguard_admin role', () => {
      const result = service.processOverride('hash123', 'admin-user', 'gateguard_admin');
      expect(result).toBe(true);
    });
  });

  describe('performance', () => {
    it('evaluate completes in < 50ms', () => {
      // Warm up cache
      service.evaluate('echo hello');

      const start = performance.now();
      for (let i = 0; i < 100; i++) {
        service.evaluate(`echo iteration-${i}`);
      }
      const elapsed = performance.now() - start;
      const avgMs = elapsed / 100;

      expect(avgMs).toBeLessThan(50);
    });
  });
});
