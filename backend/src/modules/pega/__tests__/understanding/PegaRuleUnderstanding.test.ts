import { describe, it, expect, beforeEach } from 'vitest';
import { PegaRuleUnderstandingService } from '../../understanding/PegaRuleUnderstandingService.js';
import type { PegaRuleUnderstanding } from '../../understanding/PegaRuleUnderstandingService.js';
import { PegaSchemaInferrer } from '../../inference/PegaSchemaInferrer.js';
import { PegaFieldDocumentor } from '../../inference/PegaFieldDocumentor.js';
import { PegaSemanticAnalyzer } from '../../semantic/PegaSemanticAnalyzer.js';
import { PegaRuleSimulator } from '../../semantic/PegaRuleSimulator.js';
import { PegaReferenceExtractor } from '../../references/PegaReferenceExtractor.js';
import { PegaMetaModelRegistry } from '../../metamodel/PegaMetaModelRegistry.js';
import { PegaMetaModelCompiler } from '../../metamodel/PegaMetaModelCompiler.js';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const schemasDir = path.resolve(__dirname, '../../schemas');

// ── Inline Test Fixtures ──────────────────────────────────────────────

const ACTIVITY_FIXTURE = {
  pxObjClass: 'Rule-Obj-Activity',
  pyClassName: 'Work-Order',
  pyActivityName: 'CalculateOrderTotal',
  pyLabel: 'Calculate Order Total with Discounts',
  pyDescription: 'Calculates the total order amount applying tier-based discounts',
  steps: [
    { pyStepNum: '1', pyMethod: 'Property-Set', pyMethodParameters: '.pyTotal', pyLabel: 'Init Total' },
    { pyStepNum: '2', pyMethod: 'Call', pyMethodParameters: 'Work-Order.CalculateDiscount', pyLabel: 'Calc Discount' },
    { pyStepNum: '3', pyMethod: 'Property-Set', pyMethodParameters: '.pyGrandTotal', pyLabel: 'Apply Grand Total' },
    { pyStepNum: '4', pyMethod: 'Obj-Save', pyMethodParameters: 'Work-Order', pyLabel: 'Save Order' },
  ],
};

const DATA_TRANSFORM_FIXTURE = {
  pxObjClass: 'Rule-Obj-Model',
  pyClassName: 'Work-Order',
  pyModelName: 'InitializeOrderData',
  pyLabel: 'Initialize Order Data Transform',
  pyActions: [
    { pyActionType: 'Set', pyTarget: '.OrderDate', pySource: '.CurrentDate' },
    { pyActionType: 'Set', pyTarget: '.Status', pySource: '.DefaultStatus' },
    { pyActionType: 'Apply Data Transform', pyTarget: 'SetCustomerDefaults' },
  ],
};

const DECISION_TABLE_FIXTURE = {
  pxObjClass: 'Rule-Declare-DecisionTable',
  pyClassName: 'Work-Order',
  pyLabel: 'DetermineDiscountTable',
  pyPropertyEvaluated: '.OrderTotal',
  pyDecisionTableRows: [
    { pyCondition: '.OrderTotal > 1000', pyResult: '10%', pyPriority: 1 },
    { pyCondition: '.OrderTotal > 500', pyResult: '5%', pyPriority: 2 },
    { pyCondition: 'true', pyResult: '0%', pyPriority: 3 },
  ],
  pyReturnActions: [{ pyTransformName: 'ApplyDiscount' }],
};

const FLOW_FIXTURE = {
  pxObjClass: 'Rule-Obj-Flow',
  pyClassName: 'Work-Order',
  pyFlowName: 'OrderProcessingFlow',
  pyLabel: 'Main Order Processing Flow',
  pyShapes: [
    { pyShapeType: 'Start', pyName: 'Begin' },
    { pyShapeType: 'Action', pyFlowActionName: 'ValidateOrder', pyWhenCondition: 'IsOrderValid' },
    { pyShapeType: 'Decision', pyWhenCondition: 'IsApproved' },
    { pyShapeType: 'Action', pyFlowActionName: 'ProcessPayment' },
    { pyShapeType: 'End', pyName: 'Complete' },
  ],
};

