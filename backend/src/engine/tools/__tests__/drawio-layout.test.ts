/**
 * SA4E-84 — Unit tests for drawio-layout layout algorithms (pure, in-place).
 */

import { describe, it, expect } from 'vitest';
import { applyLayout } from '../drawio-layout.js';
import type { DiagramGraph, DiagramNode } from '../drawio-parser.js';

function makeGraph(): DiagramGraph {
  return {
    nodes: [
      { id: 'A', parentId: '1', x: 0, y: 0, width: 120, height: 60, style: '', isContainer: false },
      { id: 'B', parentId: '1', x: 0, y: 0, width: 120, height: 60, style: '', isContainer: false },
    ],
    edges: [
      { id: 'e1', sourceId: 'A', targetId: 'B', style: '' },
    ],
    containers: [],
  };
}

describe('applyLayout — layered (DOWN)', () => {
  it('places sources on layer 0 and targets on layer 1', () => {
    const g = makeGraph();
    applyLayout(g, 'layered', 80, 'DOWN');
    const a = g.nodes.find(n => n.id === 'A')!;
    const b = g.nodes.find(n => n.id === 'B')!;
    expect(a.y).toBe(0);
    expect(a.x).toBe(0);
    expect(b.y).toBe(160); // layer 1 * (spacing * 2)
    expect(b.x).toBe(0);
  });

  it('stacks multiple nodes in the same layer horizontally', () => {
    const g: DiagramGraph = {
      nodes: [
        { id: 'A', parentId: '1', x: 0, y: 0, width: 120, height: 60, style: '', isContainer: false },
        { id: 'A2', parentId: '1', x: 0, y: 0, width: 120, height: 60, style: '', isContainer: false },
        { id: 'B', parentId: '1', x: 0, y: 0, width: 120, height: 60, style: '', isContainer: false },
      ],
      edges: [
        { id: 'e1', sourceId: 'A', targetId: 'B', style: '' },
        { id: 'e2', sourceId: 'A2', targetId: 'B', style: '' },
      ],
      containers: [],
    };
    applyLayout(g, 'layered', 80, 'DOWN');
    const a2 = g.nodes.find(n => n.id === 'A2')!;
    expect(a2.y).toBe(0);
    expect(a2.x).toBe(200); // idx 1 * (width + spacing)
  });

  it('applies RIGHT direction increasing X by layer', () => {
    const g = makeGraph();
    applyLayout(g, 'layered', 80, 'RIGHT');
    const b = g.nodes.find(n => n.id === 'B')!;
    expect(b.x).toBe(160);
    expect(b.y).toBe(0);
  });
});

describe('applyLayout — force', () => {
  it('seeds a grid when all nodes start at origin and yields finite positions', () => {
    const g = makeGraph();
    applyLayout(g, 'force', 80, 'DOWN');
    const a = g.nodes.find(n => n.id === 'A')!;
    const b = g.nodes.find(n => n.id === 'B')!;
    // Symmetric pair stays on the same horizontal axis but separates horizontally.
    expect(a.x).not.toBe(b.x);
    expect(a.x).not.toBe(0);
    expect(a.y).toBe(b.y);
    expect(Number.isFinite(a.x)).toBe(true);
    expect(Number.isFinite(b.y)).toBe(true);
  });
});

describe('applyLayout — radial', () => {
  it('keeps the first node at origin and places the rest on a ring', () => {
    const g: DiagramGraph = {
      nodes: Array.from({ length: 4 }, (_, i) => ({
        id: `N${i}`, parentId: '1', x: 5, y: 5, width: 100, height: 50,
        style: '', isContainer: false,
      })),
      edges: [], containers: [],
    };
    applyLayout(g, 'radial', 80, 'DOWN');
    const center = g.nodes.find(n => n.id === 'N0')!;
    expect(center.x).toBe(0);
    expect(center.y).toBe(0);
    for (const n of g.nodes.slice(1)) {
      expect(Math.hypot(n.x, n.y)).toBeGreaterThan(0);
    }
  });
});

describe('applyLayout — dispatch', () => {
  it('routes mrtree through the layered algorithm', () => {
    const g = makeGraph();
    applyLayout(g, 'mrtree', 80, 'DOWN');
    const b = g.nodes.find(n => n.id === 'B')!;
    expect(b.y).toBe(160);
  });

  it('falls back to layered for unknown algorithms', () => {
    const g = makeGraph();
    applyLayout(g, 'bogus', 80, 'DOWN');
    const b = g.nodes.find(n => n.id === 'B')!;
    expect(b.y).toBe(160);
  });

  it('is a no-op for empty graphs', () => {
    const g: DiagramGraph = { nodes: [], edges: [], containers: [] };
    expect(() => applyLayout(g, 'layered', 80, 'DOWN')).not.toThrow();
  });
});

describe('applyLayout — container resizing', () => {
  it('expands container to bound repositioned children', () => {
    const childA: DiagramNode = { id: 'A', parentId: 'cont', x: 0, y: 0, width: 120, height: 60, style: '', isContainer: false };
    const childB: DiagramNode = { id: 'B', parentId: 'cont', x: 0, y: 0, width: 120, height: 60, style: '', isContainer: false };
    const container: DiagramNode = { id: 'cont', parentId: '1', x: 0, y: 0, width: 400, height: 300, style: 'swimlane;', isContainer: true };
    const g: DiagramGraph = {
      nodes: [childA, childB],
      edges: [{ id: 'e1', sourceId: 'A', targetId: 'B', style: '' }],
      containers: [container],
    };
    applyLayout(g, 'layered', 80, 'DOWN');
    expect(container.width).toBeGreaterThan(0);
    expect(container.width).toBeGreaterThan(200);
    expect(container.height).toBeGreaterThan(200);
    expect(childA.x).toBeLessThan(container.width);
    expect(childB.x).toBeLessThan(container.width);
  });

  it('leaves containers without children untouched', () => {
    const container: DiagramNode = { id: 'cont', parentId: '1', x: 0, y: 0, width: 100, height: 100, style: 'swimlane;', isContainer: true };
    const g: DiagramGraph = { nodes: [], edges: [], containers: [container] };
    applyLayout(g, 'layered', 80, 'DOWN');
    expect(container.width).toBe(100);
    expect(container.height).toBe(100);
  });
});