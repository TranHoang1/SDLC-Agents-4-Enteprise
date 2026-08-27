/**
 * SA4E-171 — Unit tests for pega-mapping module.
 * resolveSymbolKind derives kind deterministically: 'pega_' + pxObjClass
 * lowercased with '-'→'_'. No hardcoded table, so future rule types classify
 * automatically without ever falling through to pega_unknown.
 */

import { describe, it, expect } from 'vitest';
import {
  resolveSymbolKind,
  isPegaKind,
  buildVirtualPath,
  buildFqn,
  parseFqn,
  resolveRuleSetName,
  resolveRuleSetVersion,
} from '../pega-mapping.js';

describe('pega-mapping', () => {
  describe('resolveSymbolKind', () => {
    it('derives kind = pega_ + lowercased pxObjClass with - replaced by _', () => {
      expect(resolveSymbolKind('Rule-Obj-Activity')).toBe('pega_rule_obj_activity');
      expect(resolveSymbolKind('Rule-Obj-Flow')).toBe('pega_rule_obj_flow');
      expect(resolveSymbolKind('Rule-Obj-Model')).toBe('pega_rule_obj_model');
      expect(resolveSymbolKind('Rule-Declare-Expressions')).toBe('pega_rule_declare_expressions');
      expect(resolveSymbolKind('Rule-Connect-REST')).toBe('pega_rule_connect_rest');
    });

    it('classifies previously-unknown / future rule types automatically', () => {
      // A brand-new rule type nobody hardcoded still gets a meaningful kind.
      expect(resolveSymbolKind('Rule-Obj-SomethingNew')).toBe('pega_rule_obj_somethingnew');
      expect(resolveSymbolKind('Rule-Some-FutureType')).toBe('pega_rule_some_futuretype');
    });

    it('handles non Rule- classes losslessly (still prefixed)', () => {
      expect(resolveSymbolKind('Data-Admin-DB-Table')).toBe('pega_data_admin_db_table');
    });

    it('returns pega_unknown only for empty/invalid input', () => {
      expect(resolveSymbolKind('')).toBe('pega_unknown');
      expect(resolveSymbolKind(undefined as unknown as string)).toBe('pega_unknown');
    });

    it('trims surrounding whitespace before deriving', () => {
      expect(resolveSymbolKind('  Rule-Obj-Activity  ')).toBe('pega_rule_obj_activity');
    });
  });

  describe('isPegaKind', () => {
    it('should return true for pega_ prefixed kinds', () => {
      expect(isPegaKind('pega_activity')).toBe(true);
      expect(isPegaKind('pega_flow')).toBe(true);
      expect(isPegaKind('pega_connector')).toBe(true);
      expect(isPegaKind('pega_unknown')).toBe(true);
    });

    it('should return false for non-pega kinds', () => {
      expect(isPegaKind('class')).toBe(false);
      expect(isPegaKind('function')).toBe(false);
      expect(isPegaKind('method')).toBe(false);
      expect(isPegaKind('')).toBe(false);
    });
  });

  describe('buildVirtualPath', () => {
    it('should build pega:// virtual path including ruleset + version', () => {
      const result = buildVirtualPath('Work-HR', 'pega_activity', 'ApproveLeave', 'HRApps', '01-02-01');
      expect(result).toBe('pega://Work-HR/activity/ApproveLeave/HRApps/01-02-01');
    });

    it('should use "-" for missing ruleset/version (so paths stay well-formed)', () => {
      expect(buildVirtualPath('Work', 'pega_data_transform', 'MapData'))
        .toBe('pega://Work/data_transform/MapData/-/-');
    });

    it('distinct ruleset/version produce distinct paths (no collision)', () => {
      const a = buildVirtualPath('Work', 'pega_activity', 'Foo', 'RS1', '01-01-01');
      const b = buildVirtualPath('Work', 'pega_activity', 'Foo', 'RS2', '01-01-01');
      expect(a).not.toBe(b);
    });
  });

  describe('buildFqn', () => {
    it('should build 5-part FQN (type:class:name:ruleset:version)', () => {
      const result = buildFqn('Rule-Obj-Activity', 'Work-HR', 'ApproveLeave', 'HRApps', '01-02-01');
      expect(result).toBe('Rule-Obj-Activity:Work-HR:ApproveLeave:HRApps:01-02-01');
    });

    it('keeps pxObjClass at index 0 so split(":")[0] parsers still work', () => {
      const fqn = buildFqn('Rule-Obj-Flow', 'Work-Claims', 'ProcessClaim', 'RS', '01-01-01');
      expect(fqn.split(':')[0]).toBe('Rule-Obj-Flow');
    });

    it('uses "-" for missing ruleset/version', () => {
      expect(buildFqn('Rule-Obj-Flow', 'Work-Claims', 'Process-Claim'))
        .toBe('Rule-Obj-Flow:Work-Claims:Process-Claim:-:-');
    });

    it('distinct ruleset/version do not collide', () => {
      const a = buildFqn('Rule-Obj-Activity', 'Work', 'Foo', 'RS1', '01-01-01');
      const b = buildFqn('Rule-Obj-Activity', 'Work', 'Foo', 'RS2', '01-01-01');
      expect(a).not.toBe(b);
    });
  });

  describe('parseFqn', () => {
    it('round-trips a 5-part FQN', () => {
      const f = parseFqn('Rule-Obj-Activity:Work-HR:ApproveLeave:HRApps:01-02-01');
      expect(f).toEqual({
        pxObjClass: 'Rule-Obj-Activity', pyClassName: 'Work-HR',
        pyRuleName: 'ApproveLeave', ruleSet: 'HRApps', version: '01-02-01',
      });
    });

    it('tolerates a legacy 3-part FQN (ruleset/version default to "-")', () => {
      const f = parseFqn('Rule-Obj-Flow:Work:MyFlow');
      expect(f.pxObjClass).toBe('Rule-Obj-Flow');
      expect(f.ruleSet).toBe('-');
      expect(f.version).toBe('-');
    });
  });

  describe('resolveRuleSetName / resolveRuleSetVersion', () => {
    it('reads capital-S export fields (pyRuleSet / pyRuleSetVersion)', () => {
      const json = { pyRuleSet: 'HRAppsV2', pyRuleSetVersion: '01-02-01' };
      expect(resolveRuleSetName(json)).toBe('HRAppsV2');
      expect(resolveRuleSetVersion(json)).toBe('01-02-01');
    });

    it('falls back to lowercase fixture fields (pyRuleset / pyRulesetVersion)', () => {
      const json = { pyRuleset: 'Legacy', pyRulesetVersion: '02-00-00' };
      expect(resolveRuleSetName(json)).toBe('Legacy');
      expect(resolveRuleSetVersion(json)).toBe('02-00-00');
    });
  });
});