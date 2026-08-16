/**
 * SA4E-106 — Unit tests for PegaContentExtractor.
 * Verifies readable text extraction from raw Pega rule JSON.
 */

import { describe, it, expect } from 'vitest';
import { extractRuleContent } from '../PegaContentExtractor.js';
import {
  MOCK_ACTIVITY_JSON,
  MOCK_DATA_TRANSFORM_JSON,
  MOCK_DECISION_TABLE_JSON,
} from './fixtures/pega-samples.js';

describe('PegaContentExtractor', () => {
  it('extracts identity header with type, class, name and ruleset', () => {
    const out = extractRuleContent(MOCK_ACTIVITY_JSON);
    expect(out).toContain('RULE TYPE: Rule-Obj-Activity');
    expect(out).toContain('CLASS: Work-Cover-Jira');
    expect(out).toContain('NAME: ResolveTicket');
    expect(out).toContain('RULESET: JiraIntegration (01-02-03)');
  });

  it('renders activity steps as readable logic with Call params', () => {
    const out = extractRuleContent(MOCK_ACTIVITY_JSON);
    expect(out).toContain('LOGIC (Activity Steps):');
    expect(out).toContain('[RowID:');

    const activity = {
      ...MOCK_ACTIVITY_JSON,
      steps: [...MOCK_ACTIVITY_JSON.steps, {
        pyStepNum: '3',
        pyMethod: 'Java',
        pyMethodParameters: 'Primary.setOutcome(.pyOutcome, "Resolved");',
        pyLabel: 'Set Outcome via Java',
      }],
    };
    const withJava = extractRuleContent(activity);
    expect(withJava).toContain('Java(Primary.setOutcome');
  });

  it('renders data transforms via normalizeDataTransform', () => {
    const out = extractRuleContent(MOCK_DATA_TRANSFORM_JSON);
    expect(out).toContain('LOGIC (Data Transform):');
    expect(out).toContain('DATA TRANSFORM:');
  });

  it('renders decision table rows', () => {
    const decision = {
      ...MOCK_DECISION_TABLE_JSON,
      pyDecisionRules: [
        { pyWhenCondition: 'pyStatus = "Open"', pyResult: 'High' },
      ],
    };
    const out = extractRuleContent(decision);
    expect(out).toContain('LOGIC (Decision Table):');
    expect(out).toContain('pyStatus = "Open"');
  });

  it('extracts parameters section when pyParameters present', () => {
    const out = extractRuleContent({
      ...MOCK_ACTIVITY_JSON,
      pyParameters: [
        { pyParameterName: 'caseID', pyDefaultValue: '0', pyMode: 'in' },
      ],
    });
    expect(out).toContain('PARAMETERS:');
    expect(out).toContain('caseID');
  });

  it('extracts top-level Java code fields', () => {
    const out = extractRuleContent({
      ...MOCK_ACTIVITY_JSON,
      pyJavaCode: 'public void run() { ctx.log("hi"); }',
    });
    expect(out).toContain('JAVA:');
    expect(out).toContain('pyJavaCode:');
    expect(out).toContain('public void run()');
  });

  it('excludes internal px/pz metadata from field dump', () => {
    const out = extractRuleContent({
      ...MOCK_ACTIVITY_JSON,
      pxUpdateOperator: 'admin',
      pzInsKey: 'KEYX',
      pySomeCustom: 'value',
    });
    expect(out).not.toContain('pxUpdateOperator');
    expect(out).not.toContain('pzInsKey');
    expect(out).toContain('pySomeCustom: value');
  });

  it('handles empty/minimal rule without throwing', () => {
    const out = extractRuleContent({ pxObjClass: 'Rule-Obj-Flow', pyClassName: 'Work', pyRuleName: 'F' });
    expect(out).toContain('RULE TYPE: Rule-Obj-Flow');
    expect(out).toContain('NAME: F');
  });
});