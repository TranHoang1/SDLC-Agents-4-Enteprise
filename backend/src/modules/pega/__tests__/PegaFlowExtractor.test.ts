/**
 * SA4E — Unit tests for PegaFlowExtractor.
 * Verifies a flow's real structure (shapes + connectors) is reconstructed from
 * pyModelProcess so the enrichment LLM sees the actual process, not just metadata.
 */

import { describe, it, expect } from 'vitest';
import { extractFlowStructure } from '../PegaFlowExtractor.js';

const FLOW = {
  pxObjClass: 'Rule-Obj-Flow',
  pyModelProcess: {
    pyShapes: {
      Start1: { pxObjClass: 'Data-MO-Event-Start', pyStartingHarness: 'NewSample' },
      Utility2: {
        pxObjClass: 'Data-MO-Activity-Utility',
        pyMOName: 'Create Candidate party',
        pyRuleParamsStreamName: 'pzRunDataTransform',
        pyCallParams: { DataTransformName: 'NewPartyCandidate' },
      },
      END52: { pxObjClass: 'Data-MO-Event-End' },
    },
    pyConnectors: {
      Transition1: { pxObjClass: 'Data-MO-Connector-Transition', pyFrom: 'Start1', pyTo: 'Utility2', pyConditionType: 'Always' },
      Transition2: { pxObjClass: 'Data-MO-Connector-Transition', pyFrom: 'Utility2', pyTo: 'END52', pyConditionType: 'Always' },
    },
  },
};

describe('PegaFlowExtractor', () => {
  it('renders shapes with kind, display name, and the rule/params they run', () => {
    const out = extractFlowStructure(FLOW)!;
    expect(out).toContain('LOGIC (Flow):');
    expect(out).toContain('Start1 [Start] harness=NewSample');
    expect(out).toContain('Utility2 [Utility] "Create Candidate party" runs=pzRunDataTransform');
    expect(out).toContain('params(DataTransformName=NewPartyCandidate)');
    expect(out).toContain('END52 [End]');
  });

  it('renders the transition graph (from -> to [condition])', () => {
    const out = extractFlowStructure(FLOW)!;
    expect(out).toContain('Start1 -> Utility2 [Always]');
    expect(out).toContain('Utility2 -> END52 [Always]');
  });

  it('includes the guard expression when a transition is conditional', () => {
    const out = extractFlowStructure({
      pxObjClass: 'Rule-Obj-Flow',
      pyModelProcess: {
        pyShapes: { A: { pxObjClass: 'Data-MO-Event-Start' }, B: { pxObjClass: 'Data-MO-Event-End' } },
        pyConnectors: { T: { pyFrom: 'A', pyTo: 'B', pyConditionType: 'When', pyExpression: '.Amount > 1000' } },
      },
    })!;
    expect(out).toContain('A -> B [When: .Amount > 1000]');
  });

  it('returns null when there is no model process (metadata-only export)', () => {
    expect(extractFlowStructure({ pxObjClass: 'Rule-Obj-Flow', pyFlowType: 'Linear' })).toBeNull();
  });
});
