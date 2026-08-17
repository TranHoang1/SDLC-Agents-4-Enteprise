/**
 * KSA-164 — Unit tests for CFG construction and helpers.
 * Covers BasicBlock, ControlFlowGraph, CFGBuilder + statement handlers.
 */

import { describe, it, expect } from 'vitest';
import { BasicBlock } from '../cfg/BasicBlock.js';
import { ControlFlowGraph } from '../cfg/ControlFlowGraph.js';
import { CFGBuilder } from '../cfg/CFGBuilder.js';
import { getFunctionBody, processStatement } from '../cfg/CFGStatementHandlers.js';
import { mockNode } from './mock-node.js';

function idNode(text: string, row = 0): ReturnType<typeof mockNode> {
  return mockNode({ type: 'identifier', text, row });
}

describe('BasicBlock', () => {
  it('adds statements and tracks line range', () => {
    const block = new BasicBlock(1, 'normal');
    block.addStatement(idNode('x', 2));
    block.addStatement(idNode('y', 5));
    expect(block.isEmpty).toBe(false);
    expect(block.startLine).toBe(3);
    expect(block.endLine).toBe(6);
    expect(block.statements.map(s => s.type)).toEqual(['identifier', 'identifier']);
  });

  it('extracts definitions from declarations', () => {
    const block = new BasicBlock(1, 'normal');
    const decl = mockNode({
      type: 'lexical_declaration',
      children: [mockNode({
        type: 'variable_declarator',
        fields: { name: idNode('foo', 1) },
      })],
    });
    block.addStatement(decl);
    const defs = block.getDefinitions();
    expect(defs).toHaveLength(1);
    expect(defs[0].name).toBe('foo');
    expect(defs[0].blockId).toBe(1);
  });

  it('extracts definitions from assignments', () => {
    const block = new BasicBlock(1, 'normal');
    block.addStatement(mockNode({
      type: 'assignment_expression',
      fields: { left: idNode('bar', 3) },
    }));
    expect(block.getDefinitions().map(d => d.name)).toEqual(['bar']);
  });

  it('extracts uses from identifier subtrees', () => {
    const block = new BasicBlock(1, 'normal');
    block.addStatement(mockNode({
      type: 'call_expression',
      children: [idNode('baz', 1), idNode('qux', 1)],
    }));
    const uses = block.getUses();
    expect(uses.map(u => u.name).sort()).toEqual(['baz', 'qux']);
    expect(uses.every(u => u.blockId === 1)).toBe(true);
  });

  it('is empty when no statements', () => {
    const block = new BasicBlock(0, 'entry');
    expect(block.isEmpty).toBe(true);
    expect(block.getDefinitions()).toEqual([]);
    expect(block.getUses()).toEqual([]);
  });
});

describe('ControlFlowGraph', () => {
  it('adds blocks and edges, exposing adjacency', () => {
    const a = new BasicBlock(0, 'entry');
    const b = new BasicBlock(1, 'normal');
    const c = new BasicBlock(2, 'exit');
    const cfg = new ControlFlowGraph(a);
    cfg.addBlock(b);
    cfg.addBlock(c);
    cfg.addEdge(a, b, 'sequential');
    cfg.addEdge(b, c, 'sequential');

    expect(cfg.blocks).toHaveLength(3);
    expect(cfg.getSuccessors(a).map(x => x.id)).toEqual([1]);
    expect(cfg.getPredecessors(c).map(x => x.id)).toEqual([1]);
    expect(cfg.getOutEdges(b)).toHaveLength(1);
    expect(cfg.getInEdges(b)).toHaveLength(1);
    expect(cfg.exits.map(x => x.id)).toEqual([2]);
    expect(cfg.getBlock(1)).toBe(b);
    expect(cfg.getBlock(99)).toBeUndefined();
  });

  it('computes topological order and reverse post-order', () => {
    const a = new BasicBlock(0, 'entry');
    const b = new BasicBlock(1, 'normal');
    const c = new BasicBlock(2, 'exit');
    const cfg = new ControlFlowGraph(a);
    cfg.addBlock(b);
    cfg.addBlock(c);
    cfg.addEdge(a, b, 'sequential');
    cfg.addEdge(b, c, 'sequential');

    const topo = cfg.topologicalOrder().map(x => x.id);
    expect(topo).toEqual([0, 1, 2]);
    const rpo = cfg.reversePostOrder().map(x => x.id);
    expect(rpo[0]).toBe(0);
    expect(rpo[rpo.length - 1]).toBe(2);
  });

  it('renders a readable string summary', () => {
    const a = new BasicBlock(0, 'entry');
    const cfg = new ControlFlowGraph(a);
    const b = new BasicBlock(1, 'exit');
    cfg.addBlock(b);
    cfg.addEdge(a, b, 'sequential');
    const str = cfg.toString();
    expect(str).toContain('2 blocks, 1 edges');
    expect(str).toContain('B0 -[sequential]-> B1');
  });
});

