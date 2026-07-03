/**
 * KSA-163: Graph Loader — Loads subgraphs from the relationships table.
 */

import Database from 'better-sqlite3';
import type { AdjacencyList } from '../types.js';

export interface SymbolInfo {
  id: number;
  name: string;
  kind: string;
  filePath: string;
}

export class GraphLoader {
  private db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  /** Load the import/dependency graph as adjacency list. */
  loadDependencyGraph(module?: string): AdjacencyList {
    let sql = `
      SELECT source_symbol_id, target_symbol_id
      FROM relationships
      WHERE kind = 'imports'
        AND target_symbol_id IS NOT NULL
        AND file_path NOT LIKE '%node_modules%'
        AND file_path NOT LIKE '%vendor%'
    `;
    const params: unknown[] = [];
    if (module) {
      sql += ` AND file_path LIKE ?`;
      params.push(`%${module}%`);
    }

    const rows = this.db.prepare(sql).all(...params) as Array<{
      source_symbol_id: number;
      target_symbol_id: number;
    }>;

    const graph: AdjacencyList = new Map();
    for (const row of rows) {
      if (!graph.has(row.source_symbol_id)) graph.set(row.source_symbol_id, []);
      graph.get(row.source_symbol_id)!.push(row.target_symbol_id);
      // Ensure target node exists in graph
      if (!graph.has(row.target_symbol_id)) graph.set(row.target_symbol_id, []);
    }
    return graph;
  }

  /** Load the call graph as adjacency list (caller → callee). */
  loadCallGraph(module?: string): AdjacencyList {
    let sql = `
      SELECT source_symbol_id, target_symbol_id
      FROM relationships
      WHERE kind = 'calls'
        AND target_symbol_id IS NOT NULL
    `;
    const params: unknown[] = [];
    if (module) {
      sql += ` AND file_path LIKE ?`;
      params.push(`%${module}%`);
    }

    const rows = this.db.prepare(sql).all(...params) as Array<{
      source_symbol_id: number;
      target_symbol_id: number;
    }>;

    const graph: AdjacencyList = new Map();
    for (const row of rows) {
      if (!graph.has(row.source_symbol_id)) graph.set(row.source_symbol_id, []);
      graph.get(row.source_symbol_id)!.push(row.target_symbol_id);
      if (!graph.has(row.target_symbol_id)) graph.set(row.target_symbol_id, []);
    }
    return graph;
  }

  /** Load reverse call graph (callee → callers). */
  loadReverseCallGraph(module?: string): AdjacencyList {
    let sql = `
      SELECT source_symbol_id, target_symbol_id
      FROM relationships
      WHERE kind = 'calls'
        AND target_symbol_id IS NOT NULL
    `;
    const params: unknown[] = [];
    if (module) {
      sql += ` AND file_path LIKE ?`;
      params.push(`%${module}%`);
    }

    const rows = this.db.prepare(sql).all(...params) as Array<{
      source_symbol_id: number;
      target_symbol_id: number;
    }>;

    // Reverse: target → [callers]
    const graph: AdjacencyList = new Map();
    for (const row of rows) {
      if (!graph.has(row.target_symbol_id)) graph.set(row.target_symbol_id, []);
      graph.get(row.target_symbol_id)!.push(row.source_symbol_id);
      if (!graph.has(row.source_symbol_id)) graph.set(row.source_symbol_id, []);
    }
    return graph;
  }

  /** Get symbol info by ID. */
  getSymbolInfo(symbolId: number): SymbolInfo | null {
    const row = this.db.prepare(`
      SELECT s.id, s.name, s.kind, f.relative_path as filePath
      FROM symbols s
      JOIN files f ON f.id = s.file_id
      WHERE s.id = ?
    `).get(symbolId) as SymbolInfo | undefined;
    return row ?? null;
  }

  /** Get symbol info for multiple IDs. */
  getSymbolInfoBatch(symbolIds: number[]): Map<number, SymbolInfo> {
    if (symbolIds.length === 0) return new Map();
    const placeholders = symbolIds.map(() => '?').join(',');
    const rows = this.db.prepare(`
      SELECT s.id, s.name, s.kind, f.relative_path as filePath
      FROM symbols s
      JOIN files f ON f.id = s.file_id
      WHERE s.id IN (${placeholders})
    `).all(...symbolIds) as SymbolInfo[];

    const map = new Map<number, SymbolInfo>();
    for (const row of rows) map.set(row.id, row);
    return map;
  }

  /** Resolve a symbol name to its ID. */
  resolveSymbolId(name: string, filePath?: string): number | null {
    let sql = 'SELECT s.id FROM symbols s JOIN files f ON f.id = s.file_id WHERE s.name = ?';
    const params: unknown[] = [name];
    if (filePath) {
      sql += ' AND f.relative_path LIKE ?';
      params.push(`%${filePath}%`);
    }
    sql += ' LIMIT 1';
    const row = this.db.prepare(sql).get(...params) as { id: number } | undefined;
    return row?.id ?? null;
  }
}
