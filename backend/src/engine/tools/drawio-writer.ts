/**
 * Writes updated node positions back to draw.io XML — regex-based rewrite.
 */

import * as fs from 'fs';
import { DiagramGraph, DiagramNode } from './drawio-parser.js';
import { routeEdges, Waypoint } from './drawio-router.js';

/** Write layout results back to the XML file. */
export function writeLayout(rawXml: string, graph: DiagramGraph, filePath: string): void {
  let xml = rawXml;
  const allNodes = [...graph.nodes, ...graph.containers];
  xml = applyPositions(xml, allNodes);
  xml = applyEdgeAnchors(xml, graph);
  xml = applyEdgeRouting(xml, graph);
  fs.writeFileSync(filePath, xml, 'utf-8');
}

function applyPositions(xml: string, nodes: DiagramNode[]): string {
  for (const node of nodes) {
    // Match mxCell with this id, then update its mxGeometry
    const cellRegex = new RegExp(
      `(<mxCell[^>]*\\bid="${escapeRegex(node.id)}"[^>]*>\\s*<mxGeometry)([^/]*?)(/?>)`, 's'
    );
    xml = xml.replace(cellRegex, (_match, prefix, attrs, suffix) => {
      attrs = setAttr(attrs, 'x', fmt(node.x));
      attrs = setAttr(attrs, 'y', fmt(node.y));
      attrs = setAttr(attrs, 'width', fmt(node.width));
      attrs = setAttr(attrs, 'height', fmt(node.height));
      return `${prefix}${attrs}${suffix}`;
    });
    // Also handle self-closing mxCell with child mxGeometry on same line
    const altRegex = new RegExp(
      `(id="${escapeRegex(node.id)}"[^>]*>\\s*<mxGeometry\\s)([^>]*?)(/>)`, 's'
    );
    xml = xml.replace(altRegex, (_match, prefix, attrs, suffix) => {
      attrs = setAttr(attrs, 'x', fmt(node.x));
      attrs = setAttr(attrs, 'y', fmt(node.y));
      attrs = setAttr(attrs, 'width', fmt(node.width));
      attrs = setAttr(attrs, 'height', fmt(node.height));
      return `${prefix}${attrs}${suffix}`;
    });
  }
  return xml;
}

function applyEdgeAnchors(xml: string, graph: DiagramGraph): string {
  const nodeMap = new Map([...graph.nodes, ...graph.containers].map(n => [n.id, n]));
  for (const edge of graph.edges) {
    const src = nodeMap.get(edge.sourceId);
    const tgt = nodeMap.get(edge.targetId);
    if (!src || !tgt) continue;
    const [exitX, exitY] = computeExit(src, tgt);
    const [entryX, entryY] = computeEntry(src, tgt);
    const cellRegex = new RegExp(`(<mxCell[^>]*\\bid="${escapeRegex(edge.id)}"[^>]*style=")([^"]*)(")`, 's');
    xml = xml.replace(cellRegex, (_m, pre, style, post) => {
      style = setStyleProp(style, 'exitX', fmt(exitX));
      style = setStyleProp(style, 'exitY', fmt(exitY));
      style = setStyleProp(style, 'entryX', fmt(entryX));
      style = setStyleProp(style, 'entryY', fmt(entryY));
      return `${pre}${style}${post}`;
    });
  }
  return xml;
}

function applyEdgeRouting(xml: string, graph: DiagramGraph): string {
  const routes = routeEdges(graph);
  if (routes.size === 0) return xml;
  for (const [edgeId, waypoints] of routes) {
    // Set orthogonal style
    const styleRegex = new RegExp(`(<mxCell[^>]*\\bid="${escapeRegex(edgeId)}"[^>]*style=")([^"]*)(")`, 's');
    xml = xml.replace(styleRegex, (_m, pre, style, post) => {
      style = setStyleProp(style, 'edgeStyle', 'orthogonalEdgeStyle');
      style = setStyleProp(style, 'rounded', '1');
      return `${pre}${style}${post}`;
    });
    // Add waypoints Array inside mxGeometry
    const geomRegex = new RegExp(
      `(id="${escapeRegex(edgeId)}"[^>]*>[\\s\\S]*?<mxGeometry[^>]*)(/>|>)`, 's'
    );
    const pointsXml = buildPointsXml(waypoints);
    xml = xml.replace(geomRegex, (_m, prefix, close) => {
      if (close === '/>') return `${prefix}>${pointsXml}</mxGeometry>`;
      return `${prefix}>${pointsXml}`;
    });
  }
  return xml;
}

function buildPointsXml(waypoints: Waypoint[]): string {
  const points = waypoints.map(wp => `<mxPoint x="${fmt(wp.x)}" y="${fmt(wp.y)}" />`).join('');
  return `<Array as="points">${points}</Array>`;
}

function computeExit(src: DiagramNode, tgt: DiagramNode): [number, number] {
  const dx = (tgt.x + tgt.width / 2) - (src.x + src.width / 2);
  const dy = (tgt.y + tgt.height / 2) - (src.y + src.height / 2);
  return pickSide(dx, dy);
}

function computeEntry(src: DiagramNode, tgt: DiagramNode): [number, number] {
  const dx = (src.x + src.width / 2) - (tgt.x + tgt.width / 2);
  const dy = (src.y + src.height / 2) - (tgt.y + tgt.height / 2);
  return pickSide(dx, dy);
}

function pickSide(dx: number, dy: number): [number, number] {
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? [1, 0.5] : [0, 0.5];
  return dy > 0 ? [0.5, 1] : [0.5, 0];
}

function setStyleProp(style: string, key: string, value: string): string {
  const regex = new RegExp(`${key}=[^;]*`);
  if (regex.test(style)) return style.replace(regex, `${key}=${value}`);
  const sep = style.endsWith(';') ? '' : ';';
  return `${style}${sep}${key}=${value};`;
}

function setAttr(attrs: string, key: string, value: string): string {
  const regex = new RegExp(`${key}="[^"]*"`);
  if (regex.test(attrs)) return attrs.replace(regex, `${key}="${value}"`);
  return ` ${key}="${value}"${attrs}`;
}

function fmt(val: number): string {
  const rounded = Math.round(val);
  return rounded === val ? String(rounded) : val.toFixed(1);
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
