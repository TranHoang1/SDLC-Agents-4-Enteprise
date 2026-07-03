/**
 * LOD Animation — Expand/Collapse Transitions
 * KSA-143: KB Graph Level of Detail / Semantic Zoom
 * 
 * Smooth 400ms animations for cluster expand/collapse.
 * Uses easeOutCubic (expand) and easeInCubic (collapse).
 */

class LODAnimation {
  constructor(graph3dInstance) {
    this._graph = graph3dInstance;
    this._active = new Map(); // clusterId -> animation state
  }

  /**
   * Expand a cluster: super node fades out, children orbit out.
   * @param {Object} cluster - cluster object with center, childNodeIds, radius
   * @param {Array} childNodes - actual node objects to show
   * @param {Object} options - { duration, onComplete, onPhase }
   */
  expand(cluster, childNodes, options = {}) {
    const duration = options.duration || 400;
    const onComplete = options.onComplete || (() => {});
    const startTime = performance.now();

    const positions = this._computeOrbitalPositions(childNodes.length, cluster.center, cluster.radius);

    const state = {
      clusterId: cluster.id,
      type: 'expand',
      startTime,
      duration,
      childNodes,
      positions,
      onComplete,
      cancelled: false
    };
    this._active.set(cluster.id, state);
    this._animate(state);
  }

  /**
   * Collapse a cluster: children move to center, super node fades in.
   */
  collapse(cluster, childNodes, options = {}) {
    const duration = options.duration || 400;
    const onComplete = options.onComplete || (() => {});
    const startTime = performance.now();

    // Store current positions as start
    const startPositions = childNodes.map(n => ({ x: n.x || 0, y: n.y || 0, z: n.z || 0 }));

    const state = {
      clusterId: cluster.id,
      type: 'collapse',
      startTime,
      duration,
      childNodes,
      startPositions,
      target: cluster.center,
      onComplete,
      cancelled: false
    };
    this._active.set(cluster.id, state);
    this._animate(state);
  }

  /**
   * Cancel an in-progress animation.
   */
  cancel(clusterId) {
    const state = this._active.get(clusterId);
    if (state) {
      state.cancelled = true;
      this._active.delete(clusterId);
    }
  }

  isAnimating(clusterId) {
    return this._active.has(clusterId);
  }

  dispose() {
    for (const state of this._active.values()) {
      state.cancelled = true;
    }
    this._active.clear();
  }

  _animate(state) {
    if (state.cancelled) return;

    const now = performance.now();
    const elapsed = now - state.startTime;
    const progress = Math.min(elapsed / state.duration, 1.0);

    if (state.type === 'expand') {
      this._animateExpand(state, progress);
    } else {
      this._animateCollapse(state, progress);
    }

    if (progress >= 1.0) {
      this._active.delete(state.clusterId);
      state.onComplete();
    } else {
      requestAnimationFrame(() => this._animate(state));
    }
  }

  _animateExpand(state, progress) {
    const { childNodes, positions, clusterId } = state;

    if (progress >= 0.2 && progress <= 0.8) {
      const moveProgress = (progress - 0.2) / 0.6;
      const eased = this._easeOutCubic(moveProgress);

      for (let i = 0; i < childNodes.length; i++) {
        const target = positions[i];
        const node = childNodes[i];
        node.fx = state.positions[i].x * eased + (1 - eased) * (node.__lodCenterX || 0);
        node.fy = state.positions[i].y * eased + (1 - eased) * (node.__lodCenterY || 0);
        node.fz = state.positions[i].z * eased + (1 - eased) * (node.__lodCenterZ || 0);
      }
    } else if (progress > 0.8) {
      for (let i = 0; i < childNodes.length; i++) {
        const node = childNodes[i];
        node.fx = positions[i].x;
        node.fy = positions[i].y;
        node.fz = positions[i].z;
      }
    }
  }

  _animateCollapse(state, progress) {
    const { childNodes, startPositions, target } = state;

    if (progress >= 0.2 && progress <= 0.8) {
      const moveProgress = (progress - 0.2) / 0.6;
      const eased = this._easeInCubic(moveProgress);

      for (let i = 0; i < childNodes.length; i++) {
        const start = startPositions[i];
        const node = childNodes[i];
        node.fx = start.x + (target.x - start.x) * eased;
        node.fy = start.y + (target.y - start.y) * eased;
        node.fz = start.z + (target.z - start.z) * eased;
      }
    } else if (progress > 0.8) {
      for (const node of childNodes) {
        node.fx = target.x;
        node.fy = target.y;
        node.fz = target.z;
      }
    }
  }

  /**
   * Compute orbital positions for children around cluster center.
   * <= 20: single ring. > 20: two concentric rings.
   */
  _computeOrbitalPositions(count, center, radius) {
    const positions = [];
    if (count <= 20) {
      for (let i = 0; i < count; i++) {
        const angle = (2 * Math.PI * i) / count;
        positions.push({
          x: center.x + Math.cos(angle) * radius,
          y: center.y + Math.sin(angle * 0.3) * radius * 0.2,
          z: center.z + Math.sin(angle) * radius
        });
      }
    } else {
      const innerCount = Math.floor(count * 0.4);
      const outerCount = count - innerCount;
      const innerRadius = radius * 0.6;

      for (let i = 0; i < innerCount; i++) {
        const angle = (2 * Math.PI * i) / innerCount;
        positions.push({
          x: center.x + Math.cos(angle) * innerRadius,
          y: center.y + Math.sin(angle * 0.3) * innerRadius * 0.2,
          z: center.z + Math.sin(angle) * innerRadius
        });
      }
      for (let i = 0; i < outerCount; i++) {
        const angle = (2 * Math.PI * i) / outerCount;
        positions.push({
          x: center.x + Math.cos(angle) * radius,
          y: center.y + Math.sin(angle * 0.3) * radius * 0.2,
          z: center.z + Math.sin(angle) * radius
        });
      }
    }
    return positions;
  }

  _easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }
  _easeInCubic(t) { return t * t * t; }
}

window.LODAnimation = LODAnimation;
