/**
 * SA4E — Unit tests for PegaNestedLogicExtractor.
 * Verifies the REAL formula/conditions of declarative rules are extracted from
 * nested arrays/objects (not top-level scalars), so enrichment stops
 * hallucinating pseudo code for Declare-Expression and When rules.
 */

import { describe, it, expect } from 'vitest';
import {
  extractDeclareExpression,
  extractWhenConditions,
  extractNestedLogic,
} from '../PegaNestedLogicExtractor.js';

describe('PegaNestedLogicExtractor', () => {
  describe('Declare-Expression', () => {
    const rule = {
      pxObjClass: 'Rule-Declare-Expressions',
      pyTargetProperty: '.Age',
      pyDefaultExpression: {
        pyTargetProperty: '.Age',
        pyExpressionString: '.BirthDate=="" ? "" : DateTimeDifference(.BirthDate, Now(), "Y")',
      },
    };

    it('extracts target property and the real formula string', () => {
      const out = extractDeclareExpression(rule);
      expect(out).toContain('LOGIC (Declared Expression):');
      expect(out).toContain('.Age = ');
      expect(out).toContain('DateTimeDifference(.BirthDate, Now(), "Y")');
    });

    it('returns null when no nested expression object is present', () => {
      expect(extractDeclareExpression({ pxObjClass: 'Rule-Declare-Expressions' })).toBeNull();
    });

    it('does not fabricate control flow (no IF/ELSE injected)', () => {
      const out = extractDeclareExpression(rule) ?? '';
      expect(out).not.toContain('END IF');
    });
  });

  describe('When conditions', () => {
    const rule = {
      pxObjClass: 'Rule-Obj-When',
      pyLogicString: 'A AND B',
      pyCondition: [
        { pyConditionLabel: 'A', pyConditionValue1String: '.Dependents(1).pyFirstName = ""' },
        { pyConditionLabel: 'B', pyConditionValue1String: '.Dependents(1).Relationship = "Select"' },
      ],
    };

    it('extracts labeled conditions and the combine logic', () => {
      const out = extractWhenConditions(rule);
      expect(out).toContain('LOGIC (When Conditions):');
      expect(out).toContain('A: .Dependents(1).pyFirstName = ""');
      expect(out).toContain('B: .Dependents(1).Relationship = "Select"');
      expect(out).toContain('Combine: A AND B');
    });

    it('falls back to positional labels when label missing', () => {
      const out = extractWhenConditions({
        pyCondition: [{ pyConditionValue1String: '.X = 1' }],
      });
      expect(out).toContain('A: .X = 1');
    });

    it('returns null when there are no conditions', () => {
      expect(extractWhenConditions({ pyCondition: [] })).toBeNull();
    });
  });

  describe('extractNestedLogic dispatch', () => {
    it('prefers declared expression when present', () => {
      const out = extractNestedLogic({
        pyDefaultExpression: { pyTargetProperty: '.X', pyExpressionString: '1 + 1' },
      });
      expect(out).toContain('LOGIC (Declared Expression):');
    });

    it('returns null for a rule with no nested logic', () => {
      expect(extractNestedLogic({ pxObjClass: 'Rule-Obj-Property', pyName: 'Foo' })).toBeNull();
    });
  });
});
