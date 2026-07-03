/**
 * KSA-146: TypeScript Symbol Extractor.
 * Extracts functions, classes, interfaces, type aliases, enums, and arrow functions.
 */

import type { SyntaxNode, ExtractedSymbol, ExtractedRelationship, SymbolKind } from '../types.js';
import { getNodeText, getNodeRange, getNamedChild, calculateComplexity, extractDocComment } from '../ast-utils.js';
import { isExported, hasModifier, extractParameters, extractReturnType, buildFunctionSignature, extractDecorators, extractModifiers } from './ts-utils.js';

export class TSSymbolExtractor {
  extract(
    rootNode: SyntaxNode, source: string, filePath: string,
    relationships: ExtractedRelationship[]
  ): ExtractedSymbol[] {
    const symbols: ExtractedSymbol[] = [];
    this.extractFromNode(rootNode, source, filePath, null, symbols, relationships);
    return symbols;
  }

  private extractFromNode(
    node: SyntaxNode, source: string, filePath: string,
    parentName: string | null, symbols: ExtractedSymbol[],
    relationships: ExtractedRelationship[],
  ): void {
    for (let i = 0; i < node.namedChildCount; i++) {
      const child = node.namedChild(i);
      if (!child) continue;

      switch (child.type) {
        case 'function_declaration':
        case 'generator_function_declaration':
          this.extractFunction(child, source, filePath, parentName, symbols);
          break;
        case 'class_declaration':
          this.extractClass(child, source, filePath, parentName, symbols, relationships);
          break;
        case 'interface_declaration':
          this.extractInterface(child, source, filePath, parentName, symbols);
          break;
        case 'type_alias_declaration':
          this.extractTypeAlias(child, source, filePath, parentName, symbols);
          break;
        case 'enum_declaration':
          this.extractEnum(child, source, filePath, parentName, symbols);
          break;
        case 'lexical_declaration':
        case 'variable_declaration':
          this.extractVariableDeclaration(child, source, filePath, parentName, symbols);
          break;
        case 'export_statement':
          this.extractFromNode(child, source, filePath, parentName, symbols, relationships);
          break;
      }
    }
  }

  private extractFunction(
    node: SyntaxNode, source: string, filePath: string,
    parentName: string | null, symbols: ExtractedSymbol[],
  ): void {
    const nameNode = getNamedChild(node, 'identifier');
    if (!nameNode) return;

    const name = getNodeText(nameNode, source);
    const range = getNodeRange(node);
    const params = extractParameters(node, source);
    const returnType = extractReturnType(node, source);
    const exported = isExported(node);
    const isAsync = hasModifier(node, source, 'async');
    const docComment = extractDocComment(node, source);
    const decorators = extractDecorators(node, source);

    symbols.push({
      name,
      kind: parentName ? 'method' : 'function',
      filePath,
      startLine: range.startLine,
      endLine: range.endLine,
      signature: buildFunctionSignature(name, params, returnType, isAsync),
      parameters: params,
      returnType,
      isAsync,
      isExported: exported,
      parentName,
      docComment,
      complexity: calculateComplexity(node),
      decorators: decorators.length > 0 ? decorators : undefined,
    });
  }

  private extractClass(
    node: SyntaxNode, source: string, filePath: string,
    parentName: string | null, symbols: ExtractedSymbol[],
    relationships: ExtractedRelationship[],
  ): void {
    const nameNode = getNamedChild(node, 'type_identifier') ?? getNamedChild(node, 'identifier');
    if (!nameNode) return;

    const name = getNodeText(nameNode, source);
    const range = getNodeRange(node);
    const exported = isExported(node);
    const docComment = extractDocComment(node, source);
    const decorators = extractDecorators(node, source);
    const modifiers = extractModifiers(node, source);
    const isAbstract = modifiers.includes('abstract');

    symbols.push({
      name,
      kind: 'class',
      filePath,
      startLine: range.startLine,
      endLine: range.endLine,
      signature: `${isAbstract ? 'abstract ' : ''}class ${name}`,
      isExported: exported,
      parentName,
      docComment,
      modifiers: modifiers.length > 0 ? modifiers : undefined,
      decorators: decorators.length > 0 ? decorators : undefined,
    });

    // Extract class body members
    const body = getNamedChild(node, 'class_body');
    if (body) {
      this.extractClassMembers(body, source, filePath, name, symbols);
    }
  }

  private extractClassMembers(
    body: SyntaxNode, source: string, filePath: string,
    className: string, symbols: ExtractedSymbol[],
  ): void {
    for (let i = 0; i < body.namedChildCount; i++) {
      const member = body.namedChild(i);
      if (!member) continue;

      switch (member.type) {
        case 'method_definition':
          this.extractMethod(member, source, filePath, className, symbols);
          break;
        case 'public_field_definition':
        case 'property_definition':
          this.extractProperty(member, source, filePath, className, symbols);
          break;
      }
    }
  }

