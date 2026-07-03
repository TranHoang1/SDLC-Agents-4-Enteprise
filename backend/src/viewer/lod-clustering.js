/**
 * LOD Clustering — Louvain Community Detection
 * KSA-143: KB Graph Level of Detail / Semantic Zoom
 * 
 * Deterministic clustering algorithm for graph nodes.
 * Produces communities of 5-50 nodes for LOD rendering.
 */

export class LODClustering {
  constructor(options = {}) {
    this._minSize = options.minClusterSize || 5;
    this._maxSize = options.maxClusterSize || 50;
    this._maxClusters = options.maxClusters || 100;
  }

  compute(nodes, edges) {
    if (!nodes || nodes.length === 0) return [];
    const edgeCount = new Map();
    for (const e of edges) {
      edgeCount.set(e.source, (edgeCount.get(e.source) || 0) + 1);
      edgeCount.set(e.target, (edgeCount.get(e.target) || 0) + 1);
    }
    const connected = nodes.filter(n => (edgeCount.get(n.id) || 0) > 0);
    const isolated = nodes.filter(n => (edgeCount.get(n.id) || 0) === 0);
    let connectedClusters = [];
    if (connected.length >= this._minSize) {
      connected.sort((a, b) => String(a.id).localeCompare(String(b.id)));
      const adj = this._buildAdjacency(connected, edges);
      const communities = this._louvainPhase1(connected, adj);
      const processed = this._enforceSizeConstraints(communities, connected);
      connectedClusters = this._buildClusters(processed, nodes);
    }
    let isolatedClusters = [];
    if (isolated.length > 0) {
      const typeGroups = new Map();
      for (const n of isolated) {
        const key = n.type || 'UNKNOWN';
        if (!typeGroups.has(key)) typeGroups.set(key, []);
        typeGroups.get(key).push(n.id);
      }
      const isoCommunities = [];
      for (const [type, ids] of typeGroups) {
        for (let i = 0; i < ids.length; i += this._maxSize) {
          const chunk = ids.slice(i, i + this._maxSize);
          if (chunk.length >= 2) isoCommunities.push(chunk);
        }
      }
      isolatedClusters = this._buildClusters(isoCommunities, nodes, connectedClusters.length);
    }
    const allClusters = [...connectedClusters, ...isolatedClusters];
    return this._enforceMaxClusters(allClusters);
  }

  recompute(nodes, edges) { return this.compute(nodes, edges); }

  getClusterForNode(nodeId, clusters) {
    for (const c of clusters) { if (c.childNodeIds.includes(nodeId)) return c; }
    return null;
  }

  _buildAdjacency(nodes, edges) {
    const nodeSet = new Set(nodes.map(n => n.id));
    const nodeTypeMap = new Map(nodes.map(n => [n.id, n.type || '']));
    const adj = new Map();
    for (const n of nodes) adj.set(n.id, []);
    for (const e of edges) {
      const s = typeof e.source === 'object' ? e.source.id : e.source;
      const t = typeof e.target === 'object' ? e.target.id : e.target;
      if (!nodeSet.has(s) || !nodeSet.has(t)) continue;
      const typeMatch = nodeTypeMap.get(s) === nodeTypeMap.get(t) ? 1 : 0;
      const weight = 2 + typeMatch;
      adj.get(s).push({ target: t, weight });
      adj.get(t).push({ target: s, weight });
    }
    return adj;
  }

  _louvainPhase1(nodes, adj) {
    const community = new Map();
    nodes.forEach((n, i) => community.set(n.id, i));
    const totalWeight = this._totalWeight(adj);
    let improved = true;
    let iterations = 0;
    const maxIter = 20;
    while (improved && iterations < maxIter) {
      improved = false;
      iterations++;
      for (const node of nodes) {
        const nodeId = node.id;
        const currentComm = community.get(nodeId);
        const neighborComms = new Map();
        for (const { target, weight } of adj.get(nodeId)) {
          const nc = community.get(target);
          neighborComms.set(nc, (neighborComms.get(nc) || 0) + weight);
        }
        let bestComm = currentComm;
        let bestGain = 0;
        for (const [comm, edgeWeight] of neighborComms) {
          if (comm === currentComm) continue;
          const gain = this._modularityGain(nodeId, comm, community, adj, totalWeight, edgeWeight);
          if (gain > bestGain) { bestGain = gain; bestComm = comm; }
        }
        if (bestComm !== currentComm) { community.set(nodeId, bestComm); improved = true; }
      }
    }
    const groups = new Map();
    for (const [nodeId, comm] of community) {
      if (!groups.has(comm)) groups.set(comm, []);
      groups.get(comm).push(nodeId);
    }
    return Array.from(groups.values());
  }

