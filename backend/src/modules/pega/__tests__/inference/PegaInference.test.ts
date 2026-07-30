import { describe, it, expect, beforeEach } from 'vitest';
import { PegaSchemaInferrer, PegaFieldDocumentor } from '../../inference/index.js';
import { PegaMetaModelRegistry, PegaMetaModelLoader, PegaMetaModelCompiler } from '../../metamodel/index.js';
import { MOCK_ACTIVITY_JSON, MOCK_DATA_TRANSFORM_JSON, MOCK_DECISION_TABLE_JSON, MOCK_OPERATOR_DATA_JSON } from '../fixtures/pega-samples.js';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const schemasDir = path.resolve(__dirname, '../../schemas');

describe('PegaSchemaInferrer', () => {
  let inferrer: PegaSchemaInferrer;
  let registry: PegaMetaModelRegistry;

  beforeEach(async () => {
    inferrer = new PegaSchemaInferrer();
    registry = PegaMetaModelRegistry.getInstance();
    if (!registry.isKnownClass('@baseclass')) {
      await registry.initialize(schemasDir);
    }
  });

  describe('inferFromRule', () => {
    it('infers pxObjClass correctly from JSON', () => {
      const def = inferrer.inferFromRule('Rule-Obj-Activity', MOCK_ACTIVITY_JSON);
      expect(def.pxObjClass).toBe('Rule-Obj-Activity');
    });

    it('returns properties and children from sample JSON', () => {
      const def = inferrer.inferFromRule('Rule-Obj-Activity', MOCK_ACTIVITY_JSON);
      expect(def.properties.length).toBeGreaterThan(0);
      expect(def.children.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('inferBaseClass', () => {
    it('infers baseClass for Rule-Obj-Activity → Rule-Obj-', () => {
      const base = inferrer.inferBaseClass('Rule-Obj-Activity', registry);
      expect(base).toBe('Rule-Obj-');
    });

    it('infers baseClass for Rule-Obj-FooBar → Rule-Obj-', () => {
      const base = inferrer.inferBaseClass('Rule-Obj-FooBar', registry);
      expect(base).toBe('Rule-Obj-');
    });

    it('infers baseClass for Rule-Connect-REST → Rule-Connect-', () => {
      const base = inferrer.inferBaseClass('Rule-Connect-REST', registry);
      expect(base).toBe('Rule-Connect-');
    });

    it('infers baseClass for Rule-HTML-Section → Rule-HTML-', () => {
      const base = inferrer.inferBaseClass('Rule-HTML-Section', registry);
      expect(base).toBe('Rule-HTML-');
    });

    it('infers baseClass by walking up hierarchy when intermediate missing', () => {
      const base = inferrer.inferBaseClass('Rule-X-Y', registry);
      expect(base).toBe('Rule-');
    });

    it('infers baseClass for unknown → @baseclass', () => {
      const base = inferrer.inferBaseClass('Something-Completely-Unknown', registry);
      expect(base).toBe('@baseclass');
    });

    it('returns empty string for @baseclass itself', () => {
      const base = inferrer.inferBaseClass('@baseclass', registry);
      expect(base).toBe('');
    });
  });

  describe('inferProperties', () => {
    it('infers properties with correct types (string, number, boolean, ref)', () => {
      const json: Record<string, unknown> = {
        pyLabel: 'My Label',
        pyCount: 42,
        pyActive: true,
        pyClassName: 'Work-Cover',
        pyActivityName: 'DoSomething',
      };
      const props = inferrer.inferProperties(json);
      const label = props.find(p => p.name === 'pyLabel');
      const count = props.find(p => p.name === 'pyCount');
      const active = props.find(p => p.name === 'pyActive');
      const className = props.find(p => p.name === 'pyClassName');
      const activityName = props.find(p => p.name === 'pyActivityName');

      expect(label?.type).toBe('string');
      expect(count?.type).toBe('number');
      expect(active?.type).toBe('boolean');
      expect(className).toBeUndefined();
      expect(activityName).toBeDefined();
      expect(activityName!.type).toBe('ref');
    });

    it('marks Name-ending fields as isReference', () => {
      const json: Record<string, unknown> = {
        pyTemplateName: 'MyTemplate',
        pySourceClass: 'Work-',
        pyLabel: 'Hello',
      };
      const props = inferrer.inferProperties(json);
      const templateName = props.find(p => p.name === 'pyTemplateName');
      const sourceClass = props.find(p => p.name === 'pySourceClass');
      const label = props.find(p => p.name === 'pyLabel');

      expect(templateName?.isReference).toBe(true);
      expect(templateName?.type).toBe('ref');
      expect(sourceClass?.isReference).toBe(true);
      expect(sourceClass?.type).toBe('ref');
      expect(label?.isReference).toBe(false);
    });

    it('marks Class-ending fields as isReference', () => {
      const json: Record<string, unknown> = {
        pyTargetClass: 'Work-Cover',
        pySourceClass: 'Data-Admin',
        pyDescription: 'some text',
      };
      const props = inferrer.inferProperties(json);
      const tc = props.find(p => p.name === 'pyTargetClass');
      const sc = props.find(p => p.name === 'pySourceClass');
      expect(tc?.isReference).toBe(true);
      expect(sc?.isReference).toBe(true);
    });

    it('marks Profile-ending fields as isReference', () => {
      const json: Record<string, unknown> = {
        pyAuthProfile: 'MyProfile',
        pyLabel: 'test',
      };
      const props = inferrer.inferProperties(json);
      const profile = props.find(p => p.name === 'pyAuthProfile');
      expect(profile?.isReference).toBe(true);
      expect(profile?.type).toBe('ref');
    });

    it('detects children from array fields', () => {
      const json: Record<string, unknown> = {
        pyLabel: 'test',
        steps: [
          { pxObjClass: 'Embedded-Step', pyStepNum: '1', pyMethod: 'Call' },
          { pxObjClass: 'Embedded-Step', pyStepNum: '2', pyMethod: 'Call' },
        ],
      };
      const children = inferrer.inferChildren(json);
      const stepsChild = children.find(c => c.name === 'steps');
      expect(stepsChild).toBeDefined();
      expect(stepsChild!.childType).toBe('Embedded-Step');
      expect(stepsChild!.arrayType).toBe('array');
    });

    it('does not produce duplicate properties', () => {
      const json: Record<string, unknown> = { pyLabel: 'A' };
      Object.defineProperty(json, 'pyLabel', { value: 'B', enumerable: true, writable: true, configurable: true });
      const props = inferrer.inferProperties(json);
      const labels = props.filter(p => p.name === 'pyLabel');
      expect(labels.length).toBeLessThanOrEqual(1);
    });

    it('detects reference from dotted value like class.method', () => {
      const json: Record<string, unknown> = {
        pyMethodCall: 'Work-Cover.SomeActivity',
        pyLabel: 'Simple Label',
      };
      const props = inferrer.inferProperties(json);
      const methodCall = props.find(p => p.name === 'pyMethodCall');
      expect(methodCall).toBeDefined();
      expect(methodCall!.type).toBe('ref');
    });
  });

  describe('ensureSchema', () => {
    it('creates and registers when class unknown', () => {
      const freshRegistry = PegaMetaModelRegistry.getInstance();
      const json: Record<string, unknown> = {
        pyLabel: 'Test Rule',
        pyDescription: 'A test rule',
      };
      const def = inferrer.ensureSchema('Rule-Obj-TestUnknown', json, freshRegistry);
      expect(def.pxObjClass).toBe('Rule-Obj-TestUnknown');
      expect(freshRegistry.isKnownClass('Rule-Obj-TestUnknown')).toBe(true);
      const fetched = freshRegistry.getParser('Rule-Obj-TestUnknown');
      expect(fetched).toBeDefined();
      expect(fetched!.pxObjClass).toBe('Rule-Obj-TestUnknown');
    });

    it('returns existing when class known', () => {
      const json: Record<string, unknown> = {
        pyLabel: 'Activity',
      };
      const first = inferrer.ensureSchema('Rule-Obj-TestKnown', json, registry);
      const second = inferrer.ensureSchema('Rule-Obj-TestKnown', json, registry);
      expect(second).toBe(first);
    });

    it('sets baseClass for newly inferred schemas', () => {
      const json: Record<string, unknown> = {
        pyLabel: 'New Rule',
      };
      const def = inferrer.ensureSchema('Rule-Obj-NewThing', json, registry);
      expect(def.baseClass).toBeDefined();
      expect(def.baseClass!.startsWith('Rule-')).toBe(true);
    });

    it('returns pre-loaded schema for known class in registry', () => {
      const json: Record<string, unknown> = {
        pyLabel: 'Extra Field Not In Schema',
      };
      const def = inferrer.ensureSchema('Rule-Obj-Activity', json, registry);
      expect(def.pxObjClass).toBe('Rule-Obj-Activity');
      expect(def.label).toBeDefined();
    });
  });

  describe('hasKnownSchema', () => {
    it('returns false for unknown type', () => {
      expect(inferrer.hasKnownSchema('Totally-Unregistered-Type', registry)).toBe(false);
    });

    it('returns true for known type after ensureSchema', () => {
      const json: Record<string, unknown> = { pyLabel: 'test' };
      inferrer.ensureSchema('Rule-Obj-CheckKnown', json, registry);
      expect(inferrer.hasKnownSchema('Rule-Obj-CheckKnown', registry)).toBe(true);
    });
  });

  describe('isReferenceField', () => {
    it('detects Name-suffix fields as reference', () => {
      expect(inferrer.isReferenceField('pyActivityName')).toBe(true);
      expect(inferrer.isReferenceField('pyModelName')).toBe(true);
      expect(inferrer.isReferenceField('pyRuleName')).toBe(true);
      expect(inferrer.isReferenceField('pyTransformName')).toBe(true);
    });

    it('detects Class-suffix fields as reference', () => {
      expect(inferrer.isReferenceField('pyClassName')).toBe(true);
      expect(inferrer.isReferenceField('pySuperClass')).toBe(true);
      expect(inferrer.isReferenceField('pyTargetClass')).toBe(true);
    });

    it('detects Profile-suffix fields as reference', () => {
      expect(inferrer.isReferenceField('pyAuthProfile')).toBe(true);
    });

    it('does not mark plain fields as reference', () => {
      expect(inferrer.isReferenceField('pyLabel')).toBe(false);
      expect(inferrer.isReferenceField('pyDescription')).toBe(false);
      expect(inferrer.isReferenceField('pyCount')).toBe(false);
    });
  });

  describe('handle edge cases', () => {
    it('handles empty JSON gracefully', () => {
      const def = inferrer.inferFromRule('Rule-Obj-Empty', {});
      expect(def.pxObjClass).toBe('Rule-Obj-Empty');
      expect(def.properties).toEqual([]);
      expect(def.children).toEqual([]);
    });

    it('handles malformed JSON (null values)', () => {
      const json: Record<string, unknown> = {
        pyLabel: null,
        pyCount: null,
        pyActive: null,
      };
      const props = inferrer.inferProperties(json);
      expect(props.length).toBeGreaterThanOrEqual(0);
    });

    it('handles deeply nested JSON (objects as values → skip)', () => {
      const json: Record<string, unknown> = {
        pyLabel: 'test',
        nestedObject: { innerKey: 'value', deeper: { a: 1 } },
        anotherProp: 'keep me',
      };
      const props = inferrer.inferProperties(json);
      const nested = props.find(p => p.name === 'nestedObject');
      expect(nested).toBeUndefined();
      expect(props.find(p => p.name === 'anotherProp')).toBeDefined();
    });

    it('marks system fields with pxCreate* and pxUpdate* prefixes as isSystem', () => {
      const json: Record<string, unknown> = {
        pyLabel: 'test',
        pxCreateDateTime: '2026-07-27T10:00:00Z',
        pxUpdateOperator: 'user@test.com',
      };
      const props = inferrer.inferProperties(json);
      const createTime = props.find(p => p.name === 'pxCreateDateTime');
      const updateOp = props.find(p => p.name === 'pxUpdateOperator');
      expect(createTime).toBeDefined();
      expect(createTime!.isSystem).toBe(true);
      expect(updateOp).toBeDefined();
      expect(updateOp!.isSystem).toBe(true);
      expect(props.find(p => p.name === 'pyLabel')).toBeDefined();
    });

    it('marks system fields with pz* prefix as isSystem', () => {
      const json: Record<string, unknown> = {
        pyLabel: 'test',
        pzChecksum: 'abc123',
        pzIndex: '0',
      };
      const props = inferrer.inferProperties(json);
      const checksum = props.find(p => p.name === 'pzChecksum');
      const index = props.find(p => p.name === 'pzIndex');
      expect(checksum).toBeDefined();
      expect(checksum!.isSystem).toBe(true);
      expect(index).toBeDefined();
      expect(index!.isSystem).toBe(true);
    });

    it('skips pxObjClass, pyClassName, pyRuleName in properties', () => {
      const json: Record<string, unknown> = {
        pxObjClass: 'Rule-Obj-Test',
        pyClassName: 'Work-Test',
        pyRuleName: 'MyRule',
        pyLabel: 'visible',
      };
      const props = inferrer.inferProperties(json);
      expect(props.find(p => p.name === 'pxObjClass')).toBeUndefined();
      expect(props.find(p => p.name === 'pyClassName')).toBeUndefined();
      expect(props.find(p => p.name === 'pyRuleName')).toBeUndefined();
      expect(props.find(p => p.name === 'pyLabel')).toBeDefined();
    });

    it('skips skipped arrays pxAllChangeList, pxWarnings', () => {
      const json: Record<string, unknown> = {
        pyLabel: 'test',
        pxAllChangeList: [],
        pxWarnings: [],
      };
      const children = inferrer.inferChildren(json);
      expect(children.find(c => c.name === 'pxAllChangeList')).toBeUndefined();
      expect(children.find(c => c.name === 'pxWarnings')).toBeUndefined();
    });
  });
});

describe('PegaFieldDocumentor', () => {
  let inferrer: PegaSchemaInferrer;
  let documentor: PegaFieldDocumentor;
  let registry: PegaMetaModelRegistry;

  beforeEach(async () => {
    inferrer = new PegaSchemaInferrer();
    documentor = new PegaFieldDocumentor(inferrer);
    registry = PegaMetaModelRegistry.getInstance();
    if (!registry.isKnownClass('@baseclass')) {
      await registry.initialize(schemasDir);
    }
  });

  describe('documentField', () => {
    it('generates description for Activity field', () => {
      const doc = documentor.documentField('pyActivityName', 'ResolveTicket', {});
      expect(doc.fieldName).toBe('pyActivityName');
      expect(doc.description).toBe('Name of the Activity rule to call');
      expect(doc.isReference).toBe(true);
      expect(doc.sampleValues).toContain('ResolveTicket');
    });

    it('generates description for DataTransform field', () => {
      const doc = documentor.documentField('pyModelName', 'InitializeTicketData', {});
      expect(doc.fieldName).toBe('pyModelName');
      expect(doc.description).toBe('Data Transform/Model name');
      expect(doc.isReference).toBe(true);
    });

    it('generates description for DecisionTable fields', () => {
      const doc = documentor.documentField('pyPropertyEvaluated', 'pyPriority', {});
      expect(doc.description).toBe('Property being evaluated');
    });

    it('generates description for connector fields', () => {
      const doc = documentor.documentField('pyTargetClass', 'Work-Cover-External', {});
      expect(doc.description).toBe('Target class for the connector');
      expect(doc.isReference).toBe(true);
    });

    it('handles unknown field gracefully', () => {
      const doc = documentor.documentField('pyUnknownField', 'some-value', {});
      expect(doc.description).toContain('Field pyUnknownField');
      expect(doc.isReference).toBe(false);
    });

    it('marks pxObjClass as required', () => {
      const doc = documentor.documentField('pxObjClass', 'Rule-Obj-Test', {});
      expect(doc.isRequired).toBe(true);
      expect(doc.isReference).toBe(true);
    });
  });

  describe('documentClass', () => {
    it('documents all fields in an Activity JSON', () => {
      const docs = documentor.documentClass('Rule-Obj-Activity', MOCK_ACTIVITY_JSON, registry);
      expect(docs.length).toBeGreaterThan(0);
      const labelDoc = docs.find(d => d.fieldName === 'pyLabel');
      expect(labelDoc).toBeDefined();
      expect(labelDoc!.description).toBe('Display label for the rule');
    });

    it('documents all fields in a DataTransform JSON', () => {
      const docs = documentor.documentClass('Rule-Obj-Model', MOCK_DATA_TRANSFORM_JSON, registry);
      expect(docs.length).toBeGreaterThan(0);
      const modelDoc = docs.find(d => d.fieldName === 'pyModelName');
      expect(modelDoc).toBeDefined();
      expect(modelDoc!.description).toBe('Data Transform/Model name');
    });
  });

  describe('generatePromptContext', () => {
    it('produces formatted output for an Activity', () => {
      const ctx = documentor.generatePromptContext('Rule-Obj-Activity', MOCK_ACTIVITY_JSON, registry);
      expect(ctx).toContain('Rule Type: Rule-Obj-Activity');
      expect(ctx).toContain('Fields:');
      expect(ctx).toContain('pyActivityName');
      expect(ctx).toContain('pyLabel');
      expect(ctx).toContain('ref');
      expect(ctx).toContain('optional');
    });

    it('produces formatted output with sample values', () => {
      const ctx = documentor.generatePromptContext('Rule-Obj-Activity', MOCK_ACTIVITY_JSON, registry);
      expect(ctx).toContain('ResolveTicket');
      expect(ctx).toContain('Process and Resolve Jira Ticket');
    });

    it('produces formatted output for a DataTransform', () => {
      const ctx = documentor.generatePromptContext('Rule-Obj-Model', MOCK_DATA_TRANSFORM_JSON, registry);
      expect(ctx).toContain('Rule Type: Rule-Obj-Model');
      expect(ctx).toContain('pyModelName');
      expect(ctx).toContain('InitializeTicketData');
    });
  });
});

describe('Integration: Inference + Metamodel', () => {
  let inferrer: PegaSchemaInferrer;
  let registry: PegaMetaModelRegistry;
  let loader: PegaMetaModelLoader;

  beforeEach(async () => {
    inferrer = new PegaSchemaInferrer();
    loader = new PegaMetaModelLoader();
    registry = PegaMetaModelRegistry.getInstance();
    if (!registry.isKnownClass('@baseclass')) {
      await registry.initialize(schemasDir);
    }
  });

  it('infer → register → compile → parse → same fields', () => {
    const json: Record<string, unknown> = {
      pyLabel: 'Integration Test Rule',
      pyDescription: 'Testing inference',
    };
    const def = inferrer.ensureSchema('Rule-Obj-IntegTest', json, registry);

    const compiler = new PegaMetaModelCompiler(registry);
    const strategy = compiler.compileStrategy(def);

    const parseResult = strategy.parse({ ...json, pxObjClass: 'Rule-Obj-IntegTest', pyClassName: 'Work-Test' });
    expect(parseResult.symbol.ruleType).toBe('Rule-Obj-IntegTest');
    expect(parseResult.dependencies).toEqual([]);
  });

  it('LLM can see field descriptions from documentor', () => {
    const doc = new PegaFieldDocumentor(inferrer);
    const ctx = doc.generatePromptContext('Rule-Obj-Activity', MOCK_ACTIVITY_JSON, registry);
    expect(ctx).toContain('Name of the Activity rule to call');
    expect(ctx).toContain('Display label for the rule');
    expect(ctx).toContain('Ruleset name');
    expect(ctx).toContain('Applies to class name');
  });

  it('ensureSchema + compileStrategy + parse round-trip', () => {
    const json: Record<string, unknown> = {
      pyLabel: 'RoundTrip',
      pyDescription: 'Going full circle',
      steps: [
        { pxObjClass: 'Embedded-Step', pyStepNum: '1', pyMethod: 'Call' },
      ],
    };
    const def = inferrer.ensureSchema('Rule-Obj-RoundTrip', json, registry);

    expect(def.properties.some(p => p.name === 'pyLabel')).toBe(true);
    expect(def.children.some(c => c.name === 'steps')).toBe(true);

    const compiler = new PegaMetaModelCompiler(registry);
    const strategy = compiler.compileStrategy(def);

    const parseJson: Record<string, unknown> = {
      pxObjClass: 'Rule-Obj-RoundTrip',
      pyClassName: 'Work-RoundTrip',
      pyRuleName: 'TestRoundTrip',
      pyLabel: 'RoundTrip',
      steps: [
        { pxObjClass: 'Embedded-Step', pyStepNum: '1', pyMethod: 'Call' },
      ],
    };
    const result = strategy.parse(parseJson);
    expect(result.symbol.name).toBe('TestRoundTrip');
    expect(result.symbol.ruleType).toBe('Rule-Obj-RoundTrip');
  });

  it('inferred schema resolves inheritance properly via registry', () => {
    const json: Record<string, unknown> = { pyLabel: 'Child Rule' };
    const def = inferrer.ensureSchema('Rule-Obj-InheritChild', json, registry);
    expect(def.baseClass).toBe('Rule-Obj-');
    expect(registry.getParser(def.baseClass!)).toBeDefined();
    expect(registry.getParser('@baseclass')).toBeDefined();
  });

  it('inferred schema resolves Data-Custom to Data- when Data- exists', () => {
    const json: Record<string, unknown> = { pyLabel: 'Custom Data' };
    const def = inferrer.ensureSchema('Data-Custom-Product', json, registry);
    expect(def.baseClass).toBe('Data-');
    expect(registry.isKnownClass('Data-')).toBe(true);
  });

  it('inferred schema from operator data uses inferFromRule for correct properties', () => {
    const def = inferrer.inferFromRule('Data-Admin-Operator-ID', MOCK_OPERATOR_DATA_JSON);
    expect(def.properties.some(p => p.name === 'pyUserIdentifier')).toBe(true);
    expect(def.properties.some(p => p.name === 'pyUserName')).toBe(true);
    expect(def.properties.some(p => p.name === 'pyAccessGroup')).toBe(true);
  });

  it('inferred schema from decision table JSON uses inferFromRule for correct properties', () => {
    const def = inferrer.inferFromRule('Rule-Declare-DecisionTable', MOCK_DECISION_TABLE_JSON);
    expect(def.properties.some(p => p.name === 'pyPropertyEvaluated')).toBe(true);
    expect(def.properties.some(p => p.name === 'pyLabel')).toBe(true);
  });

  it('inferred schema from operator data with ensureSchema + unique class', () => {
    const def = inferrer.ensureSchema('Inferred-Data-Admin-Operator-ID', MOCK_OPERATOR_DATA_JSON, registry);
    expect(def.properties.some(p => p.name === 'pyUserIdentifier')).toBe(true);
    expect(def.properties.some(p => p.name === 'pyUserName')).toBe(true);
    expect(def.properties.some(p => p.name === 'pyAccessGroup')).toBe(true);
    expect(def.baseClass).toBe('@baseclass');
  });

  it('multiple inferSchema calls for different types produce different schemas', () => {
    const def1 = inferrer.ensureSchema('Rule-Obj-TypeA', { pyLabel: 'A' }, registry);
    const def2 = inferrer.ensureSchema('Rule-Obj-TypeB', { pyLabel: 'B' }, registry);
    expect(def1).not.toBe(def2);
    expect(def1.pxObjClass).toBe('Rule-Obj-TypeA');
    expect(def2.pxObjClass).toBe('Rule-Obj-TypeB');
  });

  it('compiled strategy from inferred schema matches correct type', () => {
    const json: Record<string, unknown> = { pyLabel: 'Test' };
    const def = inferrer.ensureSchema('Rule-Obj-MyCustom', json, registry);
    const compiler = new PegaMetaModelCompiler(registry);
    const strategy = compiler.compileStrategy(def);
    expect(strategy.supports('Rule-Obj-MyCustom')).toBe(true);
    expect(strategy.supports('Rule-Obj-MyCustomSub')).toBe(false);
  });
});

describe('Integration: Documentor Edge Cases', () => {
  let inferrer: PegaSchemaInferrer;
  let documentor: PegaFieldDocumentor;
  let registry: PegaMetaModelRegistry;

  beforeEach(async () => {
    inferrer = new PegaSchemaInferrer();
    documentor = new PegaFieldDocumentor(inferrer);
    registry = PegaMetaModelRegistry.getInstance();
    if (!registry.isKnownClass('@baseclass')) {
      await registry.initialize(schemasDir);
    }
  });

  it('generates prompt context with null values gracefully', () => {
    const json: Record<string, unknown> = {
      pyLabel: null,
      pyDescription: 'Has null label',
    };
    const ctx = documentor.generatePromptContext('Rule-Obj-NullTest', json, registry);
    expect(ctx).toContain('Rule Type: Rule-Obj-NullTest');
    expect(ctx).toContain('pyDescription');
  });
});
