/**
 * KSA-149: Java Language Parser.
 * Extracts symbols and relationships from Java AST using tree-sitter.
 * Supports: classes, interfaces, enums, records, annotations,
 * methods, constructors, fields, imports, inheritance, calls.
 */

import type { Parser as ParserType } from 'web-tree-sitter';
import type {
  ILanguageParser, ParseResult, ExtractedSymbol, ExtractedRelationship,
  ParseError, SyntaxNode, SymbolKind, RelationshipKind
} from '../types.js';
import {
  getNodeText, getNodeRange, findNodes, getNamedChild, walkTree, extractDocComment
} from '../ast-utils.js';

export default class JavaParser implements ILanguageParser {
  readonly languageId: string;
  private parser: any;

  constructor(parser: any, languageId: string) {
    this.parser = parser;
    this.languageId = languageId;
  }

  getSupportedExtensions(): string[] {
    return ['.java'];
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

    // Extract package declaration
    this.extractPackage(tree.rootNode, source, filePath, symbols);

    // Extract imports
    this.extractImports(tree.rootNode, source, filePath, relationships);

    // Extract type declarations
    this.extractDeclarations(tree.rootNode, source, filePath, null, symbols, relationships);

    return { symbols, relationships, errors };
  }

  // ─── Package Extraction ──────────────────────────────────────────────

  private extractPackage(
    root: SyntaxNode, source: string, filePath: string,
    symbols: ExtractedSymbol[],
  ): void {
    const pkgNodes = findNodes(root, 'package_declaration');
    if (pkgNodes.length === 0) return;

    const pkgNode = pkgNodes[0];
    const scopedId = findNodes(pkgNode, 'scoped_identifier')[0]
      ?? findNodes(pkgNode, 'identifier')[0];
    if (!scopedId) return;

    const name = getNodeText(scopedId, source);
    const range = getNodeRange(pkgNode);

    symbols.push({
      name,
      kind: 'namespace',
      filePath,
      startLine: range.startLine,
      endLine: range.endLine,
      signature: `package ${name}`,
      isExported: true,
    });
  }

  // ─── Import Extraction ───────────────────────────────────────────────

  private extractImports(
    root: SyntaxNode, source: string, filePath: string,
    relationships: ExtractedRelationship[],
  ): void {
    const importNodes = findNodes(root, 'import_declaration');

    for (const importNode of importNodes) {
      const text = getNodeText(importNode, source);
      const isStatic = text.includes('static');
      const isWildcard = text.includes('*');

      // Extract the import path
      const scopedId = findNodes(importNode, 'scoped_identifier')[0];
      const identifier = findNodes(importNode, 'identifier');
      const path = scopedId
        ? getNodeText(scopedId, source)
        : (identifier.length > 0 ? getNodeText(identifier[0], source) : '');

      const target = isWildcard ? `${path}.*` : path;

      relationships.push({
        sourceSymbol: '__file__',
        targetSymbol: target,
        kind: 'imports',
        filePath,
        line: importNode.startPosition.row + 1,
        metadata: {
          ...(isStatic && { static: true }),
          ...(isWildcard && { wildcard: true }),
        },
      });
    }
  }

  // ─── Declaration Extraction ──────────────────────────────────────────

  private extractDeclarations(
    node: SyntaxNode, source: string, filePath: string,
    parentName: string | null, symbols: ExtractedSymbol[],
    relationships: ExtractedRelationship[],
    depth: number = 0,
  ): void {
    if (depth > 10) return; // Safety: prevent infinite recursion

    for (let i = 0; i < node.namedChildCount; i++) {
      const child = node.namedChild(i);
      if (!child) continue;

      switch (child.type) {
        case 'class_declaration':
          this.extractType(child, source, filePath, parentName, 'class', symbols, relationships, depth);
          break;
        case 'interface_declaration':
          this.extractType(child, source, filePath, parentName, 'interface', symbols, relationships, depth);
          break;
        case 'enum_declaration':
          this.extractType(child, source, filePath, parentName, 'enum', symbols, relationships, depth);
          break;
        case 'record_declaration':
          this.extractType(child, source, filePath, parentName, 'class', symbols, relationships, depth);
          break;
        case 'annotation_type_declaration':
          this.extractType(child, source, filePath, parentName, 'interface', symbols, relationships, depth);
          break;
      }
    }
  }

