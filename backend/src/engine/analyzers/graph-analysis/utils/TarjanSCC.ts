/**
 * KSA-163: Tarjan's Strongly Connected Components algorithm.
 * Finds all cycles in a directed graph.
 */

import type { AdjacencyList } from '../types.js';

export class TarjanSCC {
  private index = 0;
  private stack: number[] = [];
  private indices: Map<number, number> = new Map();
  private lowlinks: Map<number, number> = new Map();
  private onStack: Set<number> = new Set();
  private sccs: number[][] = [];

  /** Find all strongly connected components with size > 1 (cycles). */
  findSCCs(graph: AdjacencyList): number[][] {
    this.reset();
    for (const node of graph.keys()) {
      if (!this.indices.has(node)) {
        this.strongConnect(node, graph);
      }
    }
    // Only return SCCs with more than 1 node (actual cycles)
    return this.sccs.filter(scc => scc.length > 1);
  }

  private strongConnect(v: number, graph: AdjacencyList): void {
    this.indices.set(v, this.index);
    this.lowlinks.set(v, this.index);
    this.index++;
    this.stack.push(v);
    this.onStack.add(v);

    const neighbors = graph.get(v) || [];
    for (const w of neighbors) {
      if (!this.indices.has(w)) {
        this.strongConnect(w, graph);
        this.lowlinks.set(v, Math.min(this.lowlinks.get(v)!, this.lowlinks.get(w)!));
      } else if (this.onStack.has(w)) {
        this.lowlinks.set(v, Math.min(this.lowlinks.get(v)!, this.indices.get(w)!));
      }
    }

    if (this.lowlinks.get(v) === this.indices.get(v)) {
      const scc: number[] = [];
      let w: number;
      do {
        w = this.stack.pop()!;
        this.onStack.delete(w);
        scc.push(w);
      } while (w !== v);
      this.sccs.push(scc);
    }
  }

  private reset(): void {
    this.index = 0;
    this.stack = [];
    this.indices = new Map();
    this.lowlinks = new Map();
    this.onStack = new Set();
    this.sccs = [];
  }
}
