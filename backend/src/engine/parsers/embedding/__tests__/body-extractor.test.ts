/**
 * SA4E-169 — Unit tests for the function body extractor.
 */

import { describe, it, expect } from 'vitest';
import { BodyExtractor } from '../body-extractor.js';
import type { SyntaxNode } from '../../types.js';
import type { Tree } from 'web-tree-sitter';

interface MockNodeSpec {
  type: string;
  text: string;
  row: number;
  named?: Array<MockNodeSpec | SyntaxNode>;
}

type NodeInput = MockNodeSpec | SyntaxNode;

function isBuiltNode(v: unknown): v is SyntaxNode {
  return !!v && typeof v === 'object' &&
    typeof (v as { child?: unknown }).child === 'function' &&
    (v as { __built?: boolean }).__built === true;
}

function buildNode(spec: NodeInput, parent: SyntaxNode | null = null): SyntaxNode {
  if (isBuiltNode(spec)) {
    Object.defineProperty(spec, 'parent', { value: parent, enumerable: false });
    return spec;
  }
  const children: SyntaxNode[] = [];
  const node = {
    __built: true,
    type: spec.type,
    text: spec.text,
    get startIndex() {
      if (!parent) return 0;
      const idx = (parent as unknown as { text: string }).text.indexOf(spec.text);
      if (idx < 0) return 0;
      return (parent as unknown as { startIndex: number }).startIndex + idx;
    },
    get endIndex() {
      const self = this as unknown as { startIndex: number; text: string };
      return self.startIndex + self.text.length;
    },
    get startPosition() { return { row: spec.row, column: 0 }; },
    get endPosition() { return { row: spec.row + (spec.text.match(/\n/g)?.length ?? 0), column: 0 }; },
    get parent() { return parent; },
    get childCount() { return children.length; },
    get namedChildCount() { return children.length; },
    child(i: number) { return children[i] ?? null; },
    namedChild(i: number) { return children[i] ?? null; },
  } as unknown as SyntaxNode & { __built: boolean };

  for (const childSpec of spec.named ?? []) {
    children.push(buildNode(childSpec, node));
  }
  return node;
}

function fnNode(source: string, row: number, name: string, bodyText: string): SyntaxNode {
  return buildNode({
    type: 'function_declaration',
    text: source,
    row,
    named: [
      { type: 'identifier', text: name, row },
      { type: 'statement_block', text: bodyText, row: row + 1 },
    ],
  });
}

function buildTree(source: string, named: Array<MockNodeSpec | SyntaxNode>): Tree {
  return { rootNode: buildNode({ type: 'program', text: source, row: 0, named }) } as unknown as Tree;
}

describe('BodyExtractor.extractBody', () => {
  it('returns the function body when it exceeds minBodyLines', () => {
    const extractor = new BodyExtractor(3, 10_000);
    const source = 'function doWork() {\n  const x = 1;\n  return x;\n}';
    const node = fnNode(source, 0, 'doWork', '{\n  const x = 1;\n  return x;\n}');
    expect(extractor.extractBody(node, source)).toBe('{\n  const x = 1;\n  return x;\n}');
  });

  it('returns null when the body has fewer lines than minBodyLines', () => {
    const extractor = new BodyExtractor(3, 10_000);
    const source = 'function go() { x(); }';
    expect(extractor.extractBody(fnNode(source, 0, 'go', '{ x(); }'), source)).toBeNull();
  });

  it('returns null when no body node exists', () => {
    const extractor = new BodyExtractor(3, 10_000);
    const source = 'function bare()';
    const node = buildNode({
      type: 'function_declaration',
      text: source,
      row: 0,
      named: [{ type: 'identifier', text: 'bare', row: 0 }],
    });
    expect(extractor.extractBody(node, source)).toBeNull();
  });

  it('truncates bodies exceeding maxBodyTokens', () => {
    const extractor = new BodyExtractor(3, 2);
    const bodyText = '{\n  const a = 1;\n  const b = 2;\n  const c = 3;\n}';
    const source = `function big() ${bodyText}`;
    expect(extractor.extractBody(fnNode(source, 0, 'big', bodyText), source)).toBe('{ const');
  });
});

describe('BodyExtractor.extractAllBodies', () => {
  it('collects named function bodies from the whole tree', () => {
    const extractor = new BodyExtractor(3, 10_000);
    const first = 'function first() {\n  const x = 1;\n  return x;\n}';
    const second = 'function second() {\n  const y = 2;\n  return y;\n}';
    const source = `${first}\n${second}`;
    const tree = buildTree(source, [
      fnNode(source, 0, 'first', '{\n  const x = 1;\n  return x;\n}'),
      fnNode(source, 4, 'second', '{\n  const y = 2;\n  return y;\n}'),
    ]);

    const bodies = extractor.extractAllBodies(tree, source, 'src/a.ts');
    expect(bodies).toHaveLength(2);
    expect(bodies[0]).toMatchObject({ name: 'first', symbolId: 'src/a.ts:first:1', startLine: 1 });
    expect(bodies.map(b => b.name)).toEqual(['first', 'second']);
    expect(bodies[0].tokenCount).toBeGreaterThan(0);
  });

  it('reports anonymous fallback name when no identifier is found', () => {
    const extractor = new BodyExtractor(3, 10_000);
    const bodyText = '{\n  const z = 1;\n  return z;\n}';
    const source = `() => ${bodyText}`;
    const node = buildNode({
      type: 'arrow_function',
      text: source,
      row: 0,
      named: [{ type: 'statement_block', text: bodyText, row: 1 }],
    });
    const tree = buildTree(source, [node]);

    const bodies = extractor.extractAllBodies(tree, source, 'x.ts');
    expect(bodies).toHaveLength(1);
    expect(bodies[0].name).toBe('<anonymous>');
    expect(bodies[0].symbolId).toContain('x.ts');
  });

  it('skips bodies that fail the line threshold', () => {
    const extractor = new BodyExtractor(3, 10_000);
    const source = 'function tiny() { x(); }';
    expect(extractor.extractAllBodies(buildTree(source, [fnNode(source, 0, 'tiny', '{ x(); }')]), source, 'x.ts')).toHaveLength(0);
  });
});