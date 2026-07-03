/**
 * KSA-191: Apex Language Parser.
 * Extracts symbols and relationships from Apex AST using tree-sitter.
 * Supports: classes, interfaces, enums, triggers,
 * methods, constructors, fields, DML, SOQL, imports, inheritance, calls.
 */

import type { Parser as ParserType } from 'web-tree-sitter';
import type {
  ILanguageParser, ParseResult, ExtractedSymbol, ExtractedRelationship,
  ParseError, SyntaxNode, SymbolKind, RelationshipKind
} from '../types.js';
import {
  getNodeText, getNodeRange, findNodes, getNamedChild, walkTree, extractDocComment
} from '../ast-utils.js';

export default class ApexParser implements ILanguageParser {
  readonly languageId: string;
  private parser: any;

  constructor(parser: any, languageId: string) {
    this.parser = parser;
    this.languageId = languageId;
  }

  getSupportedExtensions(): string[] {
    return ['.cls', '.trigger'];
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

    // Detect if trigger file
    if (filePath.endsWith('.trigger')) {
      this.extractTrigger(tree.rootNode, source, filePath, symbols, relationships);
    } else {
      this.extractDeclarations(tree.rootNode, source, filePath, null, symbols, relationships);
    }

    return { symbols, relationships, errors };
  }

  // --- Declaration Extraction ---

