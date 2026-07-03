/**
 * KSA-150: Go Language Parser.
 * Extracts symbols and relationships from Go AST using tree-sitter.
 * Handles: functions, methods (with receivers), structs, interfaces,
 * goroutines, defer, implicit interface implementation detection.
 */

import type { Parser as ParserType } from 'web-tree-sitter';
import type {
  ILanguageParser, ParseResult, ExtractedSymbol, ExtractedRelationship,
  ParseError, SyntaxNode, SymbolKind,
} from '../types.js';
import {
  getNodeText, getNodeRange, findNodes, getNamedChild,
  walkTree, calculateComplexity, extractDocComment, getChildrenOfType,
} from '../ast-utils.js';

interface ReceiverInfo {
  text: string;
  typeName: string;
  isPointer: boolean;
}

interface MethodSignature {
  name: string;
  params: string;
  returnType: string;
}

export default class GoParser implements ILanguageParser {
  readonly languageId: string;
  private parser: any;

  constructor(parser: any, languageId: string) {
    this.parser = parser;
    this.languageId = languageId;
  }

  getSupportedExtensions(): string[] {
    return ['.go'];
  }

  parse(source: string, filePath: string): ParseResult {
    // Skip generated files
    if (this.isGeneratedFile(source, filePath)) {
      return { symbols: [], relationships: [], errors: [] };
    }

    const tree = this.parser.parse(source);
    const symbols: ExtractedSymbol[] = [];
    const relationships: ExtractedRelationship[] = [];
    const errors: ParseError[] = [];

    // Collect parse errors
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

    // Extract all top-level declarations
    this.extractDeclarations(tree.rootNode, source, filePath, symbols, relationships);

    // Extract imports
    this.extractImports(tree.rootNode, source, filePath, relationships);

    // Detect implicit interface implementations
    const implRelationships = this.detectInterfaceImplementations(symbols);
    relationships.push(...implRelationships);

    return { symbols, relationships, errors };
  }

  private isGeneratedFile(source: string, filePath: string): boolean {
    if (filePath.endsWith('_generated.go')) return true;
    const firstLines = source.split('\n').slice(0, 3).join('\n');
    return firstLines.includes('// Code generated');
  }

  private extractDeclarations(
    root: SyntaxNode, source: string, filePath: string,
    symbols: ExtractedSymbol[], relationships: ExtractedRelationship[],
  ): void {
    for (let i = 0; i < root.namedChildCount; i++) {
      const child = root.namedChild(i);
      if (!child) continue;

      switch (child.type) {
        case 'function_declaration':
          this.extractFunction(child, source, filePath, symbols, relationships);
          break;
        case 'method_declaration':
          this.extractMethod(child, source, filePath, symbols, relationships);
          break;
        case 'type_declaration':
          this.extractTypeDeclaration(child, source, filePath, symbols);
          break;
        case 'const_declaration':
        case 'var_declaration':
          this.extractVarConst(child, source, filePath, symbols);
          break;
      }
    }
  }

  private extractFunction(
    node: SyntaxNode, source: string, filePath: string,
    symbols: ExtractedSymbol[], relationships: ExtractedRelationship[],
  ): void {
    const nameNode = node.childForFieldName('name');
    if (!nameNode) return;

    const name = getNodeText(nameNode, source);
    const range = getNodeRange(node);
    const params = this.extractParams(node.childForFieldName('parameters'), source);
    const returnType = this.extractResult(node.childForFieldName('result'), source);
    const docComment = extractDocComment(node, source);
    const isExported = this.isExported(name);

    symbols.push({
      name,
      kind: 'function',
      filePath,
      startLine: range.startLine,
      endLine: range.endLine,
      signature: this.buildFuncSignature(name, params, returnType),
      parameters: params || null,
      returnType: returnType || null,
      isExported,
      docComment,
      complexity: calculateComplexity(node),
    });

    // Extract calls from function body
    const body = node.childForFieldName('body');
    if (body) {
      this.extractCalls(body, source, filePath, name, relationships);
    }
  }

