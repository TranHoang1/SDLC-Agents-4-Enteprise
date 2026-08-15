/**
 * Shared mock helpers for testing CFG/taint modules without a real parser.
 * Minimal web-tree-sitter-compatible node builder.
 */

import type { SyntaxNode } from '../../../../parsers/types.js';

export interface MockNodeOptions {
  type?: string;
  text?: string;
  row?: number;
  children?: MockNodeOptions[];
  fields?: Record<string, MockNodeOptions>;
}

function isBuiltNode(v: unknown): v is SyntaxNode {
  return !!v && typeof v === 'object' &&
    typeof (v as { childForFieldName?: unknown }).childForFieldName === 'function';
}

export function mockNode(opts: MockNodeOptions | SyntaxNode): SyntaxNode {
  if (isBuiltNode(opts)) return opts;
  const children: SyntaxNode[] = (opts.children ?? []).map((c) => mockNode(c));
  const namedChildren: SyntaxNode[] = children.filter((c) => namedOk(c));
  const fields: Record<string, SyntaxNode> = {};
  for (const [k, v] of Object.entries(opts.fields ?? {})) {
    fields[k] = mockNode(v);
  }

  return {
    type: opts.type ?? 'node',
    text: opts.text ?? '',
    get childCount() { return children.length; },
    get namedChildCount() { return namedChildren.length; },
    child(i: number): SyntaxNode | null { return children[i] ?? null; },
    namedChild(i: number): SyntaxNode | null { return namedChildren[i] ?? null; },
    childForFieldName(name: string): SyntaxNode | null { return fields[name] ?? null; },
    get childForField() { return undefined as never; },
    startPosition: { row: opts.row ?? 0, column: 0 },
    endPosition: { row: opts.row ?? 0, column: (opts.text ?? '').length },
    get isNamed() { return true; },
  } as unknown as SyntaxNode;
}

function namedOk(n: SyntaxNode): boolean {
  return (n as unknown as { isNamed?: boolean }).isNamed ?? true;
}