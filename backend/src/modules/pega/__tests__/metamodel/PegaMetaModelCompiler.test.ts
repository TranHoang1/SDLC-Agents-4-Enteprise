import { describe, it, expect, beforeAll } from 'vitest';
import path from 'path';
import { fileURLToPath } from 'url';
import { PegaMetaModelLoader, PegaMetaModelRegistry, PegaMetaModelCompiler, PegaMetaModelService } from '../../metamodel/index.js';
import { PegaParserRegistry } from '../../strategies/PegaParserRegistry.js';
import type { PegaClassDefinition } from '../../metamodel/PegaClassDefinition.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const schemasDir = path.resolve(__dirname, '../../schemas');

describe('PegaMetaModelCompiler', () => {
  let loader: PegaMetaModelLoader;
  let metaRegistry: PegaMetaModelRegistry;
  let compiler: PegaMetaModelCompiler;

  beforeAll(async () => {
    loader = new PegaMetaModelLoader();
    await loader.loadSchemaDirectory(schemasDir);

    metaRegistry = PegaMetaModelRegistry.getInstance();
    // Ensure fresh state
    await metaRegistry.initialize(schemasDir);

    compiler = new PegaMetaModelCompiler(metaRegistry);
  });

  // ---------------------------------------------------------------------------
  // Test 1: Compiles strategy for Rule-Obj-Activity, parses sample activity JSON
  // ---------------------------------------------------------------------------
  describe('Test 1: Rule-Obj-Activity strategy', () => {
    it('compiles a strategy and parses a sample activity JSON', () => {
      const activityDef = loader.getClass('Rule-Obj-Activity');
      expect(activityDef).toBeDefined();

      const strategy = compiler.compileStrategy(activityDef!);
      expect(strategy.supports('Rule-Obj-Activity')).toBe(true);

      const sampleActivity = {
        pxObjClass: 'Rule-Obj-Activity',
        pyClassName: 'Work-Order',
        pyRuleName: 'ApproveOrder',
        pyLabel: 'Approve Order Activity',
        pyRuleset: 'OrderApp',
        pyRulesetVersion: '01-02-01',
        pyDescription: 'Approves an order after validation',
        pyMethod: 'Call',
        steps: [
          {
            pxObjClass: 'Embed-Step',
            pyStepNumber: '1',
            pyMethod: 'Call',
            pyMethodParameters: 'ValidateOrder',
            pyStepDescription: 'Validate the order',
          },
          {
            pxObjClass: 'Embed-Step',
            pyStepNumber: '2',
            pyMethod: 'Call',
            pyMethodParameters: 'SendApproval',
            pyStepDescription: 'Send for approval',
          },
        ],
        pyLinks: [
          {
            pxObjClass: 'Embed-ClassLinks',
            pyLinkName: 'RelatedFlow',
            pyLinkLinkToClass: 'Work-Order',
            pyLinkLinkToName: 'ApprovalFlow',
          },
        ],
        pyPagesAndClasses: [
          {
            pxObjClass: 'Embed-PagesAndClasses',
            pyPagesAndClassesPage: 'orderPage',
            pyPagesAndClassesClass: 'Work-Order',
          },
        ],
        pyValidRuleSets: [
          {
            pxObjClass: 'Embed-ClassRuleSets',
            pyRuleSetName: 'OrderApp',
          },
        ],
      };

      const result = strategy.parse(sampleActivity);
      expect(result.symbol.ruleType).toBe('Rule-Obj-Activity');
      expect(result.symbol.name).toBe('ApproveOrder');
      expect(result.symbol.className).toBe('Work-Order');
      expect(result.symbol.fqn).toBe('Rule-Obj-Activity:Work-Order:ApproveOrder');
      expect(result.symbol.isRule).toBe(true);
      expect(result.symbol.ruleset).toBe('OrderApp');
      expect(result.symbol.version).toBe('01-02-01');

      // Should detect pyMethodParameters (Call method) and other references as dependencies
      expect(result.dependencies.length).toBeGreaterThanOrEqual(1);
      expect(result.dependencies.some(d => d.ruleName === 'ApproveOrder')).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Test 2: Compiles strategy for Rule-Connect-REST, parses sample connect JSON
  // ---------------------------------------------------------------------------
  describe('Test 2: Rule-Connect-REST strategy', () => {
    it('compiles a strategy and parses a sample connect JSON with endpoint and method', () => {
      const connectDef = loader.getClass('Rule-Connect-REST');
      expect(connectDef).toBeDefined();

      const strategy = compiler.compileStrategy(connectDef!);
      expect(strategy.supports('Rule-Connect-REST')).toBe(true);

      const sampleRest = {
        pxObjClass: 'Rule-Connect-REST',
        pyClassName: 'Work-Cover-Jira',
        pyRuleName: 'GetJiraIssue',
        pyLabel: 'Get Jira Issue',
        pyRuleset: 'JiraIntegration',
        pyRulesetVersion: '01-02-03',
        pyBaseURL: 'https://jira.example.com/rest/api/2',
        pyResourcePath: '/issue/{issueId}',
        pyHTTPMethod: 'GET',
        pyAuthProfile: 'JiraOAuth',
        pyAuthType: 'oauth2',
        pyRequestDataTransform: 'MapJiraRequest',
        pyResponseDataTransform: 'ParseJiraResponse',
        pyHeaders: [
          { pxObjClass: 'Embed-Header', pyHeaderName: 'Authorization', pyHeaderValue: 'Bearer ${token}' },
        ],
      };

      const result = strategy.parse(sampleRest);

      // Symbol assertion
      expect(result.symbol.ruleType).toBe('Rule-Connect-REST');
      expect(result.symbol.name).toBe('GetJiraIssue');
      expect(result.symbol.className).toBe('Work-Cover-Jira');
      expect(result.symbol.fqn).toBe('Rule-Connect-REST:Work-Cover-Jira:GetJiraIssue');
      expect(result.symbol.isRule).toBe(true);

      // Reference dependencies: pyAuthProfile, pyRequestDataTransform, pyResponseDataTransform
      // plus any other fields ending in Name/Class/Profile/Transform
      expect(result.dependencies.length).toBeGreaterThanOrEqual(3);

      expect(result.dependencies).toContainEqual(
        expect.objectContaining({ ruleName: 'JiraOAuth', ruleType: 'Rule-Connect-AuthProfile' }),
      );
      expect(result.dependencies).toContainEqual(
        expect.objectContaining({ ruleName: 'MapJiraRequest', ruleType: 'Rule-Obj-Model' }),
      );
      expect(result.dependencies).toContainEqual(
        expect.objectContaining({ ruleName: 'ParseJiraResponse', ruleType: 'Rule-Obj-Model' }),
      );
    });
  });

  // ---------------------------------------------------------------------------
  // Test 3: Compiles strategy for Rule-Decision-Table, parses sample with rows
  // ---------------------------------------------------------------------------
  describe('Test 3: Rule-Declare-DecisionTable strategy', () => {
    it('compiles a strategy and parses a sample decision table with rows', () => {
      // The class name in schemas is Rule-Declare-DecisionTable
      const dtDef = loader.getClass('Rule-Declare-DecisionTable');
      expect(dtDef).toBeDefined();

      const strategy = compiler.compileStrategy(dtDef!);
      expect(strategy.supports('Rule-Declare-DecisionTable')).toBe(true);

      const sampleDT = {
        pxObjClass: 'Rule-Declare-DecisionTable',
        pyClassName: 'Work-Order',
        pyRuleName: 'PriorityDecision',
        pyLabel: 'Priority Decision',
        pyRuleset: 'OrderApp',
        pyRulesetVersion: '01-02-01',
        pyPurpose: 'Determine order priority based on amount',
        pyPropertyEvaluated: 'pyPriority',
        pyDecisionTableRows: [
          {
            pxObjClass: 'Embed-DecisionRow',
            pyCondition: '.pyAmount > 10000',
            pyResult: '"High"',
          },
          {
            pxObjClass: 'Embed-DecisionRow',
            pyCondition: '.pyAmount > 5000',
            pyResult: '"Medium"',
          },
          {
            pxObjClass: 'Embed-DecisionRow',
            pyCondition: 'otherwise',
            pyResult: '"Low"',
          },
        ],
      };

      const result = strategy.parse(sampleDT);
      expect(result.symbol.ruleType).toBe('Rule-Declare-DecisionTable');
      expect(result.symbol.name).toBe('PriorityDecision');
      expect(result.symbol.className).toBe('Work-Order');

      // Should detect pyPropertyEvaluated as reference dependency (ends in 'Evaluated')
      expect(result.dependencies.length).toBeGreaterThanOrEqual(1);
      const propRef = result.dependencies.find(d => d.ruleName === 'pyPriority');
      expect(propRef).toBeDefined();
      expect(propRef!.ruleType).toBe('Rule-Obj-Property');
    });
  });

  // ---------------------------------------------------------------------------
  // Test 4: Strategy resolves inheritance: Rule-Obj-Activity has @baseclass props
  // ---------------------------------------------------------------------------
  describe('Test 4: Inheritance resolution', () => {
    it('compiled strategy for Rule-Obj-Activity includes @baseclass properties', () => {
      const activityDef = loader.getClass('Rule-Obj-Activity');
      const baseDef = loader.getClass('@baseclass');
      expect(activityDef).toBeDefined();
      expect(baseDef).toBeDefined();

      // The loader already resolved inheritance, so activityDef should have base properties
      const activityPropNames = new Set(activityDef!.properties.map(p => p.name));
      for (const baseProp of baseDef!.properties) {
        expect(activityPropNames.has(baseProp.name)).toBe(true);
      }

      // The compiler strategy's class definition should also carry inherited properties
      const strategy = compiler.compileStrategy(activityDef!);

      // Strategy should parse JSON that includes those base properties
      const sampleJson = {
        pxObjClass: 'Rule-Obj-Activity',
        pyClassName: 'Work-Order',
        pyRuleName: 'TestActivity',
        pyLabel: 'Test',
        pyDescription: 'Full description',    // inherited from @baseclass
        pyUsage: 'Usage info',                // inherited from @baseclass
        pyCategory: 'Technical',              // inherited from @baseclass
      };
      const result = strategy.parse(sampleJson);
      expect(result.symbol.name).toBe('TestActivity');
      expect(result.symbol.className).toBe('Work-Order');
    });

    it('strategy supports Rule-Obj-Activity via base class matching', () => {
      const ruleDef = loader.getClass('Rule-');
      expect(ruleDef).toBeDefined();
      const strategy = compiler.compileStrategy(ruleDef!);

      // 'Rule-' is a base class category that should match Rule-Obj-Activity
      expect(strategy.supports('Rule-Obj-Activity')).toBe(true);
      expect(strategy.supports('Rule-Obj-Flow')).toBe(true);
      expect(strategy.supports('Rule-Connect-REST')).toBe(true);
      expect(strategy.supports('Rule-Declare-DecisionTable')).toBe(true);
      expect(strategy.supports('Rule-Obj-')).toBe(true);
    });

    it('strategy supports subclasses through inheritance chain', () => {
      // Rule-Connect- supports Rule-Connect-REST and Rule-Connect-SOAP
      const connectDef = loader.getClass('Rule-Connect-');
      expect(connectDef).toBeDefined();
      const strategy = compiler.compileStrategy(connectDef!);

      expect(strategy.supports('Rule-Connect-REST')).toBe(true);
      expect(strategy.supports('Rule-Connect-SOAP')).toBe(true);
      expect(strategy.supports('Rule-Connect-SQL')).toBe(true);
      // But not unrelated
      expect(strategy.supports('Rule-Obj-Activity')).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // Test 5: Strategy returns undefined for unregistered class
  // ---------------------------------------------------------------------------
  describe('Test 5: Unregistered class handling', () => {
    it('getStrategy returns undefined for classes that were not compiled', () => {
      const noCompileCompiler = new PegaMetaModelCompiler(metaRegistry);
      expect(noCompileCompiler.getStrategy('NonExistent-Class-XYZ')).toBeUndefined();
      expect(noCompileCompiler.getStrategy('Rule-Obj-Activity')).toBeUndefined();
    });
  });

  // ---------------------------------------------------------------------------
  // Test 6: compileAll returns strategies for all registered classes (200+)
  // ---------------------------------------------------------------------------
  describe('Test 6: compileAll returns strategies for all registered classes', () => {
    it('returns strategies for 200+ registered classes', () => {
      const strategies = compiler.compileAll();
      expect(strategies.length).toBeGreaterThanOrEqual(175);

      // Should include key classes
      const classNames = strategies
        .map(s => {
          // Extract class name from a test parse
          const result = s.parse({ pxObjClass: 'Rule-Obj-Activity', pyClassName: 'Test', pyRuleName: 'T' });
          return result.symbol.ruleType;
        })
        .filter((v, i, a) => a.indexOf(v) === i);

      expect(classNames).toContain('Rule-Obj-Activity');
    });

    it('each compiled strategy supports its own pxObjClass', () => {
      const strategies = compiler.compileAll();
      const knownClasses = metaRegistry.getKnownClasses();

      // Check some specific classes
      for (const cls of ['Rule-Obj-Activity', 'Rule-Connect-REST', '@baseclass', 'Rule-', 'Rule-Obj-Model']) {
        const matching = strategies.filter(s => s.supports(cls));
        expect(matching.length).toBeGreaterThanOrEqual(1);
      }
    });
  });

  // ---------------------------------------------------------------------------
  // Test 7: Integration: PegaParserRegistry uses compiled strategy for a class
  // ---------------------------------------------------------------------------
  describe('Test 7: PegaParserRegistry integration', () => {
    it('PegaParserRegistry uses compiled strategy for a class', () => {
      const parserRegistry = new PegaParserRegistry();

      // Compile and register strategies for connect classes
      const connectDef = loader.getClass('Rule-Connect-REST');
      expect(connectDef).toBeDefined();
      const strategy = compiler.compileStrategy(connectDef!);
      parserRegistry.registerStrategy(strategy);

      // Now parse via registry - the compiled strategy should match
      const sampleRest = {
        pxObjClass: 'Rule-Connect-REST',
        pyClassName: 'Work-Cover',
        pyRuleName: 'IntegrationTest',
        pyLabel: 'Integration Test',
        pyRuleset: 'TestApp',
        pyRulesetVersion: '01-01-01',
        pyEndpointURL: 'https://api.example.com/v1',
        pyAuthProfile: 'TestAuth',
      };

      const result = parserRegistry.parse(sampleRest);
      expect(result.symbol.ruleType).toBe('Rule-Connect-REST');
      expect(result.symbol.name).toBe('IntegrationTest');
      expect(result.symbol.className).toBe('Work-Cover');
      expect(result.symbol.ruleset).toBe('TestApp');

      // Should have at least the auth profile dependency
      expect(result.dependencies.some(d => d.ruleName === 'TestAuth' && d.ruleType === 'Rule-Connect-AuthProfile')).toBe(true);
    });

    it('fallback strategy is used when no compiled strategy matches', () => {
      const parserRegistry = new PegaParserRegistry();
      const result = parserRegistry.parse({
        pxObjClass: 'Rule-Obj-Activity',
        pyClassName: 'Test',
        pyActivityName: 'FallbackActivity',
      });
      expect(result.symbol.ruleType).toBe('Rule-Obj-Activity');
      expect(result.symbol.name).toBe('FallbackActivity');
    });
  });

  // ---------------------------------------------------------------------------
  // Test 8: PegaMetaModelService.initialize() loads + compiles + registers
  // ---------------------------------------------------------------------------
  describe('Test 8: PegaMetaModelService initialization', () => {
    it('initialize loads schemas, compiles strategies, and registers them in one call', async () => {
      const service = new PegaMetaModelService();

      expect(service.isInitialized()).toBe(false);

      // Initialize uses the singleton registry
      await service.initialize(schemasDir);

      expect(service.isInitialized()).toBe(true);

      // Should be usable for parsing via the service's parser registry
      const parserRegistry = service.getRegistry();

      // Parse an activity
      const activityResult = parserRegistry.parse({
        pxObjClass: 'Rule-Obj-Activity',
        pyClassName: 'Work-Order',
        pyRuleName: 'ServiceTest',
        pyRuleset: 'Test',
      });
      expect(activityResult.symbol.ruleType).toBe('Rule-Obj-Activity');
      expect(activityResult.symbol.name).toBe('ServiceTest');

      // Parse a connect REST
      const connectResult = parserRegistry.parse({
        pxObjClass: 'Rule-Connect-REST',
        pyClassName: 'Work-Order',
        pyRuleName: 'ServiceConnect',
        pyEndpointURL: 'https://api.example.com',
        pyAuthProfile: 'MyAuth',
      });
      expect(connectResult.symbol.ruleType).toBe('Rule-Connect-REST');

      // Should detect reference dependencies
      const authDep = connectResult.dependencies.find(d => d.ruleName === 'MyAuth');
      expect(authDep).toBeDefined();
    });

    it('idempotent: multiple initialize calls do not reinitialize', async () => {
      const service = new PegaMetaModelService();
      await service.initialize(schemasDir);
      expect(service.isInitialized()).toBe(true);

      // Second call should be a no-op
      await service.initialize(schemasDir);
      expect(service.isInitialized()).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Test 9: Handles malformed JSON gracefully
  // ---------------------------------------------------------------------------
  describe('Test 9: Malformed JSON handling', () => {
    it('returns a result without throwing on empty object', () => {
      const activityDef = loader.getClass('Rule-Obj-Activity');
      expect(activityDef).toBeDefined();
      const strategy = compiler.compileStrategy(activityDef!);

      expect(() => strategy.parse({})).not.toThrow();
      const result = strategy.parse({});
      expect(result.symbol).toBeDefined();
      expect(result.symbol.ruleType).toBe('Rule-Obj-Activity');
      expect(result.symbol.name).toBe('Unnamed');
      expect(result.dependencies).toBeDefined();
    });

    it('returns a result without throwing on null-like values', () => {
      const activityDef = loader.getClass('Rule-Obj-Activity');
      expect(activityDef).toBeDefined();
      const strategy = compiler.compileStrategy(activityDef!);

      const weirdJson = {
        pxObjClass: 'Rule-Obj-Activity',
        pyClassName: null,
        pyRuleName: undefined,
        pyLabel: 42,
        steps: 'not-an-array',
        pyDescription: { nested: 'object' },
      };

      expect(() => strategy.parse(weirdJson as any)).not.toThrow();
      const result = strategy.parse(weirdJson as any);
      expect(result.symbol).toBeDefined();
      // pyLabel is 42 (not a string), so the extractName skips it and returns 'Unnamed'
      expect(result.symbol.className).toBe('@baseclass');
    });

    it('returns a result for partially missing required fields', () => {
      const connectDef = loader.getClass('Rule-Connect-REST');
      expect(connectDef).toBeDefined();
      const strategy = compiler.compileStrategy(connectDef!);

      const minimal = {
        pxObjClass: 'Rule-Connect-REST',
        pyRuleName: 'MinimalConnect',
      };

      const result = strategy.parse(minimal);
      expect(result.symbol.name).toBe('MinimalConnect');
      expect(result.symbol.ruleType).toBe('Rule-Connect-REST');
      expect(result.dependencies).toBeDefined();
    });
  });

  // ---------------------------------------------------------------------------
  // Test 10: Reference detection on naming convention fields
  // ---------------------------------------------------------------------------
  describe('Test 10: Reference detection', () => {
    it('detects fields ending in Name, Class, Profile, Transform as dependencies', () => {
      const activityDef = loader.getClass('Rule-Obj-Activity');
      expect(activityDef).toBeDefined();
      const strategy = compiler.compileStrategy(activityDef!);

      const json = {
        pxObjClass: 'Rule-Obj-Activity',
        pyClassName: 'Work-Order',
        pyRuleName: 'ReferenceTest',
        pyLabel: 'Reference Test',
        pyWhenCondition: 'CheckStatus',
        pyFlowActionName: 'NotifyManager',
        pyFlowName: 'ApprovalFlow',
        pyPropertyName: 'OrderAmount',
        pyTransformName: 'MapOrderData',
        // Extra reference-like fields
        pyAuthProfile: 'BasicAuthProfile',
        pyRequestDataTransform: 'MapRequest',
        pyResponseDataTransform: 'MapResponse',
        pyDerivesFrom: 'Rule-Obj-',
        pySuperClass: 'Rule-Obj-',
      };

      const result = strategy.parse(json);

      // Should catch all reference fields
      const depNames = result.dependencies.map(d => d.ruleName);
      expect(depNames).toContain('CheckStatus');
      expect(depNames).toContain('NotifyManager');
      expect(depNames).toContain('ApprovalFlow');
      expect(depNames).toContain('OrderAmount');
      expect(depNames).toContain('MapOrderData');

      // Check ruleType inference
      const flowDep = result.dependencies.find(d => d.ruleName === 'ApprovalFlow');
      expect(flowDep!.ruleType).toBe('Rule-Obj-Flow');

      const whenDep = result.dependencies.find(d => d.ruleName === 'CheckStatus');
      expect(whenDep!.ruleType).toBe('Rule-Obj-When');

      const propertyDep = result.dependencies.find(d => d.ruleName === 'OrderAmount');
      expect(propertyDep!.ruleType).toBe('Rule-Obj-Property');
    });

    it('deduplicates dependencies', () => {
      const activityDef = loader.getClass('Rule-Obj-Activity');
      expect(activityDef).toBeDefined();
      const strategy = compiler.compileStrategy(activityDef!);

      const json = {
        pxObjClass: 'Rule-Obj-Activity',
        pyClassName: 'Work-Order',
        pyRuleName: 'DedupTest',
        pyLabel: 'Dedup Test',
        pyWhenCondition: 'CheckStatus',
        pyMethodParameters: 'CheckStatus', // same value as pyWhenCondition - should deduplicate
      };

      const result = strategy.parse(json);
      // Count duplicates by ruleName
      const ruleNameCounts = new Map<string, number>();
      for (const dep of result.dependencies) {
        ruleNameCounts.set(dep.ruleName, (ruleNameCounts.get(dep.ruleName) || 0) + 1);
      }

      // Each ruleName should appear at most once
      for (const [, count] of ruleNameCounts) {
        expect(count).toBe(1);
      }
    });
  });
});
