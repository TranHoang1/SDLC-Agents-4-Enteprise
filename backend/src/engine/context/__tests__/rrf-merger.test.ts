/**
 * RRFMerger unit tests — Reciprocal Rank Fusion across code/memory/graph sources.
 */

import { describe, it, expect } from 'vitest';
import { RRFMerger } from '../rrf-merger.js';
import type { SourceWeights } from '../types.js';

const merger = new RRFMerger();
const K = 60;

function source(name: string, results: any[]) {
  return { source: name, results };
}

describe('RRFMerger.merge', () => {
  it('returns results sorted by descending score', () => {
    const out = merger.merge({
      code: source('code', [{ id: 1, name: 'a' }, { id: 2, name: 'b' }]),
      memory: source('memory', []),
      graph: source('graph', []),
    });
    expect(out.length).toBe(2);
    expect(out[0].relevance_score).toBeGreaterThanOrEqual(out[1].relevance_score);
    expect(out[0].sources).toEqual(['code']);
    expect(out[1].sources).toEqual(['code']);
  });

  it('fuses the same item appearing in multiple sources', () => {
    const out = merger.merge({
      code: source('code', [{ id: 7, name: 'shared' }]),
      memory: source('memory', [{ id: 7, name: 'shared' }]),
      graph: source('graph', []),
    });
    expect(out.length).toBe(1);
    expect(out[0].relevance_score).toBeCloseTo(0.5 / K + 0.3 / K);
    expect(out[0].sources).toEqual(['code', 'memory']);
  });

  it('ranks earlier results higher within a single source', () => {
    const out = merger.merge({
      code: source('code', [{ id: 1, name: 'top' }, { id: 2, name: 'second' }]),
      memory: source('memory', []),
      graph: source('graph', []),
    });
    expect(out[0].relevance_score).toBeCloseTo(0.5 / K);
    expect(out[1].relevance_score).toBeCloseTo(0.5 / (K + 1));
  });

  it('applies custom weights', () => {
    const weights: SourceWeights = { code: 1.0, memory: 0, graph: 0 };
    const out = merger.merge({
      code: source('code', [{ id: 1, name: 'only-code' }]),
      memory: source('memory', [{ id: 1, name: 'only-code' }]),
      graph: source('graph', [{ id: 1, name: 'only-code' }]),
    }, weights);
    expect(out[0].relevance_score).toBeCloseTo(1 / K);
  });

  it('dedupes items keyed by name+file when no id exists', () => {
    const out = merger.merge({
      code: source('code', [{ name: 'fn', file: 'src/a.ts' }]),
      memory: source('memory', [{ name: 'fn', file: 'src/a.ts' }]),
      graph: source('graph', []),
    });
    expect(out.length).toBe(1);
    expect(out[0].sources).toEqual(['code', 'memory']);
  });

  it('keys by name alone when file is missing', () => {
    const out = merger.merge({
      code: source('code', [{ name: 'lone' }]),
      memory: source('memory', [{ name: 'lone' }]),
      graph: source('graph', []),
    });
    expect(out.length).toBe(1);
    expect(out[0].sources).toEqual(['code', 'memory']);
  });

  it('falls back to serialized content for nameless items', () => {
    const out = merger.merge({
      code: source('code', [{ kind: 'expr', x: 1 }]),
      memory: source('memory', [{ kind: 'expr', x: 1 }]),
      graph: source('graph', []),
    });
    expect(out.length).toBe(1);
    expect(out[0].sources).toEqual(['code', 'memory']);
  });

  it('spreads item fields and stamps relevance_score and sources', () => {
    const out = merger.merge({
      code: source('code', [{ id: 3, name: 'thing', kind: 'class', line: 12 }]),
      memory: source('memory', []),
      graph: source('graph', []),
    });
    expect(out[0]).toMatchObject({ id: 3, name: 'thing', kind: 'class', line: 12 });
    expect(out[0].sources).toEqual(['code']);
    expect(typeof out[0].relevance_score).toBe('number');
  });

  it('returns an empty list when all sources are empty', () => {
    expect(merger.merge({ code: source('code', []), memory: source('memory', []), graph: source('graph', []) })).toEqual([]);
  });
});