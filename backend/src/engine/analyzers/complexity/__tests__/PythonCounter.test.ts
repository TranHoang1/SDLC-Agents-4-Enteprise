/**
 * KSA-161 — Unit tests for the Python decision point counter.
 */

import { describe, it, expect } from 'vitest';
import { PythonCounter } from '../counters/PythonCounter.js';
import { mockNode } from './mock-node.js';

describe('PythonCounter', () => {
  const counter = new PythonCounter();

  it('declares the python language with expected node lists', () => {
    expect(counter.language).toBe('python');
    expect(counter.branchNodeTypes).toContain('elif_clause');
    expect(counter.branchNodeTypes).toContain('conditional_expression');
    expect(counter.loopNodeTypes).toEqual(['for_statement', 'while_statement']);
    expect(counter.logicalOperators).toEqual(['and', 'or']);
    expect(counter.exceptionNodeTypes).toEqual(['except_clause']);
  });

  it('counts Python decision points', () => {
    const body = mockNode({
      type: 'module',
      children: [
        mockNode({ type: 'if_statement' }),
        mockNode({ type: 'elif_clause' }),
        mockNode({ type: 'conditional_expression' }),
        mockNode({ type: 'for_statement' }),
        mockNode({ type: 'while_statement' }),
        mockNode({ type: 'except_clause' }),
        mockNode({ type: 'boolean_operator', fields: { operator: mockNode({ type: 'operator', text: 'and' }) } }),
        mockNode({ type: 'boolean_operator', fields: { operator: mockNode({ type: 'operator', text: 'or' }) } }),
      ],
    });
    expect(counter.countDecisionPoints(body)).toEqual({
      branches: 3, loops: 2, logical_ops: 2, exception_handlers: 1,
    });
  });

  it('falls back to children keywords for and/or detection', () => {
    const body = mockNode({
      type: 'module',
      children: [mockNode({ type: 'boolean_operator', children: [mockNode({ text: 'or' })] })],
    });
    expect(counter.countDecisionPoints(body).logical_ops).toBe(1);
  });

  it('counts a boolean_operator once even with multiple operator keywords', () => {
    const body = mockNode({
      type: 'module',
      children: [
        mockNode({ type: 'boolean_operator', children: [mockNode({ text: 'and' }), mockNode({ text: 'or' })] }),
      ],
    });
    expect(counter.countDecisionPoints(body).logical_ops).toBe(1);
  });

  it('counts return statements as early returns minus one', () => {
    const body = mockNode({
      type: 'module',
      children: [mockNode({ type: 'return_statement' }), mockNode({ type: 'return_statement' }), mockNode({ type: 'return_statement' })],
    });
    expect(counter.countEarlyReturns(body)).toBe(2);
  });

  it('computes nesting depth across combined control structures', () => {
    const body = mockNode({
      type: 'module',
      children: [
        mockNode({
          type: 'if_statement',
          children: [
            mockNode({ type: 'block', children: [mockNode({ type: 'while_statement', children: [mockNode({ type: 'block', children: [mockNode({ type: 'for_statement' })] })] })] }),
          ],
        }),
      ],
    });
    expect(counter.calculateNestingDepth(body)).toBe(3);
  });
});