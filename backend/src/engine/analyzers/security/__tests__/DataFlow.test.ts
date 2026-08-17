/**
 * KSA-164 — Unit tests for ReachingDefinitions and DataFlowAnalyzer.
 */

import { describe, it, expect } from 'vitest';
import { BasicBlock } from '../cfg/BasicBlock.js';
import { ControlFlowGraph } from '../cfg/ControlFlowGraph.js';
import { ReachingDefinitions } from '../dataflow/ReachingDefinitions.js';
import { DataFlowAnalyzer } from '../dataflow/DataFlowAnalyzer.js';
import { mockNode } from './mock-node.js';

function buildLinearCfg(): ControlFlowGraph {
  const entry = new BasicBlock(0, 'entry');
  const cfg = new ControlFlowGraph(entry);
  const mid = new BasicBlock(1, 'normal');
  const exit = new BasicBlock(2, 'exit');
  cfg.addBlock(mid);
  cfg.addBlock(exit);
  cfg.addEdge(entry, mid, 'sequential');
  cfg.addEdge(mid, exit, 'sequential');

  // entry: let x = 5
  entry.addStatement(mockNode({
    type: 'lexical_declaration',
    children: [mockNode({ type: 'variable_declarator', fields: { name: mockNode({ type: 'identifier', text: 'x', row: 0 }) } })],
  }));
  // mid: y = x + 1
  mid.addStatement(mockNode({
    type: 'assignment_expression',
    fields: { left: mockNode({ type: 'identifier', text: 'y', row: 1 }) },
  }));
  mid.addStatement(mockNode({ type: 'call_expression', children: [mockNode({ type: 'identifier', text: 'x', row: 2 })] }));
  return cfg;
}

describe('ReachingDefinitions', () => {
  it('propagates definitions along sequential flow', () => {
    const cfg = buildLinearCfg();
    const rd = new ReachingDefinitions();
    const inSets = rd.compute(cfg);

    // exit block's IN includes the x definition from entry
    const exitIn = inSets.get(2)!;
    expect(exitIn.size).toBeGreaterThan(0);
    expect(Array.from(exitIn).some(d => d.variable === 'x')).toBe(true);
  });

  it('terminates within iteration bounds on cyclic graphs', () => {
    const a = new BasicBlock(0, 'entry');
    const cfg = new ControlFlowGraph(a);
    const b = new BasicBlock(1, 'loop-header');
    const c = new BasicBlock(2, 'exit');
    cfg.addBlock(b);
    cfg.addBlock(c);
    cfg.addEdge(a, b, 'sequential');
    cfg.addEdge(b, b, 'loop-back');
    cfg.addEdge(b, c, 'loop-exit');
    b.addStatement(mockNode({ type: 'lexical_declaration', children: [mockNode({ type: 'variable_declarator', fields: { name: mockNode({ type: 'identifier', text: 'i', row: 0 }) } })] }));

    const rd = new ReachingDefinitions();
    const inSets = rd.compute(cfg);
    expect(inSets.size).toBe(3);
  });
});

describe('DataFlowAnalyzer', () => {
  it('builds def-use chains', () => {
    const cfg = buildLinearCfg();
    const analyzer = new DataFlowAnalyzer();
    const result = analyzer.analyze(cfg);

    expect(result.definitions.length).toBeGreaterThan(0);
    const xChain = result.defUseChains.find(c => c.definition.variable === 'x');
    expect(xChain).toBeDefined();
    expect(xChain!.uses.length).toBeGreaterThan(0);
  });

  it('returns empty chains when a definition has no uses', () => {
    const entry = new BasicBlock(0, 'entry');
    const cfg = new ControlFlowGraph(entry);
    const exit = new BasicBlock(1, 'exit');
    cfg.addBlock(exit);
    cfg.addEdge(entry, exit, 'sequential');
    entry.addStatement(mockNode({
      type: 'lexical_declaration',
      children: [mockNode({ type: 'variable_declarator', fields: { name: mockNode({ type: 'identifier', text: 'unused', row: 0 }) } })],
    }));

    const analyzer = new DataFlowAnalyzer();
    const result = analyzer.analyze(cfg);
    expect(result.defUseChains).toHaveLength(0);
  });
});