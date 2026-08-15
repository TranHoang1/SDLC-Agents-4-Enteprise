/**
 * KSA-161 — Unit tests for the Go decision point counter.
 */

import { describe, it, expect } from 'vitest';
import { GoCounter } from '../counters/GoCounter.js';
import { mockNode } from './mock-node.js';

describe('GoCounter', () => {
  const counter = new GoCounter();

  it('declares the go language with expected node lists', () => {
    expect(counter.language).toBe('go');
    expect(counter.branchNodeTypes).toContain('expression_case');
    expect(counter.branchNodeTypes).toContain('type_case');
    expect(counter.branchNodeTypes).toContain('select_statement');
    expect(counter.branchNodeTypes).toContain('communication_case');
    expect(counter.loopNodeTypes).toEqual(['for_statement']);
    expect(counter.exceptionNodeTypes).toEqual([]);
  });

  it('counts Go decision points', () => {
    const body = mockNode({
      type: 'block',
      children: [
        mockNode({ type: 'if_statement' }),
        mockNode({ type: 'expression_case' }),
        mockNode({ type: 'type_case' }),
        mockNode({ type: 'select_statement' }),
        mockNode({ type: 'communication_case' }),
        mockNode({ type: 'for_statement' }),
        mockNode({ type: 'catch_clause' }),
        mockNode({ type: 'binary_expression', fields: { operator: mockNode({ type: 'operator', text: '||' }) } }),
      ],
    });
    const counts = counter.countDecisionPoints(body);
    expect(counts).toEqual({
      branches: 5, loops: 1, logical_ops: 1, exception_handlers: 0,
    });
  });

  it('counts return statements as early returns minus one', () => {
    const body = mockNode({
      type: 'block',
      children: [mockNode({ type: 'return_statement' }), mockNode({ type: 'return_statement' })],
    });
    expect(counter.countEarlyReturns(body)).toBe(1);
  });

  it('computes nesting depth for nested control flow', () => {
    const body = mockNode({
      type: 'block',
      children: [
        mockNode({ type: 'if_statement', children: [mockNode({ type: 'block', children: [mockNode({ type: 'for_statement', children: [mockNode({ type: 'block', children: [mockNode({ type: 'expression_case' })] })] })] })] }),
      ],
    });
    expect(counter.calculateNestingDepth(body)).toBe(3);
  });
});