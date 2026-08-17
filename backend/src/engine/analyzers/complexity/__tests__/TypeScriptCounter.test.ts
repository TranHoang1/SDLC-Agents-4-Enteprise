/**
 * KSA-161 — Unit tests for the TypeScript/JavaScript decision point counter.
 */

import { describe, it, expect } from 'vitest';
import { TypeScriptCounter } from '../counters/TypeScriptCounter.js';
import { mockNode } from './mock-node.js';

describe('TypeScriptCounter', () => {
  const counter = new TypeScriptCounter();

  it('declares the typescript language with expected node lists', () => {
    expect(counter.language).toBe('typescript');
    expect(counter.branchNodeTypes).toContain('if_statement');
    expect(counter.branchNodeTypes).toContain('ternary_expression');
    expect(counter.loopNodeTypes).toContain('for_in_statement');
    expect(counter.logicalOperators).toEqual(['&&', '||', '??']);
    expect(counter.exceptionNodeTypes).toEqual(['catch_clause']);
  });

  it('counts TS decision points across branch/loop/exception/node lists', () => {
    const body = mockNode({
      type: 'statement_block',
      children: [
        mockNode({ type: 'if_statement' }),
        mockNode({ type: 'switch_case' }),
        mockNode({ type: 'ternary_expression' }),
        mockNode({ type: 'for_statement' }),
        mockNode({ type: 'for_in_statement' }),
        mockNode({ type: 'while_statement' }),
        mockNode({ type: 'do_statement' }),
        mockNode({ type: 'catch_clause' }),
        mockNode({ type: 'binary_expression', fields: { operator: mockNode({ type: 'operator', text: '&&' }) } }),
        mockNode({ type: 'optional_chain_expression' }),
      ],
    });
    expect(counter.countDecisionPoints(body)).toEqual({
      branches: 3, loops: 4, logical_ops: 2, exception_handlers: 1,
    });
  });

  it('counts optional chaining as a logical branch decision', () => {
    const body = mockNode({
      type: 'statement_block',
      children: [mockNode({ type: 'optional_chain_expression' })],
    });
    expect(counter.countDecisionPoints(body).logical_ops).toBe(1);
  });

  it('ignores binary operators not in the logical set', () => {
    const body = mockNode({
      type: 'statement_block',
      children: [mockNode({ type: 'binary_expression', fields: { operator: mockNode({ type: 'operator', text: '==' }) } })],
    });
    expect(counter.countDecisionPoints(body).logical_ops).toBe(0);
  });

  it('counts return statements as early returns minus one', () => {
    const body = mockNode({
      type: 'statement_block',
      children: [mockNode({ type: 'return_statement' }), mockNode({ type: 'return_statement' })],
    });
    expect(counter.countEarlyReturns(body)).toBe(1);
  });

  it('computes nesting for nested if/while', () => {
    const body = mockNode({
      type: 'statement_block',
      children: [
        mockNode({ type: 'if_statement', children: [mockNode({ type: 'statement_block', children: [mockNode({ type: 'while_statement' })] })] }),
      ],
    });
    expect(counter.calculateNestingDepth(body)).toBe(2);
  });
});