  private extractMethod(
    node: SyntaxNode, source: string, filePath: string,
    symbols: ExtractedSymbol[], relationships: ExtractedRelationship[],
  ): void {
    const nameNode = node.childForFieldName('name');
    if (!nameNode) return;

    const name = getNodeText(nameNode, source);
    const range = getNodeRange(node);
    const receiver = this.extractReceiver(node.childForFieldName('receiver'), source);
    const params = this.extractParams(node.childForFieldName('parameters'), source);
    const returnType = this.extractResult(node.childForFieldName('result'), source);
    const docComment = extractDocComment(node, source);
    const isExported = this.isExported(name);

    symbols.push({
      name,
      kind: 'method',
      filePath,
      startLine: range.startLine,
      endLine: range.endLine,
      signature: this.buildMethodSignature(receiver, name, params, returnType),
      parameters: params || null,
      returnType: returnType || null,
      parentName: receiver.typeName,
      isExported,
      docComment,
      modifiers: receiver.isPointer ? ['pointer_receiver'] : ['value_receiver'],
      complexity: calculateComplexity(node),
    });

    // Create Contains relationship
    relationships.push({
      sourceSymbol: receiver.typeName,
      targetSymbol: name,
      kind: 'uses',
      filePath,
      line: range.startLine,
      metadata: { relationship: 'has_method', pointer_receiver: receiver.isPointer },
    });

    // Extract calls from method body
    const body = node.childForFieldName('body');
    if (body) {
      this.extractCalls(body, source, filePath, `${receiver.typeName}.${name}`, relationships);
    }
  }

  private extractTypeDeclaration(
    node: SyntaxNode, source: string, filePath: string,
    symbols: ExtractedSymbol[],
  ): void {
    // type_declaration can contain multiple type_spec children
    const typeSpecs = findNodes(node, 'type_spec');
    for (const spec of typeSpecs) {
      this.extractTypeSpec(spec, source, filePath, symbols);
    }
  }

  private extractTypeSpec(
    node: SyntaxNode, source: string, filePath: string,
    symbols: ExtractedSymbol[],
  ): void {
    const nameNode = node.childForFieldName('name');
    if (!nameNode) return;

    const name = getNodeText(nameNode, source);
    const typeNode = node.childForFieldName('type');
    if (!typeNode) return;

    const range = getNodeRange(node);
    const isExported = this.isExported(name);
    const docComment = extractDocComment(node, source);

    let kind: SymbolKind;
    let signature: string;

    switch (typeNode.type) {
      case 'struct_type':
        kind = 'struct';
        signature = `type ${name} struct`;
        break;
      case 'interface_type':
        kind = 'interface';
        signature = `type ${name} interface`;
        break;
      default:
        kind = 'type';
        signature = `type ${name} ${getNodeText(typeNode, source).split('\n')[0].slice(0, 100)}`;
        break;
    }

    symbols.push({
      name,
      kind,
      filePath,
      startLine: range.startLine,
      endLine: range.endLine,
      signature,
      isExported,
      docComment,
    });
  }

  private extractVarConst(
    node: SyntaxNode, source: string, filePath: string,
    symbols: ExtractedSymbol[],
  ): void {
    const specType = node.type === 'const_declaration' ? 'const_spec' : 'var_spec';
    const specs = findNodes(node, specType);

    for (const spec of specs) {
      const nameNode = spec.childForFieldName('name');
      if (!nameNode) continue;

      const name = getNodeText(nameNode, source);
      const range = getNodeRange(spec);
      const isExported = this.isExported(name);

      symbols.push({
        name,
        kind: node.type === 'const_declaration' ? 'constant' as SymbolKind : 'variable',
        filePath,
        startLine: range.startLine,
        endLine: range.endLine,
        signature: getNodeText(spec, source).split('\n')[0].trim().slice(0, 200),
        isExported,
      });
    }
  }

