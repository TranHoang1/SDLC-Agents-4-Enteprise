import type { ElkNode, ElkEdge, RepositionedNode } from './drawio-layout-models.js';
import { flatten, collectEdges } from './elk-layout.js';

export interface XmlWriteResult {
  xml: string;
  repositionedNodes: RepositionedNode[];
}

export function applyLayoutToXml(rawXml: string, laidOut: ElkNode): XmlWriteResult {
  const newPosRaw = collectNewPos(laidOut);
  const oldPos = readCurrentPositions(rawXml);
  const { dx, dy } = normalizeOffset(newPosRaw);
  const newPos = shiftBy(newPosRaw, dx, dy);
  let xml = rawXml;
  for (const [id, pos] of newPos) xml = replaceCellGeometry(xml, id, pos.x, pos.y);
  for (const edge of collectEdges(laidOut)) xml = replaceEdgeWaypoints(xml, edge, dx, dy);
  return { xml, repositionedNodes: buildRepositioned(oldPos, newPos) };
}

function collectNewPos(laidOut: ElkNode): Map<string, { x: number; y: number }> {
  const map = new Map<string, { x: number; y: number }>();
  for (const node of flatten(laidOut)) {
    if (node.x !== undefined && node.y !== undefined) map.set(node.id, { x: node.x, y: node.y });
  }
  return map;
}

function readCurrentPositions(xml: string): Map<string, { x: number; y: number }> {
  const map = new Map<string, { x: number; y: number }>();
  const cellRegex = /<mxCell\s([^>]*?)(?:\/>|>([\s\S]*?)<\/mxCell>)/g;
  let m: RegExpExecArray | null;
  while ((m = cellRegex.exec(xml)) !== null) {
    const id = /id="([^"]+)"/.exec(m[1])?.[1];
    const geom = /<mxGeometry\s([^>]*?)(?:\/>|>)/.exec(m[2] ?? '');
    if (!id || !geom) continue;
    const x = parseFloat(/x="([^"]+)"/.exec(geom[1])?.[1] ?? '0');
    const y = parseFloat(/y="([^"]+)"/.exec(geom[1])?.[1] ?? '0');
    map.set(id, { x, y });
  }
  return map;
}

function replaceCellGeometry(xml: string, id: string, x: number, y: number): string {
  const cellRegex = new RegExp(`(<mxCell\\b[^>]*\\bid="${escapeRegex(id)}"[^>]*>)([\\s\\S]*?)(</mxCell>)`);
  return xml.replace(cellRegex, (whole, open: string, body: string, close: string) => {
    const geomRegex = /(<mxGeometry\b[^>]*)(\sx="[^"]*")(\sy="[^"]*")(\s[^>]*?)(\/>|>)/;
    const fixed = body.replace(geomRegex, (_g, head: string, _x: string, _y: string, tail: string, end: string) =>
      `${head} x="${round(x)}" y="${round(y)}"${tail}${end}`);
    return fixed === body ? whole : `${open}${fixed}${close}`;
  });
}

function replaceEdgeWaypoints(xml: string, edge: ElkEdge, dx: number, dy: number): string {
  const bends = edge.sections?.flatMap(s => s.bendPoints ?? []) ?? [];
  if (bends.length === 0) return xml;
  const cellRegex = new RegExp(`(<mxCell\\b[^>]*\\bid="${escapeRegex(edge.id)}"[^>]*edge="1"[^>]*>)([\\s\\S]*?)(</mxCell>)`);
  return xml.replace(cellRegex, (whole, open: string, body: string, close: string) => {
    const parent = /parent="([^"]+)"/.exec(open)?.[1] ?? '1';
    if (parent !== '1') return whole;
    const pointsXml = bends.map(b => `<mxPoint x="${round(b.x + dx)}" y="${round(b.y + dy)}"/>`).join('');
    const withPoints = body.replace(
      /(<mxGeometry\b[^>]*relative="1"[^>]*>)([\s\S]*?)(<\/mxGeometry>)/,
      (_g, head: string, inner: string, tail: string) => `${head}${inner.replace(/<Array as="points">[\s\S]*?<\/Array>/, '')}<Array as="points">${pointsXml}</Array>${tail}`,
    );
    return withPoints === body ? whole : `${open}${withPoints}${close}`;
  });
}

function normalizeOffset(pos: Map<string, { x: number; y: number }>): { dx: number; dy: number } {
  let minX = 0, minY = 0;
  for (const p of pos.values()) { minX = Math.min(minX, p.x); minY = Math.min(minY, p.y); }
  return { dx: minX < 0 ? -minX : 0, dy: minY < 0 ? -minY : 0 };
}

function shiftBy(pos: Map<string, { x: number; y: number }>, dx: number, dy: number): Map<string, { x: number; y: number }> {
  const out = new Map<string, { x: number; y: number }>();
  for (const [id, p] of pos) out.set(id, { x: p.x + dx, y: p.y + dy });
  return out;
}

function buildRepositioned(
  oldPos: Map<string, { x: number; y: number }>,
  newPos: Map<string, { x: number; y: number }>,
): RepositionedNode[] {
  const out: RepositionedNode[] = [];
  for (const [id, p] of newPos) {
    const o = oldPos.get(id);
    if (!o) continue;
    if (Math.abs(o.x - p.x) > 0.5 || Math.abs(o.y - p.y) > 0.5) {
      out.push({ id, x_old: o.x, y_old: o.y, x_new: p.x, y_new: p.y });
    }
  }
  return out;
}

function round(v: number): number { return Math.round(v * 10) / 10; }

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}