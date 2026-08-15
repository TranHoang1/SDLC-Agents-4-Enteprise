/**
 * KSA-161 — Unit tests for the ComplexityCalculator orchestration engine.
 */

import { describe, it, expect } from 'vitest';
import { ComplexityCalculator } from '../ComplexityCalculator.js';
import { BaseNodeCounter } from '../counters/BaseNodeCounter.js';
import { mockNode } from './mock-node.js';

class JavaCounter extends BaseNodeCounter {
  readonly language = 'java-stub';
  readonly branchNodeTypes = ['if_statement'];
  readonly loopNodeTypes = ['for_statement'];
  readonly logicalOperators = ['&&'];
  readonly exceptionNodeTypes = ['catch_clause'];
}

describe('ComplexityCalculator', () => {
  it('supports built-in languages including javascript', () => {
    const calc = new ComplexityCalculator();
    expect(calc.supportsLanguage('typescript')).toBe(true);
    expect(calc.supportsLanguage('python')).toBe(true);
    expect(calc.supportsLanguage('java')).toBe(true);
    expect(calc.supportsLanguage('kotlin')).toBe(true);
    expect(calc.supportsLanguage('go')).toBe(true);
    expect(calc.supportsLanguage('javascript')).toBe(true);
    expect(calc.supportsLanguage('ruby')).toBe(false);
  });

  it('exposes supported language list', () => {
    const calc = new ComplexityCalculator();
    const langs = calc.getSupportedLanguages();
    expect(langs).toContain('typescript');
    expect(langs).toContain('python');
    expect(langs).toContain('java');
    expect(langs).toContain('kotlin');
    expect(langs).toContain('go');
    expect(langs).toContain('javascript');
  });

  it('computes a full complexity breakdown for typescript', () => {
    const calc = new ComplexityCalculator();
    const body = mockNode({
      type: 'statement_block',
      children: [
        mockNode({ type: 'if_statement' }),
        mockNode({ type: 'while_statement' }),
        mockNode({ type: 'catch_clause' }),
        mockNode({ type: 'binary_expression', fields: { operator: mockNode({ type: 'operator', text: '&&' }) } }),
        mockNode({ type: 'return_statement' }),
        mockNode({ type: 'return_statement' }),
      ],
    });
    const result = calc.calculate(body, 'typescript');
    expect(result).toEqual({
      cyclomatic_complexity: 5,
      branches: 1,
      loops: 1,
      logical_ops: 1,
      exception_handlers: 1,
      nesting_depth: 1,
      early_returns: 1,
    });
  });

  it('returns null for unsupported languages', () => {
    const calc = new ComplexityCalculator();
    expect(calc.calculate(mockNode({ type: 'node' }), 'ruby')).toBeNull();
  });

  it('registers and uses a custom counter', () => {
    const calc = new ComplexityCalculator();
    calc.registerCounter(new JavaCounter());
    expect(calc.supportsLanguage('java-stub')).toBe(true);

    const body = mockNode({
      type: 'method_body',
      children: [mockNode({ type: 'if_statement' }), mockNode({ type: 'for_statement' })],
    });
    const result = calc.calculate(body, 'java-stub');
    expect(result?.cyclomatic_complexity).toBe(3);
    expect(result?.branches).toBe(1);
    expect(result?.loops).toBe(1);
    expect(result?.nesting_depth).toBe(1);
  });
});