describe('getFunctionBody', () => {
  it('finds the body via field', () => {
    const body = mockNode({ type: 'statement_block' });
    const fn = mockNode({ type: 'function_declaration', fields: { body } });
    expect(getFunctionBody(fn, 'ts')).toBe(body);
  });

  it('finds a block child otherwise', () => {
    const body = mockNode({ type: 'block' });
    const fn = mockNode({ type: 'function_definition', children: [body] });
    expect(getFunctionBody(fn, 'python')).toBe(body);
  });

  it('returns null when no body', () => {
    const fn = mockNode({ type: 'declaration' });
    expect(getFunctionBody(fn, 'ts')).toBeNull();
  });
});

describe('processStatement', () => {
  it('adds default statements to the current block', () => {
    const current = new BasicBlock(0, 'entry');
    const exit = new BasicBlock(1, 'exit');
    const cfg = new ControlFlowGraph(current);
    cfg.addBlock(exit);
    const stmt = mockNode({ type: 'expression_statement', children: [idNode('x', 1)] });
    const next = processStatement(stmt, current, exit, cfg, () => new BasicBlock(9, 'normal'));
    expect(next).toBe(current);
    expect(current.statements).toHaveLength(1);
  });

  it('routes return statements to exit and signals termination', () => {
    const current = new BasicBlock(0, 'entry');
    const exit = new BasicBlock(1, 'exit');
    const cfg = new ControlFlowGraph(current);
    cfg.addBlock(exit);
    const ret = mockNode({ type: 'return_statement' });
    const next = processStatement(ret, current, exit, cfg, () => new BasicBlock(9, 'normal'));
    expect(next).toBeNull();
    expect(cfg.getOutEdges(current)[0].type).toBe('return');
  });
});

describe('CFGBuilder', () => {
  it('builds a linear CFG for a function with a body', () => {
    const builder = new CFGBuilder();
    const body = mockNode({
      type: 'statement_block',
      children: [mockNode({ type: 'expression_statement', children: [idNode('a', 1)] })],
    });
    const fn = mockNode({ type: 'function_declaration', fields: { body } });
    const cfg = builder.build(fn, 'ts');

    expect(cfg.entry.type).toBe('entry');
    expect(cfg.exits).toHaveLength(1);
    expect(cfg.blocks.length).toBeGreaterThanOrEqual(2); // entry, exit
    // the single statement is absorbed into the entry block
    expect(cfg.entry.statements.length).toBeGreaterThan(0);
    expect(cfg.getSuccessors(cfg.entry).some(b => b.type === 'exit')).toBe(true);
  });

  it('links entry directly to exit when no body', () => {
    const builder = new CFGBuilder();
    const fn = mockNode({ type: 'function_declaration' });
    const cfg = builder.build(fn, 'ts');
    expect(cfg.getSuccessors(cfg.entry).map(b => b.type)).toContain('exit');
  });

  it('builds an if/else diamond', () => {
    const builder = new CFGBuilder();
    const consequence = mockNode({ type: 'expression_statement', children: [idNode('t', 1)] });
    const alternative = mockNode({ type: 'else_clause', children: [mockNode({ type: 'expression_statement', children: [idNode('e', 2)] })] });
    const ifStmt = mockNode({
      type: 'if_statement',
      fields: {
        condition: idNode('cond', 0),
        consequence,
        alternative,
      },
    });
    const body = mockNode({ type: 'statement_block', children: [ifStmt] });
    const fn = mockNode({ type: 'function_declaration', fields: { body } });
    const cfg = builder.build(fn, 'ts');

    const branchTrue = cfg.edges.filter(e => e.type === 'branch-true');
    const branchFalse = cfg.edges.filter(e => e.type === 'branch-false');
    expect(branchTrue.length).toBeGreaterThanOrEqual(1);
    expect(branchFalse.length).toBeGreaterThanOrEqual(1);
  });
});