  private extractDeclarations(
    node: SyntaxNode, source: string, filePath: string,
    parentName: string | null, symbols: ExtractedSymbol[],
    relationships: ExtractedRelationship[], depth: number = 0,
  ): void {
    if (depth > 10) return;

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
      }
    }
  }

  // --- Type (Class/Interface/Enum) Extraction ---

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

    const modifiers = this.extractModifiers(node, source);
    const isExported = modifiers.includes('public') || modifiers.includes('global');
    const annotations = this.extractAnnotations(node, source);

    // Extract superclass and interfaces
    this.extractInheritance(node, source, filePath, name, relationships);

    // Build signature
    const modStr = modifiers.join(' ');
    const signature = `${modStr} ${defaultKind} ${name}`.trim();

    symbols.push({
      name,
      kind: defaultKind,
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

  // --- Member Extraction ---

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
      }
    }
  }

  // --- Method Extraction ---

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

    const paramsNode = getNamedChild(node, 'formal_parameters');
    const params = paramsNode ? getNodeText(paramsNode, source) : '()';

    const returnType = this.extractMethodReturnType(node, source);

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
      isExported: modifiers.includes('public') || modifiers.includes('global'),
      docComment,
      complexity,
    });

    // Extract calls, DML, SOQL from method body
    if (body) {
      const callerName = `${className}.${name}`;
      this.extractCalls(body, source, filePath, callerName, relationships);
      this.extractDML(body, source, filePath, callerName, relationships);
      this.extractSOQL(body, source, filePath, callerName, relationships);
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

  // --- Constructor Extraction ---

  private extractConstructor(
    node: SyntaxNode, source: string, filePath: string,
    className: string, symbols: ExtractedSymbol[],
    relationships: ExtractedRelationship[],
  ): void {
    const nameNode = getNamedChild(node, 'identifier');
    const name = nameNode ? getNodeText(nameNode, source) : className;
    const range = getNodeRange(node);
    const modifiers = this.extractModifiers(node, source);
    const docComment = extractDocComment(node, source);

    const paramsNode = getNamedChild(node, 'formal_parameters');
    const params = paramsNode ? getNodeText(paramsNode, source) : '()';

    const body = getNamedChild(node, 'constructor_body') ?? getNamedChild(node, 'block');

    symbols.push({
      name: 'constructor',
      kind: 'constructor',
      filePath,
      startLine: range.startLine,
      endLine: range.endLine,
      signature: `${modifiers.join(' ')} ${name}${params}`.trim(),
      parameters: params,
      modifiers,
      parentName: className,
      isExported: modifiers.includes('public') || modifiers.includes('global'),
      docComment,
    });

    if (body) {
      this.extractCalls(body, source, filePath, `${className}.constructor`, relationships);
      this.extractDML(body, source, filePath, `${className}.constructor`, relationships);
      this.extractSOQL(body, source, filePath, `${className}.constructor`, relationships);
    }
  }

  // --- Field Extraction ---

  private extractFields(
    node: SyntaxNode, source: string, filePath: string,
    className: string, symbols: ExtractedSymbol[],
  ): void {
    const range = getNodeRange(node);
    const modifiers = this.extractModifiers(node, source);
    const annotations = this.extractAnnotations(node, source);
    const typeText = this.getFieldType(node, source);

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
        isExported: modifiers.includes('public') || modifiers.includes('global'),
      });
    }
  }

  // --- Trigger Extraction ---

  private extractTrigger(
    root: SyntaxNode, source: string, filePath: string,
    symbols: ExtractedSymbol[], relationships: ExtractedRelationship[],
  ): void {
    const triggerNodes = findNodes(root, 'trigger_declaration');
    if (triggerNodes.length === 0) {
      // Fallback: try to parse as a class if no trigger_declaration found
      this.extractDeclarations(root, source, filePath, null, symbols, relationships);
      return;
    }

    const triggerNode = triggerNodes[0];
    const nameNode = getNamedChild(triggerNode, 'identifier');
    if (!nameNode) return;

    const name = getNodeText(nameNode, source);
    const range = getNodeRange(triggerNode);

    // Extract SObject name (second identifier after "on")
    const objectNode = triggerNode.namedChild(1);
    const sobject = objectNode ? getNodeText(objectNode, source) : 'Unknown';

    // Extract events (before insert, after update, etc.)
    const events = this.extractTriggerEvents(triggerNode, source);

    symbols.push({
      name,
      kind: 'class',
      filePath,
      startLine: range.startLine,
      endLine: range.endLine,
      signature: `trigger ${name} on ${sobject} (${events.join(', ')})`,
      modifiers: ['trigger'],
      isExported: true,
    });

    // trigger-on relationship
    relationships.push({
      sourceSymbol: name,
      targetSymbol: sobject,
      kind: 'trigger-on' as RelationshipKind,
      filePath,
      line: range.startLine,
      metadata: { events },
    });

    // Extract body for calls/DML/SOQL
    const body = getNamedChild(triggerNode, 'trigger_body') ?? getNamedChild(triggerNode, 'block');
    if (body) {
      this.extractCalls(body, source, filePath, name, relationships);
      this.extractDML(body, source, filePath, name, relationships);
      this.extractSOQL(body, source, filePath, name, relationships);
    }
  }

  private extractTriggerEvents(triggerNode: SyntaxNode, source: string): string[] {
    const events: string[] = [];
    const text = getNodeText(triggerNode, source);
    const eventMatch = text.match(/\(([^)]+)\)/);
    if (eventMatch) {
      const eventStr = eventMatch[1];
      const eventParts = eventStr.split(',').map(e => e.trim().toLowerCase());
      events.push(...eventParts);
    }
    return events;
  }

  // --- DML Extraction ---

  private extractDML(
    body: SyntaxNode, source: string, filePath: string,
    callerName: string, relationships: ExtractedRelationship[],
  ): void {
    const dmlNodes = findNodes(body, 'dml_expression');
    for (const dml of dmlNodes) {
      const dmlType = dml.child(0);
      if (!dmlType) continue;
      const operation = getNodeText(dmlType, source).toUpperCase();

      const targetExpr = dml.child(1);
      if (!targetExpr) continue;
      const targetText = getNodeText(targetExpr, source);
      const sobject = this.inferSObjectFromDML(targetText, source, body);

      relationships.push({
        sourceSymbol: callerName,
        targetSymbol: sobject || targetText,
        kind: 'dml' as RelationshipKind,
        filePath,
        line: dml.startPosition.row + 1,
        metadata: { operation },
      });
    }
  }

  /** Heuristic: infer SObject name from DML target variable. */
  private inferSObjectFromDML(targetText: string, source: string, body: SyntaxNode): string | null {
    // Common patterns: variable name often hints at SObject
    // e.g., "accounts" -> "Account", "newContacts" -> "Contact"
    const cleaned = targetText.replace(/^(new|old|updated|inserted)/, '');
    const singular = cleaned.replace(/s$/, '');
    if (singular.length > 0) {
      return singular.charAt(0).toUpperCase() + singular.slice(1);
    }
    return null;
  }

  // --- SOQL Extraction ---

  private extractSOQL(
    body: SyntaxNode, source: string, filePath: string,
    callerName: string, relationships: ExtractedRelationship[],
  ): void {
    const soqlNodes = findNodes(body, 'soql_expression');
    for (const soql of soqlNodes) {
      const soqlText = getNodeText(soql, source);
      const fromMatch = soqlText.match(/FROM\s+(\w+)/i);
      if (!fromMatch) continue;
      const sobject = fromMatch[1];

      const fieldsMatch = soqlText.match(/SELECT\s+(.+?)\s+FROM/i);
      const fields = fieldsMatch
        ? fieldsMatch[1].split(',').map(f => f.trim())
        : [];

      relationships.push({
        sourceSymbol: callerName,
        targetSymbol: sobject,
        kind: 'soql' as RelationshipKind,
        filePath,
        line: soql.startPosition.row + 1,
        metadata: { fields },
      });
    }
  }

  // --- Call Extraction ---

  private extractCalls(
    body: SyntaxNode, source: string, filePath: string,
    callerName: string, relationships: ExtractedRelationship[],
  ): void {
    const seen = new Set<string>();

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

    const object = callNode.child(0);
    if (object && object !== nameNode && object.type !== 'identifier') {
      const objectText = getNodeText(object, source);
      const simplified = objectText.length > 50
        ? objectText.split('.').slice(-2).join('.')
        : objectText;
      return `${simplified}.${name}`;
    }

    if (object && object !== nameNode && object.type === 'identifier') {
      return `${getNodeText(object, source)}.${name}`;
    }

    return name;
  }

  // --- Inheritance Extraction ---

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
  }

  // --- Helpers ---

  private extractModifiers(node: SyntaxNode, source: string): string[] {
    const modifiers: string[] = [];
    const modifierNode = getNamedChild(node, 'modifiers');
    if (!modifierNode) return modifiers;

    for (let i = 0; i < modifierNode.childCount; i++) {
      const child = modifierNode.child(i);
      if (!child) continue;
      if (child.type === 'marker_annotation' || child.type === 'annotation') continue;
      const text = getNodeText(child, source).toLowerCase();
      // Apex-specific modifiers
      if (['public', 'private', 'protected', 'global', 'virtual', 'abstract',
           'static', 'final', 'transient', 'webservice',
           'with sharing', 'without sharing', 'inherited sharing'].includes(text)) {
        modifiers.push(text);
      }
    }
    return modifiers;
  }

  private extractAnnotations(node: SyntaxNode, source: string): string[] {
    const annotations: string[] = [];
    const modifierNode = getNamedChild(node, 'modifiers');
    if (!modifierNode) return annotations;

    for (let i = 0; i < modifierNode.childCount; i++) {
      const child = modifierNode.child(i);
      if (!child) continue;
      if (child.type === 'marker_annotation' || child.type === 'annotation') {
        const text = getNodeText(child, source).replace(/^@/, '').split('(')[0].trim();
        annotations.push(text);
      }
    }
    return annotations;
  }

  private extractMethodReturnType(node: SyntaxNode, source: string): string | undefined {
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
    const text = getNodeText(typeNode, source);
    return text.split('<')[0].trim();
  }

  private calculateComplexity(node: SyntaxNode): number {
    let complexity = 1;
    const branchTypes = new Set([
      'if_statement', 'for_statement', 'enhanced_for_statement',
      'while_statement', 'do_statement', 'switch_expression',
      'catch_clause', 'ternary_expression',
    ]);

    walkTree(node, {
      enter(n) {
        if (branchTypes.has(n.type)) complexity++;
        if (n.type === '&&' || n.type === '||') complexity++;
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