  // ─── Type (Class/Interface/Enum/Record) Extraction ───────────────────

  private extractType(
    node: SyntaxNode, source: string, filePath: string,
    parentName: string | null, defaultKind: SymbolKind,
    symbols: ExtractedSymbol[], relationships: ExtractedRelationship[],
    depth: number,
  ): void {
    const nameNode = getNamedChild(node, 'identifier');
    if (!nameNode) return;

    const name = getNodeText(nameNode, source);
    const range = getNodeRange(node);
    const docComment = extractDocComment(node, source);

    // Modifiers
    const modifiers = this.extractModifiers(node, source);
    const isExported = modifiers.includes('public');

    // Annotations
    const annotations = this.extractAnnotations(node, source);

    // Determine kind
    const kind: SymbolKind = defaultKind;
    if (node.type === 'record_declaration') {
      modifiers.push('record');
    }
    if (node.type === 'annotation_type_declaration') {
      modifiers.push('annotation');
    }

    // Extract superclass and interfaces
    this.extractInheritance(node, source, filePath, name, relationships);

    // Build signature
    const typeKeyword = node.type === 'record_declaration' ? 'record'
      : node.type === 'annotation_type_declaration' ? '@interface'
      : defaultKind;
    const modStr = modifiers.filter(m => m !== 'record' && m !== 'annotation').join(' ');
    const signature = `${modStr} ${typeKeyword} ${name}`.trim();

    symbols.push({
      name,
      kind,
      filePath,
      startLine: range.startLine,
      endLine: range.endLine,
      signature: signature.slice(0, 500),
      modifiers,
      decorators: annotations,
      parentName,
      isExported,
      docComment,
    });

    // Extract body members
    const body = getNamedChild(node, 'class_body')
      ?? getNamedChild(node, 'interface_body')
      ?? getNamedChild(node, 'enum_body');

    if (body) {
      this.extractMembers(body, source, filePath, name, symbols, relationships, depth);
    }

    // Annotation relationships
    for (const ann of annotations) {
      relationships.push({
        sourceSymbol: name,
        targetSymbol: ann,
        kind: 'decorates',
        filePath,
        line: range.startLine,
      });
    }
  }

  // ─── Member Extraction ───────────────────────────────────────────────

  private extractMembers(
    body: SyntaxNode, source: string, filePath: string,
    className: string, symbols: ExtractedSymbol[],
    relationships: ExtractedRelationship[], depth: number,
  ): void {
    for (let i = 0; i < body.namedChildCount; i++) {
      const member = body.namedChild(i);
      if (!member) continue;

      switch (member.type) {
        case 'method_declaration':
          this.extractMethod(member, source, filePath, className, symbols, relationships);
          break;
        case 'constructor_declaration':
          this.extractConstructor(member, source, filePath, className, symbols, relationships);
          break;
        case 'field_declaration':
          this.extractFields(member, source, filePath, className, symbols);
          break;
        case 'class_declaration':
          this.extractType(member, source, filePath, className, 'class', symbols, relationships, depth + 1);
          break;
        case 'interface_declaration':
          this.extractType(member, source, filePath, className, 'interface', symbols, relationships, depth + 1);
          break;
        case 'enum_declaration':
          this.extractType(member, source, filePath, className, 'enum', symbols, relationships, depth + 1);
          break;
        case 'record_declaration':
          this.extractType(member, source, filePath, className, 'class', symbols, relationships, depth + 1);
          break;
      }
    }
  }

  // ─── Method Extraction ───────────────────────────────────────────────