const SIMPLE_RULE_FIXTURE = {
  pxObjClass: 'Rule-Obj-When',
  pyClassName: 'Work-Order',
  pyRuleName: 'IsHighPriority',
  pyLabel: 'Is High Priority Check',
};

const UNKNOWN_RULE_FIXTURE = {
  pxObjClass: 'Rule-Obj-CustomAnalyzer',
  pyClassName: 'Work-Order',
  pyRuleName: 'CustomAnalysis',
  pyThreshold: '100',
  pyTransformName: 'NormalizeData',
};

let unknownCounter = 0;
function makeUniqueUnknownFixture(): Record<string, unknown> {
  unknownCounter++;
  const cls = `Rule-Obj-Custom-${unknownCounter}`;
  return {
    pxObjClass: cls,
    pyClassName: 'Work-Order',
    pyRuleName: `CustomAnalysis${unknownCounter}`,
    pyThreshold: String(unknownCounter * 100),
    pyTransformName: 'NormalizeData',
  };
}

const EMPTY_JSON = {};

// ── Service Factory ───────────────────────────────────────────────────

function createService(): PegaRuleUnderstandingService {
  const inferrer = new PegaSchemaInferrer();
  const documentor = new PegaFieldDocumentor(inferrer);
  const analyzer = new PegaSemanticAnalyzer();
  const simulator = new PegaRuleSimulator();
  const extractor = new PegaReferenceExtractor();
  const registry = PegaMetaModelRegistry.getInstance();
  const compiler = new PegaMetaModelCompiler(registry);
  return new PegaRuleUnderstandingService(
    inferrer, documentor, analyzer, simulator, extractor, registry, compiler,
  );
}

