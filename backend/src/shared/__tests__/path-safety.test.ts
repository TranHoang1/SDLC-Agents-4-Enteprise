/**
 * Unit tests — shared path-safety helpers (SA4E-41 SEC-04/05).
 * Verifies traversal/absolute/null-byte rejection, workspace containment
 * checks, and the resolveWithinWorkspace combiner.
 */

import * as path from 'path';
import { describe, it, expect } from 'vitest';
import { isPathSafe, isWithinRoot, resolveWithinWorkspace } from '../path-safety.js';

describe('isPathSafe', () => {
  it('accepts simple relative paths', () => {
    expect(isPathSafe('a/b/c.ts')).toBe(true);
    expect(isPathSafe('file.txt')).toBe(true);
  });

  it('rejects empty and non-string inputs', () => {
    expect(isPathSafe('')).toBe(false);
    expect(isPathSafe(undefined as any)).toBe(false);
    expect(isPathSafe(null as any)).toBe(false);
    expect(isPathSafe(123 as any)).toBe(false);
  });

  it('rejects null-byte inputs', () => {
    expect(isPathSafe('a\0b')).toBe(false);
  });

  it('rejects absolute paths', () => {
    expect(isPathSafe('/etc/passwd')).toBe(false);
    expect(isPathSafe('C:\\Windows\\System32')).toBe(false);
  });

  it("rejects pure and prefix '..' traversal", () => {
    expect(isPathSafe('..')).toBe(false);
    expect(isPathSafe('../x')).toBe(false);
    expect(isPathSafe('../../etc')).toBe(false);
  });

  it("rejects embedded '..' segments after normalization", () => {
    expect(isPathSafe('a/../../b')).toBe(false);
    expect(isPathSafe('a/../..')).toBe(false);
  });

  it('rejects backslash traversal on any platform', () => {
    expect(isPathSafe('..\\..\\etc\\passwd')).toBe(false);
    expect(isPathSafe('a\\..\\..\\b')).toBe(false);
  });
});

describe('isWithinRoot', () => {
  const root = path.resolve('/workspace/proj-a');

  it('is true when fullPath equals root', () => {
    expect(isWithinRoot(root, path.join(root))).toBe(true);
  });

  it('is true for descendants of root', () => {
    expect(isWithinRoot(root, path.join(root, 'src', 'index.ts'))).toBe(true);
  });

  it('is false for paths outside the root', () => {
    expect(isWithinRoot(root, path.resolve('/workspace/proj-b/secret.txt'))).toBe(false);
    expect(isWithinRoot(root, path.resolve('/etc/passwd'))).toBe(false);
  });

  it('is false for a sibling directory that merely shares a name prefix', () => {
    expect(isWithinRoot(root, path.resolve('/workspace/proj-a-2/x.ts'))).toBe(false);
  });
});

describe('resolveWithinWorkspace', () => {
  const ws = path.resolve('/data/workspace');

  it('resolves a safe relative path inside the workspace', () => {
    const resolved = resolveWithinWorkspace(ws, 'docs/plan.md');
    expect(resolved).toBe(path.join(ws, 'docs', 'plan.md'));
  });

  it('returns null for traversal attempts', () => {
    expect(resolveWithinWorkspace(ws, '../outside.md')).toBeNull();
    expect(resolveWithinWorkspace(ws, 'a/../../outside.md')).toBeNull();
  });

  it('returns null for absolute paths', () => {
    expect(resolveWithinWorkspace(ws, '/etc/passwd')).toBeNull();
    expect(resolveWithinWorkspace(ws, 'C:\\secret.txt')).toBeNull();
  });

  it('returns null for null-byte inputs', () => {
    expect(resolveWithinWorkspace(ws, 'a\0b')).toBeNull();
  });
});