  _modularityGain(nodeId, targetComm, community, adj, totalWeight, edgeWeightToComm) {
    if (totalWeight === 0) return 0;
    const ki = adj.get(nodeId).reduce((sum, e) => sum + e.weight, 0);
    let sumIn = 0;
    for (const [nid, comm] of community) {
      if (comm !== targetComm) continue;
      for (const { target, weight } of adj.get(nid)) {
        if (community.get(target) === targetComm) sumIn += weight;
      }
    }
    sumIn /= 2;
    let sumTot = 0;
    for (const [nid, comm] of community) {
      if (comm !== targetComm) continue;
      sumTot += adj.get(nid).reduce((s, e) => s + e.weight, 0);
    }
    const m2 = totalWeight * 2;
    return (edgeWeightToComm / m2) - (sumTot * ki) / (m2 * m2);
  }

  _totalWeight(adj) {
    let total = 0;
    for (const edges of adj.values()) { for (const e of edges) total += e.weight; }
    return total / 2;
  }

  _enforceSizeConstraints(communities, nodes) {
    const result = [];
    for (const group of communities) {
      if (group.length < this._minSize) { result.push(group); }
      else if (group.length > this._maxSize) {
        for (let i = 0; i < group.length; i += this._maxSize) {
          const chunk = group.slice(i, i + this._maxSize);
          if (chunk.length >= this._minSize) result.push(chunk);
          else if (result.length > 0) result[result.length - 1].push(...chunk);
        }
      } else { result.push(group); }
    }
    const valid = [];
    const tooSmall = [];
    for (const g of result) {
      if (g.length >= this._minSize) valid.push(g);
      else tooSmall.push(g);
    }
    for (const small of tooSmall) {
      if (valid.length === 0) { valid.push(small); continue; }
      valid.sort((a, b) => a.length - b.length);
      valid[0].push(...small);
    }
    return valid;
  }

  _enforceMaxClusters(clusters) {
    while (clusters.length > this._maxClusters) {
      clusters.sort((a, b) => {
        const aLen = a.childNodeIds ? a.childNodeIds.length : a.length;
        const bLen = b.childNodeIds ? b.childNodeIds.length : b.length;
        return aLen - bLen;
      });
      const smallest = clusters[0];
      const second = clusters[1];
      if (smallest.childNodeIds && second.childNodeIds) {
        second.childNodeIds.push(...smallest.childNodeIds);
        second.label = `${second.dominantType} (${second.childNodeIds.length})`;
      }
      clusters = clusters.slice(1);
    }
    return clusters;
  }

  _buildClusters(communities, allNodes, idOffset = 0) {
    const nodeMap = new Map(allNodes.map(n => [n.id, n]));
    return communities.map((childIds, idx) => {
      const children = childIds.map(id => nodeMap.get(id)).filter(Boolean);
      const center = this._centroid(children);
      const radius = this._radius(children, center);
      const dominantType = this._dominantType(children);
      return {
        id: `cluster-${String(idx + idOffset).padStart(3, '0')}`,
        label: `${dominantType} (${childIds.length})`,
        childNodeIds: childIds,
        center,
        radius: Math.max(radius, 10),
        dominantType,
        state: 'COLLAPSED'
      };
    });
  }

  _centroid(nodes) {
    if (nodes.length === 0) return { x: 0, y: 0, z: 0 };
    const sum = nodes.reduce((acc, n) => ({ x: acc.x + (n.x || 0), y: acc.y + (n.y || 0), z: acc.z + (n.z || 0) }), { x: 0, y: 0, z: 0 });
    return { x: sum.x / nodes.length, y: sum.y / nodes.length, z: sum.z / nodes.length };
  }

  _radius(nodes, center) {
    if (nodes.length === 0) return 0;
    let maxDist = 0;
    for (const n of nodes) {
      const dx = (n.x || 0) - center.x, dy = (n.y || 0) - center.y, dz = (n.z || 0) - center.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (dist > maxDist) maxDist = dist;
    }
    return maxDist;
  }

  _dominantType(nodes) {
    const counts = {};
    for (const n of nodes) { const t = n.type || 'UNKNOWN'; counts[t] = (counts[t] || 0) + 1; }
    let max = 0, dominant = 'UNKNOWN';
    for (const [type, count] of Object.entries(counts)) { if (count > max) { max = count; dominant = type; } }
    return dominant;
  }
}
