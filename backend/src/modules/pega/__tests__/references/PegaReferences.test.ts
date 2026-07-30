import { describe, it, expect } from 'vitest';
import { PegaReferenceExtractor, extractPegaName } from '../../references/PegaReferenceExtractor.js';
import { PegaImpactAnalyzer } from '../../references/PegaImpactAnalyzer.js';
import type { DependencyGraph } from '../../references/PegaReferenceExtractor.js';

describe('PegaReferenceExtractor', () => {
  const extractor = new PegaReferenceExtractor();

  describe('extractFromRule - Activity', () => {
    const activityJson = {
      pxObjClass: 'Rule-Obj-Activity',
      pyClassName: 'Work-Cover-Jira',
      pyActivityName: 'ResolveTicket',
      pyRuleset: 'JiraIntegration',
      pyRulesetVersion: '01-02-03',
      pyLabel: 'Process and Resolve Jira Ticket',
      steps: [
        { pyStepNum: '1', pyMethod: 'Call', pyMethodParameters: 'Work-Cover-Jira.ValidateData', pyLabel: 'Validate Input' },
        { pyStepNum: '2', pyMethod: 'Call', pyMethodParameters: '@baseclass.SendNotification', pyLabel: 'Send Email' },
        { pyStepNum: '3', pyMethod: 'Branch', pyMethodParameters: 'Work-Cover-Jira.CheckStatus', pyLabel: 'Check Status' },
      ],
    };
    const deps = extractor.extractFromRule(activityJson);

    it('finds called activities from step pyMethodParameters', () => {
      const calls = deps.filter(d => d.relation === 'calls' && d.type === 'Rule-Obj-Activity');
      expect(calls.length).toBeGreaterThanOrEqual(3);
      expect(calls.some(d => d.name === 'ValidateData')).toBe(true);
      expect(calls.some(d => d.name === 'SendNotification')).toBe(true);
      expect(calls.some(d => d.name === 'CheckStatus')).toBe(true);
    });
    it('marks direct calls as non-optional', () => {
      const call = deps.find(d => d.name === 'ValidateData');
      expect(call).toBeDefined();
      expect(call!.optional).toBe(false);
      expect(call!.relation).toBe('calls');
    });
  });

  describe('extractFromRule - DataTransform', () => {
    const dtJson = {
      pxObjClass: 'Rule-Obj-Model',
      pyClassName: 'Work-Cover-Jira',
      pyModelName: 'InitializeTicketData',
      pyActions: [
        { pyActionType: 'Apply Data Transform', pyTarget: 'SetDefaultStatus' },
        { pyActionType: 'Apply Data Transform', pyTarget: 'MapFields' },
      ],
    };
    const deps = extractor.extractFromRule(dtJson);
    it('finds transforms from pyActions', () => {
      const transforms = deps.filter(d => d.type === 'Rule-Obj-Model');
      expect(transforms.some(d => d.name === 'SetDefaultStatus')).toBe(true);
    });
    it('finds when conditions from pyActions', () => {
      const dtWithWhen = {
        pxObjClass: 'Rule-Obj-Model',
        pyClassName: 'Work-Cover-Jira',
        pyModelName: 'ConditionalTransform',
        pyActions: [
          { pyActionType: 'Apply Data Transform', pyTarget: 'SetHighPriority', pyWhenCondition: 'IsHighPriority' },
        ],
      };
      const dtDeps = extractor.extractFromRule(dtWithWhen);
      expect(dtDeps.some(d => d.name === 'IsHighPriority' && d.type === 'Rule-Obj-When')).toBe(true);
    });
  });

  describe('extractFromRule - Flow', () => {
    const flowJson = {
      pxObjClass: 'Rule-Obj-Flow',
      pyClassName: 'Work-Cover-Jira',
      pyFlowName: 'MainFlow',
      pyShapes: [
        { pyShapeType: 'Action', pyFlowActionName: 'CreateTicket', pyWhenCondition: 'IsValid' },
        { pyShapeType: 'Decision', pyWhenCondition: 'IsApproved' },
        { pyShapeType: 'Action', pyFlowActionName: 'CloseTicket' },
      ],
    };
    const deps = extractor.extractFromRule(flowJson);
    it('finds flow actions from shapes', () => {
      expect(deps.some(d => d.name === 'CreateTicket' && d.type === 'Rule-Obj-FlowAction')).toBe(true);
      expect(deps.some(d => d.name === 'CloseTicket' && d.type === 'Rule-Obj-FlowAction')).toBe(true);
    });
    it('finds when conditions from shapes', () => {
      expect(deps.some(d => d.name === 'IsValid' && d.type === 'Rule-Obj-When')).toBe(true);
      expect(deps.some(d => d.name === 'IsApproved' && d.type === 'Rule-Obj-When')).toBe(true);
    });
  });

  describe('extractFromRule - Connect', () => {
    const connectJson = {
      pxObjClass: 'Rule-Connect-REST',
      pyClassName: 'Work-Cover-Jira',
      pyRuleName: 'JiraRESTConnector',
      pyAuthProfile: 'JiraOAuthProfile',
      pyRequestDataTransform: 'BuildJiraRequest',
      pyResponseDataTransform: 'ParseJiraResponse',
    };
    const deps = extractor.extractFromRule(connectJson);
    it('finds auth profile', () => {
      expect(deps.some(d => d.name === 'JiraOAuthProfile' && d.type === 'Rule-Connect-AuthProfile' && d.relation === 'configures')).toBe(true);
    });
    it('finds request and response data transforms', () => {
      expect(deps.some(d => d.name === 'BuildJiraRequest' && d.type === 'Rule-Obj-Model')).toBe(true);
      expect(deps.some(d => d.name === 'ParseJiraResponse' && d.type === 'Rule-Obj-Model')).toBe(true);
    });
  });

  describe('extractFromRule - Decision', () => {
    const decisionJson = {
      pxObjClass: 'Rule-Decision-Strategy',
      pyClassName: 'Work-Cover-Jira',
      pyName: 'PriorityStrategy',
      pyComponents: [
        { pyName: 'HighValueSegment', pyComponentType: 'Segment', pyRef: 'HighValueCustomer' },
        { pyName: 'VIPTreatment', pyComponentType: 'Treatment', pyTreatment: 'VIPOffer' },
      ],
    };
    const deps = extractor.extractFromRule(decisionJson);
    it('finds strategy references from components', () => {
      expect(deps.some(d => d.name === 'HighValueCustomer' && d.type === 'Rule-Decision-Strategy')).toBe(true);
      expect(deps.some(d => d.name === 'VIPOffer' && d.type === 'Rule-Decision-Strategy')).toBe(true);
    });
  });

  describe('extractFromRule - Section', () => {
    const sectionJson = {
      pxObjClass: 'Rule-HTML-Section',
      pyClassName: 'Work-Cover-Jira',
      pyRuleName: 'TicketDetailsSection',
      pyLayouts: [
        { type: 'dynamic', when: 'IsEditable', children: [{ type: 'field', when: 'ShowDescription' }] },
      ],
    };
    const deps = extractor.extractFromRule(sectionJson);
    it('finds when conditions from layout when clauses', () => {
      expect(deps.some(d => d.name === 'IsEditable' && d.type === 'Rule-Obj-When')).toBe(true);
    });
  });

  describe('extractFromRule - Declare', () => {
    const declareJson = {
      pxObjClass: 'Rule-Declare-Trigger',
      pyClassName: 'Work-Cover-Jira',
      pyRuleName: 'OnTicketSave',
      pyTriggerType: 'after',
      pyOperation: 'save',
      pyActivityName: 'PostSaveProcessing',
      pyWhenCondition: 'IsNotArchived',
    };
    const deps = extractor.extractFromRule(declareJson);
    it('finds activity reference from declare trigger', () => {
      expect(deps.some(d => d.name === 'PostSaveProcessing' && d.type === 'Rule-Obj-Activity' && d.relation === 'calls')).toBe(true);
    });
    it('finds when condition from declare trigger', () => {
      expect(deps.some(d => d.name === 'IsNotArchived' && d.type === 'Rule-Obj-When')).toBe(true);
    });
  });

  describe('buildGraph', () => {
    it('builds nodes and edges from multiple rules', () => {
      const rules = [
        { pxObjClass: 'Rule-Obj-Activity', pyClassName: 'Work-Cover-Jira', pyActivityName: 'MainFlow', steps: [{ pyMethod: 'Call', pyMethodParameters: 'Work-Cover-Jira.SubFlow' }] },
        { pxObjClass: 'Rule-Obj-Activity', pyClassName: 'Work-Cover-Jira', pyActivityName: 'SubFlow', steps: [] },
      ];
      const graph = extractor.buildGraph(rules);
      expect(graph.nodes.length).toBeGreaterThanOrEqual(2);
      expect(graph.edges.length).toBeGreaterThanOrEqual(1);
      expect(graph.edges[0].source).toContain('MainFlow');
      expect(graph.edges[0].target).toContain('SubFlow');
    });
  });

  describe('findCycles', () => {
    it('detects a simple cycle between two rules', () => {
      const rules = [
        { pxObjClass: 'Rule-Obj-Activity', pyClassName: 'Test', pyActivityName: 'A', steps: [{ pyMethod: 'Call', pyMethodParameters: 'Test.B' }] },
        { pxObjClass: 'Rule-Obj-Activity', pyClassName: 'Test', pyActivityName: 'B', steps: [{ pyMethod: 'Call', pyMethodParameters: 'Test.A' }] },
      ];
      const graph = extractor.buildGraph(rules);
      const cycles = extractor.findCycles(graph);
      expect(cycles.length).toBeGreaterThanOrEqual(1);
      expect(cycles[0].length).toBeGreaterThanOrEqual(2);
    });
    it('detects a longer cycle with three rules', () => {
      const rules = [
        { pxObjClass: 'Rule-Obj-Activity', pyClassName: 'Test', pyActivityName: 'X', steps: [{ pyMethod: 'Call', pyMethodParameters: 'Test.Y' }] },
        { pxObjClass: 'Rule-Obj-Activity', pyClassName: 'Test', pyActivityName: 'Y', steps: [{ pyMethod: 'Call', pyMethodParameters: 'Test.Z' }] },
        { pxObjClass: 'Rule-Obj-Activity', pyClassName: 'Test', pyActivityName: 'Z', steps: [{ pyMethod: 'Call', pyMethodParameters: 'Test.X' }] },
      ];
      const graph = extractor.buildGraph(rules);
      const cycles = extractor.findCycles(graph);
      expect(cycles.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('calculateDepth', () => {
    it('calculates depth for a deeply nested rule', () => {
      const rules = [
        { pxObjClass: 'Rule-Obj-Activity', pyClassName: 'Test', pyActivityName: 'Root', steps: [{ pyMethod: 'Call', pyMethodParameters: 'Test.Level1' }] },
        { pxObjClass: 'Rule-Obj-Activity', pyClassName: 'Test', pyActivityName: 'Level1', steps: [{ pyMethod: 'Call', pyMethodParameters: 'Test.Level2' }] },
        { pxObjClass: 'Rule-Obj-Activity', pyClassName: 'Test', pyActivityName: 'Level2', steps: [{ pyMethod: 'Call', pyMethodParameters: 'Test.Level3' }] },
        { pxObjClass: 'Rule-Obj-Activity', pyClassName: 'Test', pyActivityName: 'Level3', steps: [] },
      ];
      const graph = extractor.buildGraph(rules);
      const depth = extractor.calculateDepth('Root', graph);
      expect(depth).toBe(3);
    });
  });

  describe('findOrphans', () => {
    it('finds rules not referenced by anything', () => {
      const rules = [
        { pxObjClass: 'Rule-Obj-Activity', pyClassName: 'Test', pyActivityName: 'Called', steps: [] },
        { pxObjClass: 'Rule-Obj-Activity', pyClassName: 'Test', pyActivityName: 'Caller', steps: [{ pyMethod: 'Call', pyMethodParameters: 'Test.Called' }] },
        { pxObjClass: 'Rule-Obj-Activity', pyClassName: 'Test', pyActivityName: 'Orphaned', steps: [] },
      ];
      const graph = extractor.buildGraph(rules);
      const orphans = extractor.findOrphans(graph);
      expect(orphans).toContain('Orphaned');
      expect(orphans).toContain('Caller');
      expect(orphans).not.toContain('Called');
    });
  });

  describe('getDependents', () => {
    it('finds rules that depend on a specific rule', () => {
      const rules = [
        { pxObjClass: 'Rule-Obj-Activity', pyClassName: 'Test', pyActivityName: 'SharedUtil', steps: [] },
        { pxObjClass: 'Rule-Obj-Activity', pyClassName: 'Test', pyActivityName: 'Alpha', steps: [{ pyMethod: 'Call', pyMethodParameters: 'Test.SharedUtil' }] },
        { pxObjClass: 'Rule-Obj-Activity', pyClassName: 'Test', pyActivityName: 'Beta', steps: [{ pyMethod: 'Call', pyMethodParameters: 'Test.SharedUtil' }] },
      ];
      const graph = extractor.buildGraph(rules);
      const dependents = extractor.getDependents('SharedUtil', graph);
      expect(dependents).toContain('Alpha');
      expect(dependents).toContain('Beta');
      expect(dependents).not.toContain('SharedUtil');
    });
  });
});

describe('PegaImpactAnalyzer', () => {
  const extractor = new PegaReferenceExtractor();
  const analyzer = new PegaImpactAnalyzer(extractor);

  function buildSampleGraph(): DependencyGraph {
    return extractor.buildGraph([
      { pxObjClass: 'Rule-Obj-Activity', pyClassName: 'App', pyActivityName: 'TopFlow', steps: [{ pyMethod: 'Call', pyMethodParameters: 'App.MiddleFlow' }] },
      { pxObjClass: 'Rule-Obj-Activity', pyClassName: 'App', pyActivityName: 'MiddleFlow', steps: [{ pyMethod: 'Call', pyMethodParameters: 'App.BottomFlow' }] },
      { pxObjClass: 'Rule-Obj-Activity', pyClassName: 'App', pyActivityName: 'BottomFlow', steps: [{ pyMethod: 'Call', pyMethodParameters: 'App.LeafUtil' }] },
      { pxObjClass: 'Rule-Obj-Activity', pyClassName: 'App', pyActivityName: 'LeafUtil', steps: [] },
      { pxObjClass: 'Rule-Obj-Activity', pyClassName: 'App', pyActivityName: 'IndependentFlow', steps: [] },
    ]);
  }

  it('analyzeChange with one dependent', () => {
    const graph = buildSampleGraph();
    const analysis = analyzer.analyzeChange('LeafUtil', graph);
    expect(analysis.directDependents).toContain('BottomFlow');
    expect(analysis.directDependents.length).toBe(1);
  });

  it('analyzeChange with transitive dependents', () => {
    const graph = buildSampleGraph();
    const analysis = analyzer.analyzeChange('LeafUtil', graph);
    expect(analysis.indirectDependents.length).toBeGreaterThanOrEqual(2);
    expect(analysis.indirectDependents).toContain('MiddleFlow');
    expect(analysis.indirectDependents).toContain('TopFlow');
  });

  it('assigns correct risk level', () => {
    const graph = buildSampleGraph();
    const analysis = analyzer.analyzeChange('TopFlow', graph);
    expect(['low', 'medium', 'high']).toContain(analysis.risk);
    expect(analysis.impactScope).toMatch(/^(local|module|crossModule|system)$/);
  });

  it('analyzeBatch analyzes multiple rules', () => {
    const graph = buildSampleGraph();
    const results = analyzer.analyzeBatch(['TopFlow', 'LeafUtil'], graph);
    expect(results.size).toBe(2);
    expect(results.has('TopFlow')).toBe(true);
    expect(results.has('LeafUtil')).toBe(true);
  });

  it('suggests tests based on impact', () => {
    const graph = buildSampleGraph();
    const analysis = analyzer.analyzeChange('LeafUtil', graph);
    const tests = analyzer.suggestTests(analysis, graph.nodes.map(n => n.name));
    expect(tests.length).toBeGreaterThanOrEqual(1);
    expect(tests.some(t => t.includes('LeafUtil'))).toBe(true);
  });

  it('suggests rule-type-specific tests', () => {
    const graph = extractor.buildGraph([
      { pxObjClass: 'Rule-Obj-When', pyClassName: 'App', pyWhenCondition: 'IsActive', pyRuleName: 'IsActive' },
    ]);
    const analysis = analyzer.analyzeChange('IsActive', graph);
    const tests = analyzer.suggestTests(analysis, graph.nodes.map(n => n.name));
    expect(tests.some(t => t.toLowerCase().includes('condition') || t.toLowerCase().includes('evaluates'))).toBe(true);
  });

  it('toDot generates valid DOT format', () => {
    const graph = buildSampleGraph();
    const dot = analyzer.toDot(graph);
    expect(dot).toContain('digraph PegaDependencies');
    expect(dot).toContain('->');
    expect(dot).toContain('rankdir=LR');
    expect(dot.endsWith('}')).toBe(true);
    for (const node of graph.nodes) {
      expect(dot).toContain(node.name);
    }
  });
});

describe('Edge cases', () => {
  const extractor = new PegaReferenceExtractor();

  it('empty rule returns empty references', () => {
    const deps = extractor.extractFromRule({});
    expect(deps).toEqual([]);
  });

  it('handles malformed JSON gracefully', () => {
    const deps = extractor.extractFromRule(null as unknown as Record<string, unknown>);
    expect(deps).toEqual([]);
  });

  it('partial JSON does not throw', () => {
    const deps = extractor.extractFromRule({ pxObjClass: 'Rule-Obj-Activity' } as Record<string, unknown>);
    expect(Array.isArray(deps)).toBe(true);
  });

  it('auto-detects reference fields using naming conventions', () => {
    const json = {
      pxObjClass: 'Rule-Connect-REST',
      pyClassName: 'App',
      pyRuleName: 'MyConnector',
      pyCustomTransform: 'MapData',
      pyMyCondition: 'CheckFlag',
      pyTargetClass: 'App-Class',
    };
    const deps = extractor.extractFromRule(json);
    expect(deps.some(d => d.name === 'MapData' && d.type === 'Rule-Obj-Model')).toBe(true);
    expect(deps.some(d => d.name === 'CheckFlag' && d.type === 'Rule-Obj-When')).toBe(true);
    expect(deps.some(d => d.name === 'App-Class' && d.type === 'Rule-Obj-Class')).toBe(true);
  });

  it('deduplicates references', () => {
    const json = {
      pxObjClass: 'Rule-Obj-Activity',
      pyClassName: 'Test',
      pyActivityName: 'DupCheck',
      pyMethodParameters: 'Test.Foo',
      steps: [{ pyMethod: 'Call', pyMethodParameters: 'Test.Foo' }],
    };
    const deps = extractor.extractFromRule(json);
    const fooRefs = deps.filter(d => d.name === 'Foo');
    expect(fooRefs.length).toBe(1);
  });

  it('pxRuleReferences are extracted', () => {
    const json = {
      pxObjClass: 'Rule-Decision-Strategy',
      pyClassName: 'App',
      pyName: 'TestStrategy',
      pxRuleReferences: [
        { pxRuleObjClass: 'Rule-Obj-Activity', pyRuleName: 'RefActivity' },
        { pxRuleObjClass: 'Rule-Obj-When', pyRuleName: 'RefWhen' },
      ],
    };
    const deps = extractor.extractFromRule(json);
    expect(deps.some(d => d.name === 'RefActivity' && d.type === 'Rule-Obj-Activity')).toBe(true);
    expect(deps.some(d => d.name === 'RefWhen' && d.type === 'Rule-Obj-When')).toBe(true);
  });

  it('extractPegaName helper works', () => {
    expect(extractPegaName({ pyActivityName: 'TestActivity' })).toBe('TestActivity');
    expect(extractPegaName({ pyRuleName: 'MyRule', pyLabel: 'Label' })).toBe('MyRule');
    expect(extractPegaName({})).toBe('Unnamed');
  });

  it('buildGraph with no rules returns empty graph', () => {
    const graph = extractor.buildGraph([]);
    expect(graph.nodes).toEqual([]);
    expect(graph.edges).toEqual([]);
  });
});

describe('ImpactAnalyzer advanced scenarios', () => {
  const extractor = new PegaReferenceExtractor();
  const analyzer = new PegaImpactAnalyzer(extractor);

  it('analyzeChange with no dependents has local scope', () => {
    const graph = extractor.buildGraph([
      { pxObjClass: 'Rule-Obj-Activity', pyClassName: 'App', pyActivityName: 'Standalone', steps: [] },
    ]);
    const analysis = analyzer.analyzeChange('Standalone', graph);
    expect(analysis.directDependents).toEqual([]);
    expect(analysis.indirectDependents).toEqual([]);
    expect(analysis.impactScope).toBe('local');
  });

  it('analyzeChange on unknown rule returns safe defaults', () => {
    const graph = extractor.buildGraph([]);
    const analysis = analyzer.analyzeChange('NonExistent', graph);
    expect(analysis.ruleName).toBe('NonExistent');
    expect(analysis.risk).toBe('low');
    expect(analysis.impactScope).toBe('local');
  });

  it('toDot handles optional edges', () => {
    const graph = extractor.buildGraph([
      { pxObjClass: 'Rule-Obj-Activity', pyClassName: 'App', pyActivityName: 'Main', steps: [{ pyMethod: 'Call', pyMethodParameters: 'App.Sub' }] },
      { pxObjClass: 'Rule-Obj-Activity', pyClassName: 'App', pyActivityName: 'Sub', pyWhenCondition: 'OptionalWhen', steps: [] },
    ]);
    const dot = analyzer.toDot(graph);
    expect(dot).toContain('->');
  });

  it('impact scope escalates with multiple types', () => {
    const rules = [
      { pxObjClass: 'Rule-Obj-Activity', pyClassName: 'App', pyActivityName: 'Central', steps: [{ pyMethod: 'Call', pyMethodParameters: 'App.Util' }] },
      { pxObjClass: 'Rule-Obj-Activity', pyClassName: 'App', pyActivityName: 'Util', steps: [] },
    ];
    const graph = extractor.buildGraph(rules);
    const analysis = analyzer.analyzeChange('Util', graph);
    expect(analysis.directDependents).toContain('Central');
  });
});
