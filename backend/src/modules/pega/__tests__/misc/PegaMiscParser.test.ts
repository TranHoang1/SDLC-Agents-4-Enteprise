import { describe, it, expect } from 'vitest';
import { PegaMiscParser } from '../../misc/PegaMiscParser.js';
import { PegaParserRegistry } from '../../strategies/PegaParserRegistry.js';
import { registerMiscParsers } from '../../misc/index.js';

describe('PegaMiscParser', () => {
  const parser = new PegaMiscParser();

  // ─── Group 1: MapValue — source/target/map ruleset ─────────────────────

  describe('MapValue parsing', () => {
    it('parses MapValue with source/target property and map ruleset', () => {
      const json = {
        pxObjClass: 'Rule-Obj-MapValue',
        pyRuleName: 'MapCustomerName',
        pySourceProperty: '.Customer.FullName',
        pyTargetProperty: '.Order.CustomerName',
        pyMapRuleSet: 'CustomerMappingRules',
      };

      const result = parser.parse(json);
      expect(result.symbol.name).toBe('MapCustomerName');
      expect(result.symbol.ruleType).toBe('Rule-Obj-MapValue');

      const typed = parser.parseMapValue(json);
      expect(typed.pyName).toBe('MapCustomerName');
      expect(typed.pySourceProperty).toBe('.Customer.FullName');
      expect(typed.pyTargetProperty).toBe('.Order.CustomerName');
      expect(typed.pyMapRuleSet).toBe('CustomerMappingRules');
    });

    it('handles MapValue with missing optional fields', () => {
      const json = {
        pxObjClass: 'Rule-Obj-MapValue',
        pyRuleName: 'MinimalMap',
      };

      const typed = parser.parseMapValue(json);
      expect(typed.pyName).toBe('MinimalMap');
      expect(typed.pySourceProperty).toBeUndefined();
      expect(typed.pyTargetProperty).toBeUndefined();
      expect(typed.pyMapRuleSet).toBeUndefined();
    });
  });

  // ─── Group 2: FieldValue — field value + class ref ──────────────────────

  describe('FieldValue parsing', () => {
    it('parses FieldValue with field value and class reference', () => {
      const json = {
        pxObjClass: 'Rule-Obj-FieldValue',
        pyRuleName: 'StatusActive',
        pyFieldValue: 'Active',
        pyClass: 'Work-Order',
        pyValue: 'Active',
      };

      const result = parser.parse(json);
      expect(result.symbol.name).toBe('StatusActive');

      const typed = parser.parseFieldValue(json);
      expect(typed.pyName).toBe('StatusActive');
      expect(typed.pyFieldValue).toBe('Active');
      expect(typed.pyClass).toBe('Work-Order');
      expect(typed.pyValue).toBe('Active');
    });

    it('handles FieldValue with missing optional fields', () => {
      const json = {
        pxObjClass: 'Rule-Obj-FieldValue',
        pyRuleName: 'MinimalField',
      };

      const typed = parser.parseFieldValue(json);
      expect(typed.pyName).toBe('MinimalField');
      expect(typed.pyFieldValue).toBeUndefined();
      expect(typed.pyClass).toBeUndefined();
      expect(typed.pyValue).toBeUndefined();
    });
  });

  // ─── Group 3: CaseType — stages + start process ────────────────────────

  describe('CaseType parsing', () => {
    it('parses CaseType with stages and start process', () => {
      const json = {
        pxObjClass: 'Rule-Obj-CaseType',
        pyRuleName: 'OrderProcessing',
        pyLabel: 'Order Processing Case',
        pyStages: [
          { pyName: 'Stage1', pyLabel: 'Initial Review' },
          { pyName: 'Stage2', pyLabel: 'Fulfillment' },
        ],
        pyDefaultStage: 'Stage1',
        pyStartProcess: 'StartOrderProcess',
      };

      const result = parser.parse(json);
      expect(result.symbol.name).toBe('OrderProcessing');

      const typed = parser.parseCaseType(json);
      expect(typed.pyName).toBe('OrderProcessing');
      expect(typed.pyLabel).toBe('Order Processing Case');
      expect(typed.stages).toHaveLength(2);
      expect(typed.stages![0].pyName).toBe('Stage1');
      expect(typed.stages![0].pyLabel).toBe('Initial Review');
      expect(typed.stages![1].pyName).toBe('Stage2');
      expect(typed.pyDefaultStage).toBe('Stage1');
      expect(typed.pyStartProcess).toBe('StartOrderProcess');
    });

    it('extracts start process dependency from CaseType', () => {
      const json = {
        pxObjClass: 'Rule-Obj-CaseType',
        pyClassName: 'Work-Order',
        pyRuleName: 'SimpleCase',
        pyStartProcess: 'InitProcess',
      };

      const result = parser.parse(json);
      expect(result.dependencies).toHaveLength(1);
      expect(result.dependencies[0]).toEqual({
        ruleType: 'Rule-Obj-Activity',
        className: 'Work-Order',
        ruleName: 'InitProcess',
      });
    });
  });

  // ─── Group 4: Stage — type + processes ─────────────────────────────────

  describe('Stage parsing', () => {
    it('parses Stage with type and processes', () => {
      const json = {
        pxObjClass: 'Rule-Obj-Stage',
        pyRuleName: 'ReviewStage',
        pyLabel: 'Review Stage',
        pyStageType: 'Approval',
        pyProcesses: ['ReviewProcess', 'EscalateProcess'],
      };

      const result = parser.parse(json);
      expect(result.symbol.name).toBe('ReviewStage');

      const typed = parser.parseStage(json);
      expect(typed.pyName).toBe('ReviewStage');
      expect(typed.pyLabel).toBe('Review Stage');
      expect(typed.pyStageType).toBe('Approval');
      expect(typed.pyProcesses).toEqual(['ReviewProcess', 'EscalateProcess']);
    });

    it('extracts process dependencies from Stage', () => {
      const json = {
        pxObjClass: 'Rule-Obj-Stage',
        pyClassName: 'Work-Order',
        pyRuleName: 'StageWithProcesses',
        pyStageType: 'Subprocess',
        pyProcesses: ['ProcessA', 'ProcessB'],
      };

      const result = parser.parse(json);
      const processDeps = result.dependencies.filter(d => d.ruleType === 'Rule-Obj-Activity');
      expect(processDeps).toHaveLength(2);
      expect(processDeps[0]).toEqual({ ruleType: 'Rule-Obj-Activity', className: 'Work-Order', ruleName: 'ProcessA' });
      expect(processDeps[1]).toEqual({ ruleType: 'Rule-Obj-Activity', className: 'Work-Order', ruleName: 'ProcessB' });
    });
  });

  // ─── Group 5: ServiceLevel — urgency/goal/deadline/escalation ──────────

  describe('ServiceLevel parsing', () => {
    it('parses ServiceLevel with urgency, goal, deadline, escalation', () => {
      const json = {
        pxObjClass: 'Rule-Obj-ServiceLevel',
        pyRuleName: 'SLADefault',
        pyUrgency: 50,
        pyGoal: '2h',
        pyDeadline: '8h',
        pyLimit: '24h',
        pyAction: 'NotifyManager',
        pyEscalation: 'EscalateToDirector',
      };

      const result = parser.parse(json);
      expect(result.symbol.name).toBe('SLADefault');

      const typed = parser.parseServiceLevel(json);
      expect(typed.pyName).toBe('SLADefault');
      expect(typed.pyUrgency).toBe(50);
      expect(typed.pyGoal).toBe('2h');
      expect(typed.pyDeadline).toBe('8h');
      expect(typed.pyLimit).toBe('24h');
      expect(typed.pyAction).toBe('NotifyManager');
      expect(typed.pyEscalation).toBe('EscalateToDirector');
    });

    it('handles ServiceLevel with missing optional fields', () => {
      const json = {
        pxObjClass: 'Rule-Obj-ServiceLevel',
        pyRuleName: 'MinimalSLA',
      };

      const typed = parser.parseServiceLevel(json);
      expect(typed.pyUrgency).toBeUndefined();
      expect(typed.pyGoal).toBeUndefined();
      expect(typed.pyDeadline).toBeUndefined();
      expect(typed.pyEscalation).toBeUndefined();
    });
  });

  // ─── Group 6: Circumstance — type/value/target ────────────────────────

  describe('Circumstance parsing', () => {
    it('parses Circumstance with type, value, target property', () => {
      const json = {
        pxObjClass: 'Rule-Circumstance-Date',
        pyRuleName: 'HolidayRule',
        pyCircumstanceType: 'Date',
        pyValue: '2026-12-25',
        pyTargetProperty: '.Order.ShipDate',
        pyPriority: 1,
      };

      const result = parser.parse(json);
      expect(result.symbol.name).toBe('HolidayRule');

      const typed = parser.parseCircumstance(json);
      expect(typed.pyName).toBe('HolidayRule');
      expect(typed.pyCircumstanceType).toBe('Date');
      expect(typed.pyValue).toBe('2026-12-25');
      expect(typed.pyTargetProperty).toBe('.Order.ShipDate');
      expect(typed.pyPriority).toBe(1);
    });

    it('handles Circumstance with missing optional fields', () => {
      const json = {
        pxObjClass: 'Rule-Circumstance-Property',
        pyRuleName: 'SimpleCirc',
      };

      const typed = parser.parseCircumstance(json);
      expect(typed.pyCircumstanceType).toBeUndefined();
      expect(typed.pyValue).toBeUndefined();
      expect(typed.pyTargetProperty).toBeUndefined();
      expect(typed.pyPriority).toBeUndefined();
    });
  });

  // ─── Group 7: Agent/Queue — interval/queue/threads ─────────────────────

  describe('Agent/Queue parsing', () => {
    it('parses Agent with type, interval, queue type, max threads', () => {
      const json = {
        pxObjClass: 'Rule-Agent-Queue',
        pyRuleName: 'EmailDispatcher',
        pyType: 'Queue',
        pyQueueType: 'Email',
        pyInterval: 60,
        pyMaxThreads: 5,
      };

      const result = parser.parse(json);
      expect(result.symbol.name).toBe('EmailDispatcher');

      const typed = parser.parseAgent(json);
      expect(typed.pyName).toBe('EmailDispatcher');
      expect(typed.pyType).toBe('Queue');
      expect(typed.pyQueueType).toBe('Email');
      expect(typed.pyInterval).toBe(60);
      expect(typed.pyMaxThreads).toBe(5);
    });

    it('parses QueueProcessor with class name and max items', () => {
      const json = {
        pxObjClass: 'Rule-Agent-Queue',
        pyRuleName: 'ProcessOrders',
        pyClassName: 'Work-Order',
        pyMaxItems: 100,
      };

      const typed = parser.parseQueueProcessor(json);
      expect(typed.pyName).toBe('ProcessOrders');
      expect(typed.pyClassName).toBe('Work-Order');
      expect(typed.pyMaxItems).toBe(100);
    });
  });

  // ─── Group 8: ReportDef — filters/sort/columns ────────────────────────

  describe('ReportDef parsing', () => {
    it('parses ReportDef with filters, sort fields, columns', () => {
      const json = {
        pxObjClass: 'Rule-Obj-Report-Definition',
        pyRuleName: 'OpenOrdersReport',
        pyDatasource: 'Data-Order',
        pyFilters: [
          { pyProperty: '.Status', pyOperator: 'equals', pyValue: 'Open' },
          { pyProperty: '.Priority', pyOperator: 'greater', pyValue: '3' },
        ],
        pySortFields: [
          { pyProperty: '.CreateDate', pyOrder: 'DESC' },
        ],
        pyColumns: [
          { pyProperty: '.OrderID', pyLabel: 'Order ID', pySortable: true },
          { pyProperty: '.CustomerName', pyLabel: 'Customer' },
        ],
      };

      const result = parser.parse(json);
      expect(result.symbol.name).toBe('OpenOrdersReport');

      const typed = parser.parseReportDef(json);
      expect(typed.pyName).toBe('OpenOrdersReport');
      expect(typed.pyDatasource).toBe('Data-Order');
      expect(typed.pyFilters).toHaveLength(2);
      expect(typed.pyFilters![0].pyProperty).toBe('.Status');
      expect(typed.pyFilters![0].pyOperator).toBe('equals');
      expect(typed.pyFilters![0].pyValue).toBe('Open');
      expect(typed.pySortFields).toHaveLength(1);
      expect(typed.pySortFields![0].pyProperty).toBe('.CreateDate');
      expect(typed.pySortFields![0].pyOrder).toBe('DESC');
      expect(typed.pyColumns).toHaveLength(2);
      expect(typed.pyColumns![0].pyProperty).toBe('.OrderID');
      expect(typed.pyColumns![0].pyLabel).toBe('Order ID');
      expect(typed.pyColumns![0].pySortable).toBe(true);
    });

    it('handles ReportDef with missing arrays', () => {
      const json = {
        pxObjClass: 'Rule-Obj-Report-Definition',
        pyRuleName: 'MinimalReport',
      };

      const typed = parser.parseReportDef(json);
      expect(typed.pyDatasource).toBeUndefined();
      expect(typed.pyFilters).toBeUndefined();
      expect(typed.pySortFields).toBeUndefined();
      expect(typed.pyColumns).toBeUndefined();
    });
  });

  // ─── Group 9: Correspondence — subject/body/from ──────────────────────

  describe('Correspondence parsing', () => {
    it('parses Correspondence with subject, body, from address', () => {
      const json = {
        pxObjClass: 'Rule-Corr-Email',
        pyRuleName: 'WelcomeEmail',
        pyType: 'Email',
        pySubject: 'Welcome to our platform',
        pyBody: 'Dear {{.Customer.Name}},\n\nWelcome!',
        pyFromAddress: 'noreply@example.com',
      };

      const result = parser.parse(json);
      expect(result.symbol.name).toBe('WelcomeEmail');

      const typed = parser.parseCorrespondence(json);
      expect(typed.pyName).toBe('WelcomeEmail');
      expect(typed.pyType).toBe('Email');
      expect(typed.pySubject).toBe('Welcome to our platform');
      expect(typed.pyBody).toBe('Dear {{.Customer.Name}},\n\nWelcome!');
      expect(typed.pyFromAddress).toBe('noreply@example.com');
    });

    it('handles Correspondence with missing optional fields', () => {
      const json = {
        pxObjClass: 'Rule-Corr-SMS',
        pyRuleName: 'AlertSMS',
      };

      const typed = parser.parseCorrespondence(json);
      expect(typed.pyType).toBeUndefined();
      expect(typed.pySubject).toBeUndefined();
      expect(typed.pyBody).toBeUndefined();
      expect(typed.pyFromAddress).toBeUndefined();
    });
  });

  // ─── Group 10: File rules + Edit rules ────────────────────────────────

  describe('File rules + Edit rules', () => {
    it('parses FileBinary and FileText', () => {
      const binaryJson = {
        pxObjClass: 'Rule-File-Binary',
        pyRuleName: 'LogoImage',
        pyFilePath: '/assets/logo.png',
        pyMimeType: 'image/png',
      };

      const binary = parser.parseFileBinary(binaryJson);
      expect(binary.pyName).toBe('LogoImage');
      expect(binary.pyFilePath).toBe('/assets/logo.png');
      expect(binary.pyMimeType).toBe('image/png');

      const textJson = {
        pxObjClass: 'Rule-File-Text',
        pyRuleName: 'ConfigJSON',
        pyContent: '{"version": "1.0"}',
      };

      const text = parser.parseFileText(textJson);
      expect(text.pyName).toBe('ConfigJSON');
      expect(text.pyContent).toBe('{"version": "1.0"}');
    });

    it('parses EditValidate with validate type, class, message', () => {
      const json = {
        pxObjClass: 'Rule-Edit-Validate',
        pyRuleName: 'ValidateEmail',
        pyValidateType: 'Prompt',
        pyClass: 'Work-Contact',
        pyMessage: 'Please enter a valid email address',
      };

      const result = parser.parse(json);
      expect(result.symbol.name).toBe('ValidateEmail');

      const typed = parser.parseEditValidate(json);
      expect(typed.pyName).toBe('ValidateEmail');
      expect(typed.pyValidateType).toBe('Prompt');
      expect(typed.pyClass).toBe('Work-Contact');
      expect(typed.pyMessage).toBe('Please enter a valid email address');
    });
  });

  // ─── Group 11: AutoTest + Utility ──────────────────────────────────────

  describe('AutoTest + Utility', () => {
    it('parses AutoTest with test script and expectations', () => {
      const json = {
        pxObjClass: 'Rule-Test-AutoTest',
        pyRuleName: 'LoginTest',
        pyTestScript: ['OpenLoginPage', 'EnterCredentials', 'ClickLogin'],
        pyExpectations: ['DashboardVisible', 'UserNameDisplayed'],
      };

      const result = parser.parse(json);
      expect(result.symbol.name).toBe('LoginTest');

      const typed = parser.parseAutoTest(json);
      expect(typed.pyName).toBe('LoginTest');
      expect(typed.pyTestScript).toEqual(['OpenLoginPage', 'EnterCredentials', 'ClickLogin']);
      expect(typed.pyExpectations).toEqual(['DashboardVisible', 'UserNameDisplayed']);
    });

    it('parses Utility with code, language, parameters', () => {
      const json = {
        pxObjClass: 'Rule-Utility-Script',
        pyRuleName: 'CalculateTax',
        pyCode: 'return amount * 0.1;',
        pyLanguage: 'JS',
        pyParameters: ['amount'],
      };

      const result = parser.parse(json);
      expect(result.symbol.name).toBe('CalculateTax');

      const typed = parser.parseUtility(json);
      expect(typed.pyName).toBe('CalculateTax');
      expect(typed.pyCode).toBe('return amount * 0.1;');
      expect(typed.pyLanguage).toBe('JS');
      expect(typed.pyParameters).toEqual(['amount']);
    });
  });

  // ─── Group 12: supports() for all prefixes + round-trip + missing fields

  describe('supports() for all prefixes + round-trip + missing fields', () => {
    it('returns true for all misc rule type prefixes', () => {
      expect(parser.supports('Rule-Obj-MapValue')).toBe(true);
      expect(parser.supports('Rule-Obj-FieldValue')).toBe(true);
      expect(parser.supports('Rule-Obj-CaseType')).toBe(true);
      expect(parser.supports('Rule-Obj-Stage')).toBe(true);
      expect(parser.supports('Rule-Obj-ServiceLevel')).toBe(true);
      expect(parser.supports('Rule-Obj-Report-Definition')).toBe(true);
      expect(parser.supports('Rule-Circumstance-Date')).toBe(true);
      expect(parser.supports('Rule-Circumstance-Property')).toBe(true);
      expect(parser.supports('Rule-Agent-Queue')).toBe(true);
      expect(parser.supports('Rule-Agent-JobScheduler')).toBe(true);
      expect(parser.supports('Rule-Corr-Email')).toBe(true);
      expect(parser.supports('Rule-Corr-Letter')).toBe(true);
      expect(parser.supports('Rule-File-Binary')).toBe(true);
      expect(parser.supports('Rule-File-Text')).toBe(true);
      expect(parser.supports('Rule-Edit-Validate')).toBe(true);
      expect(parser.supports('Rule-Test-AutoTest')).toBe(true);
      expect(parser.supports('Rule-Utility-Script')).toBe(true);
      expect(parser.supports('Rule-Message')).toBe(true);
      expect(parser.supports('Rule-Stream')).toBe(true);
      expect(parser.supports('Rule-Shortcut')).toBe(true);
    });

    it('returns false for unrelated rule types', () => {
      expect(parser.supports('Rule-Obj-Activity')).toBe(false);
      expect(parser.supports('Rule-Obj-Model')).toBe(false);
      expect(parser.supports('Rule-Connect-REST')).toBe(false);
      expect(parser.supports('Rule-Access-')).toBe(false);
      expect(parser.supports('')).toBe(false);
    });

    it('round-trips MapValue -> same fields', () => {
      const original = {
        pxObjClass: 'Rule-Obj-MapValue',
        pyRuleName: 'RoundTripMap',
        pySourceProperty: '.Source.Field',
        pyTargetProperty: '.Target.Field',
        pyMapRuleSet: 'MappingRules',
      };

      const typed = parser.parseMapValue(original);
      expect(typed.pxObjClass).toBe('Rule-Obj-MapValue');
      expect(typed.pyName).toBe('RoundTripMap');
      expect(typed.pySourceProperty).toBe('.Source.Field');
      expect(typed.pyTargetProperty).toBe('.Target.Field');
      expect(typed.pyMapRuleSet).toBe('MappingRules');
    });

    it('handles empty JSON for parse()', () => {
      const json = { pxObjClass: 'Rule-Obj-CaseType' };

      const result = parser.parse(json);
      expect(result.symbol.name).toBe('');
      expect(result.symbol.fqn).toBe('Rule-Obj-CaseType:@baseclass:');
      expect(result.dependencies).toHaveLength(0);
    });
  });

  // ─── Registry integration ──────────────────────────────────────────────

  describe('Registry integration', () => {
    it('registers and parses via PegaParserRegistry', () => {
      const registry = new PegaParserRegistry();
      registerMiscParsers(registry);

      const json = {
        pxObjClass: 'Rule-Obj-MapValue',
        pyRuleName: 'RegistryMap',
        pySourceProperty: '.Source',
        pyTargetProperty: '.Target',
      };

      const result = registry.parse(json);
      expect(result.symbol.ruleType).toBe('Rule-Obj-MapValue');
      expect(result.symbol.name).toBe('RegistryMap');
      expect(result.symbol.logicSummary).toContain('RegistryMap');
    });

    it('handles Rule-Stream with groups', () => {
      const json = {
        pxObjClass: 'Rule-Stream',
        pyRuleName: 'OrderStream',
        pyDataSource: 'Data-Order',
        pyGroups: ['GroupA', 'GroupB'],
      };

      const typed = parser.parseStream(json);
      expect(typed.pyName).toBe('OrderStream');
      expect(typed.pyDataSource).toBe('Data-Order');
      expect(typed.pyGroups).toEqual(['GroupA', 'GroupB']);
    });

    it('parses Shortcut, Message, and missing types', () => {
      const shortcut = parser.parseShortcut({
        pxObjClass: 'Rule-Shortcut',
        pyRuleName: 'QuickNav',
        pyTarget: 'Rule-Obj-CaseType MyCase',
      });
      expect(shortcut.pyName).toBe('QuickNav');
      expect(shortcut.pyTarget).toBe('Rule-Obj-CaseType MyCase');

      const msg = parser.parseMessage({
        pxObjClass: 'Rule-Message',
        pyRuleName: 'WelcomeMsg',
        pyText: 'Welcome to the system',
      });
      expect(msg.pyName).toBe('WelcomeMsg');
      expect(msg.pyText).toBe('Welcome to the system');
    });
  });
});