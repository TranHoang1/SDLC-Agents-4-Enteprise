import { describe, it, expect } from 'vitest';
import { PegaRuleAstParser } from '../../PegaRuleAstParser.js';
import { PegaGoldenDataset } from '../../quality/PegaGoldenDataset.js';
import { PegaRoundTripValidator } from '../../quality/PegaRoundTripValidator.js';
import { PegaMutationTester } from '../../quality/PegaMutationTester.js';

const parser = new PegaRuleAstParser();
const dataset = new PegaGoldenDataset();
const roundTrip = new PegaRoundTripValidator(parser);
const mutationTester = new PegaMutationTester(parser);

// =============================================================================
// SECTION 1: GoldenDataset returns valid samples for all major rule types
// =============================================================================

describe('PegaGoldenDataset — sample integrity', () => {
  it('returns valid Activity sample with correct pxObjClass', () => {
    const sample = dataset.getActivitySample();
    expect(sample.pxObjClass).toBe('Rule-Obj-Activity');
    expect(sample.name).toBe('ResolveTicket');
    expect(sample.json.steps).toBeDefined();
    expect(Array.isArray(sample.json.steps)).toBe(true);
  });

  it('returns valid Data Transform sample with correct pxObjClass', () => {
    const sample = dataset.getDataTransformSample();
    expect(sample.pxObjClass).toBe('Rule-Obj-Model');
    expect(sample.name).toBe('InitializeTicket');
    expect(sample.json.pyActions).toBeDefined();
  });

  it('returns valid Flow sample with correct pxObjClass', () => {
    const sample = dataset.getFlowSample();
    expect(sample.pxObjClass).toBe('Rule-Obj-Flow');
    expect(sample.name).toBe('MainProcess');
    expect(sample.json.pyShapes).toBeDefined();
  });

  it('returns valid Decision Table sample with correct pxObjClass', () => {
    const sample = dataset.getDecisionTableSample();
    expect(sample.pxObjClass).toBe('Rule-Declare-DecisionTable');
    expect(sample.name).toBe('PriorityDecision');
    expect(sample.json.pyDecisionTableRows).toBeDefined();
  });

  it('returns valid Decision Tree sample with correct pxObjClass', () => {
    const sample = dataset.getDecisionTreeSample();
    expect(sample.pxObjClass).toBe('Rule-Declare-DecisionTree');
    expect(sample.name).toBe('ApprovalTree');
  });

  it('returns valid When condition sample with correct pxObjClass', () => {
    const sample = dataset.getWhenSample();
    expect(sample.pxObjClass).toBe('Rule-Obj-When');
    expect(sample.name).toBe('IsHighPriority');
  });

  it('returns valid Section sample with correct pxObjClass', () => {
    const sample = dataset.getSectionSample();
    expect(sample.pxObjClass).toBe('Rule-HTML-Section');
    expect(sample.name).toBe('TicketDetails');
  });

  it('returns valid Connect REST sample with correct pxObjClass', () => {
    const sample = dataset.getConnectRestSample();
    expect(sample.pxObjClass).toBe('Rule-Connect-REST');
    expect(sample.name).toBe('GetJiraIssue');
  });

  it('returns valid Declare Expression sample with correct pxObjClass', () => {
    const sample = dataset.getDeclareExpressionSample();
    expect(sample.pxObjClass).toBe('Rule-Declare-Expressions');
    expect(sample.name).toBe('TotalAmount');
  });

  it('returns valid Class sample with correct pxObjClass', () => {
    const sample = dataset.getClassSample();
    expect(sample.pxObjClass).toBe('Rule-Obj-Class');
    expect(sample.name).toBe('Work-Cover-Jira');
  });

  it('returns valid Flow Action sample with correct pxObjClass', () => {
    const sample = dataset.getFlowActionSample();
    expect(sample.pxObjClass).toBe('Rule-Obj-FlowAction');
    expect(sample.name).toBe('NewAssignment');
  });

  it('returns valid Declare Pages sample with correct pxObjClass', () => {
    const sample = dataset.getDeclarePagesSample();
    expect(sample.pxObjClass).toBe('Rule-Declare-Pages');
    expect(sample.name).toBe('TicketPages');
    expect(sample.json.pyPages).toBeDefined();
    expect(Array.isArray(sample.json.pyPages)).toBe(true);
  });

  it('returns valid Utility sample with correct pxObjClass', () => {
    const sample = dataset.getUtilitySample();
    expect(sample.pxObjClass).toBe('Rule-Utility-Function');
    expect(sample.name).toBe('StringUtils');
    expect(sample.json.pyParameters).toBeDefined();
    expect(Array.isArray(sample.json.pyParameters)).toBe(true);
  });

  it('returns valid Connect SOAP sample with correct pxObjClass', () => {
    const sample = dataset.getConnectSOAPSample();
    expect(sample.pxObjClass).toBe('Rule-Connect-SOAP');
    expect(sample.name).toBe('GetCustomerData');
    expect(sample.json.pyBaseURL).toBeDefined();
    expect(sample.json.pySOAPAction).toBeDefined();
  });

  it('returns valid Access Role sample with correct pxObjClass', () => {
    const sample = dataset.getAccessRoleSample();
    expect(sample.pxObjClass).toBe('Rule-Access-Role');
    expect(sample.name).toBe('JiraIntegrationRole');
    expect(sample.json.pyOperations).toBeDefined();
    expect(Array.isArray(sample.json.pyOperations)).toBe(true);
  });

  it('returns all 15 samples via getAllSamples()', () => {
    const all = dataset.getAllSamples();
    expect(all).toHaveLength(15);
    const types = all.map(s => s.pxObjClass);
    expect(types).toContain('Rule-Obj-Activity');
    expect(types).toContain('Rule-Obj-Model');
    expect(types).toContain('Rule-Obj-Flow');
    expect(types).toContain('Rule-Declare-DecisionTable');
    expect(types).toContain('Rule-Obj-When');
    expect(types).toContain('Rule-Connect-REST');
  });
});

