/**
 * LOD Manager — Orchestrates Level of Detail for 3D KB Graph
 * KSA-143: KB Graph Level of Detail / Semantic Zoom
 * 
 * Integrates clustering + animation with ForceGraph3D.
 * Manages camera distance checks, budget enforcement, state machine.
 */

// LODClustering and LODAnimation loaded via separate <script> tags (global)

const COLORS = {
  // Document types
  CONTEXT: '#ec4899', DECISION: '#06b6d4', ERROR_PATTERN: '#dc2626',
  ARCHITECTURE: '#10b981', REQUIREMENT: '#3b82f6', PROCEDURE: '#f59e0b',
  LESSON_LEARNED: '#f97316', CODE_ENTITY: '#ef4444', DOCUMENT: '#a855f7',
  // Code entity types
  FUNCTION: '#818cf8', METHOD: '#6366f1', CLASS: '#e879f9',
  INTERFACE: '#c084fc', TYPE: '#fb7185', CONSTRUCTOR: '#f472b6',
  ENUM: '#34d399', CONSTANT: '#fbbf24', VARIABLE: '#94a3b8',
};

class LODManager {
  constructor(graph3dInstance, config = {}) {
    this._graph = graph3dInstance;
    this._config = {
      expandThreshold: config.expandThreshold || 50,
      collapseThreshold: config.collapseThreshold || (config.expandThreshold || 50) * 1.4,
      animationDuration: config.animationDuration || 400,
      maxVisibleNodes: config.maxVisibleNodes || 100,
      minClusterSize: config.minClusterSize || 5,
      maxClusterSize: config.maxClusterSize || 50,
      lodEnabled: config.lodEnabled !== false
    };

    this._clustering = new LODClustering({
      minClusterSize: this._config.minClusterSize,
      maxClusterSize: this._config.maxClusterSize
    });
    this._animation = new LODAnimation(graph3dInstance);

    this._clusters = new Map();
    this._allNodes = [];
    this._allEdges = [];
    this._visibleNodes = new Set();
    this._rafId = null;
    this._initialized = false;
  }

  initialize(nodes, edges) {
    this._allNodes = nodes;
    this._allEdges = edges;
    if (nodes.length <= this._config.maxVisibleNodes) { this._initialized = false; return; }
    if (!this._config.lodEnabled) { this._initialized = false; return; }

    const startTime = performance.now();
    const clusters = this._clustering.compute(nodes, edges);
    const elapsed = performance.now() - startTime;
    console.log(`[LOD] Clustering: ${clusters.length} clusters from ${nodes.length} nodes in ${elapsed.toFixed(0)}ms`);
    if (elapsed > 5000) console.warn('[LOD] Clustering took', elapsed, 'ms');

    for (const cluster of clusters) this._clusters.set(cluster.id, cluster);
    this._showSuperNodes();
    this._initialized = true;
    this._startTick();
    console.log(`[LOD] Initialized: ${clusters.length} clusters from ${nodes.length} nodes (${elapsed.toFixed(0)}ms)`);
  }

  expandCluster(clusterId) {
    const cluster = this._clusters.get(clusterId);
    if (!cluster || cluster.state !== 'COLLAPSED') return false;
    if (!this._budgetAllows(cluster)) {
      if (!this._freeBudget(cluster.childNodeIds.length)) return false;
    }
    cluster.state = 'EXPANDING';

    // Progressive loading: fetch children from API if not already loaded
    if (!cluster.__childrenLoaded) {
      const token = localStorage.getItem('admin_token') || '';
      fetch('/api/admin/kb/graph/cluster/' + clusterId, {
        headers: { 'Authorization': 'Bearer ' + token }
      })
        .then(r => r.json())
        .then(data => {
          if (data && data.nodes) {
            // Add fetched nodes to allNodes
            const existingIds = new Set(this._allNodes.map(n => n.id));
            for (const node of data.nodes) {
              if (!existingIds.has(node.id)) {
                // Position around cluster center
                node.x = cluster.center.x + (Math.random() - 0.5) * 60;
                node.y = cluster.center.y + (Math.random() - 0.5) * 60;
                node.z = cluster.center.z + (Math.random() - 0.5) * 60;
                this._allNodes.push(node);
              }
            }
            // Update childNodeIds with fetched node IDs
            cluster.childNodeIds = data.nodes.map(n => n.id);
            // Add edges
            if (data.edges) {
              for (const e of data.edges) this._allEdges.push(e);
            }
            cluster.__childrenLoaded = true;
            // Now do the expand animation
            this._doExpand(cluster, clusterId);
          }
        })
        .catch(() => {
          // Fallback: expand with existing data
          this._doExpand(cluster, clusterId);
        });
    } else {
      this._doExpand(cluster, clusterId);
    }
    return true;
  }

  _doExpand(cluster, clusterId) {
    const childNodes = this._getChildNodes(cluster);
    for (const node of childNodes) {
      node.__lodCenterX = cluster.center.x;
      node.__lodCenterY = cluster.center.y;
      node.__lodCenterZ = cluster.center.z;
    }
    this._animation.expand(cluster, childNodes, {
      duration: this._config.animationDuration,
      onComplete: () => {
        cluster.state = 'EXPANDED';
        for (const id of cluster.childNodeIds) this._visibleNodes.add(id);
        this._visibleNodes.delete(cluster.id);
        this._updateGraphData();
      }
    });
  }

  collapseCluster(clusterId) {
    const cluster = this._clusters.get(clusterId);
    if (!cluster || cluster.state !== 'EXPANDED') return false;
    if (cluster.interacting) return false;
    cluster.state = 'COLLAPSING';
    const childNodes = this._getChildNodes(cluster);
    this._animation.collapse(cluster, childNodes, {
      duration: this._config.animationDuration,
      onComplete: () => {
        cluster.state = 'COLLAPSED';
        for (const id of cluster.childNodeIds) this._visibleNodes.delete(id);
        this._visibleNodes.add(cluster.id);
        this._updateGraphData();
      }
    });
    return true;
  }

