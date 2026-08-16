/**
 * SA4E-171 — Unit tests for pega-mapping module.
 * Covers: resolveSymbolKind, isPegaKind, buildVirtualPath, buildFqn,
 * PEGA_OBJ_CLASS_TO_KIND map (16 entries + connector wildcard + unknown fallback).
 */

import { describe, it, expect } from 'vitest';
import {
  PEGA_OBJ_CLASS_TO_KIND,
  resolveSymbolKind,
  isPegaKind,
  buildVirtualPath,
  buildFqn,
} from '../pega-mapping.js';

describe('pega-mapping', () => {
  describe('PEGA_OBJ_CLASS_TO_KIND', () => {
    it('should contain 16 entries', () => {
      expect(PEGA_OBJ_CLASS_TO_KIND.size).toBe(16);
    });

    it('should map all known pxObjClass values', () => {
      const expected: [string, string][] = [
        ['Rule-Obj-Activity', 'pega_activity'],
        ['Rule-Obj-Flow', 'pega_flow'],
        ['Rule-Obj-DataTransform', 'pega_data_transform'],
        ['Rule-Obj-DecisionTable', 'pega_decision_table'],
        ['Rule-Obj-DecisionTree', 'pega_decision_tree'],
        ['Rule-Obj-Section', 'pega_section'],
        ['Rule-Obj-Harness', 'pega_harness'],
        ['Rule-Obj-Report-Definition', 'pega_report'],
        ['Rule-Obj-MapValue', 'pega_map_value'],
        ['Rule-Obj-When', 'pega_when'],
        ['Rule-Declare-Expressions', 'pega_declare_expression'],
        ['Rule-Declare-Pages', 'pega_declare_page'],
        ['Rule-Obj-Validate', 'pega_validate'],
        ['Rule-Obj-ListVw', 'pega_list_view'],
        ['Rule-Obj-Property', 'pega_property'],
        ['Rule-Obj-CaseType', 'pega_case_type'],
      ];
      for (const [objClass, kind] of expected) {
        expect(PEGA_OBJ_CLASS_TO_KIND.get(objClass)).toBe(kind);
      }
    });
  });

  describe('resolveSymbolKind', () => {
    it('should resolve exact-match pxObjClass to kind', () => {
      expect(resolveSymbolKind('Rule-Obj-Activity')).toBe('pega_activity');
      expect(resolveSymbolKind('Rule-Obj-Flow')).toBe('pega_flow');
      expect(resolveSymbolKind('Rule-Obj-DataTransform')).toBe('pega_data_transform');
    });

    it('should resolve Rule-Connect-* wildcard to pega_connector', () => {
      expect(resolveSymbolKind('Rule-Connect-HTTP')).toBe('pega_connector');
      expect(resolveSymbolKind('Rule-Connect-SOAP')).toBe('pega_connector');
      expect(resolveSymbolKind('Rule-Connect-REST')).toBe('pega_connector');
    });

    it('should fallback to pega_unknown for unrecognized classes', () => {
      expect(resolveSymbolKind('Rule-Obj-Unknown')).toBe('pega_unknown');
      expect(resolveSymbolKind('SomeOtherClass')).toBe('pega_unknown');
      expect(resolveSymbolKind('')).toBe('pega_unknown');
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
    it('should build pega:// virtual path from metadata', () => {
      const result = buildVirtualPath('Work-HR', 'pega_activity', 'ApproveLeave');
      expect(result).toBe('pega://Work-HR/activity/ApproveLeave');
    });

    it('should strip pega_ prefix for ruleType segment', () => {
      expect(buildVirtualPath('Work', 'pega_data_transform', 'MapData'))
        .toBe('pega://Work/data_transform/MapData');
      expect(buildVirtualPath('Org', 'pega_decision_table', 'Routing'))
        .toBe('pega://Org/decision_table/Routing');
    });

    it('should handle connector kind', () => {
      expect(buildVirtualPath('System', 'pega_connector', 'HTTPCall'))
        .toBe('pega://System/connector/HTTPCall');
    });
  });

  describe('buildFqn', () => {
    it('should build FQN in pxObjClass:pyClassName:pyRuleName format', () => {
      const result = buildFqn('Rule-Obj-Activity', 'Work-HR', 'ApproveLeave');
      expect(result).toBe('Rule-Obj-Activity:Work-HR:ApproveLeave');
    });

    it('should handle special characters in names', () => {
      const result = buildFqn('Rule-Obj-Flow', 'Work-Claims', 'Process-Claim');
      expect(result).toBe('Rule-Obj-Flow:Work-Claims:Process-Claim');
    });
  });
});