/**
 * KSA-166 — Unit tests for IDORDetector.
 * Focuses on ID parameter detection, DB lookup discovery, authorization checks,
 * and trust tier classification.
 */

import { describe, it, expect } from 'vitest';
import { IDORDetector } from '../idor/IDORDetector.js';
import type { SyntaxNode } from '../../../parsers/types.js';

function nodeWithBody(body: string): SyntaxNode {
  return { text: body } as unknown as SyntaxNode;
}

function handlerBody(lines: string[]): string {
  return lines.join('\n');
}

describe('IDORDetector', () => {
  const detector = new IDORDetector();

  it('flags a direct ID param -> DB lookup with no authz', () => {
    const body = handlerBody([
      'const user = findByPk(req.params.activityId);',
      'res.send(user);',
    ]);
    const findings = detector.detect(nodeWithBody(body), 'users.ts', 'ts', 'getUser');

    expect(findings.length).toBeGreaterThan(0);
    const byUid = findings.find(f => f.idParam.includes('activityId') || f.idParam === 'req.params.activityId');
    expect(byUid).toBeDefined();
    if (byUid) {
      expect(byUid).toMatchObject({
        handler: 'getUser',
        missingAuthzCheck: true,
        cwe: 'CWE-639',
        severity: 'High',
      });
      expect(byUid.dbLookup.function).toBe('findByPk');
    }
  });

  it('does not flag when an authorization check exists', () => {
    const body = handlerBody([
      'const user = findByPk(req.params.activityId);',
      'if (!isOwner(req.user.id, user)) return 403;',
      'res.send(user);',
    ]);
    expect(detector.detect(nodeWithBody(body), 'users.ts', 'ts', 'getUser')).toHaveLength(0);
  });

  it('returns no findings when no ID parameter exists', () => {
    const body = handlerBody([
      'const list = findAll();',
      'res.send(list);',
    ]);
    expect(detector.detect(nodeWithBody(body), 'users.ts', 'ts', 'listUsers')).toHaveLength(0);
  });

  it('flags ORM findUnique with uuid param', () => {
    const body = handlerBody([
      'return await db.flow.findUnique({ where: { uuid } });',
    ]);
    const findings = detector.detect(nodeWithBody(body), 'repo.ts', 'ts', 'getOne');
    expect(findings.length).toBeGreaterThan(0);
    expect(findings[0].dbLookup.function).toBe('findUnique');
  });

  it('classifies direct single-line lookups as T1', () => {
    const body = handlerBody([
      'return findByPk(req.params.activityId);',
    ]);
    const findings = detector.detect(nodeWithBody(body), 'users.ts', 'ts', 'getUser');
    expect(findings.length).toBeGreaterThan(0);
    const byKey = findings.find(f => f.idParam.includes('activityId'));
    expect(byKey).toBeDefined();
    if (byKey) {
      expect(byKey.trustTier).toBe('T1');
      expect(byKey.severity).toBe('High');
    }
  });

  it('classifies indirect lookups with heavier processing as lower trust tiers', () => {
    const body = handlerBody([
      'const id = req.params.activityId;',
      'const a = normaliseUp(id);',
      'const b = a + 1;',
      'const c = b + 1;',
      'const d = c + 1;',
      'const e = d + 1;',
      'const f = e + 1;',
      'const user = findByPk(f);',
      'res.send(user);',
    ]);
    const findings = detector.detect(nodeWithBody(body), 'users.ts', 'ts', 'getUser');
    expect(findings.length).toBeGreaterThan(0);
    const byKey = findings.find(f => f.idParam.includes('activityId'));
    expect(byKey).toBeDefined();
    if (byKey) {
      // multi-step path between param and lookup => not T1
      expect(['T2', 'T3']).toContain(byKey.trustTier);
    }
  });

  it('does not match a DB lookup when the ID param is unrelated', () => {
    const body = handlerBody([
      'const keyParam = req.params.assetKey;',
      'return findByPk(otherParam);',
    ]);
    // `otherParam` is not an ID param; the only ID param (assetKey) is not used at the lookup
    expect(detector.detect(nodeWithBody(body), 'users.ts', 'ts', 'getUser')).toHaveLength(0);
  });
});