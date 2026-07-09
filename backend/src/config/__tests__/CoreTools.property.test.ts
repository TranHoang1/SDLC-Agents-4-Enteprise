/**
 * PBT-01..03 — CoreTools.resolveCoreToolNames property tests (SA4E-18).
 * fast-check is NOT a project dependency, so properties are exercised with a
 * deterministic-seed random-input loop (1000 runs) mutating CORE_TOOLS contents.
 */

import { describe, it, expect, afterEach } from 'vitest';
import { CORE_TOOLS, META_TOOLS, resolveCoreToolNames } from '../CoreTools.js';

const META = [...META_TOOLS];
const original = [...CORE_TOOLS];
const RUNS = 1000;

function setCore(entries: string[]): void {
  (CORE_TOOLS as string[]).length = 0;
  (CORE_TOOLS as string[]).push(...(entries as any[]));
}

// Small deterministic PRNG (mulberry32) for reproducible random inputs.
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const POOL = ['mem_search', 'code_search', 'find_tools', '', '   ', 'x', 'weird tool', 'a', 'b'];

function randomArray(rand: () => number): any[] {
  const len = Math.floor(rand() * 12);
  const out: any[] = [];
  for (let i = 0; i < len; i++) {
    const pick = rand();
    if (pick < 0.15) out.push('');
    else if (pick < 0.3) out.push('   ');
    else out.push(POOL[Math.floor(rand() * POOL.length)]);
  }
  return out;
}

afterEach(() => setCore(original));

describe('CoreTools property invariants', () => {
  it('PBT-01: always includes all META_TOOLS for any input', () => {
    const rand = rng(12345);
    for (let i = 0; i < RUNS; i++) {
      setCore(randomArray(rand));
      const set = resolveCoreToolNames();
      for (const m of META) expect(set.has(m)).toBe(true);
    }
  });

  it('PBT-02: output is always duplicate-free', () => {
    const rand = rng(67890);
    for (let i = 0; i < RUNS; i++) {
      setCore(randomArray(rand));
      const set = resolveCoreToolNames();
      const arr = [...set];
      expect(arr.length).toBe(new Set(arr).size);
    }
  });

  it('PBT-03: never throws; invalid entries dropped, result non-empty', () => {
    const rand = rng(24680);
    for (let i = 0; i < RUNS; i++) {
      setCore(randomArray(rand));
      let set: Set<string> | undefined;
      expect(() => { set = resolveCoreToolNames(); }).not.toThrow();
      expect(set!.size).toBeGreaterThanOrEqual(META.length);
      expect(set!.has('')).toBe(false);
      expect(set!.has('   ')).toBe(false);
    }
  });
});
