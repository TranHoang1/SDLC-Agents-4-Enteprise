/**
 * KSA-155: Dependency Graph Service - BFS traversal on import relationships.
 * Supports outgoing (what does this file import?) and incoming (who imports this file?) queries.
 */

import * as path from 'path';
import Database from 'better-sqlite3';
import { FileResolver } from './file-resolver.js';

export interface DependencyNode {
  file: string;
  depth: number;
  importedSymbols: string[];
  isExternal: boolean;
}

export interface DependencyResult {
  root: string;
  direction: string;
  results: DependencyNode[];
  cycles: string[][];
  metadata: {
    totalNodes: number;
    maxDepthReached: number;
    truncated: boolean;
    queryTimeMs: number;
    externalCount: number;
  };
}

export class DependencyGraphService {
  private db: Database.Database;
  private fileResolver: FileResolver;

  constructor(db: Database.Database, fileResolver: FileResolver) {
    this.db = db;
    this.fileResolver = fileResolver;
  }

  /** Query dependency graph with direction and depth control. */
  query(
    file: string,
    direction: 'incoming' | 'outgoing' | 'both' = 'outgoing',
    depth: number = 1,
    includeExternal: boolean = false,
    limit: number = 50,
    kindFilter?: string | string[]
  ): DependencyResult {
    const startTime = Date.now();
    const clampedDepth = Math.min(Math.max(depth, 1), 5);

    const resolved = this.fileResolver.resolveFile(file);
    if (!resolved) {
      return this.fileNotFoundResponse(file);
    }

    // Determine which relationship kinds to traverse
    const kinds = kindFilter
      ? (Array.isArray(kindFilter) ? kindFilter : [kindFilter])
      : undefined; // undefined = use default per direction

    let results: DependencyNode[];
    let cycles: string[][];

    if (direction === 'both') {
      const outgoing = this.bfsTraversal(resolved, 'outgoing', clampedDepth, includeExternal, limit, kinds);
      const incoming = this.bfsTraversal(resolved, 'incoming', clampedDepth, includeExternal, limit, kinds);
      results = this.mergeResults(outgoing.results, incoming.results);
      cycles = [...outgoing.cycles, ...incoming.cycles];
    } else {
      const traversal = this.bfsTraversal(resolved, direction, clampedDepth, includeExternal, limit, kinds);
      results = traversal.results;
      cycles = traversal.cycles;
    }

    return {
      root: resolved,
      direction,
      results,
      cycles,
      metadata: {
        totalNodes: results.length,
        maxDepthReached: Math.min(clampedDepth, Math.max(...results.map(r => r.depth), 0)),
        truncated: results.length >= limit,
        queryTimeMs: Date.now() - startTime,
        externalCount: results.filter(r => r.isExternal).length,
      },
    };
  }

  private bfsTraversal(
    root: string,
    direction: 'incoming' | 'outgoing',
    maxDepth: number,
    includeExternal: boolean,
    limit: number,
    kinds?: string[]
  ): { results: DependencyNode[]; cycles: string[][] } {
    const visited = new Set<string>([root]);
    const results: DependencyNode[] = [];
    const cycles: string[][] = [];
    const queue: Array<{ file: string; depth: number; path: string[] }> = [
      { file: root, depth: 0, path: [root] },
    ];

    while (queue.length > 0 && results.length < limit) {
      const { file: current, depth: currentDepth, path: currentPath } = queue.shift()!;
      if (currentDepth >= maxDepth) continue;

      const deps = direction === 'outgoing'
        ? this.getOutgoingDeps(current, kinds)
        : this.getIncomingDeps(current, kinds);

      for (const dep of deps) {
        const isExternal = this.fileResolver.isExternal(dep.target);

        if (isExternal && !includeExternal) continue;

        const resolvedTarget = isExternal
          ? dep.target
          : this.fileResolver.resolveImportTarget(current, dep.target);

        if (!resolvedTarget) continue;

        // Cycle detection
        if (currentPath.includes(resolvedTarget)) {
          cycles.push([...currentPath, resolvedTarget]);
          continue;
        }

        if (!visited.has(resolvedTarget)) {
          visited.add(resolvedTarget);
          results.push({
            file: resolvedTarget,
            depth: currentDepth + 1,
            importedSymbols: dep.symbols,
            isExternal,
          });

          if (!isExternal && currentDepth + 1 < maxDepth) {
            queue.push({
              file: resolvedTarget,
              depth: currentDepth + 1,
              path: [...currentPath, resolvedTarget],
            });
          }
        }
      }
    }

    return { results, cycles };
  }

