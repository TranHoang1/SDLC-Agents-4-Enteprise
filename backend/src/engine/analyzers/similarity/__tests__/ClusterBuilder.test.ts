/**
 * KSA-168 — Unit tests for the Union-Find ClusterBuilder.
 */

import { describe, it, expect } from 'vitest';
import { ClusterBuilder } from '../ClusterBuilder.js';

describe('ClusterBuilder', () => {
  it('treats a fresh node as its own cluster', () => {
    const builder = new ClusterBuilder();
    expect(builder.find(5)).toBe(5);
    expect(builder.connected(5, 5)).toBe(true);
  });

  it('reports nodes as disconnected before union', () => {
    const builder = new ClusterBuilder();
    expect(builder.connected(1, 2)).toBe(false);
  });

  it('merges two nodes after union', () => {
    const builder = new ClusterBuilder();
    builder.union(1, 2);
    expect(builder.connected(1, 2)).toBe(true);
    expect(builder.connected(1, 3)).toBe(false);
  });

  it('unions transitively', () => {
    const builder = new ClusterBuilder();
    builder.union(1, 2);
    builder.union(2, 3);
    builder.union(3, 4);
    expect(builder.connected(1, 4)).toBe(true);
  });

  it('groups clusters with two or more members', () => {
    const builder = new ClusterBuilder();
    builder.union(1, 2);
    builder.union(3, 4);
    builder.union(4, 5);
    builder.find(99);

    const clusters = builder.getClusters();
    const memberLists = Array.from(clusters.values()).map(m => [...m].sort((a, b) => a - b));
    expect(memberLists).toHaveLength(2);
    expect(memberLists.some(l => l.join(',') === '1,2')).toBe(true);
    expect(memberLists.some(l => l.join(',') === '3,4,5')).toBe(true);
  });

  it('excludes singletons when building clusters', () => {
    const builder = new ClusterBuilder();
    builder.union(1, 2);
    builder.find(7);
    builder.find(8);
    const clusters = builder.getClusters();
    expect(clusters.size).toBe(1);
    expect([...clusters.values()][0]).toHaveLength(2);
  });

  it('counts distinct clusters only', () => {
    const builder = new ClusterBuilder();
    builder.union(1, 2);
    builder.union(3, 4);
    builder.union(10, 11);
    expect(builder.getClusterCount()).toBe(3);
  });

  it('is a no-op for the same node union', () => {
    const builder = new ClusterBuilder();
    builder.union(1, 1);
    expect(builder.getClusterCount()).toBe(0);
  });

  it('applies path compression across repeated finds', () => {
    const builder = new ClusterBuilder();
    builder.union(1, 2);
    builder.union(2, 3);
    builder.union(3, 4);
    const root = builder.find(1);
    expect(builder.find(2)).toBe(root);
    expect(builder.find(3)).toBe(root);
    expect(builder.find(4)).toBe(root);
    expect(builder.connected(1, 4)).toBe(true);
  });
});