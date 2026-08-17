/**
 * KSA-161 — Unit tests for the Kotlin decision point counter.
 */

import { describe, it, expect } from 'vitest';
import { KotlinCounter } from '../counters/KotlinCounter.js';
import { mockNode } from './mock-node.js';

describe('KotlinCounter', () => {
  const counter = new KotlinCounter();

  it('declares the kotlin language with expected node lists', () => {
    expect(counter.language).toBe('kotlin');
    expect(counter.branchNodeTypes).toContain('if_expression');
    expect(counter.branchNodeTypes).toContain('when_entry');
    expect(counter.branchNodeTypes).toContain('elvis_expression');
    expect(counter.loopNodeTypes).toContain('do_while_statement');
    expect(counter.exceptionNodeTypes).toEqual(['catch_block']);
  });

  it('counts Kotlin decision points', () => {
    const body = mockNode({
      type: 'function_body',
      children: [
        mockNode({ type: 'if_expression' }),
        mockNode({ type: 'when_entry' }),
        mockNode({ type: 'elvis_expression' }),
        mockNode({ type: 'for_statement' }),
        mockNode({ type: 'while_statement' }),
        mockNode({ type: 'do_while_statement' }),
        mockNode({ type: 'catch_block' }),
        mockNode({ type: 'conjunction_expression' }),
        mockNode({ type: 'disjunction_expression' }),
        mockNode({ type: 'binary_expression', fields: { operator: mockNode({ type: 'operator', text: '&&' }) } }),
      ],
    });
    expect(counter.countDecisionPoints(body)).toEqual({
      branches: 3, loops: 3, logical_ops: 3, exception_handlers: 1,
    });
  });

  it('counts returns via jump_expression nodes only', () => {
    const body = mockNode({
      type: 'function_body',
      children: [
        mockNode({ type: 'jump_expression' }),
        mockNode({ type: 'jump_expression' }),
        mockNode({ type: 'return_statement' }),
      ],
    });
    expect(counter.countEarlyReturns(body)).toBe(1);
  });

  it('ignores return_statement which is not a Kotlin return node', () => {
    const body = mockNode({
      type: 'function_body',
      children: [mockNode({ type: 'return_statement' }), mockNode({ type: 'return_statement' })],
    });
    expect(counter.countEarlyReturns(body)).toBe(0);
  });

  it('computes nesting depth across control structures', () => {
    const body = mockNode({
      type: 'function_body',
      children: [
        mockNode({ type: 'if_expression', children: [mockNode({ type: 'statement_block', children: [mockNode({ type: 'while_statement', children: [mockNode({ type: 'statement_block', children: [mockNode({ type: 'when_entry' })] })] })] })] }),
      ],
    });
    expect(counter.calculateNestingDepth(body)).toBe(3);
  });
});