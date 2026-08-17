import * as fs from 'fs';
import * as path from 'path';
import type { DatabaseAdapter } from '../../database/adapters/DatabaseAdapter.js';
import { GrammarRegistry } from './grammar-registry.js';
import { extractSymbols } from './signature-extractor.js';
import type { ParseResult, IndexResult } from './types.js';
import { storeResults, storeRegexResults, extractAndStoreBodies } from './indexer/storage.js';
import { DependencyResolver } from './dependency-resolver.js';

export class TreeSitterIndexer {
  private registry: GrammarRegistry;
  private adapter: DatabaseAdapter;
  private maxFileSize: number;
  private depResolver: DependencyResolver;
  private workspace: string;

  constructor(registry: GrammarRegistry, adapter: DatabaseAdapter, maxFileSize: number = 1_048_576, workspace: string = '') {
    this.registry = registry;
    this.adapter = adapter;
    this.maxFileSize = maxFileSize;
    this.depResolver = new DependencyResolver();
    this.workspace = workspace;
  }

  async indexFile(filePath: string, relativePath: string, projectId: string): Promise<IndexResult> {
    const startTime = Date.now();
    let source: string;
    try {
      const stat = fs.statSync(filePath);
      if (stat.size > this.maxFileSize) return await this.regexFallback(filePath, relativePath, projectId, startTime);
      source = fs.readFileSync(filePath, 'utf-8');
    } catch {
      return { filePath: relativePath, symbolCount: 0, relationshipCount: 0, parseErrors: 1, duration: Date.now() - startTime, method: 'regex-fallback', dependencies: [] };
    }
    const parser = await this.registry.getParser(filePath);
    let result: ParseResult;
    let method: 'tree-sitter' | 'regex-fallback';
    if (parser) {
      result = parser.parse(source, relativePath);
      method = 'tree-sitter';
    } else {
      return await this.regexFallback(filePath, relativePath, projectId, startTime);
    }
    const symbolIds = await storeResults(this.adapter, relativePath, result, projectId);
    await extractAndStoreBodies(this.adapter, relativePath, source, result, symbolIds, projectId);
    const dependencies = this.depResolver.resolve(source, relativePath, this.workspace);
    return { filePath: relativePath, symbolCount: result.symbols.length, relationshipCount: result.relationships.length, parseErrors: result.errors.length, duration: Date.now() - startTime, method, dependencies };
  }

  async indexFiles(files: { absolutePath: string; relativePath: string }[], projectId: string): Promise<IndexResult[]> {
    const results: IndexResult[] = [];
    for (const file of files) {
      results.push(await this.indexFile(file.absolutePath, file.relativePath, projectId));
    }
    return results;
  }

  private async regexFallback(filePath: string, relativePath: string, projectId: string, startTime: number): Promise<IndexResult> {
    try {
      const source = fs.readFileSync(filePath, 'utf-8');
      const ext = path.extname(filePath).toLowerCase();
      const language = this.extToLanguage(ext);
      const symbols = extractSymbols(source, language);
      if (symbols.length > 0) await storeRegexResults(this.adapter, relativePath, symbols, projectId);
      const dependencies = this.depResolver.resolve(source, relativePath, this.workspace);
      return { filePath: relativePath, symbolCount: symbols.length, relationshipCount: 0, parseErrors: 0, duration: Date.now() - startTime, method: 'regex-fallback', dependencies };
    } catch {
      return { filePath: relativePath, symbolCount: 0, relationshipCount: 0, parseErrors: 1, duration: Date.now() - startTime, method: 'regex-fallback', dependencies: [] };
    }
  }

  private extToLanguage(ext: string): string {
    const map: Record<string, string> = {
      '.ts': 'typescript', '.tsx': 'typescript', '.js': 'javascript', '.jsx': 'javascript',
      '.py': 'python', '.kt': 'kotlin', '.kts': 'kotlin', '.java': 'java', '.go': 'go', '.rs': 'rust',
      '.cls': 'apex', '.trigger': 'apex',
    };
    return map[ext] ?? 'generic';
  }
}