  private extractMethod(
    node: SyntaxNode, source: string, filePath: string,
    className: string, symbols: ExtractedSymbol[],
  ): void {
    const nameNode = getNamedChild(node, 'property_identifier') ?? getNamedChild(node, 'identifier');
    if (!nameNode) return;

    const name = getNodeText(nameNode, source);
    const range = getNodeRange(node);
    const params = extractParameters(node, source);
    const returnType = extractReturnType(node, source);
    const isAsync = hasModifier(node, source, 'async');
    const docComment = extractDocComment(node, source);
    const kind: SymbolKind = name === 'constructor' ? 'constructor' : 'method';
    const modifiers = extractModifiers(node, source);
    const decorators = extractDecorators(node, source);

    symbols.push({
      name,
      kind,
      filePath,
      startLine: range.startLine,
      endLine: range.endLine,
      signature: buildFunctionSignature(name, params, returnType, isAsync),
      parameters: params,
      returnType,
      isAsync,
      parentName: className,
      docComment,
      complexity: calculateComplexity(node),
      modifiers: modifiers.length > 0 ? modifiers : undefined,
      decorators: decorators.length > 0 ? decorators : undefined,
    });
  }

  private extractProperty(
    node: SyntaxNode, source: string, filePath: string,
    className: string, symbols: ExtractedSymbol[],
  ): void {
    const nameNode = getNamedChild(node, 'property_identifier') ?? getNamedChild(node, 'identifier');
    if (!nameNode) return;

    const name = getNodeText(nameNode, source);
    const range = getNodeRange(node);
    const modifiers = extractModifiers(node, source);

    symbols.push({
      name,
      kind: 'property',
      filePath,
      startLine: range.startLine,
      endLine: range.endLine,
      signature: getNodeText(node, source).split('\n')[0].trim().slice(0, 200),
      parentName: className,
      modifiers: modifiers.length > 0 ? modifiers : undefined,
    });
  }

  private extractInterface(
    node: SyntaxNode, source: string, filePath: string,
    parentName: string | null, symbols: ExtractedSymbol[],
  ): void {
    const nameNode = getNamedChild(node, 'type_identifier') ?? getNamedChild(node, 'identifier');
    if (!nameNode) return;

    const name = getNodeText(nameNode, source);
    const range = getNodeRange(node);
    const exported = isExported(node);
    const docComment = extractDocComment(node, source);

    symbols.push({
      name,
      kind: 'interface',
      filePath,
      startLine: range.startLine,
      endLine: range.endLine,
      signature: `interface ${name}`,
      isExported: exported,
      parentName,
      docComment,
    });
  }

  private extractTypeAlias(
    node: SyntaxNode, source: string, filePath: string,
    parentName: string | null, symbols: ExtractedSymbol[],
  ): void {
    const nameNode = getNamedChild(node, 'type_identifier') ?? getNamedChild(node, 'identifier');
    if (!nameNode) return;

    const name = getNodeText(nameNode, source);
    const range = getNodeRange(node);
    const exported = isExported(node);

    symbols.push({
      name,
      kind: 'type',
      filePath,
      startLine: range.startLine,
      endLine: range.endLine,
      signature: getNodeText(node, source).split('\n')[0].trim().slice(0, 200),
      isExported: exported,
      parentName,
    });
  }

  private extractEnum(
    node: SyntaxNode, source: string, filePath: string,
    parentName: string | null, symbols: ExtractedSymbol[],
  ): void {
    const nameNode = getNamedChild(node, 'identifier');
    if (!nameNode) return;

    const name = getNodeText(nameNode, source);
    const range = getNodeRange(node);
    const exported = isExported(node);

    symbols.push({
      name,
      kind: 'enum',
      filePath,
      startLine: range.startLine,
      endLine: range.endLine,
      signature: `enum ${name}`,
      isExported: exported,
      parentName,
    });
  }

  private extractVariableDeclaration(
    node: SyntaxNode, source: string, filePath: string,
    parentName: string | null, symbols: ExtractedSymbol[],
  ): void {
    for (let i = 0; i < node.namedChildCount; i++) {
      const declarator = node.namedChild(i);
      if (!declarator || declarator.type !== 'variable_declarator') continue;

      const nameNode = getNamedChild(declarator, 'identifier');
      if (!nameNode) continue;

      const name = getNodeText(nameNode, source);
      const value = getNamedChild(declarator, 'arrow_function') ??
                    getNamedChild(declarator, 'function_expression') ??
                    getNamedChild(declarator, 'function');

      if (value) {
        const range = getNodeRange(node);
        const params = extractParameters(value, source);
        const returnType = extractReturnType(value, source);
        const exported = isExported(node);
        const isAsync = hasModifier(value, source, 'async');
        const docComment = extractDocComment(node, source);

        symbols.push({
          name,
          kind: 'function',
          filePath,
          startLine: range.startLine,
          endLine: range.endLine,
          signature: buildFunctionSignature(name, params, returnType, isAsync),
          parameters: params,
          returnType,
          isAsync,
          isExported: exported,
          parentName,
          docComment,
          complexity: calculateComplexity(value),
        });
      }
    }
  }
}
