/**
 * KSA-146: TypeScript Inheritance/Implements Extractor.
 * Extracts extends and implements relationships from classes and interfaces.
 */

import type { SyntaxNode, ExtractedSymbol, ExtractedRelationship } from '../types.js';
import { extractHeritage } from './ts-utils.js';

export class TSInheritanceExtractor {
  extract(
    rootNode: SyntaxNode, source: string, filePath: string,
    symbols: ExtractedSymbol[]
  ): ExtractedRelationship[] {
    const relationships: ExtractedRelationship[] = [];

    // Find class and interface symbols and extract their heritage
    for (const symbol of symbols) {
      if (symbol.kind !== 'class' && symbol.kind !== 'interface') continue;

      const node = this.findNodeAtLine(rootNode, symbol.startLine - 1);
      if (!node) continue;

      const heritage = extractHeritage(node, source);
      for (const h of heritage) {
        relationships.push({
          sourceSymbol: symbol.name,
          targetSymbol: h.name,
          kind: h.kind,
          filePath,
          line: symbol.startLine,
        });
      }
    }

    return relationships;
  }

  private findNodeAtLine(rootNode: SyntaxNode, targetLine: number): SyntaxNode | null {
    const stack: SyntaxNode[] = [rootNode];
    while (stack.length > 0) {
      const node = stack.pop()!;
      if (node.startPosition.row === targetLine) {
        if (node.type === 'class_declaration' || node.type === 'interface_declaration') {
          return node;
        }
      }
      for (let i = node.childCount - 1; i >= 0; i--) {
        const child = node.child(i);
        if (child) stack.push(child);
      }
    }
    return null;
  }
}