  private extractMethod(
    node: SyntaxNode, source: string, filePath: string,
    className: string, symbols: ExtractedSymbol[],
    relationships: ExtractedRelationship[],
  ): void {
    const nameNode = getNamedChild(node, 'identifier');
    if (!nameNode) return;

    const name = getNodeText(nameNode, source);
    const range = getNodeRange(node);
    const modifiers = this.extractModifiers(node, source);
    const annotations = this.extractAnnotations(node, source);
    const docComment = extractDocComment(node, source);

    // Parameters
    const paramsNode = getNamedChild(node, 'formal_parameters');
    const params = paramsNode ? getNodeText(paramsNode, source) : '()';

    // Return type
    const returnType = this.extractMethodReturnType(node, source);

    // Complexity
    const body = getNamedChild(node, 'block');
    const complexity = body ? this.calculateComplexity(body) : 1;

    symbols.push({
      name,
      kind: 'method',
      filePath,
      startLine: range.startLine,
      endLine: range.endLine,
      signature: this.buildMethodSignature(modifiers, returnType, name, params),
      parameters: params,
      returnType,
      modifiers,
      decorators: annotations,
      parentName: className,
      isExported: modifiers.includes('public'),
      docComment,
      complexity,
    });

    // Extract calls
    if (body) {
      this.extractCalls(body, source, filePath, `${className}.${name}`, relationships);
    }

    // Annotation relationships
    for (const ann of annotations) {
      relationships.push({
        sourceSymbol: `${className}.${name}`,
        targetSymbol: ann,
        kind: 'decorates',
        filePath,
        line: range.startLine,
      });
    }
  }

  // ─── Constructor Extraction ──────────────────────────────────────────

  private extractConstructor(
    node: SyntaxNode, source: string, filePath: string,
    className: string, symbols: ExtractedSymbol[],
    relationships: ExtractedRelationship[],
  ): void {
    const nameNode = getNamedChild(node, 'identifier');
    const name = nameNode ? getNodeText(nameNode, source) : className;
    const range = getNodeRange(node);
    const modifiers = this.extractModifiers(node, source);
    const annotations = this.extractAnnotations(node, source);
    const docComment = extractDocComment(node, source);

    const paramsNode = getNamedChild(node, 'formal_parameters');
    const params = paramsNode ? getNodeText(paramsNode, source) : '()';

    const body = getNamedChild(node, 'constructor_body') ?? getNamedChild(node, 'block');
    const complexity = body ? this.calculateComplexity(body) : 1;

    symbols.push({
      name: 'constructor',
      kind: 'constructor',
      filePath,
      startLine: range.startLine,
      endLine: range.endLine,
      signature: `${modifiers.join(' ')} ${name}${params}`.trim(),
      parameters: params,
      modifiers,
      decorators: annotations,
      parentName: className,
      isExported: modifiers.includes('public'),
      docComment,
      complexity,
    });

    // Extract calls
    if (body) {
      this.extractCalls(body, source, filePath, `${className}.constructor`, relationships);
    }
  }

  // ─── Field Extraction ────────────────────────────────────────────────

  private extractFields(
    node: SyntaxNode, source: string, filePath: string,
    className: string, symbols: ExtractedSymbol[],
  ): void {
    const range = getNodeRange(node);
    const modifiers = this.extractModifiers(node, source);
    const annotations = this.extractAnnotations(node, source);

    // Get type
    const typeText = this.getFieldType(node, source);

    // Get declarators (variable names)
    const declarators = findNodes(node, 'variable_declarator');
    for (const decl of declarators) {
      const nameNode = getNamedChild(decl, 'identifier');
      if (!nameNode) continue;

      const name = getNodeText(nameNode, source);
      const isConstant = modifiers.includes('static') && modifiers.includes('final')
        && /^[A-Z_][A-Z0-9_]*$/.test(name);

      symbols.push({
        name,
        kind: isConstant ? 'constant' as SymbolKind : 'property',
        filePath,
        startLine: range.startLine,
        endLine: range.endLine,
        signature: `${modifiers.join(' ')} ${typeText} ${name}`.trim().slice(0, 200),
        returnType: typeText,
        modifiers,
        decorators: annotations,
        parentName: className,
        isExported: modifiers.includes('public'),
      });
    }
  }

