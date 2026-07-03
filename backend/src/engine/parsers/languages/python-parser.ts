/**
 * KSA-148: Python Language Parser.
 * Extracts symbols and relationships from Python AST using tree-sitter.
 * Supports: classes (Protocol, ABC, dataclass), functions (async, decorators),
 * imports (all patterns), type hints, complexity calculation.
 */

import type { Parser as ParserType } from 'web-tree-sitter';
import type {
  ILanguageParser, ParseResult, ExtractedSymbol, ExtractedRelationship,
  ParseError, SyntaxNode, SymbolKind, RelationshipKind
} from '../types.js';
import {
  getNodeText, getNodeRange, findNodes, getNamedChild, walkTree, extractDocComment
} from '../ast-utils.js';

export default class PythonParser implements ILanguageParser {
  readonly languageId: string;
  private parser: any;

  constructor(parser: any, languageId: string) {
    this.parser = parser;
    this.languageId = languageId;
  }

  getSupportedExtensions(): string[] {
    return ['.py', '.pyi'];
  }

  parse(source: string, filePath: string): ParseResult {
    const tree = this.parser.parse(source);
    const symbols: ExtractedSymbol[] = [];
    const relationships: ExtractedRelationship[] = [];
    const errors: ParseError[] = [];

    if (tree.rootNode.hasError) {
      const errorNodes = findNodes(tree.rootNode, 'ERROR');
      for (const node of errorNodes.slice(0, 10)) {
        errors.push({
          message: 'Parse error',
          line: node.startPosition.row + 1,
          column: node.startPosition.column,
        });
      }
    }

    this.extractImports(tree.rootNode, source, filePath, relationships);
    this.extractDeclarations(tree.rootNode, source, filePath, null, symbols, relationships);

    return { symbols, relationships, errors };
  }

  // ─── Import Extraction ───────────────────────────────────────────────

  private extractImports(
    root: SyntaxNode, source: string, filePath: string,
    relationships: ExtractedRelationship[],
  ): void {
    // import_statement: import os, import os.path
    const importStmts = findNodes(root, 'import_statement');
    for (const stmt of importStmts) {
      const names = findNodes(stmt, 'dotted_name');
      for (const name of names) {
        const target = getNodeText(name, source);
        relationships.push({
          sourceSymbol: '__file__',
          targetSymbol: target,
          kind: 'imports',
          filePath,
          line: stmt.startPosition.row + 1,
        });
      }
    }

    // import_from_statement: from x import y
    const fromStmts = findNodes(root, 'import_from_statement');
    for (const stmt of fromStmts) {
      const moduleName = this.extractModuleName(stmt, source);
      const isRelative = moduleName.startsWith('.');

      // Wildcard import
      if (findNodes(stmt, 'wildcard_import').length > 0) {
        relationships.push({
          sourceSymbol: '__file__',
          targetSymbol: `${moduleName}.*`,
          kind: 'imports',
          filePath,
          line: stmt.startPosition.row + 1,
          metadata: { wildcard: true, ...(isRelative && { relative: true }) },
        });
        continue;
      }

      // Named imports (aliased_import nodes)
      const importedNames = findNodes(stmt, 'aliased_import');
      if (importedNames.length > 0) {
        for (const imported of importedNames) {
          const nameNode = imported.child(0);
          if (!nameNode) continue;
          const name = getNodeText(nameNode, source);
          const aliasNode = imported.childCount > 2 ? imported.child(2) : null;
          const alias = aliasNode ? getNodeText(aliasNode, source) : undefined;

          relationships.push({
            sourceSymbol: '__file__',
            targetSymbol: moduleName ? `${moduleName}.${name}` : name,
            kind: 'imports',
            filePath,
            line: stmt.startPosition.row + 1,
            metadata: {
              from: moduleName,
              name,
              ...(alias && { alias }),
              ...(isRelative && { relative: true }),
            },
          });
        }
      } else {
        // Simple identifiers after 'import' keyword
        const identifiers = this.getImportedIdentifiers(stmt, source);
        for (const name of identifiers) {
          relationships.push({
            sourceSymbol: '__file__',
            targetSymbol: moduleName ? `${moduleName}.${name}` : name,
            kind: 'imports',
            filePath,
            line: stmt.startPosition.row + 1,
            metadata: { from: moduleName, name },
          });
        }
      }
    }
  }

