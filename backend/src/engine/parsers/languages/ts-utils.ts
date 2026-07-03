/**
 * KSA-146: TypeScript-specific AST helpers.
 * Utility functions for extracting TypeScript/JavaScript-specific constructs.
 */

import type { SyntaxNode } from '../types.js';
import { getNodeText, getNamedChild } from '../ast-utils.js';

/** Check if a node is exported (direct export or parent is export_statement). */
export function isExported(node: SyntaxNode): boolean {
  const parent = node.parent;
  return parent?.type === 'export_statement';
}

/** Check if a node has a specific modifier keyword (async, static, etc.). */
export function hasModifier(node: SyntaxNode, source: string, modifier: string): boolean {
  const text = getNodeText(node, source);
  const firstLine = text.split('\n')[0];
  return firstLine.includes(modifier);
}

/** Extract formal parameters text from a function/method node. */
export function extractParameters(node: SyntaxNode, source: string): string {
  const params = getNamedChild(node, 'formal_parameters');
  if (!params) return '';
  return getNodeText(params, source);
}

/** Extract return type annotation from a function/method node. */
export function extractReturnType(node: SyntaxNode, source: string): string | undefined {
  const typeAnnotation = getNamedChild(node, 'type_annotation');
  if (!typeAnnotation) return undefined;
  return getNodeText(typeAnnotation, source).replace(/^:\s*/, '');
}

/** Build a function signature string. */
export function buildFunctionSignature(
  name: string, params: string, returnType: string | undefined, isAsync: boolean
): string {
  const prefix = isAsync ? 'async ' : '';
  const ret = returnType ? `: ${returnType}` : '';
  return `${prefix}function ${name}${params}${ret}`.slice(0, 500);
}

/** Extract decorators/annotations from a node. */
export function extractDecorators(node: SyntaxNode, source: string): string[] {
  const decorators: string[] = [];
  for (let i = 0; i < node.namedChildCount; i++) {
    const child = node.namedChild(i);
    if (child && child.type === 'decorator') {
      const text = getNodeText(child, source).replace(/^@/, '').split('(')[0].trim();
      decorators.push(text);
    }
  }
  return decorators;
}

/** Extract heritage clauses (extends/implements) from class header text. */
export function extractHeritage(node: SyntaxNode, source: string): { name: string; kind: 'inherits' | 'implements' }[] {
  const results: { name: string; kind: 'inherits' | 'implements' }[] = [];
  const text = getNodeText(node, source).split('{')[0];

  const extendsMatch = text.match(/extends\s+(\w+)/);
  if (extendsMatch) {
    results.push({ name: extendsMatch[1], kind: 'inherits' });
  }

  const implMatch = text.match(/implements\s+([\w,\s]+)/);
  if (implMatch) {
    const names = implMatch[1].split(',').map(n => n.trim()).filter(Boolean);
    for (const name of names) {
      results.push({ name: name.split('<')[0].trim(), kind: 'implements' });
    }
  }

  return results;
}

/** Extract modifiers (public, private, protected, static, abstract, readonly). */
export function extractModifiers(node: SyntaxNode, source: string): string[] {
  const modifiers: string[] = [];
  const text = getNodeText(node, source).split('\n')[0];
  const keywords = ['public', 'private', 'protected', 'static', 'abstract', 'readonly', 'override'];
  for (const kw of keywords) {
    if (text.includes(kw)) modifiers.push(kw);
  }
  return modifiers;
}
