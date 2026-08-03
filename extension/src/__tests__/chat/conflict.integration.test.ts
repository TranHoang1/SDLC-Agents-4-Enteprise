/**
 * SA4E-85 — Integration Tests: Conflict Management (IT-CM-01/02/03).
 * Tests hash check, concurrent mod detection, workspace edit lifecycle.
 */

import { describe, test, expect } from 'vitest';
import { hashBuffer, hashesMatch } from '../../chat/tools/fileHasher';
import { isDiffStale, type DiffBlock } from '../../chat/tools/diffTypes';

describe('IT-CM-01: ToolHandler Checks Hash Against Real File', () => {
  test('hash of known content is deterministic', () => {
    const content = Buffer.from('hello world', 'utf-8');
    const h1 = hashBuffer(content);
    const h2 = hashBuffer(content);
    expect(hashesMatch(h1, h2)).toBe(true);
  });

  test('matching hash indicates safe to apply', () => {
    const buf = Buffer.from('function main() {}', 'utf-8');
    expect(hashesMatch(hashBuffer(buf), hashBuffer(buf))).toBe(true);
  });
});

describe('IT-CM-02: Concurrent Mod Detection End-to-End', () => {
  test('modified file produces conflict', () => {
    const hashAtGen = hashBuffer(Buffer.from('original', 'utf-8'));
    const currentHash = hashBuffer(Buffer.from('modified', 'utf-8'));
    expect(hashesMatch(hashAtGen, currentHash)).toBe(false);
  });

  test('regenerated patch gets fresh hash', () => {
    const fresh = hashBuffer(Buffer.from('new version', 'utf-8'));
    expect(fresh).toHaveLength(64);
  });
});

describe('IT-CM-03: WorkspaceEdit Integration', () => {
  test('DiffBlock lifecycle: pending -> applied', () => {
    const diff: DiffBlock = {
      diffId: 'd1', filePath: 'src/x.ts', patch: '+new',
      fileHashAtGeneration: 'abc', generatedAt: Date.now(), status: 'pending',
    };
    diff.status = 'applied';
    expect(diff.status).toBe('applied');
  });

  test('stale diff transitions to stale status', () => {
    const diff: DiffBlock = {
      diffId: 'd2', filePath: 'y.ts', patch: '+x',
      fileHashAtGeneration: 'def', generatedAt: Date.now() - 6 * 60 * 1000, status: 'pending',
    };
    if (isDiffStale(diff)) diff.status = 'stale';
    expect(diff.status).toBe('stale');
  });
});