  private extractModuleName(stmt: SyntaxNode, source: string): string {
    for (let i = 0; i < stmt.childCount; i++) {
      const child = stmt.child(i);
      if (!child) continue;
      if (child.type === 'dotted_name' || child.type === 'relative_import') {
        return getNodeText(child, source);
      }
    }
    return '';
  }

  private getImportedIdentifiers(stmt: SyntaxNode, source: string): string[] {
    const names: string[] = [];
    let afterImport = false;
    for (let i = 0; i < stmt.childCount; i++) {
      const child = stmt.child(i);
      if (!child) continue;
      if (child.type === 'import') { afterImport = true; continue; }
      if (afterImport && (child.type === 'dotted_name' || child.type === 'identifier')) {
        names.push(getNodeText(child, source));
      }
    }
    return names;
  }

  // ─── Declaration Extraction ──────────────────────────────────────────

  private extractDeclarations(
    node: SyntaxNode, source: string, filePath: string,
    parentName: string | null, symbols: ExtractedSymbol[],
    relationships: ExtractedRelationship[],
  ): void {
    for (let i = 0; i < node.namedChildCount; i++) {
      const child = node.namedChild(i);
      if (!child) continue;

      switch (child.type) {
        case 'function_definition':
          this.extractFunction(child, source, filePath, parentName, symbols, relationships);
          break;
        case 'class_definition':
          this.extractClass(child, source, filePath, parentName, symbols, relationships);
          break;
        case 'decorated_definition':
          this.extractDecorated(child, source, filePath, parentName, symbols, relationships);
          break;
        case 'expression_statement':
          if (!parentName) {
            this.extractModuleVariable(child, source, filePath, symbols);
          }
          break;
      }
    }
  }

  private extractDecorated(
    node: SyntaxNode, source: string, filePath: string,
    parentName: string | null, symbols: ExtractedSymbol[],
    relationships: ExtractedRelationship[],
  ): void {
    for (let i = 0; i < node.namedChildCount; i++) {
      const child = node.namedChild(i);
      if (!child) continue;
      if (child.type === 'function_definition') {
        this.extractFunction(child, source, filePath, parentName, symbols, relationships, node);
      } else if (child.type === 'class_definition') {
        this.extractClass(child, source, filePath, parentName, symbols, relationships, node);
      }
    }
  }

  // ─── Function Extraction ─────────────────────────────────────────────

  private extractFunction(
    node: SyntaxNode, source: string, filePath: string,
    parentName: string | null, symbols: ExtractedSymbol[],
    relationships: ExtractedRelationship[],
    decoratedNode?: SyntaxNode,
  ): void {
    const nameNode = getNamedChild(node, 'identifier');
    if (!nameNode) return;

    const name = getNodeText(nameNode, source);
    const range = getNodeRange(decoratedNode || node);

    // Detect async — check preceding text for 'async' keyword
    const precedingText = source.substring(Math.max(0, node.startIndex - 6), node.startIndex);
    const isAsync = precedingText.includes('async');

    // Extract decorators
    const decorators = this.getDecorators(decoratedNode || node, source);

    // Determine kind
    let kind: SymbolKind = parentName ? 'method' : 'function';
    if (decorators.includes('property')) kind = 'property';
    if (name === '__init__') kind = 'constructor';

    // Extract parameters
    const paramsNode = getNamedChild(node, 'parameters');
    const params = paramsNode ? getNodeText(paramsNode, source) : '()';

    // Extract return type
    const returnType = this.extractReturnType(node, source);

    // Modifiers
    const modifiers: string[] = [];
    if (isAsync) modifiers.push('async');
    if (decorators.includes('staticmethod')) modifiers.push('static');
    if (decorators.includes('classmethod')) modifiers.push('classmethod');
    if (decorators.includes('abstractmethod')) modifiers.push('abstract');

    const isExported = !name.startsWith('_');
    const body = getNamedChild(node, 'block');
    const complexity = body ? this.calculateComplexity(body) : 1;
    const docComment = body ? this.extractDocstring(body, source) : null;

    symbols.push({
      name,
      kind,
      filePath,
      startLine: range.startLine,
      endLine: range.endLine,
      signature: this.buildFunctionSignature(isAsync, name, params, returnType),
      parameters: params,
      returnType,
      modifiers,
      decorators,
      parentName,
      isAsync,
      isExported,
      docComment,
      complexity,
    });

    // Extract calls from body
    if (body) {
      this.extractCalls(body, source, filePath, parentName ? `${parentName}.${name}` : name, relationships);
    }

    // Extract nested definitions
    if (body) {
      this.extractDeclarations(body, source, filePath, name, symbols, relationships);
    }

    // Decorator relationships
    for (const dec of decorators) {
      relationships.push({
        sourceSymbol: parentName ? `${parentName}.${name}` : name,
        targetSymbol: dec,
        kind: 'decorates',
        filePath,
        line: range.startLine,
      });
    }
  }

