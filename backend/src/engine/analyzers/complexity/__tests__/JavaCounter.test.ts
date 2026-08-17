/**
 * KSA-161 — Unit tests for the Java decision point counter.
 */

import { describe, it, expect } from 'vitest';
import { JavaCounter } from '../counters/JavaCounter.js';
import { mockNode } from './mock-node.js';

describe('JavaCounter', () => {
  const counter = new JavaCounter();

  it('declares the java language with expected node lists', () => {
    expect(counter.language).toBe('java');
    expect(counter.branchNodeTypes).toContain('switch_expression');
    expect(counter.loopNodeTypes).toContain('enhanced_for_statement');
    expect(counter.loopNodeTypes).toContain('do_statement');
    expect(counter.logicalOperators).toEqual(['&&', '||']);
    expect(counter.exceptionNodeTypes).toEqual(['catch_clause']);
  });

  it('counts Java decision points', () => {
    const body = mockNode({
      type: 'method_body',
      children: [
        mockNode({ type: 'if_statement' }),
        mockNode({ type: 'switch_expression' }),
        mockNode({ type: 'ternary_expression' }),
        mockNode({ type: 'enhanced_for_statement' }),
        mockNode({ type: 'while_statement' }),
        mockNode({ type: 'do_statement' }),
        mockNode({ type: 'for_statement' }),
        mockNode({ type: 'catch_clause' }),
        mockNode({ type: 'binary_expression', fields: { operator: mockNode({ type: 'operator', text: '&&' }) } }),
        mockNode({ type: 'binary_expression', fields: { operator: mockNode({ type: 'operator', text: '&' }) } }),
      ],
    });
    expect(counter.countDecisionPoints(body)).toEqual({
      branches: 3, loops: 4, logical_ops: 1, exception_handlers: 1,
    });
  });

  it('counts return statements as early returns minus one', () => {
    const body = mockNode({
      type: 'method_body',
      children: [mockNode({ type: 'return_statement' }), mockNode({ type: 'return_statement' })],
    });
    expect(counter.countEarlyReturns(body)).toBe(1);
  });

  it('computes nesting depth for nested loops', () => {
    const body = mockNode({
      type: 'method_body',
      children: [
        mockNode({ type: 'for_statement', children: [mockNode({ type: 'block', children: [mockNode({ type: 'while_statement', children: [mockNode({ type: 'block', children: [mockNode({ type: 'if_statement' })] })] })] })] }),
      ],
    });
    expect(counter.calculateNestingDepth(body)).toBe(3);
  });
});