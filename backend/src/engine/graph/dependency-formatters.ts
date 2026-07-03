/**
 * KSA-155: Dependency Formatters - tree/flat/graph output formats.
 */

import * as path from 'path';
import { DependencyNode, DependencyResult } from './dependency-graph-service.js';

export interface TreeNode {
  file: string;
  label: string;
  depth: number;
  importedSymbols: string[];
  isExternal: boolean;
  children: TreeNode[];
}

export function toTreeFormat(result: DependencyResult): object {
  const { root, results } = result;
  const byDepth = new Map<number, DependencyNode[]>();

  for (const node of results) {
    if (!byDepth.has(node.depth)) byDepth.set(node.depth, []);
    byDepth.get(node.depth)!.push(node);
  }

  const tree: TreeNode = {
    file: root,
    label: path.basename(root),
    depth: 0,
    importedSymbols: [],
    isExternal: false,
    children: buildChildren(byDepth, 1),
  };

  return { root, tree, cycles: result.cycles, metadata: result.metadata };
}

function buildChildren(byDepth: Map<number, DependencyNode[]>, depth: number): TreeNode[] {
  const nodes = byDepth.get(depth) || [];
  return nodes.map(n => ({
    file: n.file,
    label: path.basename(n.file),
    depth: n.depth,
    importedSymbols: n.importedSymbols,
    isExternal: n.isExternal,
    children: buildChildren(byDepth, depth + 1),
  }));
}

export function toFlatFormat(result: DependencyResult): object {
  return {
    root: result.root,
    direction: result.direction,
    dependencies: result.results.map(r => ({
      file: r.file,
      depth: r.depth,
      importedSymbols: r.importedSymbols,
      isExternal: r.isExternal,
    })),
    cycles: result.cycles,
    metadata: result.metadata,
  };
}

export function toGraphFormat(result: DependencyResult): object {
  const { root, results } = result;
  const nodes = [
    { id: root, label: path.basename(root), depth: 0, isExternal: false },
    ...results.map(r => ({
      id: r.file,
      label: path.basename(r.file),
      depth: r.depth,
      isExternal: r.isExternal,
    })),
  ];

  const edges: Array<{ from: string; to: string; symbols: string[] }> = [];
  // Build edges from results (each result is connected to root or parent at depth-1)
  for (const r of results) {
    if (r.depth === 1) {
      edges.push({ from: root, to: r.file, symbols: r.importedSymbols });
    }
  }

  return { nodes, edges, cycles: result.cycles, metadata: result.metadata };
}

export function formatDependencyResult(result: DependencyResult, format: string): object {
  switch (format) {
    case 'tree': return toTreeFormat(result);
    case 'flat': return toFlatFormat(result);
    case 'graph': return toGraphFormat(result);
    default: return toTreeFormat(result);
  }
}
