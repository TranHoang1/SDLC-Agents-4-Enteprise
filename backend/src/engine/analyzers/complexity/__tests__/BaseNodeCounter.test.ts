/**
 * KSA-161 — Unit tests for BaseNodeCounter decision-point counting.
 */

import { describe, it, expect } from 'vitest';
import { BaseNodeCounter } from '../counters/BaseNodeCounter.js';
import { mockNode } from './mock-node.js';

class StubCounter extends BaseNodeCounter {
  readonly language = 'stub';
  readonly branchNodeTypes = ['if_statement', 'conditional_expression'];
  readonly loopNodeTypes = ['while_statement'];
  readonly logicalOperators = ['&&', '||'];
  readonly exceptionNodeTypes = ['catch_clause'];
}

describe('BaseNodeCounter', () => {
  it('counts branches, loops, exceptions and logical operators in one pass', () => {
    const counter = new StubCounter();
    const body = mockNode({
      type: 'statement_block',
      children: [
        mockNode({ type: 'if_statement' }),
        mockNode({ type: 'conditional_expression' }),
        mockNode({ type: 'while_statement' }),
        mockNode({ type: 'catch_clause' }),
        mockNode({ type: 'binary_expression', fields: { operator: mockNode({ type: 'operator', text: '&&' }) } }),
      ],
    });
    expect(counter.countDecisionPoints(body)).toEqual({
      branches: 2,
      loops: 1,
      logical_ops: 1,
      exception_handlers: 1,
    });
  });

  it('does not count unknown or plain node types', () => {
    const counter = new StubCounter();
    const body = mockNode({
      type: 'statement_block',
      children: [
        mockNode({ type: 'expression_statement' }),
        mockNode({ type: 'identifier', text: 'x' }),
        mockNode({ type: 'binary_expression', fields: { operator: mockNode({ type: 'operator', text: '+' }) } }),
      ],
    });
    expect(counter.countDecisionPoints(body)).toEqual({
      branches: 0, loops: 0, logical_ops: 0, exception_handlers: 0,
    });
  });

  it('counts only configured logical operators', () => {
    const counter = new StubCounter();
    const body = mockNode({
      type: 'statement_block',
      children: [
        mockNode({ type: 'binary_expression', fields: { operator: mockNode({ type: 'operator', text: '||' }) } }),
        mockNode({ type: 'binary_expression', fields: { operator: mockNode({ type: 'operator', text: '==' }) } }),
      ],
    });
    expect(counter.countDecisionPoints(body).logical_ops).toBe(1);
  });

  it('computes maximum nesting depth of control structures', () => {
    const counter = new StubCounter();
    const body = mockNode({
      type: 'statement_block',
      children: [
        mockNode({
          type: 'if_statement',
          children: [
            mockNode({
              type: 'statement_block',
              children: [
                mockNode({
                  type: 'while_statement',
                  children: [
                    mockNode({ type: 'statement_block', children: [mockNode({ type: 'if_statement' })] }),
                  ],
                }),
              ],
            }),
          ],
        }),
      ],
    });
    expect(counter.calculateNestingDepth(body)).toBe(3);
  });

  it('returns zero nesting depth for flat bodies', () => {
    const counter = new StubCounter();
    const body = mockNode({
      type: 'statement_block',
      children: [mockNode({ type: 'if_statement' }), mockNode({ type: 'expression_statement' })],
    });
    expect(counter.calculateNestingDepth(body)).toBe(1);
  });

  it('counts early returns as total returns minus one', () => {
    const counter = new StubCounter();
    const body = mockNode({
      type: 'statement_block',
      children: [
        mockNode({ type: 'return_statement' }),
        mockNode({ type: 'return_statement' }),
        mockNode({ type: 'return_statement' }),
      ],
    });
    expect(counter.countEarlyReturns(body)).toBe(2);
  });

  it('returns zero when there are no or only one returns', () => {
    const counter = new StubCounter();
    expect(counter.countEarlyReturns(mockNode({ type: 'statement_block' }))).toBe(0);
    expect(counter.countEarlyReturns(mockNode({
      type: 'statement_block',
      children: [mockNode({ type: 'return_statement' })],
    }))).toBe(0);
  });
});