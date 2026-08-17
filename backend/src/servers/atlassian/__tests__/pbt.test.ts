/**
 * SA4E-110 — Property-Based Tests (PBT-01 to PBT-08)
 * Uses fast-check to verify invariants for core utility functions.
 */
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { levenshtein } from '../utils/levenshtein.js';
import { normalizeForComparison } from '../utils/normalize.js';
import { getMimeType } from '../utils/mime-types.js';
import { IssueKeySchema, JqlSchema } from '../models/jira-schemas.js';

describe('PBT — Levenshtein distance properties', () => {
  it('PBT-01: distance(a, a) === 0 for any string', () => {
    fc.assert(fc.property(fc.string(), (s) => {
      expect(levenshtein(s, s)).toBe(0);
    }));
  });

  it('PBT-02: distance is symmetric — d(a,b) === d(b,a)', () => {
    fc.assert(fc.property(fc.string(), fc.string(), (a, b) => {
      expect(levenshtein(a, b)).toBe(levenshtein(b, a));
    }));
  });

  it('PBT-03: triangle inequality — d(a,c) <= d(a,b) + d(b,c)', () => {
    fc.assert(fc.property(
      fc.string({ maxLength: 20 }),
      fc.string({ maxLength: 20 }),
      fc.string({ maxLength: 20 }),
      (a, b, c) => {
        expect(levenshtein(a, c)).toBeLessThanOrEqual(
          levenshtein(a, b) + levenshtein(b, c)
        );
      }
    ));
  });

  it('PBT-04: distance <= max(len(a), len(b))', () => {
    fc.assert(fc.property(fc.string(), fc.string(), (a, b) => {
      expect(levenshtein(a, b)).toBeLessThanOrEqual(Math.max(a.length, b.length));
    }));
  });
});

describe('PBT — Normalize invariants', () => {
  it('PBT-05: normalize is idempotent — f(f(x)) === f(x)', () => {
    fc.assert(fc.property(fc.string(), (s) => {
      const once = normalizeForComparison(s);
      expect(normalizeForComparison(once)).toBe(once);
    }));
  });

  it('PBT-06: normalized output has no leading/trailing whitespace', () => {
    fc.assert(fc.property(fc.string(), (s) => {
      const result = normalizeForComparison(s);
      expect(result).toBe(result.trim());
    }));
  });
});

describe('PBT — Schema validation invariants', () => {
  it('PBT-07: IssueKeySchema rejects keys without dash or digits', () => {
    fc.assert(fc.property(fc.string({ unit: fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz'.split('')) }), (s) => {
      const result = IssueKeySchema.safeParse(s);
      expect(result.success).toBe(false);
    }));
  });

  it('PBT-08: JqlSchema rejects strings exceeding 2000 chars', () => {
    fc.assert(fc.property(
      fc.string({ minLength: 2001, maxLength: 2100 }),
      (s) => {
        const result = JqlSchema.safeParse(s);
        expect(result.success).toBe(false);
      }
    ));
  });
});