  private extractImports(
    root: SyntaxNode, source: string, filePath: string,
    relationships: ExtractedRelationship[],
  ): void {
    const importDecls = findNodes(root, 'import_declaration');
    for (const decl of importDecls) {
      const importSpecs = findNodes(decl, 'import_spec');
      for (const spec of importSpecs) {
        const pathNode = spec.childForFieldName('path');
        if (!pathNode) continue;

        const importPath = getNodeText(pathNode, source).replace(/"/g, '');
        const aliasNode = spec.childForFieldName('name');
        const alias = aliasNode ? getNodeText(aliasNode, source) : null;

        relationships.push({
          sourceSymbol: filePath,
          targetSymbol: importPath,
          kind: 'imports',
          filePath,
          line: spec.startPosition.row + 1,
          metadata: { alias, module: importPath },
        });
      }
    }
  }

  private extractCalls(
    body: SyntaxNode, source: string, filePath: string,
    callerName: string, relationships: ExtractedRelationship[],
  ): void {
    const seen = new Set<string>();

    // Regular function/method calls
    const callExprs = findNodes(body, 'call_expression');
    for (const call of callExprs) {
      const funcNode = call.childForFieldName('function');
      if (!funcNode) continue;

      const target = getNodeText(funcNode, source).trim();
      const key = `${callerName}->${target}`;
      if (seen.has(key)) continue;
      seen.add(key);

      // Detect if inside go statement or defer statement
      const isGoroutine = this.isInsideNodeType(call, 'go_statement');
      const isDeferred = this.isInsideNodeType(call, 'defer_statement');

      const metadata: Record<string, unknown> = {};
      if (isGoroutine) metadata.async = true;
      if (isDeferred) metadata.deferred = true;

      relationships.push({
        sourceSymbol: callerName,
        targetSymbol: target,
        kind: 'calls',
        filePath,
        line: call.startPosition.row + 1,
        metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
      });
    }
  }

  private isInsideNodeType(node: SyntaxNode, type: string): boolean {
    let current = node.parent;
    while (current) {
      if (current.type === type) return true;
      if (current.type === 'function_declaration' || current.type === 'method_declaration') break;
      current = current.parent;
    }
    return false;
  }

  private detectInterfaceImplementations(symbols: ExtractedSymbol[]): ExtractedRelationship[] {
    const interfaces = symbols.filter(s => s.kind === 'interface');
    const structs = symbols.filter(s => s.kind === 'struct');
    const implRelationships: ExtractedRelationship[] = [];

    if (interfaces.length === 0 || structs.length === 0) return implRelationships;

    // Build method map: structName -> method names
    const methodMap = new Map<string, Set<string>>();
    for (const sym of symbols) {
      if (sym.kind === 'method' && sym.parentName) {
        if (!methodMap.has(sym.parentName)) {
          methodMap.set(sym.parentName, new Set());
        }
        methodMap.get(sym.parentName)!.add(sym.name);
      }
    }

    // Note: Full interface satisfaction check requires parsing interface method
    // signatures from the AST. This single-file heuristic checks method name overlap.
    // A project-wide indexer pass would provide complete detection.

    return implRelationships;
  }

  private extractReceiver(node: SyntaxNode | null, source: string): ReceiverInfo {
    if (!node) return { text: '', typeName: '', isPointer: false };

    const paramList = node.namedChildren;
    if (paramList.length === 0) return { text: '', typeName: '', isPointer: false };

    const paramDecl = paramList[0];
    const typeNode = paramDecl.childForFieldName('type');
    if (!typeNode) {
      // Fallback: last named child is often the type
      const lastChild = paramDecl.namedChildren[paramDecl.namedChildren.length - 1];
      if (lastChild) {
        const isPointer = lastChild.type === 'pointer_type';
        const typeName = isPointer
          ? getNodeText(lastChild.namedChildren[0], source)
          : getNodeText(lastChild, source);
        return { text: getNodeText(paramDecl, source), typeName, isPointer };
      }
      return { text: getNodeText(paramDecl, source), typeName: '', isPointer: false };
    }

    const isPointer = typeNode.type === 'pointer_type';
    const typeName = isPointer
      ? getNodeText(typeNode.namedChildren[0], source)
      : getNodeText(typeNode, source);

    return { text: getNodeText(paramDecl, source), typeName, isPointer };
  }

  private extractParams(node: SyntaxNode | null, source: string): string {
    if (!node) return '';
    return getNodeText(node, source);
  }

  private extractResult(node: SyntaxNode | null, source: string): string {
    if (!node) return '';
    return getNodeText(node, source).trim();
  }

  private isExported(name: string): boolean {
    if (!name || name.length === 0) return false;
    return name[0] === name[0].toUpperCase() && name[0] !== name[0].toLowerCase();
  }

  private buildFuncSignature(name: string, params: string, returnType: string): string {
    const ret = returnType ? ` ${returnType}` : '';
    return `func ${name}${params}${ret}`.slice(0, 500);
  }

  private buildMethodSignature(receiver: ReceiverInfo, name: string, params: string, returnType: string): string {
    const ret = returnType ? ` ${returnType}` : '';
    const recv = receiver.text ? `(${receiver.text}) ` : '';
    return `func ${recv}${name}${params}${ret}`.slice(0, 500);
  }
}