  // ─── Inheritance Extraction ──────────────────────────────────────────

  private extractInheritance(
    node: SyntaxNode, source: string, filePath: string,
    className: string, relationships: ExtractedRelationship[],
  ): void {
    // extends (superclass)
    const superclass = getNamedChild(node, 'superclass');
    if (superclass) {
      const typeId = getNamedChild(superclass, 'type_identifier')
        ?? getNamedChild(superclass, 'scoped_type_identifier')
        ?? getNamedChild(superclass, 'generic_type');
      if (typeId) {
        const baseName = this.getBaseTypeName(typeId, source);
        relationships.push({
          sourceSymbol: className,
          targetSymbol: baseName,
          kind: 'inherits',
          filePath,
          line: typeId.startPosition.row + 1,
        });
      }
    }

    // implements (interfaces)
    const interfaces = getNamedChild(node, 'super_interfaces');
    if (interfaces) {
      const typeList = getNamedChild(interfaces, 'type_list');
      if (typeList) {
        for (let i = 0; i < typeList.namedChildCount; i++) {
          const typeNode = typeList.namedChild(i);
          if (!typeNode) continue;
          const ifaceName = this.getBaseTypeName(typeNode, source);
          relationships.push({
            sourceSymbol: className,
            targetSymbol: ifaceName,
            kind: 'implements',
            filePath,
            line: typeNode.startPosition.row + 1,
          });
        }
      }
    }

    // extends for interfaces (multiple inheritance)
    const extendsInterfaces = getNamedChild(node, 'extends_interfaces');
    if (extendsInterfaces) {
      const typeList = getNamedChild(extendsInterfaces, 'type_list');
      if (typeList) {
        for (let i = 0; i < typeList.namedChildCount; i++) {
          const typeNode = typeList.namedChild(i);
          if (!typeNode) continue;
          const ifaceName = this.getBaseTypeName(typeNode, source);
          relationships.push({
            sourceSymbol: className,
            targetSymbol: ifaceName,
            kind: 'inherits',
            filePath,
            line: typeNode.startPosition.row + 1,
          });
        }
      }
    }
  }

  // ─── Call Extraction ─────────────────────────────────────────────────

  private extractCalls(
    body: SyntaxNode, source: string, filePath: string,
    callerName: string, relationships: ExtractedRelationship[],
  ): void {
    const seen = new Set<string>();

    // Method invocations
    const methodCalls = findNodes(body, 'method_invocation');
    for (const call of methodCalls) {
      const target = this.resolveCallTarget(call, source);
      if (!target) continue;

      const key = `${callerName}->${target}`;
      if (seen.has(key)) continue;
      seen.add(key);

      relationships.push({
        sourceSymbol: callerName,
        targetSymbol: target,
        kind: 'calls',
        filePath,
        line: call.startPosition.row + 1,
      });
    }

    // Object creation (new X())
    const creations = findNodes(body, 'object_creation_expression');
    for (const creation of creations) {
      const typeNode = getNamedChild(creation, 'type_identifier')
        ?? getNamedChild(creation, 'scoped_type_identifier')
        ?? getNamedChild(creation, 'generic_type');
      if (!typeNode) continue;

      const typeName = this.getBaseTypeName(typeNode, source);
      const target = `${typeName}.constructor`;

      const key = `${callerName}->${target}`;
      if (seen.has(key)) continue;
      seen.add(key);

      relationships.push({
        sourceSymbol: callerName,
        targetSymbol: target,
        kind: 'calls',
        filePath,
        line: creation.startPosition.row + 1,
        metadata: { constructor: true },
      });
    }
  }