  getVisibleNodeCount() { return this._visibleNodes.size; }

  setConfig(config) {
    Object.assign(this._config, config);
    if (config.expandThreshold && !config.collapseThreshold) {
      this._config.collapseThreshold = this._config.expandThreshold * 1.4;
    }
    if (config.lodEnabled === false) this._disableLOD();
    else if (config.lodEnabled === true && !this._initialized) this.initialize(this._allNodes, this._allEdges);
  }

  dispose() {
    if (this._rafId) { cancelAnimationFrame(this._rafId); this._rafId = null; }
    this._animation.dispose();
    this._clusters.clear();
    this._visibleNodes.clear();
    this._initialized = false;
  }

  // --- Private methods ---

  _startTick() {
    let lastCheckTime = 0;
    const CHECK_INTERVAL = 500; // Only check every 500ms to avoid interfering with zoom
    const tick = () => {
      if (!this._initialized) return;
      const now = performance.now();
      if (now - lastCheckTime >= CHECK_INTERVAL) {
        lastCheckTime = now;
        this._checkDistances();
      }
      this._rafId = requestAnimationFrame(tick);
    };
    this._rafId = requestAnimationFrame(tick);
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

  _budgetAllows(cluster) {
    return (this._visibleNodes.size - 1 + cluster.childNodeIds.length) <= this._config.maxVisibleNodes;
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

  _showSuperNodes() {
    const superNodes = [];
    // Build node→cluster map for edge aggregation
    const nodeToCluster = new Map();
    for (const [id, cluster] of this._clusters) {
      superNodes.push({
        id: cluster.id, name: cluster.label, type: cluster.dominantType,
        x: cluster.center.x, y: cluster.center.y, z: cluster.center.z,
        __isSuper: true, __childCount: cluster.childNodeIds.length, __cluster: cluster
      });
      this._visibleNodes.add(cluster.id);
      for (const nid of cluster.childNodeIds) nodeToCluster.set(nid, cluster.id);
    }
    // Create inter-cluster edges (deduplicated)
    const edgeSet = new Set();
    const interClusterEdges = [];
    for (const e of this._allEdges) {
      const s = typeof e.source === 'object' ? e.source.id : e.source;
      const t = typeof e.target === 'object' ? e.target.id : e.target;
      const sc = nodeToCluster.get(s);
      const tc = nodeToCluster.get(t);
      if (sc && tc && sc !== tc) {
        const key = sc < tc ? `${sc}|${tc}` : `${tc}|${sc}`;
        if (!edgeSet.has(key)) {
          edgeSet.add(key);
          interClusterEdges.push({ source: sc, target: tc });
        }
      }
    }
    this._graph.graphData({ nodes: superNodes, links: interClusterEdges });
    this._graph.nodeVal(n => n.__isSuper ? 2 + Math.log(n.__childCount) * 2 : 4);
    this._graph.nodeColor(n => COLORS[n.type] || '#38bdf8');
    this._graph.nodeLabel(n => n.__isSuper ? `${n.name} (${n.__childCount} nodes)` : `[${n.type}] ${n.name}`);
    // Auto fit view after LOD initializes
    setTimeout(() => { try { this._graph.zoomToFit(400, 50); } catch(e){} }, 1000);
  }

  _getChildNodes(cluster) {
    const nodeMap = new Map(this._allNodes.map(n => [n.id, n]));
    return cluster.childNodeIds.map(id => nodeMap.get(id)).filter(Boolean);
  }

  _getVisibleEdges(visibleNodes) {
    const visibleIds = new Set(visibleNodes.map(n => n.id));
    return this._allEdges.filter(e => {
      const s = typeof e.source === 'object' ? e.source.id : e.source;
      const t = typeof e.target === 'object' ? e.target.id : e.target;
      return visibleIds.has(s) && visibleIds.has(t);
    });
  }

  _updateGraphData() {
    const nodes = [];
    const nodeMap = new Map(this._allNodes.map(n => [n.id, n]));
    for (const [id, cluster] of this._clusters) {
      if (cluster.state === 'COLLAPSED' || cluster.state === 'COLLAPSING') {
        nodes.push({
          id: cluster.id, name: cluster.label, type: cluster.dominantType,
          x: cluster.center.x, y: cluster.center.y, z: cluster.center.z,
          __isSuper: true, __childCount: cluster.childNodeIds.length, __cluster: cluster
        });
      } else {
        for (const nid of cluster.childNodeIds) {
          const node = nodeMap.get(nid);
          if (node) nodes.push(node);
        }
      }
    }
    const links = this._getVisibleEdges(nodes);
    // Preserve camera position across graph data updates
    let camPos = null;
    let camLookAt = null;
    try {
      const cam = this._graph.camera();
      camPos = { x: cam.position.x, y: cam.position.y, z: cam.position.z };
      const controls = this._graph.controls();
      if (controls && controls.target) {
        camLookAt = { x: controls.target.x, y: controls.target.y, z: controls.target.z };
      }
    } catch(e) {}
    this._graph.graphData({ nodes, links });
    // Restore camera position after graphData update
    if (camPos) {
      this._graph.cameraPosition(camPos, camLookAt, 0);
    }
  }

  _disableLOD() {
    this.dispose();
    this._graph.graphData({ nodes: this._allNodes, links: this._allEdges });
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

  _distance(a, b) {
    const dx = a.x - b.x, dy = a.y - b.y, dz = a.z - b.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }
}

// Expose globally for non-module script loading
window.LODManager = LODManager;
