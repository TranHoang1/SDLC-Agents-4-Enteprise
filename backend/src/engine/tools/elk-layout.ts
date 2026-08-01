import type { DiagramGraph } from './drawio-parser.js';
import type { ElkNode, ElkEdge, NormalizedArgs } from './drawio-layout-models.js';

let elkConstructor: Promise<new () => any> | null = null;

export async function loadElk(): Promise<new () => any> {
  if (!elkConstructor) {
    elkConstructor = import('elkjs/lib/elk.bundled.js').then(m => m.default as unknown as new () => any);
  }
  return elkConstructor;
}

const ALGORITHM_MAP: Record<string, string> = {
  layered: 'org.eclipse.elk.layered',
  force: 'org.eclipse.elk.force',
  mrtree: 'org.eclipse.elk.mrtree',
  radial: 'org.eclipse.elk.radial',
};

export function mapAlgorithm(algorithm: string): string {
  return ALGORITHM_MAP[algorithm] ?? ALGORITHM_MAP.layered;
}

export function buildElkGraph(graph: DiagramGraph, args: NormalizedArgs): ElkNode {
  const root: ElkNode = { id: 'root', width: 0, height: 0, children: [], edges: [], layoutOptions: {} };
  const nodeMap = new Map<string, ElkNode>();
  for (const n of [...graph.nodes, ...graph.containers]) {
    nodeMap.set(n.id, { id: n.id, width: n.width, height: n.height });
  }
  for (const n of [...graph.nodes, ...graph.containers]) {
    const elkNode = nodeMap.get(n.id)!;
    if (n.parentId && n.parentId !== '1' && nodeMap.has(n.parentId)) {
      const parent = nodeMap.get(n.parentId)!;
      parent.children = parent.children ?? [];
      parent.children.push(elkNode);
    } else {
      root.children!.push(elkNode);
    }
  }
  for (const e of graph.edges) {
    if (!nodeMap.has(e.sourceId) || !nodeMap.has(e.targetId)) continue;
    const edge: ElkEdge = { id: e.id, sources: [e.sourceId], targets: [e.targetId] };
    const srcParent = [...graph.nodes, ...graph.containers].find(n => n.id === e.sourceId)?.parentId ?? '1';
    const tgtParent = [...graph.nodes, ...graph.containers].find(n => n.id === e.targetId)?.parentId ?? '1';
    const sameContainer = srcParent !== '1' && srcParent === tgtParent && nodeMap.has(srcParent);
    if (sameContainer) {
      const containerElk = nodeMap.get(srcParent)!;
      containerElk.edges = containerElk.edges ?? [];
      containerElk.edges.push(edge);
    } else {
      root.edges!.push(edge);
    }
  }
  root.layoutOptions = {
    'elk.algorithm': mapAlgorithm(args.algorithm),
    'elk.direction': args.direction,
    'elk.spacing.nodeNode': args.spacing,
    'elk.layered.spacing.nodeNodeBetweenLayers': args.spacing * 2,
  };
  return root;
}

export async function runElkLayout(elkGraph: ElkNode, timeoutMs: number): Promise<ElkNode> {
  const ELK = await loadElk();
  const elk = new ELK();
  const laidOut = await withTimeout(elk.layout(elkGraph, { layoutOptions: elkGraph.layoutOptions }), timeoutMs) as ElkNode;
  validateLayoutOutput(laidOut);
  return laidOut;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`ELK layout timed out after ${ms}ms`)), ms),
    ),
  ]);
}

function validateLayoutOutput(root: ElkNode): void {
  for (const node of flatten(root)) {
    if (!Number.isFinite(node.x) || !Number.isFinite(node.y) || node.width <= 0 || node.height <= 0) {
      throw new Error(`ELK returned invalid coordinates for node '${node.id}'`);
    }
  }
}

export function flatten(root: ElkNode): ElkNode[] {
  const out: ElkNode[] = [];
  const stack = [...(root.children ?? [])];
  while (stack.length > 0) {
    const node = stack.pop()!;
    out.push(node);
    if (node.children) stack.push(...node.children);
  }
  return out;
}

export function collectEdges(root: ElkNode): ElkEdge[] {
  const out: ElkEdge[] = [];
  for (const node of flatten(root)) {
    if (node.edges) out.push(...node.edges);
  }
  return out;
}