  private resolveCallTarget(callNode: SyntaxNode, source: string): string | null {
    const nameNode = getNamedChild(callNode, 'identifier');
    if (!nameNode) return null;

    const name = getNodeText(nameNode, source);

    // Check for object (receiver) — first child before the dot
    const object = callNode.child(0);
    if (object && object !== nameNode && object.type !== 'identifier') {
      const objectText = getNodeText(object, source);
      // Simplify long chains
      const simplified = objectText.length > 50
        ? objectText.split('.').slice(-2).join('.')
        : objectText;
      return `${simplified}.${name}`;
    }

    // Simple method call or same-class call with identifier receiver
    if (object && object !== nameNode && object.type === 'identifier') {
      return `${getNodeText(object, source)}.${name}`;
    }

    return name;
  }

  // ─── Helpers ─────────────────────────────────────────────────────────

  private extractModifiers(node: SyntaxNode, source: string): string[] {
    const modifiers: string[] = [];
    const modifierNode = getNamedChild(node, 'modifiers');
    if (modifierNode) {
      for (let i = 0; i < modifierNode.childCount; i++) {
        const child = modifierNode.child(i);
        if (!child) continue;
        if (child.type !== 'marker_annotation' && child.type !== 'annotation') {
          const text = getNodeText(child, source);
          if (['public', 'private', 'protected', 'static', 'final',
               'abstract', 'synchronized', 'native', 'transient',
               'volatile', 'default', 'sealed', 'non-sealed'].includes(text)) {
            modifiers.push(text);
          }
        }
      }
    }
    return modifiers;
  }

  private extractAnnotations(node: SyntaxNode, source: string): string[] {
    const annotations: string[] = [];
    const modifierNode = getNamedChild(node, 'modifiers');
    if (modifierNode) {
      for (let i = 0; i < modifierNode.childCount; i++) {
        const child = modifierNode.child(i);
        if (!child) continue;
        if (child.type === 'marker_annotation' || child.type === 'annotation') {
          const text = getNodeText(child, source).replace(/^@/, '').split('(')[0].trim();
          annotations.push(text);
        }
      }
    }
    return annotations;
  }

  private extractMethodReturnType(node: SyntaxNode, source: string): string | undefined {
    // In Java, return type is a direct child before the method name
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (!child) continue;
      if (['type_identifier', 'void_type', 'integral_type', 'floating_point_type',
           'boolean_type', 'generic_type', 'scoped_type_identifier', 'array_type'].includes(child.type)) {
        return getNodeText(child, source);
      }
    }
    return undefined;
  }

  private getFieldType(node: SyntaxNode, source: string): string {
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (!child) continue;
      if (['type_identifier', 'void_type', 'integral_type', 'floating_point_type',
           'boolean_type', 'generic_type', 'scoped_type_identifier', 'array_type'].includes(child.type)) {
        return getNodeText(child, source);
      }
    }
    return '';
  }

  private getBaseTypeName(typeNode: SyntaxNode, source: string): string {
    // Strip generics: List<String> -> List
    const text = getNodeText(typeNode, source);
    return text.split('<')[0].trim();
  }

  private calculateComplexity(node: SyntaxNode): number {
    let complexity = 1;
    const branchTypes = new Set([
      'if_statement', 'for_statement', 'enhanced_for_statement',
      'while_statement', 'do_statement', 'switch_expression',
      'catch_clause', 'ternary_expression', 'switch_block_statement_group',
    ]);

    walkTree(node, {
      enter(n) {
        if (branchTypes.has(n.type)) complexity++;
        if (n.type === '&&' || n.type === '||') complexity++;
        if (n.type === 'lambda_expression') complexity++;
      }
    });

    return complexity;
  }

  private buildMethodSignature(
    modifiers: string[], returnType: string | undefined,
    name: string, params: string,
  ): string {
    const mods = modifiers.length ? modifiers.join(' ') + ' ' : '';
    const ret = returnType ? returnType + ' ' : '';
    return `${mods}${ret}${name}${params}`.trim().slice(0, 500);
  }
}
