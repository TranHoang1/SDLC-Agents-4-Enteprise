/**
 * KSA-146: TypeScript Import/Export Extractor.
 * Extracts import statements, re-exports, and require() calls.
 */

import type { SyntaxNode, ExtractedRelationship } from '../types.js';
import { getNodeText, getNodeRange, findNodes, getNamedChild } from '../ast-utils.js';

export class TSImportExtractor {
  extract(rootNode: SyntaxNode, source: string, filePath: string): ExtractedRelationship[] {
    const relationships: ExtractedRelationship[] = [];

    // ES module imports
    this.extractImports(rootNode, source, filePath, relationships);

    // require() calls at top level
    this.extractRequires(rootNode, source, filePath, relationships);

    return relationships;
  }

  private extractImports(
    rootNode: SyntaxNode, source: string, filePath: string,
    relationships: ExtractedRelationship[]
  ): void {
    const importNodes = findNodes(rootNode, 'import_statement');

    for (const importNode of importNodes) {
      const sourceNode = getNamedChild(importNode, 'string');
      if (!sourceNode) continue;

      const importPath = getNodeText(sourceNode, source).replace(/['"]/g, '');
      const range = getNodeRange(importNode);

      const clause = getNamedChild(importNode, 'import_clause');
      if (!clause) {
        // Side-effect import: import './styles.css'
        relationships.push({
          sourceSymbol: filePath,
          targetSymbol: importPath,
          kind: 'imports',
          filePath,
          line: range.startLine,
          metadata: { type: 'side-effect', module: importPath },
        });
        continue;
      }

      // Named imports: import { A, B } from '...'
      const namedImports = getNamedChild(clause, 'named_imports');
      if (namedImports) {
        for (let i = 0; i < namedImports.namedChildCount; i++) {
          const spec = namedImports.namedChild(i);
          if (!spec) continue;
          const text = getNodeText(spec, source);
          const parts = text.split(/\s+as\s+/);
          const importedName = parts[0].trim();
          const alias = parts.length > 1 ? parts[1].trim() : undefined;

          relationships.push({
            sourceSymbol: filePath,
            targetSymbol: importedName,
            kind: 'imports',
            filePath,
            line: range.startLine,
            metadata: {
              module: importPath,
              ...(alias && { alias }),
            },
          });
        }
        continue;
      }

      // Default import: import Foo from '...'
      const defaultImport = getNamedChild(clause, 'identifier');
      if (defaultImport) {
        relationships.push({
          sourceSymbol: filePath,
          targetSymbol: getNodeText(defaultImport, source),
          kind: 'imports',
          filePath,
          line: range.startLine,
          metadata: { module: importPath, default: true },
        });
      }

      // Namespace import: import * as ns from '...'
      const namespaceImport = getNamedChild(clause, 'namespace_import');
      if (namespaceImport) {
        const nsName = getNamedChild(namespaceImport, 'identifier');
        relationships.push({
          sourceSymbol: filePath,
          targetSymbol: nsName ? getNodeText(nsName, source) : importPath,
          kind: 'imports',
          filePath,
          line: range.startLine,
          metadata: { module: importPath, namespace: true },
        });
      }
    }
  }

  private extractRequires(
    rootNode: SyntaxNode, source: string, filePath: string,
    relationships: ExtractedRelationship[]
  ): void {
    const callNodes = findNodes(rootNode, 'call_expression');

    for (const call of callNodes) {
      const funcNode = call.child(0);
      if (!funcNode || getNodeText(funcNode, source) !== 'require') continue;

      const args = getNamedChild(call, 'arguments');
      if (!args) continue;

      const strArg = getNamedChild(args, 'string');
      if (!strArg) continue;

      const modulePath = getNodeText(strArg, source).replace(/['"]/g, '');

      relationships.push({
        sourceSymbol: filePath,
        targetSymbol: modulePath,
        kind: 'imports',
        filePath,
        line: call.startPosition.row + 1,
        metadata: { module: modulePath, type: 'require' },
      });
    }
  }
}