describe('PegaRuleUnderstandingService', () => {
  let service: PegaRuleUnderstandingService;

  beforeEach(async () => {
    const registry = PegaMetaModelRegistry.getInstance();
    if (!registry.isKnownClass('@baseclass')) {
      await registry.initialize(schemasDir);
    }
    service = createService();
  });

  // ── Basic Rule Types ──────────────────────────────────────────────────

  describe('Understanding basic rule types', () => {
    it('Understand Activity — returns correct pxObjClass, name, className, fqn', async () => {
      const u = await service.understand(ACTIVITY_FIXTURE);
      expect(u.pxObjClass).toBe('Rule-Obj-Activity');
      expect(u.name).toBe('CalculateOrderTotal');
      expect(u.className).toBe('Work-Order');
      expect(u.fqn).toBe('Rule-Obj-Activity:Work-Order:CalculateOrderTotal');
    });

    it('Understand DataTransform — returns correct summary', async () => {
      const u = await service.understand(DATA_TRANSFORM_FIXTURE);
      expect(u.pxObjClass).toBe('Rule-Obj-Model');
      expect(u.name).toBe('InitializeOrderData');
      expect(u.semantics.summary).toContain('data transform');
    });

    it('Understand DecisionTable — returns conditions and results', async () => {
      const u = await service.understand(DECISION_TABLE_FIXTURE);
      expect(u.pxObjClass).toBe('Rule-Declare-DecisionTable');
      expect(u.semantics.conditions.length).toBeGreaterThanOrEqual(1);
      expect(u.semantics.summary).toContain('DetermineDiscountTable');
    });

    it('Understand Flow — returns route description', async () => {
      const u = await service.understand(FLOW_FIXTURE);
      expect(u.pxObjClass).toBe('Rule-Obj-Flow');
      expect(u.name).toBe('OrderProcessingFlow');
      expect(u.semantics.summary).toContain('starts at');
    });
  });

  // ── Schema Integration ────────────────────────────────────────────────

  describe('Schema integration', () => {
    it('Schema field documentation is included in result', async () => {
      const u = await service.understand(ACTIVITY_FIXTURE);
      expect(u.schema.fieldDocs).toBeTruthy();
      expect(u.schema.fieldDocs.length).toBeGreaterThan(0);
      expect(u.schema.fieldDocs).toContain('Rule Type:');
      expect(u.schema.fieldDocs).toContain('Fields:');
    });

    it('Inferred flag is false for known types, true for unknown types', async () => {
      const known = await service.understand(ACTIVITY_FIXTURE);
      expect(known.schema.inferred).toBe(false);

      const unknown = await service.understand(UNKNOWN_RULE_FIXTURE);
      expect(unknown.schema.inferred).toBe(true);
    });

    it('ensureSchema is called and inferred schemas are available as classDefinition', async () => {
      const u = await service.understand(ACTIVITY_FIXTURE);
      expect(u.schema.classDefinition).toBeDefined();
      expect(u.schema.classDefinition.pxObjClass).toBe('Rule-Obj-Activity');
      expect(Array.isArray(u.schema.classDefinition.properties)).toBe(true);
    });
  });

  // ── Semantic Analysis Integration ────────────────────────────────────

  describe('Semantic analysis integration', () => {
    it('Semantic summary is included in result', async () => {
      const u = await service.understand(ACTIVITY_FIXTURE);
      expect(u.semantics.summary).toBeTruthy();
      expect(u.semantics.summary).toContain('Calculate Order Total');
    });

    it('Semantic intent is included in result', async () => {
      const u = await service.understand(ACTIVITY_FIXTURE);
      expect(u.semantics.intent).toBeTruthy();
    });

    it('Side effects are included in result', async () => {
      const u = await service.understand(ACTIVITY_FIXTURE);
      expect(u.semantics.sideEffects.length).toBeGreaterThan(0);
      const sets = u.semantics.sideEffects.filter(s => s.type === 'page_update');
      expect(sets.length).toBeGreaterThanOrEqual(2);
    });

    it('Data flow is included in result', async () => {
      const u = await service.understand(DATA_TRANSFORM_FIXTURE);
      expect(u.semantics.dataFlow.length).toBeGreaterThan(0);
      const dataEntry = u.semantics.dataFlow[0];
      expect(dataEntry.input).toBeDefined();
      expect(dataEntry.output).toBeDefined();
    });
  });

  // ── Reference Integration ────────────────────────────────────────────

  describe('Reference integration', () => {
    it('Dependencies from ReferenceExtractor are included', async () => {
      const u = await service.understand(ACTIVITY_FIXTURE);
      expect(u.dependencies.length).toBeGreaterThan(0);
      const calls = u.dependencies.filter(d => d.relation === 'calls');
      expect(calls.length).toBeGreaterThanOrEqual(1);
      expect(calls.some(d => d.name === 'CalculateDiscount')).toBe(true);
    });

    it('Empty dependencies when rule has no references', async () => {
      const simpleRule = {
        pxObjClass: 'Rule-Obj-Activity',
        pyClassName: 'Work-Order',
        pyActivityName: 'NoOpActivity',
        steps: [] as never[],
      };
      const u = await service.understand(simpleRule);
      expect(u.dependencies).toBeDefined();
      expect(Array.isArray(u.dependencies)).toBe(true);
    });
  });

  // ── Simulation ────────────────────────────────────────────────────────

  describe('Simulation', () => {
    it('Simulation result is included when options.simulate is true', async () => {
      const u = await service.understand(ACTIVITY_FIXTURE, { simulate: true });
      expect(u.simulation).not.toBeNull();
      expect(u.simulation!.result).not.toBeNull();
    });

    it('Simulation is null when options.simulate is false (default)', async () => {
      const u = await service.understand(ACTIVITY_FIXTURE);
      expect(u.simulation).toBeNull();
    });

    it('Simulation works with custom input', async () => {
      const customInput = {
        pyWorkPage: {
          pyTotal: 1000,
          pyCustomerTier: 'Gold',
        },
      };
      const u = await service.understand(ACTIVITY_FIXTURE, {
        simulate: true,
        simulateInput: customInput,
      });
      expect(u.simulation).not.toBeNull();
      expect(u.simulation!.input).toEqual(customInput);
    });
  });

  // ── Prompt Context ────────────────────────────────────────────────────

  describe('Prompt context', () => {
    it('toPromptContext includes rule identity line', async () => {
      const u = await service.understand(ACTIVITY_FIXTURE);
      expect(u.promptContext).toContain('Rule Understanding');
      expect(u.promptContext).toContain('CalculateOrderTotal');
    });

    it('toPromptContext includes schema section', async () => {
      const u = await service.understand(ACTIVITY_FIXTURE);
      expect(u.promptContext).toContain('Schema');
      expect(u.promptContext).toContain('Rule Type:');
    });

    it('toPromptContext includes semantic analysis section', async () => {
      const u = await service.understand(ACTIVITY_FIXTURE);
      expect(u.promptContext).toContain('Semantic Analysis');
      expect(u.promptContext).toContain('Summary:');
    });

    it('toPromptContext includes dependencies section', async () => {
      const u = await service.understand(ACTIVITY_FIXTURE);
      expect(u.promptContext).toContain('Dependencies');
      expect(u.promptContext).toContain('CalculateDiscount');
    });

    it('toPromptContext includes simulation section (when present)', async () => {
      const u = await service.understand(ACTIVITY_FIXTURE, { simulate: true });
      expect(u.promptContext).toContain('Simulation');
      expect(u.promptContext).toContain('Step');
    });

    it('toPromptContext excludes simulation section (when absent)', async () => {
      const u = await service.understand(ACTIVITY_FIXTURE);
      expect(u.promptContext).not.toContain('Simulation');
    });

    it('toPromptContext is non-empty string', async () => {
      const u = await service.understand(SIMPLE_RULE_FIXTURE);
      expect(u.promptContext).toBeTruthy();
      expect(u.promptContext.length).toBeGreaterThan(50);
    });
  });

  // ── Edge Cases ─────────────────────────────────────────────────────────

  describe('Edge cases', () => {
    it('Understand handles empty JSON gracefully', async () => {
      const u = await service.understand(EMPTY_JSON);
      expect(u).toBeDefined();
      expect(u.pxObjClass).toBe('Rule-Obj-Activity');
      expect(u.name).toBe('Unnamed');
      expect(u.fqn).toBe('Rule-Obj-Activity:@baseclass:Unnamed');
    });

    it('Understand handles unknown rule type (triggers inference)', async () => {
      const fixture = makeUniqueUnknownFixture();
      const u = await service.understand(fixture);
      expect(u.schema.inferred).toBe(true);
      expect(u.schema.classDefinition.properties.length).toBeGreaterThan(0);
      const hasThreshold = u.schema.classDefinition.properties.some(
        p => p.name === 'pyThreshold',
      );
      expect(hasThreshold).toBe(true);
    });

    it('Understand handles missing pxObjClass (uses default)', async () => {
      const noClass = {
        pyClassName: 'Work-Order',
        pyRuleName: 'DefaultRule',
        pyLabel: 'Default Label',
      };
      const u = await service.understand(noClass);
      expect(u.pxObjClass).toBe('Rule-Obj-Activity');
      expect(u.name).toBe('DefaultRule');
    });

    it('Integration: understand → toPromptContext → LLM-ready string', async () => {
      const u = await service.understand(ACTIVITY_FIXTURE);
      const ctx = u.promptContext;
      expect(ctx).toContain('╔');
      expect(ctx).toContain('║');
      expect(ctx).toContain('╚');
      expect(ctx).toContain('Schema');
      expect(ctx).toContain('Semantic Analysis');
      expect(ctx).toContain('Dependencies');
      expect(u.schema.fieldDocs.length).toBeGreaterThan(0);
    });

    it('Integration: multiple understands do not interfere', async () => {
      const u1 = await service.understand(ACTIVITY_FIXTURE);
      const u2 = await service.understand(DATA_TRANSFORM_FIXTURE);
      expect(u1.name).toBe('CalculateOrderTotal');
      expect(u2.name).toBe('InitializeOrderData');
      expect(u1.fqn).not.toBe(u2.fqn);
      expect(u1.semantics.summary).toContain('activity');
      expect(u2.semantics.summary).toContain('data transform');
    });

    it('toPromptContext formatting includes box-drawing characters for identity', async () => {
      const ctx = service.toPromptContext({
        pxObjClass: 'Rule-Obj-Activity',
        name: 'TestRule',
        className: 'Work-Test',
        fqn: 'Rule-Obj-Activity:Work-Test:TestRule',
        schema: {
          classDefinition: { pxObjClass: 'Rule-Obj-Activity', properties: [], children: [] },
          fieldDocs: 'Rule Type: Rule-Obj-Activity\nFields:\n  pyTest (string, optional) — Test field',
          inferred: false,
        },
        semantics: {
          summary: 'Test summary',
          intent: 'Test intent',
          sideEffects: [],
          dataFlow: [],
          conditions: [],
        },
        dependencies: [],
        dependencyGraph: '',
        simulation: null,
        promptContext: '',
      });
      expect(ctx.startsWith('╔')).toBe(true);
      expect(ctx).toContain('║');
      expect(ctx).toContain('╚');
      expect(ctx).toContain('║  Rule Understanding: TestRule');
      expect(ctx).toContain('║  Type: Rule-Obj-Activity');
      expect(ctx).toContain('║  Class: Work-Test');
    });

    it('dependencyGraph text representation is non-empty when deps exist', async () => {
      const u = await service.understand(ACTIVITY_FIXTURE);
      expect(u.dependencyGraph.length).toBeGreaterThan(0);
      expect(u.dependencyGraph).toContain('CalculateDiscount');
    });

    it('dependencyGraph empty when no deps present', async () => {
      const noDeps = {
        pxObjClass: 'Rule-Obj-Activity',
        pyClassName: 'Work-Order',
        pyActivityName: 'EmptyActivity',
        pyLabel: 'Empty',
      };
      const u = await service.understand(noDeps);
      expect(u.dependencyGraph).toBe('');
    });

    it('toPromptContext includes dependency graph in dependencies section', async () => {
      const u = await service.understand(ACTIVITY_FIXTURE);
      expect(u.promptContext).toContain('Graph:');
    });

    it('toPromptContext conditions section shown when conditions exist', async () => {
      const u = await service.understand(DECISION_TABLE_FIXTURE);
      if (u.semantics.conditions.length > 0) {
        expect(u.promptContext).toContain('Conditions:');
        expect(u.promptContext).toContain('WHEN');
      }
    });

    it('Simulation trace contains step entries', async () => {
      const u = await service.understand(ACTIVITY_FIXTURE, { simulate: true });
      expect(u.simulation).not.toBeNull();
      expect(u.simulation!.trace.length).toBeGreaterThan(0);
      expect(u.simulation!.trace[0].step).toBeDefined();
      expect(u.simulation!.trace[0].action).toBeDefined();
    });

    it('Simulation with DataTransform produces trace', async () => {
      const u = await service.understand(DATA_TRANSFORM_FIXTURE, { simulate: true });
      expect(u.simulation).not.toBeNull();
      expect(u.simulation!.trace.length).toBeGreaterThan(0);
      const startTrace = u.simulation!.trace.find(t => t.action === 'start');
      expect(startTrace).toBeDefined();
      expect(startTrace!.detail).toContain('InitializeOrderData');
    });

    it('Simulation with DecisionTable produces trace', async () => {
      const u = await service.understand(DECISION_TABLE_FIXTURE, { simulate: true });
      expect(u.simulation).not.toBeNull();
      expect(u.simulation!.trace.length).toBeGreaterThan(0);
    });

    it('Simulation with Flow produces trace', async () => {
      const u = await service.understand(FLOW_FIXTURE, { simulate: true });
      expect(u.simulation).not.toBeNull();
      expect(u.simulation!.trace.length).toBeGreaterThan(0);
    });

    it('Unknown rule type still builds complete understanding', async () => {
      const fixture = makeUniqueUnknownFixture();
      const u = await service.understand(fixture);
      expect(u.schema.inferred).toBe(true);
      expect(u.schema.fieldDocs).toBeTruthy();
      expect(u.semantics.summary).toBeTruthy();
      expect(u.dependencies).toBeDefined();
    });

    it('toPromptContext handles simulation with errors', async () => {
      const broken = {
        pxObjClass: 'Rule-Obj-Activity',
        pyClassName: 'Work-Test',
        pyActivityName: 'BrokenRule',
        steps: [
          { pyStepNum: '1', pyMethod: 'Call', pyMethodParameters: 'Work-Test.NonExistent' },
        ],
      };
      const u = await service.understand(broken, { simulate: true });
      expect(u.simulation).not.toBeNull();
      expect(u.promptContext).toContain('Simulation');
    });
  });
});
