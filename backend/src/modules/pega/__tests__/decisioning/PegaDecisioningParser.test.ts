import { describe, it, expect } from 'vitest';
import { PegaDecisioningParser } from '../../decisioning/PegaDecisioningParser.js';
import { PegaStrategyComponentResolver } from '../../decision/PegaStrategyComponentResolver.js';
import type { Strategy } from '../../decisioning/PegaDecisioningTypes.js';

describe('PegaDecisioningParser', () => {
  const parser = new PegaDecisioningParser();

  describe('supports()', () => {
    it('returns true for Rule-Decision-Strategy', () => {
      expect(parser.supports('Rule-Decision-Strategy')).toBe(true);
    });

    it('returns true for Rule-Decision-Scorecard', () => {
      expect(parser.supports('Rule-Decision-Scorecard')).toBe(true);
    });

    it('returns true for Rule-Decision-PredictiveModel', () => {
      expect(parser.supports('Rule-Decision-PredictiveModel')).toBe(true);
    });

    it('returns true for Rule-Decision-AdaptiveModel', () => {
      expect(parser.supports('Rule-Decision-AdaptiveModel')).toBe(true);
    });

    it('returns true for Rule-Decision-Interaction', () => {
      expect(parser.supports('Rule-Decision-Interaction')).toBe(true);
    });

    it('returns true for Rule-Decision-DecisionData', () => {
      expect(parser.supports('Rule-Decision-DecisionData')).toBe(true);
    });

    it('returns false for abstract Rule-Decision-', () => {
      expect(parser.supports('Rule-Decision-')).toBe(false);
    });

    it('returns false for unrelated classes', () => {
      expect(parser.supports('Rule-Obj-Activity')).toBe(false);
      expect(parser.supports('Rule-Obj-Model')).toBe(false);
      expect(parser.supports('Rule-Obj-Class')).toBe(false);
    });
  });

  describe('parse()', () => {
    it('parses a basic strategy with pyName', () => {
      const json = {
        pxObjClass: 'Rule-Decision-Strategy',
        pyClassName: 'MyCorp.MyClass',
        pyPurpose: 'CustomerStrategy',
        pyDescription: 'Main customer strategy',
        pyLabel: 'Customer Strategy',
      };
      const result = parser.parse(json);
      expect(result.symbol.name).toBe('CustomerStrategy');
      expect(result.symbol.ruleType).toBe('Rule-Decision-Strategy');
      expect(result.symbol.className).toBe('MyCorp.MyClass');
      expect(result.symbol.isRule).toBe(true);
    });

    it('parses pyLabel fallback when pyName and pyPurpose are missing', () => {
      const json = {
        pxObjClass: 'Rule-Decision-Strategy',
        pyClassName: 'MyClass',
        pyLabel: 'FallbackLabel',
      };
      const result = parser.parse(json);
      expect(result.symbol.name).toBe('FallbackLabel');
    });

    it('extracts dependencies from component refs', () => {
      const json: Record<string, unknown> = {
        pxObjClass: 'Rule-Decision-Strategy',
        pyClassName: 'MyClass',
        pyPurpose: 'MyStrategy',
        pyComponents: [
          { pyName: 'Comp1', pyComponentType: 'Segment', pyRef: 'RefRule1' },
          { pyName: 'Comp2', pyComponentType: 'Filter', pyTreatment: 'RefRule2' },
        ],
      };
      const result = parser.parse(json);
      expect(result.dependencies.length).toBeGreaterThanOrEqual(2);
      expect(result.dependencies[0].ruleName).toBe('RefRule1');
      expect(result.dependencies[1].ruleName).toBe('RefRule2');
    });
  });

  describe('parseStrategy()', () => {
    it('parses a strategy with multiple components', () => {
      const json: Record<string, unknown> = {
        pxObjClass: 'Rule-Decision-Strategy',
        pyName: 'PremiumOfferStrategy',
        pyDescription: 'Strategy for premium customer offers',
        pyComponents: [
          { pyName: 'HighValueSegment', pyComponentType: 'Segment', pyExpression: '.CustomerType = "Premium"' },
          { pyName: 'EligibilityFilter', pyComponentType: 'Filter', pyWhen: 'IsEligible' },
          { pyName: 'ProfitRank', pyComponentType: 'Rank', pyRankBy: 'ProfitScore' },
          { pyName: 'TopPriority', pyComponentType: 'SetPriority', pyPriority: '10' },
          { pyName: 'NBAStep', pyComponentType: 'NBA', pyIssue: 'CrossSell', pyGroup: 'Main' },
          { pyName: 'FinalOffer', pyComponentType: 'Offer', pyLabel: 'Premium Loan', pyDisplayOrder: 1 },
        ],
      };
      const strategy = parser.parseStrategy(json);
      expect(strategy.pyName).toBe('PremiumOfferStrategy');
      expect(strategy.pyDescription).toBe('Strategy for premium customer offers');
      expect(strategy.pyType).toBe('Rule-Decision-Strategy');
      expect(strategy.components.length).toBe(6);
      expect(strategy.components[0].pyName).toBe('HighValueSegment');
      expect(strategy.components[0].pyComponentType).toBe('Segment');
      expect(strategy.components[1].pyComponentType).toBe('Filter');
      expect(strategy.components[2].pyComponentType).toBe('Rank');
      expect(strategy.components[3].pyComponentType).toBe('SetPriority');
      expect(strategy.components[4].pyComponentType).toBe('NBA');
      expect(strategy.components[5].pyComponentType).toBe('Offer');
    });

    it('parses strategy with pySegments as components', () => {
      const json: Record<string, unknown> = {
        pyName: 'SegmentedStrategy',
        pySegments: [
          { pyName: 'SegA', pyExpression: '.Region = "US"' },
          { pyName: 'SegB', pyExpression: '.Region = "EU"' },
        ],
      };
      const strategy = parser.parseStrategy(json);
      expect(strategy.components.length).toBe(2);
      expect(strategy.components[0].pyComponentType).toBe('Segment');
      expect(strategy.components[0].config.pyExpression).toBe('.Region = "US"');
    });

    it('handles missing pyName with UnnamedStrategy', () => {
      const strategy = parser.parseStrategy({});
      expect(strategy.pyName).toBe('UnnamedStrategy');
    });

    it('returns empty components when no component data exists', () => {
      const strategy = parser.parseStrategy({ pyName: 'EmptyStrategy' });
      expect(strategy.components).toEqual([]);
    });
  });

  describe('parseCondition()', () => {
    it('parses condition with expression string', () => {
      const raw = {
        pyName: 'HighValueCond',
        pyType: 'Filter',
        pyExpression: '.CustomerType = "Premium"',
        operator: 'equals',
        field: 'CustomerType',
        value: 'Premium',
      };
      const cond = parser.parseCondition(raw);
      expect(cond.pyName).toBe('HighValueCond');
      expect(cond.pyType).toBe('Filter');
      expect(cond.pyExpression).toBe('.CustomerType = "Premium"');
      expect(cond.operator).toBe('EQUALS');
      expect(cond.field).toBe('CustomerType');
      expect(cond.value).toBe('Premium');
    });

    it('parses condition with pyWhen reference', () => {
      const raw = {
        pyName: 'EligibilityCond',
        pyWhen: 'IsEligible',
      };
      const cond = parser.parseCondition(raw);
      expect(cond.pyWhen).toBe('IsEligible');
      expect(cond.pyExpression).toBe('IsEligible');
    });

    it('parses condition with pyField mapping', () => {
      const cond = parser.parseCondition({ pyName: 'FCond', pyField: 'Status' });
      expect(cond.field).toBe('Status');
    });

    it('handles condition with custom operator', () => {
      const cond = parser.parseCondition({ pyName: 'CustomCond', operator: 'custom', pyExpression: '@MyRule.Check' });
      expect(cond.operator).toBe('CUSTOM');
    });

    it('returns undefined operator for unknown operator string', () => {
      const cond = parser.parseCondition({ pyName: 'UnknownOp', operator: 'bogus_op_xyz' });
      expect(cond.operator).toBeUndefined();
    });
  });

  describe('parseNBA()', () => {
    it('parses NBA with date ranges', () => {
      const raw: Record<string, unknown> = {
        pyName: 'CrossSellNBA',
        pyIssue: 'CrossSell',
        pyGroup: 'MainGroup',
        pyActive: true,
        pyStartDate: '20260701T000000.000 GMT',
        pyEndDate: '20261231T235959.000 GMT',
      };
      const nba = parser.parseNBA(raw);
      expect(nba.pyName).toBe('CrossSellNBA');
      expect(nba.pyIssue).toBe('CrossSell');
      expect(nba.pyGroup).toBe('MainGroup');
      expect(nba.pyActive).toBe(true);
      expect(nba.pyStartDate).toBe('20260701T000000.000 GMT');
      expect(nba.pyEndDate).toBe('20261231T235959.000 GMT');
    });

    it('parses NBA with embedded proposition', () => {
      const raw: Record<string, unknown> = {
        pyName: 'WeightedNBA',
        proposition: {
          pyName: 'HighProp',
          pyGroup: 'Tier1',
          pyWeight: 100,
        },
      };
      const nba = parser.parseNBA(raw);
      expect(nba.proposition).toBeDefined();
      expect(nba.proposition!.pyName).toBe('HighProp');
      expect(nba.proposition!.pyWeight).toBe(100);
    });

    it('parses NBA with embedded offer via pyOffer', () => {
      const raw: Record<string, unknown> = {
        pyName: 'OfferNBA',
        pyOffer: {
          pyName: 'GoldOffer',
          pyLabel: 'Gold Card',
        },
      };
      const nba = parser.parseNBA(raw);
      expect(nba.offer).toBeDefined();
      expect(nba.offer!.pyName).toBe('GoldOffer');
      expect(nba.offer!.pyLabel).toBe('Gold Card');
    });

    it('handles inactive NBA', () => {
      const nba = parser.parseNBA({ pyName: 'InactiveNBA', pyActive: false });
      expect(nba.pyActive).toBe(false);
    });

    it('handles NBA with no optional fields', () => {
      const nba = parser.parseNBA({ pyName: 'MinimalNBA' });
      expect(nba.pyName).toBe('MinimalNBA');
      expect(nba.pyIssue).toBeUndefined();
      expect(nba.pyActive).toBeUndefined();
    });
  });

  describe('parseOffer()', () => {
    it('parses offer with treatment refs', () => {
      const raw: Record<string, unknown> = {
        pyName: 'PremiumLoanOffer',
        pyLabel: 'Premium Personal Loan',
        pyIcon: 'loan-icon.png',
        pyDescription: 'Special loan for premium customers',
        pyTreatment: 'EmailTreatment_01',
        pyDisplayOrder: 2,
        treatment: {
          pyName: 'EmailTreatment_01',
          pyContent: 'Dear {{.CustomerName}}, get our premium loan...',
          pyChannel: 'Email',
          pyDisplayFormat: 'HTML',
        },
      };
      const offer = parser.parseOffer(raw);
      expect(offer.pyName).toBe('PremiumLoanOffer');
      expect(offer.pyLabel).toBe('Premium Personal Loan');
      expect(offer.pyIcon).toBe('loan-icon.png');
      expect(offer.pyDescription).toBe('Special loan for premium customers');
      expect(offer.pyTreatment).toBe('EmailTreatment_01');
      expect(offer.pyDisplayOrder).toBe(2);
      expect(offer.treatment).toBeDefined();
      expect(offer.treatment!.pyName).toBe('EmailTreatment_01');
      expect(offer.treatment!.pyChannel).toBe('Email');
    });

    it('handles minimal offer', () => {
      const offer = parser.parseOffer({ pyName: 'MinimalOffer' });
      expect(offer.pyName).toBe('MinimalOffer');
      expect(offer.pyLabel).toBeUndefined();
      expect(offer.pyDisplayOrder).toBeUndefined();
    });
  });

  describe('parseProposition()', () => {
    it('parses proposition with weight', () => {
      const raw: Record<string, unknown> = {
        pyName: 'TopProposition',
        pyGroup: 'A1',
        pyTreatment: 'Trt_001',
        pyWeight: 95,
        pyStartDate: '20260701T000000.000 GMT',
      };
      const prop = parser.parseProposition(raw);
      expect(prop.pyName).toBe('TopProposition');
      expect(prop.pyGroup).toBe('A1');
      expect(prop.pyTreatment).toBe('Trt_001');
      expect(prop.pyWeight).toBe(95);
      expect(prop.pyStartDate).toBe('20260701T000000.000 GMT');
    });

    it('parses proposition with embedded offer', () => {
      const raw: Record<string, unknown> = {
        pyName: 'BundleProp',
        pyWeight: 50,
        offer: {
          pyName: 'BundleOffer',
          pyLabel: 'Bundle Deal',
        },
      };
      const prop = parser.parseProposition(raw);
      expect(prop.offer).toBeDefined();
      expect(prop.offer!.pyName).toBe('BundleOffer');
      expect(prop.offer!.pyLabel).toBe('Bundle Deal');
    });
  });

  describe('parseTreatment()', () => {
    it('parses treatment with content and channel', () => {
      const raw: Record<string, unknown> = {
        pyName: 'SMSAlert',
        pyContent: 'Your account balance is low',
        pyChannel: 'SMS',
        pyDisplayFormat: 'PlainText',
      };
      const treatment = parser.parseTreatment(raw);
      expect(treatment.pyName).toBe('SMSAlert');
      expect(treatment.pyContent).toBe('Your account balance is low');
      expect(treatment.pyChannel).toBe('SMS');
      expect(treatment.pyDisplayFormat).toBe('PlainText');
    });
  });

  describe('Strategy -> Component -> Execution integration', () => {
    it('parses a strategy and resolves components via PegaStrategyComponentResolver', () => {
      const json: Record<string, unknown> = {
        pxObjClass: 'Rule-Decision-Strategy',
        pyName: 'IntegrationStrategy',
        pyComponents: [
          { pyName: 'Seg1', pyComponentType: 'Segment', pyExpression: '.Status = "Active"' },
          { pyName: 'Filter1', pyComponentType: 'Filter', pyWhen: 'IsVerified' },
          { pyName: 'Rank1', pyComponentType: 'Rank', pyRankBy: 'Score' },
          { pyName: 'NBA1', pyComponentType: 'NBA', pyIssue: 'Upsell', pyGroup: 'Primary' },
        ],
      };
      const strategy = parser.parseStrategy(json);
      expect(strategy.components.length).toBe(4);

      const resolver = new PegaStrategyComponentResolver();

      for (const comp of strategy.components) {
        const resolved = resolver.resolveComponentType(comp);
        expect(resolved.resolved).toBe(true);
        expect(resolved.componentType).toBe(comp.pyComponentType);
      }
    });
  });

  describe('Round-trip', () => {
    it('parses a complex strategy and re-serializes correctly via JSON round-trip', () => {
      const json: Record<string, unknown> = {
        pxObjClass: 'Rule-Decision-Strategy',
        pyName: 'RoundTripStrategy',
        pyDescription: 'Testing round-trip fidelity',
        pyComponents: [
          { pyName: 'Segment1', pyComponentType: 'Segment', pyExpression: '.Region = "US"' },
          { pyName: 'Offer1', pyComponentType: 'Offer', pyLabel: 'Test Offer', pyDisplayOrder: 1 },
        ],
      };
      const strategy = parser.parseStrategy(json);
      const roundTripped = JSON.parse(JSON.stringify(strategy)) as Strategy;
      expect(roundTripped.pyName).toBe('RoundTripStrategy');
      expect(roundTripped.pyDescription).toBe('Testing round-trip fidelity');
      expect(roundTripped.components.length).toBe(2);
      expect(roundTripped.components[0].pyName).toBe('Segment1');
      expect(roundTripped.components[1].pyComponentType).toBe('Offer');
    });
  });

  describe('Missing fields', () => {
    it('handles empty JSON gracefully', () => {
      const strategy = parser.parseStrategy({});
      expect(strategy.pyName).toBe('UnnamedStrategy');
      expect(strategy.components).toEqual([]);
      expect(strategy.pyDescription).toBeUndefined();
    });

    it('handles null pyComponents', () => {
      const strategy = parser.parseStrategy({ pyName: 'NullComp', pyComponents: null });
      expect(strategy.components).toEqual([]);
    });

    it('handles non-array pyComponents', () => {
      const strategy = parser.parseStrategy({ pyName: 'BadComp', pyComponents: 'notanarray' });
      expect(strategy.components).toEqual([]);
    });

    it('handles null pySegments', () => {
      const strategy = parser.parseStrategy({ pyName: 'NullSeg', pySegments: null });
      expect(strategy.components).toEqual([]);
    });

    it('handles partially undefined NBA fields', () => {
      const nba = parser.parseNBA({ pyName: 'PartialNBA', pyIssue: undefined });
      expect(nba.pyName).toBe('PartialNBA');
      expect(nba.pyIssue).toBeUndefined();
    });
  });
});
