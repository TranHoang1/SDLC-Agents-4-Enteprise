/**
 * SA4E-110 — Unit tests for utility functions (UT-03, UT-18)
 * Tests levenshtein, normalize, and mime-type utilities.
 */
import { describe, it, expect } from 'vitest';
import { levenshtein } from '../utils/levenshtein.js';
import { normalizeForComparison } from '../utils/normalize.js';
import { getMimeType } from '../utils/mime-types.js';

describe('UT-03: levenshtein — deterministic edit distance', () => {
  it('returns 0 for identical strings', () => {
    expect(levenshtein('hello', 'hello')).toBe(0);
  });

  it('returns correct distance for single char difference', () => {
    expect(levenshtein('cat', 'bat')).toBe(1);
  });

  it('returns correct distance for multi-char edits', () => {
    expect(levenshtein('kitten', 'sitting')).toBe(3);
  });

  it('handles empty strings', () => {
    expect(levenshtein('', 'abc')).toBe(3);
    expect(levenshtein('abc', '')).toBe(3);
    expect(levenshtein('', '')).toBe(0);
  });
});

describe('UT-18: normalizeForComparison — text normalization', () => {
  it('trims leading and trailing whitespace', () => {
    expect(normalizeForComparison('  hello  ')).toBe('hello');
  });

  it('lowercases all characters', () => {
    expect(normalizeForComparison('HELLO World')).toBe('hello world');
  });

  it('collapses multiple spaces to single space', () => {
    expect(normalizeForComparison('a   b   c')).toBe('a b c');
  });

  it('handles tabs and newlines as whitespace', () => {
    expect(normalizeForComparison("a\t\nb")).toBe('a b');
  });
});

describe('UT-18b: getMimeType — file extension mapping', () => {
  it('returns correct MIME for known extensions', () => {
    expect(getMimeType('.pdf')).toBe('application/pdf');
    expect(getMimeType('.png')).toBe('image/png');
    expect(getMimeType('.json')).toBe('application/json');
    expect(getMimeType('.docx')).toContain('wordprocessingml');
  });

  it('returns application/octet-stream for unknown extensions', () => {
    expect(getMimeType('.xyz')).toBe('application/octet-stream');
    expect(getMimeType('.unknown')).toBe('application/octet-stream');
  });

  it('is case-insensitive', () => {
    expect(getMimeType('.PDF')).toBe('application/pdf');
    expect(getMimeType('.PNG')).toBe('image/png');
  });
});
