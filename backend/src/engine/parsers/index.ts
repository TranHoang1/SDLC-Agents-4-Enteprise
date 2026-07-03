/**
 * Parsers module barrel export.
 * KSA-145: Tree-sitter core
 * KSA-152: Grammar configuration
 */

export type {
  ILanguageParser, ParseResult, ExtractedSymbol, ExtractedRelationship,
  ParseError, IndexResult, SymbolKind, RelationshipKind, NodeVisitor, SyntaxNode,
} from './types.js';

export { GrammarRegistry, loadGrammarConfig } from './grammar-registry.js';
export type { LanguageConfig, GrammarRegistryConfig } from './grammar-registry.js';

export { TreeSitterIndexer } from './tree-sitter-indexer.js';

export * from './ast-utils.js';