  private getOutgoingDeps(filePath: string, kinds?: string[]): Array<{ target: string; symbols: string[] }> {
    // KSA-191: Support querying multiple relationship kinds (default: imports + SF kinds)
    const queryKinds = kinds ?? ['imports', 'trigger-on', 'soql', 'dml', 'wire', 'flow-action', 'flow-object', 'apex-import', 'calls', 'inherits', 'implements'];
    const placeholders = queryKinds.map(() => '?').join(',');
    const rows = this.db.prepare(`
      SELECT target_symbol, metadata, kind
      FROM relationships
      WHERE file_path = ? AND kind IN (${placeholders})
      ORDER BY line
    `).all(filePath, ...queryKinds) as { target_symbol: string; metadata: string | null; kind: string }[];

    // Group by module/target
    const grouped = new Map<string, string[]>();
    for (const row of rows) {
      const module = this.extractModule(row.target_symbol);
      if (!grouped.has(module)) grouped.set(module, []);
      const symbol = this.extractSymbolName(row.target_symbol);
      if (symbol) grouped.get(module)!.push(symbol);
    }

    return Array.from(grouped.entries()).map(([target, symbols]) => ({ target, symbols }));
  }

  private getIncomingDeps(filePath: string, kinds?: string[]): Array<{ target: string; symbols: string[] }> {
    const basename = path.basename(filePath, path.extname(filePath));
    // KSA-191: Support multiple relationship kinds for incoming deps
    const queryKinds = kinds ?? ['imports', 'trigger-on', 'soql', 'dml', 'wire', 'flow-action', 'flow-object', 'apex-import', 'calls', 'inherits', 'implements'];
    const placeholders = queryKinds.map(() => '?').join(',');
    const rows = this.db.prepare(`
      SELECT DISTINCT file_path, target_symbol
      FROM relationships
      WHERE kind IN (${placeholders})
        AND (target_symbol LIKE ? OR target_symbol LIKE ? OR target_symbol LIKE ?)
    `).all(...queryKinds, `%/${basename}`, `%${basename}%`, filePath) as { file_path: string; target_symbol: string }[];

    const grouped = new Map<string, string[]>();
    for (const row of rows) {
      if (row.file_path === filePath) continue; // Skip self
      if (!grouped.has(row.file_path)) grouped.set(row.file_path, []);
      grouped.get(row.file_path)!.push(this.extractSymbolName(row.target_symbol) || '*');
    }

    return Array.from(grouped.entries()).map(([target, symbols]) => ({ target, symbols }));
  }

  private extractModule(targetSymbol: string): string {
    // target_symbol format: "module/path.symbol" or "module/path"
    const lastDot = targetSymbol.lastIndexOf('.');
    if (lastDot > 0 && !targetSymbol.includes('/')) return targetSymbol;
    if (lastDot > 0) return targetSymbol.substring(0, lastDot);
    return targetSymbol;
  }

  private extractSymbolName(targetSymbol: string): string {
    const lastDot = targetSymbol.lastIndexOf('.');
    if (lastDot > 0 && lastDot < targetSymbol.length - 1) {
      return targetSymbol.substring(lastDot + 1);
    }
    return path.basename(targetSymbol);
  }

  private mergeResults(outgoing: DependencyNode[], incoming: DependencyNode[]): DependencyNode[] {
    const seen = new Set<string>();
    const merged: DependencyNode[] = [];
    for (const node of [...outgoing, ...incoming]) {
      if (!seen.has(node.file)) {
        seen.add(node.file);
        merged.push(node);
      }
    }
    return merged;
  }

  private fileNotFoundResponse(file: string): DependencyResult {
    return {
      root: file,
      direction: 'outgoing',
      results: [],
      cycles: [],
      metadata: { totalNodes: 0, maxDepthReached: 0, truncated: false, queryTimeMs: 0, externalCount: 0 },
    };
  }
}
