/**
 * Parses draw.io XML into graph nodes and edges for layout processing.
 * Uses regex-based parsing (no external XML deps needed for draw.io format).
 */

import * as fs from 'fs';

export interface DiagramNode {
  id: string;
  parentId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  style: string;
  isContainer: boolean;
}

export interface DiagramEdge {
  id: string;
  sourceId: string;
  targetId: string;
  style: string;
}

export interface DiagramGraph {
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  containers: DiagramNode[];
}

/** Parse .drawio XML file into DiagramGraph. */
export function parseDrawio(filePath: string): { raw: string; graph: DiagramGraph } {
  const raw = fs.readFileSync(filePath, 'utf-8');
  const graph = extractGraph(raw);
  return { raw, graph };
}

function extractGraph(xml: string): DiagramGraph {
  const nodes: DiagramNode[] = [];
  const edges: DiagramEdge[] = [];
  const containers: DiagramNode[] = [];

  // Match all mxCell elements (self-closing or with children)
  const cellRegex = /<mxCell\s([^>]*?)(?:\/>|>([\s\S]*?)<\/mxCell>)/g;
  const cells: Array<{ attrs: Record<string, string>; body: string }> = [];
  let match: RegExpExecArray | null;

  while ((match = cellRegex.exec(xml)) !== null) {
    const attrs = parseAttrs(match[1]);
    const body = match[2] ?? '';
    cells.push({ attrs, body });
  }

  const cellIds = new Set(cells.map(c => c.attrs['id'] ?? ''));

  for (const cell of cells) {
    const id = cell.attrs['id'] ?? '';
    const style = cell.attrs['style'] ?? '';
    const parent = cell.attrs['parent'] ?? '1';

    if (cell.attrs['edge'] === '1') {
      const src = cell.attrs['source'];
      const tgt = cell.attrs['target'];
      if (src && tgt) edges.push({ id, sourceId: src, targetId: tgt, style });
    } else if (id !== '0' && id !== '1') {
      const geom = parseGeometry(cell.body, cell.attrs);
      if (!geom) continue;
      const isCont = hasChildren(id, cells) || isContainerStyle(style, geom.w, geom.h);
      const node: DiagramNode = {
        id, parentId: parent,
        x: geom.x, y: geom.y, width: geom.w, height: geom.h,
        style, isContainer: isCont,
      };
      if (isCont) containers.push(node); else nodes.push(node);
    }
  }
  return { nodes, edges, containers };
}

function parseGeometry(body: string, cellAttrs: Record<string, string>): { x: number; y: number; w: number; h: number } | null {
  // Look for mxGeometry in body or as sibling in raw XML
  const geomRegex = /<mxGeometry\s([^>]*?)(?:\/>|>)/;
  const geomMatch = body.match(geomRegex);
  if (!geomMatch) return null;
  const attrs = parseAttrs(geomMatch[1]);
  if (attrs['as'] !== 'geometry') return null;
  return {
    x: parseFloat(attrs['x'] ?? '0'),
    y: parseFloat(attrs['y'] ?? '0'),
    w: parseFloat(attrs['width'] ?? '80'),
    h: parseFloat(attrs['height'] ?? '40'),
  };
}

function parseAttrs(attrStr: string): Record<string, string> {
  const result: Record<string, string> = {};
  const regex = /(\w+)="([^"]*)"/g;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(attrStr)) !== null) {
    result[m[1]] = m[2];
  }
  return result;
}

function hasChildren(nodeId: string, cells: Array<{ attrs: Record<string, string>; body: string }>): boolean {
  return cells.some(c =>
    c.attrs['parent'] === nodeId && c.attrs['edge'] !== '1' && c.body.includes('mxGeometry')
  );
}

function isContainerStyle(style: string, width: number, height: number): boolean {
  const s = style.toLowerCase();
  if (s.includes('swimlane')) return true;
  if (s.includes('fillcolor=none') && s.includes('dashed=1')) return true;
  if (s.includes('shape=rectangle') && s.includes('dashed=1') && width > 300 && height > 300) return true;
  return false;
}
