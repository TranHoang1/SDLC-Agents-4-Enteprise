/**
 * KSA-163 — Unit tests for Tarjan's strongly-connected-components algorithm.
 */

import { describe, it, expect } from 'vitest';
import { TarjanSCC } from '../utils/TarjanSCC.js';
import type { AdjacencyList } from '../types.js';

function normalized(sccs: number[][]): number[][] {
  return sccs
    .map(s => [...s].sort((a, b) => a - b))
    .sort((a, b) => a[0] - b[0]);
}

describe('TarjanSCC', () => {
  it('detects a mutual dependency cycle', () => {
    const graph: AdjacencyList = new Map([[1, [2]], [2, [1]]]);
    expect(normalized(new TarjanSCC().findSCCs(graph))).toEqual([[1, 2]]);
  });

  it('ignores self-loops as non-cycles', () => {
    const graph: AdjacencyList = new Map([[1, [1]], [2, []]]);
    expect(new TarjanSCC().findSCCs(graph)).toEqual([]);
  });

  it('detects two disjoint cycles', () => {
    const graph: AdjacencyList = new Map([[1, [2]], [2, [1]], [3, [4]], [4, [3]]]);
    expect(normalized(new TarjanSCC().findSCCs(graph))).toEqual([[1, 2], [3, 4]]);
  });

  it('returns nothing for an acyclic chain', () => {
    const graph: AdjacencyList = new Map([[1, [2]], [2, [3]], [3, []]]);
    expect(new TarjanSCC().findSCCs(graph)).toEqual([]);
  });

  it('returns nothing for a diamond DAG', () => {
    const graph: AdjacencyList = new Map([[1, [2, 3]], [2, [4]], [3, [4]], [4, []]]);
    expect(new TarjanSCC().findSCCs(graph)).toEqual([]);
  });

  it('detects a cycle reachable through acyclic predecessors', () => {
    const graph: AdjacencyList = new Map([[1, [2]], [2, [3]], [3, [2]]]);
    expect(normalized(new TarjanSCC().findSCCs(graph))).toEqual([[2, 3]]);
  });

  it('excludes isolated nodes', () => {
    const graph: AdjacencyList = new Map([[1, [2]], [2, [1]], [3, []]]);
    expect(normalized(new TarjanSCC().findSCCs(graph))).toEqual([[1, 2]]);
  });

  it('finds SCCs reachable from multiple roots', () => {
    const graph: AdjacencyList = new Map([
      [1, [2]], [2, [3]], [3, [1, 4]], [4, [5]], [5, [4]],
    ]);
    expect(normalized(new TarjanSCC().findSCCs(graph))).toEqual([[1, 2, 3], [4, 5]]);
  });

  it('resets internal state between calls', () => {
    const tarjan = new TarjanSCC();
    const cyclic: AdjacencyList = new Map([[1, [2]], [2, [1]]]);
    expect(tarjan.findSCCs(cyclic)).toHaveLength(1);

    const acyclic: AdjacencyList = new Map([[1, [2]]]);
    expect(tarjan.findSCCs(acyclic)).toEqual([]);
  });
});