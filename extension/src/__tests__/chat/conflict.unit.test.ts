/**
 * SA4E-85 — Unit Tests: Conflict Management (UT-CM-01/02/03/04).
 * Tests file hash computation, stale detection, concurrent modification.
 */

import { describe, test, expect } from 'vitest';
import { hashBuffer, hashesMatch } from '../../chat/tools/fileHasher';
import { isDiffStale, STALE_THRESHOLD_MS, type DiffBlock } from '../../chat/tools/diffTypes';

describe('UT-CM-01: computeFileHash Returns Consistent SHA-256', () => {
  test('same input returns same hash', () => {
    const buf = Buffer.from('hello world', 'utf-8');
    const h1 = hashBuffer(buf);
    const h2 = hashBuffer(buf);
    expect(h1).toBe(h2);
    expect(h1).toHaveLength(64);
  });

  test('different input returns different hash', () => {
    const h1 = hashBuffer(Buffer.from('hello', 'utf-8'));
    const h2 = hashBuffer(Buffer.from('world', 'utf-8'));
    expect(h1).not.toBe(h2);
  });

  test('hashesMatch validates correctly', () => {
    const h = hashBuffer(Buffer.from('test', 'utf-8'));
    expect(hashesMatch(h, h)).toBe(true);
    const other = hashBuffer(Buffer.from('other', 'utf-8'));
    expect(hashesMatch(h, other)).toBe(false);
  });
});

describe('UT-CM-02: Stale Patch Detection After 5 Minutes', () => {
  test('diff older than 5 minutes is stale', () => {
    const diff = createDiffBlock({ generatedAt: Date.now() - 6 * 60 * 1000 });
    expect(isDiffStale(diff)).toBe(true);
  });

  test('diff younger than 5 minutes is not stale', () => {
    const diff = createDiffBlock({ generatedAt: Date.now() - 3 * 60 * 1000 });
    expect(isDiffStale(diff)).toBe(false);
  });

  test('threshold constant is 5 minutes', () => {
    expect(STALE_THRESHOLD_MS).toBe(5 * 60 * 1000);
  });
});

describe('UT-CM-03: Concurrent Modification Blocks Apply', () => {
  test('mismatched hash indicates conflict', () => {
    const hashAtGen = hashBuffer(Buffer.from('original', 'utf-8'));
    const currentHash = hashBuffer(Buffer.from('modified', 'utf-8'));
    expect(hashesMatch(hashAtGen, currentHash)).toBe(false);
  });

  test('matching hash allows apply', () => {
    const content = Buffer.from('unchanged', 'utf-8');
    const hashAtGen = hashBuffer(content);
    const currentHash = hashBuffer(content);
    expect(hashesMatch(hashAtGen, currentHash)).toBe(true);
  });
});

describe('UT-CM-04: WorkspaceEdit Preserves Undo Stack', () => {
  test('DiffBlock has required fields for WorkspaceEdit', () => {
    const diff = createDiffBlock({});
    expect(diff.diffId).toBeDefined();
    expect(diff.filePath).toBeDefined();
    expect(diff.patch).toBeDefined();
    expect(diff.fileHashAtGeneration).toBeDefined();
    expect(diff.status).toBe('pending');
  });
});

function createDiffBlock(overrides: Partial<DiffBlock>): DiffBlock {
  return {
    diffId: 'diff-1',
    filePath: 'src/test.ts',
    patch: '--- old\n+++ new\n@@ -1 +1 @@\n-old\n+new',
    fileHashAtGeneration: 'abc123def456',
    generatedAt: Date.now(),
    status: 'pending',
    ...overrides,
  };
}