  // ─── Class Extraction ────────────────────────────────────────────────

  private extractClass(
    node: SyntaxNode, source: string, filePath: string,
    parentName: string | null, symbols: ExtractedSymbol[],
    relationships: ExtractedRelationship[],
    decoratedNode?: SyntaxNode,
  ): void {
    const nameNode = getNamedChild(node, 'identifier');
    if (!nameNode) return;

    const name = getNodeText(nameNode, source);
    const range = getNodeRange(decoratedNode || node);
    const decorators = this.getDecorators(decoratedNode || node, source);

    // Extract base classes
    const argList = getNamedChild(node, 'argument_list');
    const bases: string[] = [];
    let isProtocol = false;
    let isABC = false;

    if (argList) {
      for (let i = 0; i < argList.namedChildCount; i++) {
        const arg = argList.namedChild(i);
        if (!arg) continue;
        if (arg.type === 'identifier' || arg.type === 'attribute') {
          const baseName = getNodeText(arg, source);
          bases.push(baseName);
          if (baseName === 'Protocol') isProtocol = true;
          if (baseName === 'ABC' || baseName === 'ABCMeta') isABC = true;

          const relKind: RelationshipKind = isProtocol ? 'implements' : 'inherits';
          relationships.push({
            sourceSymbol: name,
            targetSymbol: baseName,
            kind: relKind,
            filePath,
            line: arg.startPosition.row + 1,
          });
        }
      }
    }

    const kind: SymbolKind = isProtocol ? 'interface' : 'class';
    const modifiers: string[] = [];
    if (isABC) modifiers.push('abstract');
    if (decorators.includes('dataclass')) modifiers.push('dataclass');

    const isExported = !name.startsWith('_');
    const body = getNamedChild(node, 'block');
    const docComment = body ? this.extractDocstring(body, source) : null;

    symbols.push({
      name,
      kind,
      filePath,
      startLine: range.startLine,
      endLine: range.endLine,
      signature: `class ${name}${bases.length ? `(${bases.join(', ')})` : ''}`,
      modifiers,
      decorators,
      parentName,
      isExported,
      docComment,
    });

    // Extract class body
    if (body) {
      this.extractDeclarations(body, source, filePath, name, symbols, relationships);
    }

    // Decorator relationships
    for (const dec of decorators) {
      relationships.push({
        sourceSymbol: name,
        targetSymbol: dec,
        kind: 'decorates',
        filePath,
        line: range.startLine,
      });
    }
  }

  // ─── Module Variable Extraction ──────────────────────────────────────

