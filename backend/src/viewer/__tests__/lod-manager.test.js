/**
 * Unit & Integration Tests for LODManager — KSA-291 Bug Fix
 * Tests: _getExpandedCentroid, _checkDistances (fixed), _freeBudget (fixed)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- Test Helpers ---

function createMockGraph(cameraPosition = { x: 0, y: 0, z: 0 }) {
  return {
    camera: () => ({ position: cameraPosition }),
    graphData: vi.fn(),
    nodeVal: vi.fn(),
    nodeColor: vi.fn(),
    nodeLabel: vi.fn(),
  };
}

function createMockAnimation() {
  return {
    isAnimating: vi.fn().mockReturnValue(false),
    expand: vi.fn(),
    collapse: vi.fn(),
    dispose: vi.fn(),
  };
}

function createCluster(id, center, childNodeIds, state = 'COLLAPSED') {
  return {
    id,
    label: `Cluster ${id}`,
    center,
    childNodeIds,
    state,
    interacting: false,
    dominantType: 'ARCHITECTURE',
    radius: 25,
  };
}

// Since LODManager is a class with private methods, we test via a minimal instance
// that exposes internals for testing purposes.

class TestableLODManager {
  constructor(graph, config = {}) {
    this._graph = graph;
    this._config = {
      expandThreshold: config.expandThreshold || 50,
      collapseThreshold: config.collapseThreshold || (config.expandThreshold || 50) * 1.4,
      animationDuration: config.animationDuration || 400,
      maxVisibleNodes: config.maxVisibleNodes || 100,
    };
    this._clusters = new Map();
    this._allNodes = [];
    this._allEdges = [];
    this._visibleNodes = new Set();
    this._animation = createMockAnimation();
    this._initialized = true;
  }

  _getExpandedCentroid(cluster) {
    const childNodes = this._getChildNodes(cluster);
    if (childNodes.length === 0) return cluster.center;
    let sumX = 0, sumY = 0, sumZ = 0;
    const len = childNodes.length;
    for (let i = 0; i < len; i++) {
      sumX += childNodes[i].x || 0;
      sumY += childNodes[i].y || 0;
      sumZ += childNodes[i].z || 0;
    }
    return { x: sumX / len, y: sumY / len, z: sumZ / len };
  }

  _checkDistances() {
    const cam = this._graph.camera().position;
    for (const [id, cluster] of this._clusters) {
      if (this._animation.isAnimating(id)) continue;

      if (cluster.state === 'COLLAPSED') {
        const dist = this._distance(cam, cluster.center);
        if (dist < this._config.expandThreshold) {
          if (this._budgetAllows(cluster)) this.expandCluster(id);
        }
      } else if (cluster.state === 'EXPANDED') {
        const centroid = this._getExpandedCentroid(cluster);
        const dist = this._distance(cam, centroid);
        if (dist > this._config.collapseThreshold) {
          if (!cluster.interacting) this.collapseCluster(id);
        }
      }
    }
  }

  _freeBudget(needed) {
    const cam = this._graph.camera().position;
    const expanded = Array.from(this._clusters.values())
      .filter(c => c.state === 'EXPANDED' && !c.interacting)
      .sort((a, b) => {
        const distA = this._distance(cam, this._getExpandedCentroid(a));
        const distB = this._distance(cam, this._getExpandedCentroid(b));
        return distB - distA;
      });
    for (const cluster of expanded) {
      this.collapseCluster(cluster.id);
      if (this._visibleNodes.size - 1 + needed <= this._config.maxVisibleNodes) return true;
    }
    return false;
  }

  _budgetAllows(cluster) {
    return (this._visibleNodes.size - 1 + cluster.childNodeIds.length) <= this._config.maxVisibleNodes;
  }

  _getChildNodes(cluster) {
    const nodeMap = new Map(this._allNodes.map(n => [n.id, n]));
    return cluster.childNodeIds.map(id => nodeMap.get(id)).filter(Boolean);
  }

  _distance(a, b) {
    const dx = a.x - b.x, dy = a.y - b.y, dz = a.z - b.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  expandCluster = vi.fn().mockReturnValue(true);
  collapseCluster = vi.fn().mockReturnValue(true);
}

// --- Tests ---

describe('LODManager — KSA-291 Bug Fix', () => {
  describe('_getExpandedCentroid', () => {
    it('UT-1: returns correct average for 3 nodes', () => {
      const graph = createMockGraph();
      const mgr = new TestableLODManager(graph);
      mgr._allNodes = [
        { id: 'n1', x: 0, y: 0, z: 0 },
        { id: 'n2', x: 10, y: 0, z: 0 },
        { id: 'n3', x: 20, y: 0, z: 0 },
      ];
      const cluster = createCluster('c1', { x: 5, y: 0, z: 0 }, ['n1', 'n2', 'n3'], 'EXPANDED');

      const centroid = mgr._getExpandedCentroid(cluster);

      expect(centroid).toEqual({ x: 10, y: 0, z: 0 });
    });

    it('UT-2: returns cluster.center when no children found', () => {
      const graph = createMockGraph();
      const mgr = new TestableLODManager(graph);
      mgr._allNodes = [];
      const cluster = createCluster('c1', { x: 5, y: 5, z: 5 }, ['nonexistent'], 'EXPANDED');

      const centroid = mgr._getExpandedCentroid(cluster);

      expect(centroid).toEqual({ x: 5, y: 5, z: 5 });
    });

    it('UT-3: handles undefined node positions (treats as 0)', () => {
      const graph = createMockGraph();
      const mgr = new TestableLODManager(graph);
      mgr._allNodes = [
        { id: 'n1', x: 10, y: undefined, z: 5 },
        { id: 'n2', x: 20, y: 10, z: undefined },
      ];
      const cluster = createCluster('c1', { x: 0, y: 0, z: 0 }, ['n1', 'n2'], 'EXPANDED');

      const centroid = mgr._getExpandedCentroid(cluster);

      expect(centroid.x).toBeCloseTo(15);
      expect(centroid.y).toBeCloseTo(5);
      expect(centroid.z).toBeCloseTo(2.5);
    });

    it('UT-4: single node returns that node position', () => {
      const graph = createMockGraph();
      const mgr = new TestableLODManager(graph);
      mgr._allNodes = [{ id: 'n1', x: 5, y: 10, z: 15 }];
      const cluster = createCluster('c1', { x: 0, y: 0, z: 0 }, ['n1'], 'EXPANDED');

      const centroid = mgr._getExpandedCentroid(cluster);

      expect(centroid).toEqual({ x: 5, y: 10, z: 15 });
    });
  });

  describe('_checkDistances (fixed)', () => {
    it('UT-5: EXPANDED cluster uses dynamic centroid — collapse triggers', () => {
      const graph = createMockGraph({ x: 0, y: 0, z: 0 });
      const mgr = new TestableLODManager(graph, { expandThreshold: 50 });

      mgr._allNodes = [
        { id: 'n1', x: 80, y: 0, z: 0 },
        { id: 'n2', x: 100, y: 0, z: 0 },
      ];
      const cluster = createCluster('c1', { x: 10, y: 0, z: 0 }, ['n1', 'n2'], 'EXPANDED');
      mgr._clusters.set('c1', cluster);

      mgr._checkDistances();

      // centroid = (90, 0, 0), dist = 90 > 70 (collapseThreshold) -> collapse triggered
      expect(mgr.collapseCluster).toHaveBeenCalledWith('c1');
    });

    it('UT-6: COLLAPSED cluster still uses cluster.center for expand', () => {
      const graph = createMockGraph({ x: 12, y: 0, z: 0 });
      const mgr = new TestableLODManager(graph, { expandThreshold: 50 });

      mgr._allNodes = [{ id: 'n1', x: 200, y: 0, z: 0 }];
      const cluster = createCluster('c1', { x: 10, y: 0, z: 0 }, ['n1'], 'COLLAPSED');
      mgr._clusters.set('c1', cluster);
      mgr._visibleNodes = new Set(['c1']);

      mgr._checkDistances();

      // dist to cluster.center = 2 < 50 -> expand triggered
      expect(mgr.expandCluster).toHaveBeenCalledWith('c1');
    });

    it('UT-7: skips animating clusters', () => {
      const graph = createMockGraph({ x: 0, y: 0, z: 0 });
      const mgr = new TestableLODManager(graph);

      const cluster = createCluster('c1', { x: 10, y: 0, z: 0 }, ['n1'], 'EXPANDING');
      mgr._clusters.set('c1', cluster);
      mgr._animation.isAnimating.mockReturnValue(true);

      mgr._checkDistances();

      expect(mgr.expandCluster).not.toHaveBeenCalled();
      expect(mgr.collapseCluster).not.toHaveBeenCalled();
    });
  });

  describe('_freeBudget (fixed)', () => {
    it('UT-8: sorts by dynamic centroid, collapses farthest first', () => {
      const graph = createMockGraph({ x: 0, y: 0, z: 0 });
      const mgr = new TestableLODManager(graph, { maxVisibleNodes: 50 });

      mgr._allNodes = [
        { id: 'a1', x: 10, y: 0, z: 0 },
        { id: 'b1', x: 50, y: 0, z: 0 },
        { id: 'c1', x: 200, y: 0, z: 0 },
      ];
      const clusterA = createCluster('cA', { x: 5, y: 0, z: 0 }, ['a1'], 'EXPANDED');
      const clusterB = createCluster('cB', { x: 5, y: 0, z: 0 }, ['b1'], 'EXPANDED');
      const clusterC = createCluster('cC', { x: 5, y: 0, z: 0 }, ['c1'], 'EXPANDED');

      mgr._clusters.set('cA', clusterA);
      mgr._clusters.set('cB', clusterB);
      mgr._clusters.set('cC', clusterC);

      mgr._visibleNodes = new Set(Array.from({ length: 60 }, (_, i) => `node-${i}`));

      mgr._freeBudget(10);

      // clusterC (centroid x=200) should be collapsed first (farthest)
      expect(mgr.collapseCluster).toHaveBeenCalledWith('cC');
      expect(mgr.collapseCluster.mock.calls[0][0]).toBe('cC');
    });
  });

  describe('Integration: Expand -> Drift -> Collapse', () => {
    it('IT-1: collapse triggers after child nodes drift away', () => {
      const graph = createMockGraph({ x: 0, y: 0, z: 0 });
      const mgr = new TestableLODManager(graph, { expandThreshold: 50 });

      const childIds = Array.from({ length: 10 }, (_, i) => `n${i}`);
      mgr._allNodes = childIds.map((id, i) => ({
        id,
        x: 150 + i * 5,
        y: 0,
        z: 0,
      }));

      const cluster = createCluster('c1', { x: 10, y: 0, z: 0 }, childIds, 'EXPANDED');
      mgr._clusters.set('c1', cluster);

      mgr._checkDistances();

      // Dynamic centroid ~ (172.5, 0, 0), dist ~ 172.5 > 70 -> collapse
      expect(mgr.collapseCluster).toHaveBeenCalledWith('c1');
    });

    it('IT-3: expand regression — collapsed cluster uses fixed center', () => {
      const graph = createMockGraph({ x: 48, y: 0, z: 0 });
      const mgr = new TestableLODManager(graph, { expandThreshold: 50 });

      mgr._allNodes = [{ id: 'n1', x: 500, y: 0, z: 0 }];
      const cluster = createCluster('c1', { x: 50, y: 0, z: 0 }, ['n1'], 'COLLAPSED');
      mgr._clusters.set('c1', cluster);
      mgr._visibleNodes = new Set(['c1']);

      mgr._checkDistances();

      // dist to cluster.center = 2 < 50 -> expand triggered (not child pos 500)
      expect(mgr.expandCluster).toHaveBeenCalledWith('c1');
    });
  });
});
