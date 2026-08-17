/**
 * QueryAnalyzer unit tests — keyword extraction, symbol candidates, phrases, FTS query.
 */

import { describe, it, expect } from 'vitest';
import { QueryAnalyzer } from '../query-analyzer.js';

const analyzer = new QueryAnalyzer();

describe('QueryAnalyzer.analyze', () => {
  it('extracts keywords excluding stop words and short tokens', () => {
    const r = analyzer.analyze('How does the UserService fetchUser from database work?');
    expect(r.originalQuery).toBe('How does the UserService fetchUser from database work?');
    expect(r.keywords).toEqual(['userservice', 'fetchuser', 'database', 'work']);
  });

  it('detects camelCase and PascalCase symbol candidates', () => {
    const r = analyzer.analyze('find UserService definition and createOrder usage');
    expect(r.symbolCandidates).toEqual(['UserService', 'createOrder']);
  });

  it('detects snake_case symbols', () => {
    const r = analyzer.analyze('find some_variable used in fetch_data');
    expect(r.symbolCandidates).toEqual(['some_variable', 'fetch_data']);
  });

  it('detects qualified dot notation on PascalCase symbols', () => {
    const r = analyzer.analyze('UserService.getOrder details');
    expect(r.symbolCandidates).toContain('UserService.getOrder');
  });

  it('builds bigram phrases from the keyword tokens', () => {
    const r = analyzer.analyze('validate payment refund logic');
    expect(r.keywords).toEqual(['validate', 'payment', 'refund', 'logic']);
    expect(r.phrases).toEqual(['validate payment', 'payment refund', 'refund logic']);
  });

  it('joins keywords with OR for the FTS query', () => {
    const r = analyzer.analyze('schema migration table');
    expect(r.ftsQuery).toBe('schema OR migration OR table');
  });

  it('falls back to the raw query when no keywords survive', () => {
    const r = analyzer.analyze('the is a of');
    expect(r.keywords).toEqual([]);
    expect(r.symbolCandidates).toEqual([]);
    expect(r.phrases).toEqual([]);
    expect(r.ftsQuery).toBe('the is a of');
  });

  it('returns empty components for an empty query', () => {
    const r = analyzer.analyze('');
    expect(r.keywords).toEqual([]);
    expect(r.symbolCandidates).toEqual([]);
    expect(r.phrases).toEqual([]);
    expect(r.ftsQuery).toBe('');
  });

  it('normalizes case and strips punctuation from keywords', () => {
    const r = analyzer.analyze('REFRESH, config; file!');
    expect(r.keywords).toEqual(['refresh', 'config', 'file']);
  });
});