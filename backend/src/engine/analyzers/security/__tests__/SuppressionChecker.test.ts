/**
 * KSA-165 — Unit tests for SuppressionChecker.
 * Covers line-level, above-line, block, and file-scope suppression markers.
 */

import { describe, it, expect } from 'vitest';
import { SuppressionChecker } from '../injection/SuppressionChecker.js';

describe('SuppressionChecker', () => {
  const checker = new SuppressionChecker();

  describe('isSuppressed', () => {
    it('detects inline line markers', () => {
      const lines = ['const q = req.query;', 'db.query(q); // nosec'];
      const info = checker.isSuppressed(lines, 2);
      expect(info).not.toBeNull();
      expect(info!.marker).toBe('// nosec');
      expect(info!.scope).toBe('line');
      expect(info!.line).toBe(2);
    });

    it('detects python-style markers', () => {
      const lines = ['cursor.execute(sql)  # nosec'];
      const info = checker.isSuppressed(lines, 1);
      expect(info).not.toBeNull();
      expect(info!.marker).toBe('# nosec');
    });

    it('detects NOLINT marker', () => {
      const lines = ['dangerousCall(); // NOLINT'];
      expect(checker.isSuppressed(lines, 1)).not.toBeNull();
    });

    it('detects marker on the previous line', () => {
      const lines = ['// @security-ignore', 'db.query(q);'];
      const info = checker.isSuppressed(lines, 2);
      expect(info).not.toBeNull();
      expect(info!.line).toBe(1);
    });

    it('returns null when no marker present', () => {
      const lines = ['const q = req.query;', 'db.query(q);'];
      expect(checker.isSuppressed(lines, 2)).toBeNull();
    });

    it('returns null for out-of-range lines', () => {
      expect(checker.isSuppressed(['a'], 5)).toBeNull();
      expect(checker.isSuppressed(['a'], 0)).toBeNull();
    });
  });

  describe('isFileSuppressed', () => {
    it('detects file-scope marker in header', () => {
      const lines = ['#!/usr/bin/env node', '// @security-ignore-file', 'const x = 1;'];
      expect(checker.isFileSuppressed(lines)).toBe(true);
    });

    it('ignores line-scope markers', () => {
      const lines = ['// nosec', 'db.query(q);'];
      expect(checker.isFileSuppressed(lines)).toBe(false);
    });

    it('returns false for unsuppressed files', () => {
      expect(checker.isFileSuppressed(['const a = 1;'])).toBe(false);
    });
  });

  it('supports custom markers', () => {
    const custom = new SuppressionChecker([{ pattern: '// custom-ignore', scope: 'line' }]);
    expect(custom.isSuppressed(['foo(); // custom-ignore'], 1)).not.toBeNull();
    expect(custom.isSuppressed(['foo(); // nosec'], 1)).toBeNull();
  });
});