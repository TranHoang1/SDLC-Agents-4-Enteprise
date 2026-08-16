/**
 * SA4E-171 — Unit tests for CodeEnrichmentHandler strategy selection.
 * Verifies isPegaKind integration and PEGA_SUMMARY strategy routing.
 */

import { describe, it, expect } from 'vitest';
import { isPegaKind } from '../../../modules/pega/pega-mapping.js';

/**
 * Test strategy selection logic extracted from CodeEnrichmentHandler.
 * Mirrors selectStrategy() without needing full handler instantiation.
 */
const CLASS_KINDS = new Set(['class', 'interface', 'enum']);
const FUNCTION_KINDS = new Set(['function', 'method', 'arrow_function', 'generator']);

function selectStrategy(kind: string, workspaceType: string): string {
  if (workspaceType === 'pega' && isPegaKind(kind)) return 'PEGA_SUMMARY';
  if (FUNCTION_KINDS.has(kind)) return 'FUNCTION_SUMMARY';
  if (CLASS_KINDS.has(kind)) return 'CLASS_SUMMARY';
  return 'CLASS_SUMMARY';
}

describe('CodeEnrichmentHandler strategy selection (SA4E-171)', () => {
  describe('PEGA_SUMMARY strategy', () => {
    const pegaKinds = [
      'pega_activity', 'pega_flow', 'pega_data_transform',
      'pega_decision_table', 'pega_decision_tree', 'pega_section',
      'pega_harness', 'pega_report', 'pega_map_value', 'pega_when',
      'pega_declare_expression', 'pega_declare_page', 'pega_validate',
      'pega_list_view', 'pega_property', 'pega_case_type', 'pega_connector',
      'pega_unknown',
    ];

    it.each(pegaKinds)(
      'should select PEGA_SUMMARY for kind=%s with workspaceType=pega',
      (kind) => {
        expect(selectStrategy(kind, 'pega')).toBe('PEGA_SUMMARY');
      },
    );

    it('should NOT select PEGA_SUMMARY when workspaceType is standard', () => {
      expect(selectStrategy('pega_activity', 'standard')).toBe('CLASS_SUMMARY');
    });

    it('should NOT select PEGA_SUMMARY for non-pega kind even with pega workspace', () => {
      expect(selectStrategy('class', 'pega')).toBe('CLASS_SUMMARY');
      expect(selectStrategy('function', 'pega')).toBe('FUNCTION_SUMMARY');
    });
  });

  describe('standard strategies', () => {
    it('should select FUNCTION_SUMMARY for function kinds', () => {
      expect(selectStrategy('function', 'standard')).toBe('FUNCTION_SUMMARY');
      expect(selectStrategy('method', 'standard')).toBe('FUNCTION_SUMMARY');
      expect(selectStrategy('arrow_function', 'standard')).toBe('FUNCTION_SUMMARY');
      expect(selectStrategy('generator', 'standard')).toBe('FUNCTION_SUMMARY');
    });

    it('should select CLASS_SUMMARY for class kinds', () => {
      expect(selectStrategy('class', 'standard')).toBe('CLASS_SUMMARY');
      expect(selectStrategy('interface', 'standard')).toBe('CLASS_SUMMARY');
      expect(selectStrategy('enum', 'standard')).toBe('CLASS_SUMMARY');
    });

    it('should fallback to CLASS_SUMMARY for unknown kinds', () => {
      expect(selectStrategy('variable', 'standard')).toBe('CLASS_SUMMARY');
      expect(selectStrategy('unknown', 'standard')).toBe('CLASS_SUMMARY');
    });
  });
});