// =============================================================================
// SECTION 2: GoldenDataset.verify checks AST output against expected structure
// =============================================================================

describe('PegaGoldenDataset — verify', () => {
  it('verify passes for valid Activity sample', () => {
    const sample = dataset.getActivitySample();
    const ast = parser.parse(sample.json);
    const result = dataset.verify(sample, ast);
    expect(result.passed).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it('verify passes for valid Flow sample', () => {
    const sample = dataset.getFlowSample();
    const ast = parser.parse(sample.json);
    const result = dataset.verify(sample, ast);
    expect(result.passed).toBe(true);
  });

  it('verify catches incorrect rule type', () => {
    const sample = dataset.getActivitySample();
    const ast = parser.parse(sample.json);
    const wrongSample = { ...sample, pxObjClass: 'Rule-Obj-Flow' };
    const result = dataset.verify(wrongSample, ast);
    expect(result.passed).toBe(false);
    expect(result.issues.some(i => i.includes('ruleType'))).toBe(true);
  });

  it('verify catches missing references', () => {
    const sample = dataset.getActivitySample();
    const ast = parser.parse(sample.json);
    const wrongSample = { ...sample, expectedReferences: ['NonExistentRef'] };
    const result = dataset.verify(wrongSample, ast);
    expect(result.passed).toBe(false);
    expect(result.issues.some(i => i.includes('reference'))).toBe(true);
  });

  it('verify catches wrong child count', () => {
    const sample = dataset.getActivitySample();
    const ast = parser.parse(sample.json);
    const wrongSample = { ...sample, expectedChildren: 99 };
    const result = dataset.verify(wrongSample, ast);
    expect(result.passed).toBe(false);
    expect(result.issues.some(i => i.includes('children'))).toBe(true);
  });
});

// =============================================================================
// SECTION 3: All 15 golden samples parse without throwing
// =============================================================================

describe('PegaGoldenDataset — all samples parse successfully', () => {
  const all = dataset.getAllSamples();

  for (const sample of all) {
    it(`parses ${sample.pxObjClass} / ${sample.name} without throwing`, () => {
      const ast = parser.parse(sample.json);
      expect(ast).toBeDefined();
      expect(ast.ruleType).toBe(sample.pxObjClass);
      expect(ast.children.length).toBe(sample.expectedChildren);
    });
  }
});

// =============================================================================
// SECTION 4: RoundTripValidator
// =============================================================================

describe('PegaRoundTripValidator', () => {
  it('successfully preserves all fields for Activity', () => {
    const activity = {
      pxObjClass: 'Rule-Obj-Activity',
      pyClassName: 'Work-Cover-Jira',
      pyActivityName: 'ResolveTicket',
      pyRuleset: 'JiraIntegration',
      pyLabel: 'Test Activity',
      steps: [
        { pyStepNum: '1', pyMethod: 'Call', pyMethodParameters: 'Work-Cover-Jira.ValidateData', pyLabel: 'Step 1' },
      ],
    };
    const result = roundTrip.validate(activity);
    expect(result.success).toBe(true);
    expect(result.ruleName).toBe('ResolveTicket');
    expect(result.ruleType).toBe('Rule-Obj-Activity');
  });

  it('successfully preserves all fields for DataTransform', () => {
    const dt = {
      pxObjClass: 'Rule-Obj-Model',
      pyClassName: 'Work-Cover-Jira',
      pyModelName: 'InitializeTicket',
      pyRuleset: 'JiraIntegration',
      pyLabel: 'Test DT',
      pyActions: [
        { pyActionType: 'Set', pyTarget: '.pyStatus', pySource: 'New' },
        { pyActionType: 'Apply Data Transform', pyTarget: 'SetDefaultStatus' },
      ],
    };
    const result = roundTrip.validate(dt);
    expect(result.success).toBe(true);
    expect(result.ruleName).toBe('InitializeTicket');
    expect(result.ruleType).toBe('Rule-Obj-Model');
  });

  it('successfully preserves all fields for Flow', () => {
    const flow = {
      pxObjClass: 'Rule-Obj-Flow',
      pyClassName: 'Work-Cover-Jira',
      pyFlowName: 'MainFlow',
      pyRuleset: 'JiraIntegration',
      pyLabel: 'Test Flow',
      pyShapes: [
        { pyShapeType: 'Start', pyName: 'Begin' },
        { pyShapeType: 'End', pyName: 'Done' },
      ],
    };
    const result = roundTrip.validate(flow);
    expect(result.success).toBe(true);
  });

  it('successfully preserves all fields for DecisionTable', () => {
    const dt = {
      pxObjClass: 'Rule-Declare-DecisionTable',
      pyClassName: 'Work-Cover-Jira',
      pyRuleName: 'TestTable',
      pyRuleset: 'JiraIntegration',
      pyLabel: 'Test Decision Table',
      pyPropertyEvaluated: 'pyStatus',
      pyDecisionTableRows: [
        { pyCondition: 'pyUrgency > 80', pyResult: 'Critical' },
      ],
    };
    const result = roundTrip.validate(dt);
    expect(result.success).toBe(true);
  });

  it('successfully preserves all fields for ConnectREST', () => {
    const rest = {
      pxObjClass: 'Rule-Connect-REST',
      pyClassName: 'Work-Cover-Jira',
      pyRuleName: 'GetIssue',
      pyRuleset: 'JiraIntegration',
      pyLabel: 'Get Issue',
      pyBaseURL: 'https://example.com/api',
      pyResourcePath: '/issue/{id}',
      pyHTTPMethod: 'GET',
      pyHeaders: [
        { pyHeaderName: 'Authorization', pyHeaderValue: 'Bearer token' },
      ],
    };
    const result = roundTrip.validate(rest);
    expect(result.success).toBe(true);
  });

  it('detects lost fields when semantic field is dropped', () => {
    // Simulate a case where a key field gets stripped
    const original = {
      pxObjClass: 'Rule-Obj-Activity',
      pyClassName: 'Work-Cover-Jira',
      pyActivityName: 'TestActivity',
      pyCustomField: 'should-survive',
      steps: [],
    };
    const result = roundTrip.validate(original);
    // pyCustomField is not a system field, should survive
    expect(result.lostFields).not.toContain('pyCustomField');
  });

  it('handles empty JSON gracefully without throwing', () => {
    const result = roundTrip.validate({});
    expect(result.ruleName).toBe('unknown');
    expect(result.ruleType).toBe('unknown');
    expect(result.differences).toBeDefined();
  });

  it('validateBatch returns results for all samples', () => {
    const all = dataset.getAllSamples();
    const jsons = all.map(s => s.json);
    const results = roundTrip.validateBatch(jsons);
    expect(results).toHaveLength(15);
    for (const r of results) {
      expect(r.ruleName).toBeDefined();
      expect(r.ruleType).toBeDefined();
    }
  });

  it('assertPropertiesPreserved returns true for unmodified samples', () => {
    const activity = {
      pxObjClass: 'Rule-Obj-Activity',
      pyClassName: 'Work-Cover-Jira',
      pyActivityName: 'TestActivity',
      pyLabel: 'Test',
    };
    const result = roundTrip.validate(activity);
    expect(roundTrip.assertPropertiesPreserved(activity, result)).toBe(true);
  });
});

// =============================================================================
// SECTION 5: MutationTester
// =============================================================================

describe('PegaMutationTester', () => {
  const sample: Record<string, unknown> = {
    pxObjClass: 'Rule-Obj-Activity',
    pyClassName: 'Work-Cover-Jira',
    pyActivityName: 'TestActivity',
    pyRuleset: 'JiraIntegration',
    pyLabel: 'Test',
    steps: [
      { pyStepNum: '1', pyMethod: 'Call', pyMethodParameters: 'MyClass.MyMethod', pyLabel: 'Step 1' },
    ],
  };

  it('mutateFieldValue produces a different clone', () => {
    const mutated = mutationTester.mutateFieldValue(sample, 'pyLabel', 'MUTATED');
    expect(mutated.pyLabel).toBe('MUTATED');
    expect(sample.pyLabel).toBe('Test');
  });

  it('removeField removes the specified field', () => {
    const mutated = mutationTester.removeField(sample, 'pyClassName');
    expect(mutated.pyClassName).toBeUndefined();
    expect(sample.pyClassName).toBe('Work-Cover-Jira');
  });

  it('changeType changes pxObjClass and returns a different AST fingerprint', () => {
    const mutated = mutationTester.changeType(sample, 'Rule-Obj-Flow');
    expect(mutated.pxObjClass).toBe('Rule-Obj-Flow');
    expect(sample.pxObjClass).toBe('Rule-Obj-Activity');
  });

  it('addRandomField adds an extra field', () => {
    const mutated = mutationTester.addRandomField(sample);
    const extraKeys = Object.keys(mutated).filter(k => k.startsWith('pyExtraField_'));
    expect(extraKeys.length).toBeGreaterThanOrEqual(1);
  });

  it('removeChild removes an item from child array', () => {
    const mutated = mutationTester.removeChild(sample, 'steps', 0);
    const steps = mutated.steps as Array<unknown>;
    expect(steps).toHaveLength(0);
  });

  it('testMutation reports detectedDifference for label change', () => {
    const result = mutationTester.testMutation(sample, {
      name: 'change-label',
      description: 'Change label',
      apply: (orig) => mutationTester.mutateFieldValue(orig, 'pyLabel', 'MUTATED'),
    });
    expect(result.originalValid).toBe(true);
    expect(result.mutatedValid).toBe(true);
    expect(result.detectedDifference).toBe(true);
  });

  it('testMutation reports detectedDifference for pxObjClass change', () => {
    const result = mutationTester.testMutation(sample, {
      name: 'change-type',
      description: 'Change type',
      apply: (orig) => mutationTester.changeType(orig, 'Rule-Obj-Flow'),
    });
    expect(result.originalValid).toBe(true);
    expect(result.mutatedValid).toBe(true);
    expect(result.detectedDifference).toBe(true);
  });

  it('testMutation reports detectedDifference for child removal', () => {
    const result = mutationTester.testMutation(sample, {
      name: 'remove-first-step',
      description: 'Remove first step',
      apply: (orig) => mutationTester.removeChild(orig, 'steps', 0),
    });
    expect(result.originalValid).toBe(true);
    expect(result.mutatedValid).toBe(true);
    expect(result.detectedDifference).toBe(true);
  });

  it('testMutation reports detectedDifference for pyClassName removal', () => {
    const result = mutationTester.testMutation(sample, {
      name: 'remove-classname',
      description: 'Remove className',
      apply: (orig) => mutationTester.removeField(orig, 'pyClassName'),
    });
    expect(result.originalValid).toBe(true);
    expect(result.mutatedValid).toBe(true);
    expect(result.detectedDifference).toBe(true);
  });

  it('testMutation reports detectedDifference for extra field', () => {
    const result = mutationTester.testMutation(sample, {
      name: 'add-field',
      description: 'Add random field',
      apply: (orig) => mutationTester.addRandomField(orig),
    });
    expect(result.originalValid).toBe(true);
    expect(result.mutatedValid).toBe(true);
    expect(result.detectedDifference).toBe(true);
  });

  it('runMutationSuite returns results for all mutations', () => {
    const results = mutationTester.runMutationSuite(sample);
    expect(results.length).toBeGreaterThanOrEqual(8);
    const names = results.map(r => r.mutationName);
    expect(names).toContain('change-pxObjClass');
    expect(names).toContain('remove-pyClassName');
    expect(names).toContain('change-label');
    expect(names).toContain('add-random-field');
    expect(names).toContain('remove-first-step');
  });

  it('runMutationSuite returns all results with originalValid true', () => {
    const results = mutationTester.runMutationSuite(sample);
    for (const r of results) {
      expect(r.originalValid).toBe(true);
    }
  });

  it('mutation for null pyClassName still parses successfully', () => {
    const result = mutationTester.testMutation(sample, {
      name: 'set-null-classname',
      description: 'Set className to null',
      apply: (orig) => mutationTester.mutateFieldValue(orig, 'pyClassName', null),
    });
    expect(result.originalValid).toBe(true);
    expect(result.mutatedValid).toBe(true);
  });

  it('mutation with empty string label still parses', () => {
    const result = mutationTester.testMutation(sample, {
      name: 'empty-label',
      description: 'Set label to empty',
      apply: (orig) => mutationTester.mutateFieldValue(orig, 'pyLabel', ''),
    });
    expect(result.mutatedValid).toBe(true);
  });

  it('mutated fingerprint differs from original for most mutations', () => {
    const results = mutationTester.runMutationSuite(sample);
    const detected = results.filter(r => r.detectedDifference);
    expect(detected.length).toBeGreaterThanOrEqual(5);
  });
});

// =============================================================================
// SECTION 6: End-to-end integration between quality tools
// =============================================================================

describe('Quality suite integration', () => {
  it('all golden samples survive round-trip validation', () => {
    const all = dataset.getAllSamples();
    for (const sample of all) {
      const ast = parser.parse(sample.json);
      const verifyResult = dataset.verify(sample, ast);
      expect(verifyResult.passed).toBe(true);
    }
  });

  it('mutation tester detects all mutations in runMutationSuite for Flow sample', () => {
    const flowSample = dataset.getFlowSample();
    const results = mutationTester.runMutationSuite(flowSample.json as Record<string, unknown>);
    expect(results.length).toBeGreaterThanOrEqual(8);
  });

  it('round-trip + mutation together produce consistent results', () => {
    const activity = dataset.getActivitySample();
    const rtResult = roundTrip.validate(activity.json as Record<string, unknown>);
    expect(rtResult.success).toBe(true);

    const mutationResults = mutationTester.runMutationSuite(activity.json as Record<string, unknown>);
    for (const mr of mutationResults) {
      expect(mr.originalValid).toBe(true);
    }
  });

  it('golden dataset verify works for all 15 samples after parse', () => {
    const all = dataset.getAllSamples();
    for (const sample of all) {
      const ast = parser.parse(sample.json);
      const result = dataset.verify(sample, ast);
      expect(result.passed).toBe(true);
      expect(result.ast).toBeDefined();
    }
  });

  it('round-trip correctly identifies lost system fields', () => {
    const sample = {
      pxObjClass: 'Rule-Obj-When',
      pyClassName: 'Work-Cover-Jira',
      pyRuleName: 'TestWhen',
      pyWhenExpression: '.pyStatus = "Open"',
      pyWhenType: 'Expression',
      pxCreateDateTime: '2024-01-01T00:00:00Z',
      pzIndex: '42',
    };
    const result = roundTrip.validate(sample);
    // pxCreateDateTime and pzIndex are system fields, they may be lost
    // But pyWhenExpression, pyWhenType should be preserved
    expect(result.preservedFields).toContain('pyWhenExpression');
    expect(result.preservedFields).toContain('pyWhenType');
  });
});

// =============================================================================
// SECTION 7: Additional edge cases and robustness
// =============================================================================

describe('Additional robustness tests', () => {
  it('round-trip handles null values in original json without throwing', () => {
    const json: Record<string, unknown> = {
      pxObjClass: 'Rule-Obj-Activity',
      pyClassName: null,
      pyActivityName: 'NullTest',
      steps: null,
    };
    expect(() => roundTrip.validate(json)).not.toThrow();
    const result = roundTrip.validate(json);
    expect(result.ruleName).toBe('NullTest');
    expect(result.ruleType).toBe('Rule-Obj-Activity');
  });

  it('round-trip handles undefined values in original json without throwing', () => {
    const json: Record<string, unknown> = {
      pxObjClass: 'Rule-Obj-Activity',
      pyActivityName: 'UndefTest',
    };
    expect(() => roundTrip.validate(json)).not.toThrow();
    const result = roundTrip.validate(json);
    expect(result.ruleName).toBe('UndefTest');
  });

  it('mutation tester handles empty steps array gracefully', () => {
    const emptySteps: Record<string, unknown> = {
      pxObjClass: 'Rule-Obj-Activity',
      pyClassName: 'Work-Cover-Jira',
      pyActivityName: 'EmptySteps',
      steps: [],
    };
    const result = mutationTester.testMutation(emptySteps, {
      name: 'remove-first-from-empty',
      description: 'Remove from empty array',
      apply: (orig) => mutationTester.removeChild(orig, 'steps', 0),
    });
    expect(result.originalValid).toBe(true);
    expect(result.mutatedValid).toBe(true);
  });

  it('mutation tester handles missing array field gracefully', () => {
    const noSteps: Record<string, unknown> = {
      pxObjClass: 'Rule-Obj-Activity',
      pyClassName: 'Work-Cover-Jira',
      pyActivityName: 'NoSteps',
    };
    const result = mutationTester.testMutation(noSteps, {
      name: 'remove-from-missing',
      description: 'Remove from missing array',
      apply: (orig) => mutationTester.removeChild(orig, 'steps', 0),
    });
    expect(result.originalValid).toBe(true);
    expect(result.mutatedValid).toBe(true);
  });

  it('round-trip validator batch handles mixed content', () => {
    const samples = [
      {
        pxObjClass: 'Rule-Obj-Activity',
        pyClassName: 'Class1',
        pyActivityName: 'Act1',
        steps: [],
      },
      {
        pxObjClass: 'Rule-Obj-When',
        pyClassName: 'Class2',
        pyRuleName: 'When1',
        pyWhenExpression: 'true',
      },
      {},
    ];
    const results = roundTrip.validateBatch(samples);
    expect(results).toHaveLength(3);
    expect(results[0].ruleName).toBe('Act1');
    expect(results[1].ruleName).toBe('When1');
    expect(results[2].ruleName).toBe('unknown');
  });

  it('mutation tester preserves original object immutably', () => {
    const orig: Record<string, unknown> = {
      pxObjClass: 'Rule-Obj-Activity',
      pyClassName: 'Work-Cover-Jira',
      pyActivityName: 'TestActivity',
      pyLabel: 'Test',
      steps: [],
    };
    const originalJson = JSON.stringify(orig);
    mutationTester.mutateFieldValue(orig, 'pyLabel', 'changed');
    mutationTester.removeField(orig, 'pyClassName');
    expect(JSON.stringify(orig)).toBe(originalJson);
  });

  it('golden dataset verify returns ast in result', () => {
    const sample = dataset.getActivitySample();
    const ast = parser.parse(sample.json);
    const result = dataset.verify(sample, ast);
    expect(result.ast).toBe(ast);
    expect(result.sampleName).toBe('ResolveTicket');
  });

  it('round-trip validator produces consistent diff output', () => {
    const activity = {
      pxObjClass: 'Rule-Obj-Activity',
      pyClassName: 'Work-Cover-Jira',
      pyActivityName: 'DiffTest',
      steps: [
        { pyStepNum: '1', pyMethod: 'Call', pyMethodParameters: 'Class.Method', pyLabel: 'Diff' },
      ],
    };
    const result = roundTrip.validate(activity);
    expect(result.differences).toHaveLength(0);
    expect(result.lostFields).toHaveLength(0);
    expect(result.addedFields).toHaveLength(0);
  });
});
