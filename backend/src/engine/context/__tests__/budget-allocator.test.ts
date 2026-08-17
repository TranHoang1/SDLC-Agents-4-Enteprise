/**
 * BudgetAllocator unit tests — progressive detail levels and token downgrade.
 */

import { describe, it, expect } from 'vitest';
import { BudgetAllocator } from '../budget-allocator.js';
import type { MergedResult } from '../types.js';

const allocator = new BudgetAllocator();

function mk(i: number, overrides: Partial<MergedResult> = {}): MergedResult {
  return {
    name: `fn${i}`,
    file: `src/f${i}.ts`,
    line: i * 10,
    signature: `fn${i}(a, b)`,
    source_code: `function fn${i}(a, b) { return a + b; }`,
    relevance_score: 1,
    sources: ['code'],
    ...overrides,
  };
}

describe('BudgetAllocator.allocate', () => {
  it('assigns full/signature/reference detail tiers', () => {
    const results = Array.from({ length: 5 }, (_, i) => mk(i));
    const out = allocator.allocate(results, 100000);
    expect(out.map(r => r.detail)).toEqual(['full', 'signature', 'signature', 'reference', 'reference']);
  });

  it('uses source_code for full detail content', () => {
    const out = allocator.allocate([mk(0)], 100000);
    expect(out[0].content).toBe(mk(0).source_code);
    expect(out[0].tokens).toBe(Math.ceil(out[0].content.length / 4));
  });

  it('uses signature for signature-tier content', () => {
    const results = Array.from({ length: 5 }, (_, i) => mk(i));
    const out = allocator.allocate(results, 100000);
    expect(out[1].content).toBe('fn1(a, b)');
  });

  it('formats reference-tier content with name, file and line', () => {
    const results = Array.from({ length: 5 }, (_, i) => mk(i));
    const out = allocator.allocate(results, 100000);
    expect(out[3].content).toBe('fn3 (src/f3.ts:30)');
    expect(out[3].tokens).toBe(15);
  });

  it('falls back through content, signature, then name for full tier', () => {
    const noSource = allocator.allocate([mk(0, { source_code: undefined, content: 'raw content' })], 100000);
    expect(noSource[0].content).toBe('raw content');
    const noContent = allocator.allocate([mk(0, { source_code: undefined, content: undefined })], 100000);
    expect(noContent[0].content).toBe('fn0(a, b)');
    const nameOnly = allocator.allocate([mk(0, { source_code: undefined, content: undefined, signature: undefined })], 100000);
    expect(nameOnly[0].content).toBe('fn0');
  });

  it('uses name when signature is absent for signature tier', () => {
    const results = [mk(0), mk(1, { signature: undefined })];
    const out = allocator.allocate(results, 100000);
    expect(out[1].content).toBe('fn1');
  });

  it('downgrades a full result to signature when over budget', () => {
    const result = mk(0, { source_code: 'x'.repeat(1000) });
    const out = allocator.allocate([result], 300);
    expect(out[0].detail).toBe('signature');
    expect(out[0].content).toBe('fn0(a, b)');
    expect(out[0].tokens).toBe(Math.ceil('fn0(a, b)'.length / 4));
  });

  it('drops a result when even the signature exceeds budget', () => {
    const result = mk(0, { source_code: 'x'.repeat(1000), signature: 'y'.repeat(1000) });
    const out = allocator.allocate([result], 200);
    expect(out).toEqual([]);
  });

  it('returns nothing when the fixed overhead already exceeds budget', () => {
    const out = allocator.allocate([mk(0)], 50);
    expect(out).toEqual([]);
  });

  it('stops allocating once the budget is consumed', () => {
    const results = Array.from({ length: 5 }, (_, i) => mk(i, { source_code: 's', signature: 's' }));
    const out = allocator.allocate(results, 102);
    expect(out.length).toBeLessThan(5);
    expect(out.length).toBeGreaterThan(0);
  });

  it('handles a single result as a full tier', () => {
    const out = allocator.allocate([mk(0)], 100000);
    expect(out).toHaveLength(1);
    expect(out[0].detail).toBe('full');
  });
});