/**
 * KSA-151: Rust Language Parser.
 * Extracts symbols and relationships from Rust AST using tree-sitter.
 * Handles: functions (async/unsafe/const), structs, enums, traits, impl blocks,
 * use paths (grouped/nested), derive macros, modules, macro invocations.
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

type RustVisibility = 'private' | 'pub' | 'pub_crate' | 'pub_super' | 'pub_in';

interface UsePath {
  fullPath: string;
  alias: string | null;
  glob: boolean;
}

export default class RustParser implements ILanguageParser {
  readonly languageId: string;
  private parser: any;

  constructor(parser: any, languageId: string) {
    this.parser = parser;
    this.languageId = languageId;
  }

  getSupportedExtensions(): string[] {
    return ['.rs'];
  }

  parse(source: string, filePath: string): ParseResult {
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

    // Extract declarations
    this.extractFromNode(tree.rootNode, source, filePath, null, symbols, relationships);

    // Extract use declarations (imports)
    this.extractUseDeclarations(tree.rootNode, source, filePath, relationships);

    return { symbols, relationships, errors };
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
        case 'function_item':
          this.extractFunction(child, source, filePath, parentName, symbols, relationships);
          break;
        case 'struct_item':
          this.extractStruct(child, source, filePath, parentName, symbols, relationships);
          break;
        case 'enum_item':
          this.extractEnum(child, source, filePath, parentName, symbols, relationships);
          break;
        case 'trait_item':
          this.extractTrait(child, source, filePath, parentName, symbols, relationships);
          break;
        case 'impl_item':
          this.extractImpl(child, source, filePath, symbols, relationships);
          break;
        case 'mod_item':
          this.extractModule(child, source, filePath, parentName, symbols, relationships);
          break;
        case 'type_item':
          this.extractTypeAlias(child, source, filePath, parentName, symbols);
          break;
        case 'const_item':
        case 'static_item':
          this.extractConstStatic(child, source, filePath, parentName, symbols);
          break;
        case 'macro_definition':
          this.extractMacroDefinition(child, source, filePath, symbols);
          break;
      }
    }
  }

  private extractFunction(
    node: SyntaxNode, source: string, filePath: string,
    parentName: string | null, symbols: ExtractedSymbol[],
    relationships: ExtractedRelationship[],
  ): void {
    const nameNode = node.childForFieldName('name');
    if (!nameNode) return;

    const name = getNodeText(nameNode, source);
    const range = getNodeRange(node);
    const visibility = this.extractVisibility(node, source);
    const modifiers = this.extractFunctionModifiers(node, source);
    const params = this.extractParams(node.childForFieldName('parameters'), source);
    const returnType = this.extractReturnType(node, source);
    const typeParams = node.childForFieldName('type_parameters');
    const generics = typeParams ? getNodeText(typeParams, source) : '';
    const docComment = extractDocComment(node, source);
    const isExported = visibility === 'pub' || visibility === 'pub_crate';

    symbols.push({
      name,
      kind: parentName ? 'method' : 'function',
      filePath,
      startLine: range.startLine,
      endLine: range.endLine,
      signature: this.buildFuncSignature(name, generics, params, returnType, modifiers),
      parameters: params || null,
      returnType: returnType || null,
      modifiers,
      isAsync: modifiers.includes('async'),
      isExported,
      parentName,
      docComment,
      complexity: calculateComplexity(node),
    });

    // Extract calls from function body
    const body = node.childForFieldName('body');
    if (body) {
      const callerName = parentName ? `${parentName}.${name}` : name;
      this.extractCalls(body, source, filePath, callerName, relationships);
    }
  }

  private extractStruct(
    node: SyntaxNode, source: string, filePath: string,
    parentName: string | null, symbols: ExtractedSymbol[],
    relationships: ExtractedRelationship[],
  ): void {
    const nameNode = node.childForFieldName('name');
    if (!nameNode) return;

    const name = getNodeText(nameNode, source);
    const range = getNodeRange(node);
    const visibility = this.extractVisibility(node, source);
    const isExported = visibility === 'pub' || visibility === 'pub_crate';
    const docComment = extractDocComment(node, source);
    const typeParams = node.childForFieldName('type_parameters');
    const generics = typeParams ? getNodeText(typeParams, source) : '';

    symbols.push({
      name,
      kind: 'struct',
      filePath,
      startLine: range.startLine,
      endLine: range.endLine,
      signature: `struct ${name}${generics}`,
      isExported,
      parentName,
      docComment,
    });

    // Extract derive macros
    const deriveRelationships = this.extractDerives(node, source, name, filePath, range.startLine);
    relationships.push(...deriveRelationships);
  }

  private extractEnum(
    node: SyntaxNode, source: string, filePath: string,
    parentName: string | null, symbols: ExtractedSymbol[],
    relationships: ExtractedRelationship[],
  ): void {
    const nameNode = node.childForFieldName('name');
    if (!nameNode) return;

    const name = getNodeText(nameNode, source);
    const range = getNodeRange(node);
    const visibility = this.extractVisibility(node, source);
    const isExported = visibility === 'pub' || visibility === 'pub_crate';
    const docComment = extractDocComment(node, source);

    symbols.push({
      name,
      kind: 'enum',
      filePath,
      startLine: range.startLine,
      endLine: range.endLine,
      signature: `enum ${name}`,
      isExported,
      parentName,
      docComment,
    });

    // Extract derive macros
    const deriveRelationships = this.extractDerives(node, source, name, filePath, range.startLine);
    relationships.push(...deriveRelationships);
  }

  private extractTrait(
    node: SyntaxNode, source: string, filePath: string,
    parentName: string | null, symbols: ExtractedSymbol[],
    relationships: ExtractedRelationship[],
  ): void {
    const nameNode = node.childForFieldName('name');
    if (!nameNode) return;

    const name = getNodeText(nameNode, source);
    const range = getNodeRange(node);
    const visibility = this.extractVisibility(node, source);
    const isExported = visibility === 'pub' || visibility === 'pub_crate';
    const docComment = extractDocComment(node, source);
    const typeParams = node.childForFieldName('type_parameters');
    const generics = typeParams ? getNodeText(typeParams, source) : '';

    symbols.push({
      name,
      kind: 'trait',
      filePath,
      startLine: range.startLine,
      endLine: range.endLine,
      signature: `trait ${name}${generics}`,
      isExported,
      parentName,
      docComment,
    });

    // Extract trait methods as symbols
    const body = node.childForFieldName('body');
    if (body) {
      this.extractFromNode(body, source, filePath, name, symbols, relationships);
    }
  }

  private extractImpl(
    node: SyntaxNode, source: string, filePath: string,
    symbols: ExtractedSymbol[], relationships: ExtractedRelationship[],
  ): void {
    const typeNode = node.childForFieldName('type');
    if (!typeNode) return;

    const targetType = getNodeText(typeNode, source).split('<')[0].trim();
    const traitNode = node.childForFieldName('trait');
    const traitName = traitNode ? getNodeText(traitNode, source).split('<')[0].trim() : null;
    const range = getNodeRange(node);
    const typeParams = node.childForFieldName('type_parameters');
    const generics = typeParams ? getNodeText(typeParams, source) : '';

    const implName = traitName
      ? `impl ${traitName} for ${targetType}`
      : `impl ${targetType}`;

    symbols.push({
      name: implName,
      kind: 'namespace' as SymbolKind, // impl blocks are containers
      filePath,
      startLine: range.startLine,
      endLine: range.endLine,
      signature: `${implName}${generics}`,
    });

    // Create Implements relationship for trait impls
    if (traitName) {
      relationships.push({
        sourceSymbol: targetType,
        targetSymbol: traitName,
        kind: 'implements',
        filePath,
        line: range.startLine,
      });
    }

    // Extract methods within impl block
    const body = node.childForFieldName('body');
    if (body) {
      for (let i = 0; i < body.namedChildCount; i++) {
        const item = body.namedChild(i);
        if (!item) continue;

        if (item.type === 'function_item') {
          this.extractFunction(item, source, filePath, targetType, symbols, relationships);
        } else if (item.type === 'type_item') {
          this.extractTypeAlias(item, source, filePath, targetType, symbols);
        } else if (item.type === 'const_item') {
          this.extractConstStatic(item, source, filePath, targetType, symbols);
        }
      }
    }
  }

  private extractModule(
    node: SyntaxNode, source: string, filePath: string,
    parentName: string | null, symbols: ExtractedSymbol[],
    relationships: ExtractedRelationship[],
  ): void {
    const nameNode = node.childForFieldName('name');
    if (!nameNode) return;

    const name = getNodeText(nameNode, source);
    const range = getNodeRange(node);
    const visibility = this.extractVisibility(node, source);
    const isExported = visibility === 'pub' || visibility === 'pub_crate';

    symbols.push({
      name,
      kind: 'module',
      filePath,
      startLine: range.startLine,
      endLine: range.endLine,
      signature: `mod ${name}`,
      isExported,
      parentName,
    });

    // If inline module (has body), extract children
    const body = node.childForFieldName('body');
    if (body) {
      this.extractFromNode(body, source, filePath, name, symbols, relationships);
    }
  }

  private extractTypeAlias(
    node: SyntaxNode, source: string, filePath: string,
    parentName: string | null, symbols: ExtractedSymbol[],
  ): void {
    const nameNode = node.childForFieldName('name');
    if (!nameNode) return;

    const name = getNodeText(nameNode, source);
    const range = getNodeRange(node);
    const visibility = this.extractVisibility(node, source);
    const isExported = visibility === 'pub' || visibility === 'pub_crate';

    symbols.push({
      name,
      kind: 'type',
      filePath,
      startLine: range.startLine,
      endLine: range.endLine,
      signature: getNodeText(node, source).split('\n')[0].trim().slice(0, 200),
      isExported,
      parentName,
    });
  }

  private extractConstStatic(
    node: SyntaxNode, source: string, filePath: string,
    parentName: string | null, symbols: ExtractedSymbol[],
  ): void {
    const nameNode = node.childForFieldName('name');
    if (!nameNode) return;

    const name = getNodeText(nameNode, source);
    const range = getNodeRange(node);
    const visibility = this.extractVisibility(node, source);
    const isExported = visibility === 'pub' || visibility === 'pub_crate';
    const kind = node.type === 'static_item' ? 'variable' : 'constant';

    symbols.push({
      name,
      kind: kind as SymbolKind,
      filePath,
      startLine: range.startLine,
      endLine: range.endLine,
      signature: getNodeText(node, source).split('\n')[0].trim().slice(0, 200),
      isExported,
      parentName,
      modifiers: node.type === 'static_item' ? ['static'] : ['const'],
    });
  }

  private extractMacroDefinition(
    node: SyntaxNode, source: string, filePath: string,
    symbols: ExtractedSymbol[],
  ): void {
    const nameNode = node.childForFieldName('name');
    if (!nameNode) return;

    const name = getNodeText(nameNode, source);
    const range = getNodeRange(node);

    symbols.push({
      name,
      kind: 'function' as SymbolKind, // macros are callable
      filePath,
      startLine: range.startLine,
      endLine: range.endLine,
      signature: `macro_rules! ${name}`,
      modifiers: ['macro'],
      isExported: true, // macro_rules are typically exported
    });
  }

  private extractUseDeclarations(
    root: SyntaxNode, source: string, filePath: string,
    relationships: ExtractedRelationship[],
  ): void {
    const useDecls = findNodes(root, 'use_declaration');
    for (const decl of useDecls) {
      const isPublic = this.hasVisibilityModifier(decl);
      const argument = decl.childForFieldName('argument');
      if (!argument) continue;

      const paths = this.expandUsePath(argument, source, '');
      for (const usePath of paths) {
        relationships.push({
          sourceSymbol: filePath,
          targetSymbol: usePath.fullPath,
          kind: 'imports',
          filePath,
          line: decl.startPosition.row + 1,
          metadata: {
            alias: usePath.alias,
            pub_use: isPublic,
            glob: usePath.glob,
            module: usePath.fullPath,
          },
        });
      }
    }
  }

  private expandUsePath(node: SyntaxNode, source: string, prefix: string): UsePath[] {
    const text = getNodeText(node, source);

    switch (node.type) {
      case 'scoped_identifier':
      case 'identifier':
      case 'crate':
      case 'self':
      case 'super':
        return [{ fullPath: prefix + text, alias: null, glob: false }];

      case 'use_as_clause': {
        const pathNode = node.childForFieldName('path');
        const aliasNode = node.childForFieldName('alias');
        const path = pathNode ? getNodeText(pathNode, source) : text;
        const alias = aliasNode ? getNodeText(aliasNode, source) : null;
        return [{ fullPath: prefix + path, alias, glob: false }];
      }

      case 'use_wildcard':
        return [{ fullPath: prefix + '*', alias: null, glob: true }];

      case 'use_list': {
        // Grouped: {A, B, C}
        const results: UsePath[] = [];
        for (let i = 0; i < node.namedChildCount; i++) {
          const child = node.namedChild(i);
          if (child) {
            results.push(...this.expandUsePath(child, source, prefix));
          }
        }
        return results;
      }

      case 'scoped_use_list': {
        // path::{list}
        const scopePath = node.childForFieldName('path');
        const list = node.childForFieldName('list');
        const newPrefix = scopePath
          ? prefix + getNodeText(scopePath, source) + '::'
          : prefix;
        if (list) {
          return this.expandUsePath(list, source, newPrefix);
        }
        return [{ fullPath: newPrefix.replace(/::$/, ''), alias: null, glob: false }];
      }

      default:
        return [{ fullPath: prefix + text, alias: null, glob: false }];
    }
  }

  private extractCalls(
    body: SyntaxNode, source: string, filePath: string,
    callerName: string, relationships: ExtractedRelationship[],
  ): void {
    const seen = new Set<string>();

    // Regular function calls
    const callExprs = findNodes(body, 'call_expression');
    for (const call of callExprs) {
      const funcNode = call.childForFieldName('function');
      if (!funcNode) continue;

      const target = getNodeText(funcNode, source).trim();
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

    // Macro invocations
    const macroInvocations = findNodes(body, 'macro_invocation');
    for (const macroInv of macroInvocations) {
      const macroNode = macroInv.childForFieldName('macro');
      if (!macroNode) continue;

      const macroName = getNodeText(macroNode, source).replace(/!$/, '');
      const key = `${callerName}->${macroName}!`;
      if (seen.has(key)) continue;
      seen.add(key);

      relationships.push({
        sourceSymbol: callerName,
        targetSymbol: macroName,
        kind: 'calls',
        filePath,
        line: macroInv.startPosition.row + 1,
        metadata: { macro: true },
      });
    }

    // .await expressions
    const awaitExprs = findNodes(body, 'await_expression');
    for (const awaitExpr of awaitExprs) {
      const key = `${callerName}->[async].await@${awaitExpr.startPosition.row}`;
      if (seen.has(key)) continue;
      seen.add(key);

      relationships.push({
        sourceSymbol: callerName,
        targetSymbol: '[async].poll',
        kind: 'calls',
        filePath,
        line: awaitExpr.startPosition.row + 1,
        metadata: { async: true },
      });
    }
  }

  private extractDerives(
    node: SyntaxNode, source: string, symbolName: string,
    filePath: string, line: number,
  ): ExtractedRelationship[] {
    const relationships: ExtractedRelationship[] = [];

    // Look for attribute_item nodes that are siblings before this node
    let prev = node.previousNamedSibling;
    while (prev && prev.type === 'attribute_item') {
      const attrText = getNodeText(prev, source);
      const deriveMatch = attrText.match(/derive\(([^)]+)\)/);
      if (deriveMatch) {
        const traits = deriveMatch[1].split(',').map(t => t.trim());
        for (const trait of traits) {
          if (trait) {
            relationships.push({
              sourceSymbol: symbolName,
              targetSymbol: trait,
              kind: 'implements',
              filePath,
              line,
              metadata: { derived: true },
            });
          }
        }
      }
      prev = prev.previousNamedSibling;
    }

    return relationships;
  }

  private extractVisibility(node: SyntaxNode, source: string): RustVisibility {
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (!child) continue;
      if (child.type === 'visibility_modifier') {
        const text = getNodeText(child, source);
        if (text === 'pub') return 'pub';
        if (text.includes('crate')) return 'pub_crate';
        if (text.includes('super')) return 'pub_super';
        if (text.includes('in ')) return 'pub_in';
        return 'pub';
      }
    }
    return 'private';
  }

  private hasVisibilityModifier(node: SyntaxNode): boolean {
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child && child.type === 'visibility_modifier') return true;
    }
    return false;
  }

  private extractFunctionModifiers(node: SyntaxNode, source: string): string[] {
    const modifiers: string[] = [];
    const text = getNodeText(node, source);
    const header = text.split('{')[0];

    if (header.includes('async ')) modifiers.push('async');
    if (header.includes('unsafe ')) modifiers.push('unsafe');
    if (header.includes('const ')) modifiers.push('const');

    return modifiers;
  }

  private extractParams(node: SyntaxNode | null, source: string): string {
    if (!node) return '';
    return getNodeText(node, source);
  }

  private extractReturnType(node: SyntaxNode, source: string): string {
    const returnTypeNode = node.childForFieldName('return_type');
    if (!returnTypeNode) return '';
    // Remove the leading "-> "
    return getNodeText(returnTypeNode, source).replace(/^->\s*/, '').trim();
  }

  private buildFuncSignature(
    name: string, generics: string, params: string,
    returnType: string, modifiers: string[],
  ): string {
    const prefix = modifiers.length > 0 ? modifiers.join(' ') + ' ' : '';
    const ret = returnType ? ` -> ${returnType}` : '';
    return `${prefix}fn ${name}${generics}${params}${ret}`.slice(0, 500);
  }
}
