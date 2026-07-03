/**
 * KSA-157: Graph Traverser - generic BFS/DFS engine with edge/node type filtering.
 * Provides the core traversal logic for the code_traverse MCP tool.
 */

import * as fs from 'fs';
import * as path from 'path';
import Database from 'better-sqlite3';
import { SymbolResolver, ResolvedSymbol } from './symbol-resolver.js';

export interface GraphNode {
  id: number;
  name: string;
  kind: string;
  filePath: string;
  startLine: number;
  _incomingEdgeType?: string;
}

export interface TraverseConfig {
  edgeTypes: string[];
  nodeTypes: string[];
  direction: 'outgoing' | 'incoming' | 'both';
  maxDepth: number;
  maxResults: number;
}

export interface TraverseResultItem {
  node: GraphNode;
  depth: number;
  path: string[];
  edgeType: string;
}

export interface TraverseResponse {
  start: { name: string; kind: string; file: string; line: number };
  results: Array<{
    name: string;
    kind: string;
    file: string;
    line: number;
    depth: number;
    edge_type: string;
    source?: string;
  }>;
  metadata: {
    total_traversed: number;
    total_results: number;
    max_depth_reached: number;
    truncated: boolean;
    execution_time_ms: number;
  };
}

export class GraphTraverser {
  private db: Database.Database;
  private resolver: SymbolResolver;
  private workspace: string;

  constructor(db: Database.Database, resolver: SymbolResolver, workspace: string) {
    this.db = db;
    this.resolver = resolver;
    this.workspace = workspace;
  }

  /** Resolve a symbol identifier to a graph node. */
  resolveNode(identifier: string): GraphNode | null {
    const resolved = this.resolver.resolve(identifier);
    if (resolved.length === 0) return null;
    if (resolved.length > 1) {
      // Return first match but could throw AmbiguousError
      return {
        id: resolved[0].id,
        name: resolved[0].name,
        kind: resolved[0].kind,
        filePath: resolved[0].filePath,
        startLine: resolved[0].line,
      };
    }
    return {
      id: resolved[0].id,
      name: resolved[0].name,
      kind: resolved[0].kind,
      filePath: resolved[0].filePath,
      startLine: resolved[0].line,
    };
  }

  /** BFS traversal from a start node with edge/node type filters. */
  traverse(startNode: GraphNode, config: TraverseConfig): TraverseResultItem[] {
    const visited = new Set<number>();
    const queue: Array<{ node: GraphNode; depth: number; path: string[] }> = [
      { node: startNode, depth: 0, path: [startNode.name] },
    ];
    const results: TraverseResultItem[] = [];

    while (queue.length > 0 && results.length < config.maxResults) {
      const { node, depth, path: currentPath } = queue.shift()!;

      if (visited.has(node.id)) continue;
      visited.add(node.id);

      // Add to results (skip start node)
      if (depth > 0) {
        if (config.nodeTypes.length === 0 || config.nodeTypes.includes(node.kind)) {
          results.push({
            node,
            depth,
            path: currentPath,
            edgeType: node._incomingEdgeType || 'unknown',
          });
        }
      }

      // Expand neighbors if within depth limit
      if (depth < config.maxDepth) {
        const neighbors = this.getNeighbors(node.id, config);
        for (const neighbor of neighbors) {
          if (!visited.has(neighbor.id)) {
            queue.push({
              node: neighbor,
              depth: depth + 1,
              path: [...currentPath, neighbor.name],
            });
          }
        }
      }
    }

    return results.sort((a, b) => a.depth - b.depth);
  }

  /** Format traversal results into the MCP response format. */
  formatResponse(
    startNode: GraphNode,
    results: TraverseResultItem[],
    includeSource: boolean,
    sourceLines: number,
    executionTimeMs: number
  ): TraverseResponse {
    const formattedResults = results.map(r => {
      const formatted: any = {
        name: r.node.name,
        kind: r.node.kind,
        file: r.node.filePath,
        line: r.node.startLine,
        depth: r.depth,
        edge_type: r.edgeType,
      };

      if (includeSource) {
        formatted.source = this.getSourceSnippet(r.node.filePath, r.node.startLine, sourceLines);
      }

      return formatted;
    });

    return {
      start: { name: startNode.name, kind: startNode.kind, file: startNode.filePath, line: startNode.startLine },
      results: formattedResults,
      metadata: {
        total_traversed: results.length,
        total_results: formattedResults.length,
        max_depth_reached: Math.max(...results.map(r => r.depth), 0),
        truncated: results.length >= 50,
        execution_time_ms: executionTimeMs,
      },
    };
  }

  private getNeighbors(nodeId: number, config: TraverseConfig): GraphNode[] {
    const edgeFilter = config.edgeTypes.length > 0
      ? `AND r.kind IN (${config.edgeTypes.map(e => `'${e}'`).join(',')})`
      : '';

    let rows: any[] = [];

    switch (config.direction) {
      case 'outgoing':
        rows = this.db.prepare(`
          SELECT s.id, s.name, s.kind, f.relative_path as filePath, s.start_line as startLine, r.kind as _incomingEdgeType
          FROM relationships r
          JOIN symbols s ON s.id = r.target_symbol_id
          JOIN files f ON s.file_id = f.id
          WHERE r.source_symbol_id = ? ${edgeFilter}
          LIMIT 100
        `).all(nodeId);
        break;
      case 'incoming':
        rows = this.db.prepare(`
          SELECT s.id, s.name, s.kind, f.relative_path as filePath, s.start_line as startLine, r.kind as _incomingEdgeType
          FROM relationships r
          JOIN symbols s ON s.id = r.source_symbol_id
          JOIN files f ON s.file_id = f.id
          WHERE r.target_symbol_id = ? ${edgeFilter}
          LIMIT 100
        `).all(nodeId);
        break;
      case 'both': {
        const outgoing = this.db.prepare(`
          SELECT s.id, s.name, s.kind, f.relative_path as filePath, s.start_line as startLine, r.kind as _incomingEdgeType
          FROM relationships r
          JOIN symbols s ON s.id = r.target_symbol_id
          JOIN files f ON s.file_id = f.id
          WHERE r.source_symbol_id = ? ${edgeFilter}
          LIMIT 50
        `).all(nodeId);
        const incoming = this.db.prepare(`
          SELECT s.id, s.name, s.kind, f.relative_path as filePath, s.start_line as startLine, r.kind as _incomingEdgeType
          FROM relationships r
          JOIN symbols s ON s.id = r.source_symbol_id
          JOIN files f ON s.file_id = f.id
          WHERE r.target_symbol_id = ? ${edgeFilter}
          LIMIT 50
        `).all(nodeId);
        rows = [...outgoing, ...incoming];
        break;
      }
    }

    return rows as GraphNode[];
  }

  private getSourceSnippet(filePath: string, startLine: number, contextLines: number): string | null {
    try {
      const fullPath = path.resolve(this.workspace, filePath);
      if (!fs.existsSync(fullPath)) return null;
      const content = fs.readFileSync(fullPath, 'utf-8');
      const lines = content.split('\n');
      const start = Math.max(0, startLine - 1);
      const end = Math.min(lines.length, start + contextLines);
      return lines.slice(start, end).join('\n');
    } catch {
      return null;
    }
  }
}
