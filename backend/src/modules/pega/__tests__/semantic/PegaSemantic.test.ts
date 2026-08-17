import { describe, it, expect } from 'vitest';
import { PegaSemanticAnalyzer } from '../../semantic/PegaSemanticAnalyzer.js';
import { PegaRuleSimulator } from '../../semantic/PegaRuleSimulator.js';
import { PegaClipboardContext } from '../../expression/PegaClipboardContext.js';
import type { PegaClassDefinition } from '../../metamodel/PegaClassDefinition.js';

describe('PegaSemanticAnalyzer', () => {
  const analyzer = new PegaSemanticAnalyzer();

  describe('Activity analysis', () => {
    const activityJson = {
      pxObjClass: 'Rule-Obj-Activity',
      pyClassName: 'Work-Cover-Jira',
      pyActivityName: 'ResolveTicket',
      pyLabel: 'Process and Resolve Jira Ticket',
      steps: [
        { pyStepNum: '1', pyMethod: 'Call', pyMethodParameters: 'Work-Cover-Jira.ValidateData', pyLabel: 'Validate Input' },
        { pyStepNum: '2', pyMethod: 'Call', pyMethodParameters: '@baseclass.SendNotification', pyLabel: 'Send Email' },
        { pyStepNum: '3', pyMethod: 'Property-Set', pyMethodParameters: '.pyStatus', pyLabel: 'Set Status' },
        { pyStepNum: '4', pyMethod: 'Obj-Save', pyMethodParameters: 'Work-Cover-Jira', pyLabel: 'Save to DB' },
        { pyStepNum: '5', pyMethod: 'Property-Set', pyMethodParameters: '.pyPriority', pyLabel: 'Set Priority', pyWhenCondition: '.IsHighPriority' },
      ],
    };

    const analysis = analyzer.analyzeActivity(activityJson);

    it('produces summary with step count', () => {
      expect(analysis.ruleType).toBe('Rule-Obj-Activity');
      expect(analysis.name).toBe('ResolveTicket');
      expect(analysis.summary).toContain('5 step(s)');
      expect(analysis.steps).toBe(5);
    });

    it('detects called activities from Call steps', () => {
      expect(analysis.calledActivities).toContain('ValidateData');
      expect(analysis.calledActivities).toContain('SendNotification');
      expect(analysis.calledActivities).toHaveLength(2);
    });

    it('detects properties set from Property-Set steps', () => {
      expect(analysis.setProperties).toContain('pyStatus');
      expect(analysis.setProperties).toContain('pyPriority');
    });

    it('predicts side effects: api_call and db_write', () => {
      const apiCalls = analysis.sideEffects.filter(s => s.type === 'api_call');
      const dbWrites = analysis.sideEffects.filter(s => s.type === 'db_write');
      const pageUpdates = analysis.sideEffects.filter(s => s.type === 'page_update');
      expect(apiCalls.length).toBeGreaterThanOrEqual(2);
      expect(dbWrites.length).toBe(1);
      expect(pageUpdates.length).toBeGreaterThanOrEqual(2);
    });

    it('extracts conditions from when conditions on steps', () => {
      expect(analysis.conditions.length).toBeGreaterThanOrEqual(1);
      expect(analysis.conditions[0].field).toBe('.IsHighPriority');
    });

    it('extracts dependencies for called activities', () => {
      const activityDeps = analysis.dependencies.filter(d => d.type === 'activity');
      expect(activityDeps.length).toBe(2);
      expect(activityDeps[0].target).toBe('ValidateData');
    });

    it('detects data flow entries for property sets', () => {
      expect(analysis.dataFlow.length).toBeGreaterThanOrEqual(2);
    });

    it('generates intent describing what the activity does', () => {
      expect(analysis.intent).toContain('calls 2');
      expect(analysis.intent).toContain('sets 2');
    });
  });

  describe('Data Transform analysis', () => {
    const dtJson = {
      pxObjClass: 'Rule-Obj-Model',
      pyClassName: 'Work-Cover-Jira',
      pyModelName: 'InitializeTicket',
      pyLabel: 'Initialize ticket data',
      pyActions: [
        { pyActionType: 'Set', pyTarget: '.pyStatus', pySource: 'New' },
        { pyActionType: 'Set', pyTarget: '.pyPriority', pySource: '5' },
        { pyActionType: 'Apply Data Transform', pyTarget: 'SetDefaultStatus' },
        { pyActionType: 'Set', pyTarget: '.pyOwner', pySource: '.pyRequestor', pyWhenCondition: '.HasRequestor' },
      ],
    };

    const analysis = analyzer.analyzeDataTransform(dtJson);

    it('extracts property mappings', () => {
      expect(analysis.propertyMappings).toBeDefined();
      expect(analysis.propertyMappings!.length).toBe(3);
      expect(analysis.propertyMappings![0].from).toBe('New');
      expect(analysis.propertyMappings![0].to).toBe('pyStatus');
    });

    it('detects sub-transform references', () => {
      const transformDeps = analysis.dependencies.filter(d => d.type === 'data_transform');
      expect(transformDeps.length).toBe(1);
      expect(transformDeps[0].target).toBe('SetDefaultStatus');
    });

    it('detects conditions on conditional actions', () => {
      expect(analysis.conditions.length).toBe(1);
      expect(analysis.conditions[0].field).toBe('.HasRequestor');
    });

    it('generates summary with action count', () => {
      expect(analysis.summary).toContain('4 action(s)');
    });
  });

  describe('Decision analysis', () => {
    const decisionJson = {
      pxObjClass: 'Rule-Declare-DecisionTable',
      pyClassName: 'Work-Cover-Jira',
      pyLabel: 'PriorityDecision',
      pyPropertyEvaluated: 'pyUrgency',
      pyDecisionTableRows: [
        { pyCondition: 'pyUrgency > 80', pyResult: 'Critical' },
        { pyCondition: 'pyUrgency > 50', pyResult: 'High' },
        { pyCondition: 'pyUrgency > 20', pyResult: 'Medium' },
      ],
      pyReturnActions: [{ pyTransformName: 'SetHighPriorityData' }],
    };

    const analysis = analyzer.analyzeDecision(decisionJson);

    it('extracts conditions and results', () => {
      expect(analysis.conditions.length).toBe(3);
      expect(analysis.conditions[0].field).toBe('pyUrgency');
      expect(analysis.conditions[0].operator).toBe('>');
      expect(analysis.conditions[0].value).toBe('80');
    });

    it('tracks row count and property evaluated', () => {
      expect(analysis.decisionRows).toBe(3);
      expect(analysis.propertyEvaluated).toBe('pyUrgency');
    });

    it('detects data flow from input to output', () => {
      expect(analysis.dataFlow.length).toBe(3);
      expect(analysis.dataFlow[0].input).toBe('pyUrgency');
      expect(analysis.dataFlow[0].output).toBe('Critical');
    });

    it('extracts return action transform dependencies', () => {
      const transformDeps = analysis.dependencies.filter(d => d.type === 'data_transform');
      expect(transformDeps.length).toBe(1);
      expect(transformDeps[0].target).toBe('SetHighPriorityData');
    });

    it('generates summary referencing rows', () => {
      expect(analysis.summary).toContain('3 row(s)');
    });
  });

  describe('Connect analysis', () => {
    const connectJson = {
      pxObjClass: 'Rule-Connect-REST',
      pyClassName: 'Work-Cover-Jira',
      pyRuleName: 'GetJiraIssue',
      pyBaseURL: 'https://jira.example.com/rest/api/2',
      pyResourcePath: '/issue/{issueId}',
      pyHTTPMethod: 'GET',
      pyAuthenticationType: 'Basic',
    };

    const analysis = analyzer.analyzeConnect(connectJson);

    it('extracts endpoint URL and HTTP method', () => {
      expect(analysis.endpointUrl).toBe('https://jira.example.com/rest/api/2/issue/{issueId}');
      expect(analysis.httpMethod).toBe('GET');
      expect(analysis.authType).toBe('Basic');
    });

    it('predicts side effect: api_call', () => {
      const apiCalls = analysis.sideEffects.filter(s => s.type === 'api_call');
      expect(apiCalls.length).toBe(1);
      expect(apiCalls[0].target).toContain('jira.example.com');
    });

    it('generates endpoint-focused summary', () => {
      expect(analysis.summary).toContain('GET');
      expect(analysis.summary).toContain('Basic');
    });
  });

  describe('Flow analysis', () => {
    const flowJson = {
      pxObjClass: 'Rule-Obj-Flow',
      pyClassName: 'Work-Cover-Jira',
      pyFlowName: 'MainProcess',
      pyLabel: 'Main Jira Process Flow',
      pyShapes: [
        { pyShapeType: 'Start', pyName: 'Begin' },
        { pyShapeType: 'Assignment', pyName: 'AssignTicket', pyFlowActionName: 'NewAssignment' },
        { pyShapeType: 'Action', pyName: 'Validate', pyFlowActionName: 'ValidateAction', pyWhenCondition: 'NeedsValidation' },
        { pyShapeType: 'End', pyName: 'Done' },
      ],
    };

    const analysis = analyzer.analyzeFlow(flowJson);

    it('extracts route description', () => {
      expect(analysis.summary).toContain('starts at');
      expect(analysis.summary).toContain('ends at');
    });

    it('extracts shape types', () => {
      expect(analysis.shapeTypes).toContain('Start');
      expect(analysis.shapeTypes).toContain('Assignment');
      expect(analysis.shapeTypes).toContain('End');
    });

    it('detects flow action dependencies', () => {
      const faDeps = analysis.dependencies.filter(d => d.type === 'flow_action');
      expect(faDeps.length).toBe(2);
      expect(faDeps[0].target).toBe('NewAssignment');
    });

    it('extracts conditions from branching shapes', () => {
      expect(analysis.conditions.length).toBe(1);
      expect(analysis.conditions[0].field).toBe('NeedsValidation');
    });
  });

  describe('Section analysis', () => {
    const sectionJson = {
      pxObjClass: 'Rule-Obj-Section',
      pyClassName: 'Work-Cover-Jira',
      pyRuleName: 'TicketDetails',
      pyLabel: 'Ticket Details Section',
      pyLayouts: [
        { pyLayoutType: 'dynamic', pyPropertyName: 'pyStatus' },
        { pyLayoutType: 'dynamic', pyPropertyName: 'pyPriority' },
        { pyLayoutType: 'dynamic', pyPropertyName: 'pyOwner' },
      ],
    };

    const analysis = analyzer.analyzeSection(sectionJson);

    it('extracts rendered fields', () => {
      expect(analysis.renderedFields).toContain('pyStatus');
      expect(analysis.renderedFields).toContain('pyPriority');
      expect(analysis.renderedFields).toContain('pyOwner');
      expect(analysis.renderedFields!.length).toBe(3);
    });

    it('detects layout types', () => {
      expect(analysis.layoutTypes).toContain('dynamic');
    });

    it('generates field-focused summary', () => {
      expect(analysis.summary).toContain('3 field(s)');
    });
  });

  describe('Declare analysis', () => {
    const declareJson = {
      pxObjClass: 'Rule-Declare-Expressions',
      pyClassName: 'Work-Cover-Jira',
      pyRuleName: 'TotalAmount',
      pyTargetProperty: '.pyTotalAmount',
      pyExpression: '.pyQuantity * .pyUnitPrice',
    };

    const analysis = analyzer.analyzeDeclare(declareJson);

    it('extracts target property and expression', () => {
      expect(analysis.targetProperty).toBe('.pyTotalAmount');
      expect(analysis.expression).toBe('.pyQuantity * .pyUnitPrice');
    });

    it('generates recalculation summary', () => {
      expect(analysis.summary).toContain('pyTotalAmount');
      expect(analysis.summary).toContain('pyQuantity * .pyUnitPrice');
    });

    it('tracks data flow from inputs to target', () => {
      expect(analysis.dataFlow.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Generic analysis fallback', () => {
    it('produces analysis for unknown types', () => {
      const genericJson = {
        pxObjClass: 'Rule-Admin-Product',
        pyClassName: 'MyApp',
        pyRuleName: 'MyAppProduct',
      };
      const analysis = analyzer.analyze(genericJson);
      expect(analysis.ruleType).toBe('Rule-Admin-Product');
      expect(analysis.name).toBe('MyAppProduct');
      expect(analysis.summary).toContain('Rule-Admin-Product');
    });
  });

  describe('Generic analysis with class def', () => {
    it('analyzes with class definition metadata', () => {
      const json = {
        pxObjClass: 'Rule-Connect-REST',
        pyClassName: 'MyApp',
        pyRuleName: 'MyConnector',
        pyBaseURL: 'https://api.example.com',
      };
      const classDef: PegaClassDefinition = {
        pxObjClass: 'Rule-Connect-REST',
        description: 'REST connector configuration',
        properties: [
          { name: 'pyBaseURL', type: 'string', required: true, isSystem: false, isReference: false, description: 'Base URL' },
        ],
        children: [],
      };
      const analysis = analyzer.analyzeGeneric(json, classDef);
      expect(analysis.ruleType).toBe('Rule-Connect-REST');
      expect(analysis.name).toBe('MyConnector');
      expect(analysis.summary).toContain('REST connector');
    });
  });

  it('dispatches analysis by type correctly', () => {
    expect(analyzer.analyze({ pxObjClass: 'Rule-Obj-Activity', pyActivityName: 'A' }).summary).toContain('0 step(s)');
    expect(analyzer.analyze({ pxObjClass: 'Rule-Obj-Model', pyModelName: 'B' }).summary).toContain('0 action(s)');
    expect(analyzer.analyze({ pxObjClass: 'Rule-Obj-Flow', pyFlowName: 'C' }).summary).toContain('0 shape(s)');
    expect(analyzer.analyze({ pxObjClass: 'Rule-Declare-DecisionTable', pyLabel: 'D' }).summary).toContain('0 row(s)');
    expect(analyzer.analyze({ pxObjClass: 'Rule-Connect-REST', pyRuleName: 'E' }).summary).toContain('Rule-Connect-REST');
    expect(analyzer.analyze({ pxObjClass: 'Rule-Declare-Expressions', pyRuleName: 'F' }).summary).toContain('Rule-Declare-Expressions');
  });
});

describe('PegaRuleSimulator', () => {
  const simulator = new PegaRuleSimulator();

  describe('Expression evaluation', () => {
    it('evaluates a simple property expression', () => {
      const context = new PegaClipboardContext({
        pyWorkPage: {
          Status: { type: 'Text', value: 'Open' },
          Amount: { type: 'Number', value: 100 },
        },
      }, 'pyWorkPage');
      const result = simulator.evaluateExpression('.Amount', context);
      expect(result).toBe(100);
    });

    it('evaluates a text property via expression', () => {
      const context = new PegaClipboardContext({
        pyWorkPage: {
          Status: { type: 'Text', value: 'Open' },
        },
      }, 'pyWorkPage');
      const result = simulator.evaluateExpression('.Status', context);
      expect(result).toBe('Open');
    });
  });

  describe('Activity simulation', () => {
    const activityJson = {
      pxObjClass: 'Rule-Obj-Activity',
      pyActivityName: 'ResolveTicket',
      steps: [
        { pyStepNum: '1', pyMethod: 'Call', pyMethodParameters: 'Work-Cover-Jira.ValidateData', pyLabel: 'Validate Input' },
        { pyStepNum: '2', pyMethod: 'Property-Set', pyMethodParameters: '.pyStatus', pyLabel: 'Set Status' },
        { pyStepNum: '3', pyMethod: 'Obj-Save', pyMethodParameters: 'Work-Cover-Jira', pyLabel: 'Save to DB' },
      ],
    };

    it('simulates an activity with multiple steps', () => {
      const context = new PegaClipboardContext({ pyWorkPage: { Status: { type: 'Text', value: 'New' } } }, 'pyWorkPage');
      const result = simulator.simulateActivity(activityJson, context);
      expect(result.success).toBe(true);
      expect(result.trace.length).toBeGreaterThanOrEqual(5);
      expect(result.errors).toHaveLength(0);
      const actions = result.trace.map(t => t.action);
      expect(actions).toContain('call');
      expect(actions).toContain('set');
      expect(actions).toContain('db_write');
      expect(actions).toContain('complete');
    });

    it('skips steps when when-condition is false', () => {
      const jsonWithCondition = {
        pxObjClass: 'Rule-Obj-Activity',
        pyActivityName: 'ConditionalActivity',
        steps: [
          { pyStepNum: '1', pyMethod: 'Property-Set', pyMethodParameters: '.pyStatus', pyLabel: 'Set', pyWhenCondition: 'false' },
          { pyStepNum: '2', pyMethod: 'Property-Set', pyMethodParameters: '.pyName', pyLabel: 'Set Name' },
        ],
      };
      const context = new PegaClipboardContext({ pyWorkPage: {} }, 'pyWorkPage');
      const result = simulator.simulateActivity(jsonWithCondition, context);
      expect(result.success).toBe(true);
      const actions = result.trace.map(t => t.action);
      expect(actions).toContain('skip');
      expect(actions).toContain('set');
    });
  });

  describe('Data Transform simulation', () => {
    const dtJson = {
      pxObjClass: 'Rule-Obj-Model',
      pyModelName: 'InitializeTicket',
      pyActions: [
        { pyActionType: 'Set', pyTarget: '.pyStatus', pySource: 'New' },
        { pyActionType: 'Apply Data Transform', pyTarget: 'SetDefaultStatus' },
        { pyActionType: 'Set', pyTarget: '.pyPriority', pySource: '5', pyWhenCondition: 'false' },
      ],
    };

    it('simulates a data transform with actions', () => {
      const context = new PegaClipboardContext({ pyWorkPage: {} }, 'pyWorkPage');
      const result = simulator.simulateDataTransform(dtJson, context);
      expect(result.success).toBe(true);
      expect(result.trace.length).toBeGreaterThanOrEqual(5);
      const actions = result.trace.map(t => t.action);
      expect(actions).toContain('set');
      expect(actions).toContain('apply_transform');
    });

    it('skips conditional actions when condition is false', () => {
      const context = new PegaClipboardContext({ pyWorkPage: {} }, 'pyWorkPage');
      const result = simulator.simulateDataTransform(dtJson, context);
      const actions = result.trace.map(t => t.action);
      expect(actions).toContain('skip');
    });
  });

  describe('Flow simulation', () => {
    const flowJson = {
      pxObjClass: 'Rule-Obj-Flow',
      pyFlowName: 'MainProcess',
      pyShapes: [
        { pyShapeType: 'Start', pyName: 'Begin' },
        { pyShapeType: 'Assignment', pyName: 'AssignTicket', pyFlowActionName: 'NewAssignment' },
        { pyShapeType: 'End', pyName: 'Done' },
      ],
    };

    it('simulates a flow from start to end', () => {
      const context = new PegaClipboardContext({ pyWorkPage: {} }, 'pyWorkPage');
      const result = simulator.simulateFlow(flowJson, context);
      expect(result.success).toBe(true);
      expect(result.trace.length).toBeGreaterThanOrEqual(4);
      const detail = result.trace.map(t => t.detail).join(' ');
      expect(detail).toContain('END');
    });

    it('reports error for flow with no shapes', () => {
      const context = new PegaClipboardContext({ pyWorkPage: {} }, 'pyWorkPage');
      const result = simulator.simulateFlow({ pxObjClass: 'Rule-Obj-Flow', pyFlowName: 'Empty' }, context);
      expect(result.success).toBe(false);
      expect(result.errors).toContain('Flow has no shapes defined');
    });
  });

  describe('Decision Table simulation', () => {
    const decisionJson = {
      pxObjClass: 'Rule-Declare-DecisionTable',
      pyLabel: 'PriorityDecision',
      pyDecisionTableRows: [
        { pyCondition: 'pyUrgency > 80', pyResult: 'Critical' },
        { pyCondition: 'pyUrgency > 50', pyResult: 'High' },
      ],
    };

    it('simulates a decision table and traces evaluation path', () => {
      const context = new PegaClipboardContext({
        pyWorkPage: { pyUrgency: { type: 'Number', value: 90 } },
      }, 'pyWorkPage');
      const result = simulator.simulateDecisionTable(decisionJson, context);
      expect(result.success).toBe(true);
      const detail = result.trace.map(t => t.detail).join(' ');
      expect(detail).toContain('matched');
    });

    it('handles no-match scenario gracefully', () => {
      const context = new PegaClipboardContext({
        pyWorkPage: { Urgency: { type: 'Number', value: 10 } },
      }, 'pyWorkPage');
      const result = simulator.simulateDecisionTable(decisionJson, context);
      expect(result.success).toBe(true);
      const detail = result.trace.map(t => t.detail).join(' ');
      expect(detail).toContain('No matching row');
    });
  });

  describe('dispatch simulate', () => {
    it('routes requests by pxObjClass', async () => {
      const activityResult = await simulator.simulate({
        pxObjClass: 'Rule-Obj-Activity',
        json: {
          pyActivityName: 'Test',
          steps: [{ pyStepNum: '1', pyMethod: 'Property-Set', pyMethodParameters: '.x', pyLabel: 'Set X' }],
        },
        inputClipboard: { pyWorkPage: { x: { type: 'Text', value: '' } } },
      });
      expect(activityResult.success).toBe(true);

      const unsupportedResult = await simulator.simulate({
        pxObjClass: 'Rule-Obj-Unknown',
        json: { pyRuleName: 'UnknownRule' },
      });
      expect(unsupportedResult.success).toBe(false);
      expect(unsupportedResult.errors[0]).toContain('Unsupported rule type');
    });
  });

  describe('Integration: Analyzer output used to configure Simulator', () => {
    it('SemanticAnalyzer output can inform simulator configuration', async () => {
      const analyzer = new PegaSemanticAnalyzer();
      const analysis = analyzer.analyze({
        pxObjClass: 'Rule-Obj-Activity',
        pyActivityName: 'CalculateTotal',
        pyClassName: 'Order',
        steps: [
          { pyStepNum: '1', pyMethod: 'Property-Set', pyMethodParameters: '.pyTotal', pyLabel: 'Set Total' },
          { pyStepNum: '2', pyMethod: 'Obj-Save', pyMethodParameters: 'Order', pyLabel: 'Save Order' },
        ],
      });

      expect(analysis.steps).toBe(2);
      expect(analysis.sideEffects.some(s => s.type === 'page_update')).toBe(true);
      expect(analysis.sideEffects.some(s => s.type === 'db_write')).toBe(true);

      const context = new PegaClipboardContext({ pyWorkPage: { Total: { type: 'Number', value: 0 } } }, 'pyWorkPage');
      const result = simulator.simulateActivity(
        {
          pxObjClass: 'Rule-Obj-Activity',
          pyActivityName: 'CalculateTotal',
          steps: [
            { pyStepNum: '1', pyMethod: 'Property-Set', pyMethodParameters: '.pyTotal', pyLabel: 'Set Total' },
            { pyStepNum: '2', pyMethod: 'Obj-Save', pyMethodParameters: 'Order', pyLabel: 'Save Order' },
          ],
        },
        context,
      );

      expect(result.success).toBe(true);
      expect(result.trace.filter(t => t.action === 'set')).toHaveLength(1);
      expect(result.trace.filter(t => t.action === 'db_write')).toHaveLength(1);
    });
  });

  describe('Error handling: invalid input', () => {
    it('handles empty activity gracefully', () => {
      const context = new PegaClipboardContext({}, 'pyWorkPage');
      const result = simulator.simulateActivity({ pxObjClass: 'Rule-Obj-Activity' }, context);
      expect(result.success).toBe(true);
      expect(result.trace.length).toBeGreaterThanOrEqual(2);
    });

    it('handles invalid JSON with missing steps gracefully', () => {
      const context = new PegaClipboardContext({}, 'pyWorkPage');
      const result = simulator.simulateActivity(
        { pxObjClass: 'Rule-Obj-Activity', pyActivityName: null },
        context,
      );
      expect(result.success).toBe(true);
    });

    it('handles unsupported rule type gracefully', async () => {
      const result = await simulator.simulate({
        pxObjClass: 'Rule-Obj-File',
        json: { pyRuleName: 'MyFile' },
      });
      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });
});
