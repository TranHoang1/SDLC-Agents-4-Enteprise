/**
 * SA4E-183 — diff-utils unit tests.
 * Tests: computeUnifiedDiff, countDiffLines, truncateDiff, isSensitiveFile.
 */

import { describe, it, expect } from 'vitest';
import {
  computeUnifiedDiff,
  countDiffLines,
  truncateDiff,
  isSensitiveFile,
  DIFF_TRACKED_TOOLS,
} from '../diff-utils';

describe('computeUnifiedDiff', () => {
  it('produces unified diff for modified file', () => {
    const original = 'line1\nline2\nline3\n';
    const modified = 'line1\nline2-changed\nline3\n';
    const diff = computeUnifiedDiff('src/foo.ts', original, modified);
    expect(diff).toContain('-line2');
    expect(diff).toContain('+line2-changed');
    expect(diff).toContain('a/src/foo.ts');
    expect(diff).toContain('b/src/foo.ts');
  });

  it('produces diff for new file (empty original)', () => {
    const diff = computeUnifiedDiff('new.ts', '', 'hello\nworld\n');
    expect(diff).toContain('+hello');
    expect(diff).toContain('+world');
  });

  it('produces diff for deleted file (empty modified)', () => {
    const diff = computeUnifiedDiff('old.ts', 'goodbye\n', '');
    expect(diff).toContain('-goodbye');
  });

  it('returns minimal diff for identical content', () => {
    const content = 'same\n';
    const diff = computeUnifiedDiff('same.ts', content, content);
    // No + or - lines (only headers)
    const lines = diff.split('\n').filter(l => l.startsWith('+') || l.startsWith('-'));
    // Filter out --- and +++ headers
    const changes = lines.filter(l => !l.startsWith('---') && !l.startsWith('+++'));
    expect(changes.length).toBe(0);
  });
});

describe('countDiffLines', () => {
  it('counts added and removed lines', () => {
    const diff = '--- a/f.ts\n+++ b/f.ts\n@@ -1,2 +1,3 @@\n line1\n-removed\n+added1\n+added2\n';
    const result = countDiffLines(diff);
    expect(result.linesAdded).toBe(2);
    expect(result.linesRemoved).toBe(1);
  });

  it('returns zeros for empty diff', () => {
    const result = countDiffLines('');
    expect(result.linesAdded).toBe(0);
    expect(result.linesRemoved).toBe(0);
  });

  it('ignores --- and +++ header lines', () => {
    const diff = '--- a/f.ts\n+++ b/f.ts\n@@ -1 +1 @@\n-old\n+new\n';
    const result = countDiffLines(diff);
    expect(result.linesAdded).toBe(1);
    expect(result.linesRemoved).toBe(1);
  });
});

describe('truncateDiff', () => {
  it('returns original if under 2MB', () => {
    const content = 'short diff';
    expect(truncateDiff(content)).toBe(content);
  });

  it('truncates and appends notice if over 2MB', () => {
    const large = 'x'.repeat(3 * 1024 * 1024);
    const result = truncateDiff(large);
    expect(result.length).toBeLessThan(large.length);
    expect(result).toContain('[diff truncated');
  });
});

describe('isSensitiveFile', () => {
  it('detects .env files', () => {
    expect(isSensitiveFile('.env')).toBe(true);
    expect(isSensitiveFile('.env.local')).toBe(true);
    expect(isSensitiveFile('.env.production')).toBe(true);
  });

  it('detects key files', () => {
    expect(isSensitiveFile('private.key')).toBe(true);
    expect(isSensitiveFile('cert.pem')).toBe(true);
    expect(isSensitiveFile('keystore.p12')).toBe(true);
  });

  it('detects secrets directories', () => {
    expect(isSensitiveFile('secrets/db-password')).toBe(true);
    expect(isSensitiveFile('credentials/api-key.json')).toBe(true);
  });

  it('returns false for normal files', () => {
    expect(isSensitiveFile('src/main.ts')).toBe(false);
    expect(isSensitiveFile('package.json')).toBe(false);
    expect(isSensitiveFile('README.md')).toBe(false);
  });
});

describe('DIFF_TRACKED_TOOLS', () => {
  it('includes expected tool names', () => {
    expect(DIFF_TRACKED_TOOLS.has('write_file')).toBe(true);
    expect(DIFF_TRACKED_TOOLS.has('fs_write')).toBe(true);
    expect(DIFF_TRACKED_TOOLS.has('str_replace')).toBe(true);
    expect(DIFF_TRACKED_TOOLS.has('fs_append')).toBe(true);
    expect(DIFF_TRACKED_TOOLS.has('delete_file')).toBe(true);
    expect(DIFF_TRACKED_TOOLS.has('stream_write_file')).toBe(true);
  });

  it('excludes non-file tools', () => {
    expect(DIFF_TRACKED_TOOLS.has('execute_pwsh')).toBe(false);
    expect(DIFF_TRACKED_TOOLS.has('read_file')).toBe(false);
  });
});