  private extractModuleVariable(
    node: SyntaxNode, source: string, filePath: string,
    symbols: ExtractedSymbol[],
  ): void {
    const assignment = getNamedChild(node, 'assignment');
    if (!assignment) return;

    const left = assignment.child(0);
    if (!left || left.type !== 'identifier') return;

    const name = getNodeText(left, source);
    const range = getNodeRange(node);
    const isConstant = /^[A-Z_][A-Z0-9_]*$/.test(name);

    symbols.push({
      name,
      kind: isConstant ? 'constant' as SymbolKind : 'variable',
      filePath,
      startLine: range.startLine,
      endLine: range.endLine,
      signature: getNodeText(node, source).split('\n')[0].trim().slice(0, 200),
      isExported: !name.startsWith('_'),
    });
  }

  // ─── Call Extraction ─────────────────────────────────────────────────

  private extractCalls(
    body: SyntaxNode, source: string, filePath: string,
    callerName: string, relationships: ExtractedRelationship[],
  ): void {
    const callNodes = findNodes(body, 'call');
    const seen = new Set<string>();

    for (const call of callNodes) {
      const funcNode = call.child(0);
      if (!funcNode) continue;

      const funcName = getNodeText(funcNode, source);
      // Skip common builtins
      if (['print', 'len', 'range', 'str', 'int', 'float', 'list', 'dict',
           'set', 'tuple', 'type', 'isinstance', 'issubclass', 'super',
           'hasattr', 'getattr', 'setattr', 'repr', 'bool', 'enumerate',
           'zip', 'map', 'filter', 'sorted', 'reversed', 'any', 'all',
           'min', 'max', 'abs', 'round', 'open', 'id', 'hex', 'oct',
           'bin', 'ord', 'chr', 'format', 'vars', 'dir', 'help',
           'input', 'iter', 'next', 'slice', 'object', 'property',
           'staticmethod', 'classmethod'].includes(funcName)) continue;

      const key = `${callerName}->${funcName}`;
      if (seen.has(key)) continue;
      seen.add(key);

      relationships.push({
        sourceSymbol: callerName,
        targetSymbol: funcName,
        kind: 'calls',
        filePath,
        line: call.startPosition.row + 1,
      });
    }
  }

  // ─── Helpers ─────────────────────────────────────────────────────────

  private getDecorators(node: SyntaxNode, source: string): string[] {
    const decorators: string[] = [];
    for (let i = 0; i < node.namedChildCount; i++) {
      const child = node.namedChild(i);
      if (!child || child.type !== 'decorator') continue;
      const text = getNodeText(child, source).replace(/^@/, '').split('(')[0].trim();
      decorators.push(text);
    }
    return decorators;
  }

  private extractReturnType(node: SyntaxNode, source: string): string | undefined {
    const typeNode = getNamedChild(node, 'type');
    if (typeNode) return getNodeText(typeNode, source);
    return undefined;
  }

  private extractDocstring(body: SyntaxNode, source: string): string | null {
    const firstChild = body.namedChild(0);
    if (!firstChild || firstChild.type !== 'expression_statement') return null;

    const expr = firstChild.namedChild(0);
    if (!expr || expr.type !== 'string') return null;

    const text = getNodeText(expr, source);
    return text
      .replace(/^("""|''')\s*/, '')
      .replace(/\s*("""|''')$/, '')
      .trim()
      .slice(0, 500) || null;
  }

  private calculateComplexity(node: SyntaxNode): number {
    let complexity = 1;
    const branchTypes = new Set([
      'if_statement', 'elif_clause', 'for_statement', 'while_statement',
      'except_clause', 'with_statement', 'case_clause', 'assert_statement',
    ]);

    walkTree(node, {
      enter(n) {
        if (branchTypes.has(n.type)) complexity++;
        if (n.type === 'boolean_operator') complexity++;
        if (n.type === 'conditional_expression') complexity++;
        if (['list_comprehension', 'set_comprehension',
             'dictionary_comprehension', 'generator_expression'].includes(n.type)) {
          complexity++;
        }
      }
    });

    return complexity;
  }

  private buildFunctionSignature(
    isAsync: boolean, name: string, params: string, returnType: string | undefined,
  ): string {
    const prefix = isAsync ? 'async ' : '';
    const ret = returnType ? ` -> ${returnType}` : '';
    return `${prefix}def ${name}${params}${ret}`.slice(0, 500);
  }
}
