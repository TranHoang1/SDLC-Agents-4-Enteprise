/**
 * Layout algorithms for draw.io diagrams — layered, force-directed, tree, radial.
 */

import { DiagramGraph, DiagramNode, DiagramEdge } from './drawio-parser.js';

/** Apply layout algorithm to graph, updating node positions in-place. */
export function applyLayout(graph: DiagramGraph, algorithm: string, spacing: number, direction: string): void {
  if (graph.nodes.length === 0) return;
  const dispatch: Record<string, () => void> = {
    layered: () => layeredLayout(graph, spacing, direction),
    force: () => forceDirectedLayout(graph.nodes, graph.edges, spacing),
    mrtree: () => layeredLayout(graph, spacing, direction),
    radial: () => radialLayout(graph.nodes, graph.edges, spacing),
  };
  (dispatch[algorithm] ?? dispatch.layered)();
  resizeContainers(graph, spacing);
}

function layeredLayout(graph: DiagramGraph, spacing: number, direction: string): void {
  const layers = assignLayers(graph.nodes, graph.edges);
  positionLayers(graph.nodes, layers, spacing, direction);
}

function assignLayers(nodes: DiagramNode[], edges: DiagramEdge[]): Map<string, number> {
  const adj = new Map<string, string[]>();
  const inDeg = new Map<string, number>();
  for (const n of nodes) { adj.set(n.id, []); inDeg.set(n.id, 0); }
  for (const e of edges) {
    if (adj.has(e.sourceId) && adj.has(e.targetId)) {
      adj.get(e.sourceId)!.push(e.targetId);
      inDeg.set(e.targetId, (inDeg.get(e.targetId) ?? 0) + 1);
    }
  }
  const layers = new Map<string, number>();
  const queue: string[] = [];
  for (const [id, deg] of inDeg) { if (deg === 0) { queue.push(id); layers.set(id, 0); } }
  while (queue.length > 0) {
    const cur = queue.shift()!;
    const curLayer = layers.get(cur) ?? 0;
    for (const nxt of adj.get(cur) ?? []) {
      const newLayer = curLayer + 1;
      if ((layers.get(nxt) ?? -1) < newLayer) layers.set(nxt, newLayer);
      inDeg.set(nxt, (inDeg.get(nxt) ?? 1) - 1);
      if (inDeg.get(nxt) === 0) queue.push(nxt);
    }
  }
  for (const n of nodes) { if (!layers.has(n.id)) layers.set(n.id, 0); }
  return layers;
}

function positionLayers(nodes: DiagramNode[], layers: Map<string, number>, spacing: number, direction: string): void {
  const grouped = new Map<number, DiagramNode[]>();
  for (const n of nodes) {
    const layer = layers.get(n.id) ?? 0;
    if (!grouped.has(layer)) grouped.set(layer, []);
    grouped.get(layer)!.push(n);
  }
  const layerSpacing = spacing * 2;
  for (const [layer, layerNodes] of grouped) {
    for (let idx = 0; idx < layerNodes.length; idx++) {
      const node = layerNodes[idx];
      const primary = layer * layerSpacing;
      const secondary = idx * (node.width + spacing);
      switch (direction) {
        case 'DOWN': node.x = secondary; node.y = primary; break;
        case 'RIGHT': node.x = primary; node.y = secondary; break;
        case 'UP': node.x = secondary; node.y = -primary; break;
        case 'LEFT': node.x = -primary; node.y = secondary; break;
      }
    }
  }
}

function forceDirectedLayout(nodes: DiagramNode[], edges: DiagramEdge[], spacing: number): void {
  const repulsion = spacing * spacing * 10;
  const attraction = 0.01;
  if (nodes.every(n => n.x === 0 && n.y === 0)) {
    const cols = Math.max(1, Math.ceil(Math.sqrt(nodes.length)));
    nodes.forEach((n, i) => { n.x = (i % cols) * spacing * 2; n.y = Math.floor(i / cols) * spacing * 2; });
  }
  for (let iter = 0; iter < 100; iter++) {
    const damping = 1.0 - (iter / 100) * 0.8;
    applyForces(nodes, edges, repulsion, attraction, damping);
  }
}

function applyForces(nodes: DiagramNode[], edges: DiagramEdge[], repulsion: number, attraction: number, damping: number): void {
  const n = nodes.length;
  const dx = new Float64Array(n);
  const dy = new Float64Array(n);
  const nodeIdx = new Map<string, number>();
  nodes.forEach((nd, i) => nodeIdx.set(nd.id, i));
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const diffX = nodes[i].x - nodes[j].x;
      const diffY = nodes[i].y - nodes[j].y;
      const dist = Math.max(1.0, Math.sqrt(diffX * diffX + diffY * diffY));
      const force = repulsion / (dist * dist);
      const fx = force * diffX / dist, fy = force * diffY / dist;
      dx[i] += fx; dy[i] += fy; dx[j] -= fx; dy[j] -= fy;
    }
  }
  for (const e of edges) {
    const si = nodeIdx.get(e.sourceId), ti = nodeIdx.get(e.targetId);
    if (si === undefined || ti === undefined) continue;
    const diffX = nodes[ti].x - nodes[si].x, diffY = nodes[ti].y - nodes[si].y;
    const fx = attraction * diffX, fy = attraction * diffY;
    dx[si] += fx; dy[si] += fy; dx[ti] -= fx; dy[ti] -= fy;
  }
  for (let i = 0; i < n; i++) { nodes[i].x += dx[i] * damping; nodes[i].y += dy[i] * damping; }
}

function radialLayout(nodes: DiagramNode[], _edges: DiagramEdge[], spacing: number): void {
  if (nodes.length === 0) return;
  nodes[0].x = 0; nodes[0].y = 0;
  const remaining = nodes.slice(1);
  const ringSize = 8;
  for (let start = 0; start < remaining.length; start += ringSize) {
    const ring = remaining.slice(start, start + ringSize);
    const ringIdx = Math.floor(start / ringSize);
    const radius = (ringIdx + 1) * spacing * 2.5;
    ring.forEach((node, i) => {
      const angle = (2 * Math.PI * i) / ring.length;
      node.x = radius * Math.cos(angle);
      node.y = radius * Math.sin(angle);
    });
  }
}

function resizeContainers(graph: DiagramGraph, spacing: number): void {
  for (const container of graph.containers) {
    const children = graph.nodes.filter(n => n.parentId === container.id);
    if (children.length === 0) continue;
    const minX = Math.min(...children.map(c => c.x)) - spacing;
    const minY = Math.min(...children.map(c => c.y)) - spacing;
    const maxX = Math.max(...children.map(c => c.x + c.width)) + spacing;
    const maxY = Math.max(...children.map(c => c.y + c.height)) + spacing;
    container.x = minX; container.y = minY;
    container.width = maxX - minX; container.height = maxY - minY;
    for (const child of children) { child.x -= minX; child.y -= minY; }
  }
}
