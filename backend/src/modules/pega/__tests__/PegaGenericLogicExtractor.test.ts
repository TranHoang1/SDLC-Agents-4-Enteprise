/**
 * SA4E-222 Scope A — Unit tests for PegaGenericLogicExtractor.
 * Covers FR-A-1..A-7 / AC-A-3 / SM-3: deterministic, LLM-free extraction of
 * logic-bearing structures for >= 3 previously-unhandled rule types.
 */

import { describe, it, expect } from 'vitest';
import { extractGenericLogic, renderPathNodes } from '../extraction/PegaGenericLogicExtractor.js';

// ─── Sample rule JSON for previously-unhandled rule types ──────────────────────

const MAP_VALUE = {
  pxObjClass: 'Rule-Obj-MapValue',
  pyClassName: 'Work',
  pyRuleName: 'PriorityMap',
  pyInputs: [
    { label: 'Gold', value: '100', result: 'VIP' },
    { label: 'Silver', value: '50', result: 'Standard' },
  ],
};

const VALIDATE = {
  pxObjClass: 'Rule-Obj-Validate',
  pyClassName: 'Work',
  pyRuleName: 'ValidateContact',
  pySteps: [
    { name: 'CheckEmail', when: 'pyEmail is null', result: 'Fail' },
    { name: 'CheckPhone', when: 'pyPhone is null', result: 'Fail' },
  ],
};

const DECISION_TREE = {
  pxObjClass: 'Rule-Declare-DecisionTree',
  pyClassName: 'Work',
  pyRuleName: 'ApprovalTree',
  pyBranches: [
    { from: 'Start', to: 'Approve', when: 'Amount < 1000', result: 'Auto' },
    { from: 'Start', to: 'Review', when: 'Amount >= 1000', result: 'Manual' },
  ],
};

describe('PegaGenericLogicExtractor', () => {
  it('renders a structured LOGIC block (not a flat FIELDS dump) for MapValue', () => {
    const out = extractGenericLogic(MAP_VALUE);
    expect(out).not.toBeNull();
    expect(out).toContain('LOGIC (generic: pyInputs):');
    expect(out).toContain('Gold');
    expect(out).toContain('VIP');
  });

  it('renders relationships (when -> result) for Validate steps', () => {
    const out = extractGenericLogic(VALIDATE);
    expect(out).toContain('LOGIC (generic: pySteps):');
    expect(out).toContain('CheckEmail');
    expect(out).toContain('pyEmail is null -> Fail');
  });

  it('renders from->to and when->result for DecisionTree branches', () => {
    const out = extractGenericLogic(DECISION_TREE);
    expect(out).toContain('LOGIC (generic: pyBranches):');
    expect(out).toContain('Start -> Approve');
    expect(out).toContain('Amount < 1000 -> Auto');
  });

  it('is deterministic — identical input yields identical output', () => {
    const a = extractGenericLogic(DECISION_TREE);
    const b = extractGenericLogic(DECISION_TREE);
    expect(a).toBe(b);
  });

  it('returns null when there are no logic-bearing arrays', () => {
    const out = extractGenericLogic({
      pxObjClass: 'Rule-Obj-Property',
      pyClassName: 'Work',
      pyRuleName: 'Status',
      pyLabel: 'Status',
    });
    expect(out).toBeNull();
  });

  it('excludes non-logic containers like pyParameters (no false positives)', () => {
    const out = extractGenericLogic({
      pxObjClass: 'Rule-Obj-Activity',
      pyClassName: 'Work',
      pyRuleName: 'X',
      pyParameters: [
        { pyParameterName: 'caseID', pyMode: 'in', pyDefaultValue: '0' },
      ],
    });
    expect(out).toBeNull();
  });

  it('renderPathNodes returns null for empty input', () => {
    expect(renderPathNodes([], 'x')).toBeNull();
  });
});
