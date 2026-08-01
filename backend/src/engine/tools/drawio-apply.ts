/**
 * SA4E-84 — Apply orchestrator for ELK auto-layout fix mode.
 * Coordinates: normalize args → build ELK graph → run layout → write XML → validate.
 * Writes fixed XML directly to file. Returns metadata only (no content_base64).
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import type { DiagramGraph } from './drawio-parser.js';
import { parseDrawio } from './drawio-parser.js';
import type { NormalizedArgs } from './drawio-layout-models.js';
import { buildElkGraph, runElkLayout } from './elk-layout.js';
import { applyLayoutToXml } from './drawio-writer.js';

/**
 * Parse an integer from environment variable with bounds validation (SEC-02).
 * Returns defaultVal if env var is missing, NaN, out of bounds, or non-finite.
 * @param envVar - Environment variable name
 * @param defaultVal - Fallback value
 * @param min - Minimum allowed value (inclusive)
 * @param max - Maximum allowed value (inclusive)
 */
function parseEnvInt(envVar: string, defaultVal: number, min: number, max: number): number {
  const raw = process.env[envVar];
  if (raw === undefined) return defaultVal;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) return defaultVal;
  return Math.floor(parsed);
}

// BR-7: configurable limits via env (NFR-P5) — with bounds validation (SEC-02)
const MAX_NODES = parseEnvInt('SA4E_ELK_MAX_NODES', 500, 1, 5000);
const TIMEOUT_MS = parseEnvInt('SA4E_ELK_TIMEOUT_MS', 10_000, 1000, 60_000);

/** Maximum spacing in pixels to prevent resource exhaustion (SEC-03). */
const MAX_SPACING = 500;

/**
 * Orchestrate ELK layout fix: build graph → run ELK → write to file → return metadata.
 * @param rawXml - Original XML content
 * @param graph - Parsed diagram graph
 * @param issues - Detected issues (before fix)
 * @param nodeCount - Total node count
 * @param args - Tool arguments for algorithm/spacing/direction
 * @param filePath - Absolute path to write fixed XML
 * @returns JSON string with status, repositioned_nodes (no content_base64)
 */
export async function handleApply(
  rawXml: string, graph: DiagramGraph, issues: object[], nodeCount: number,
  args: Record<string, unknown>, filePath: string,
): Promise<string> {
  if (nodeCount > MAX_NODES) return error(`Diagram too large (${nodeCount} nodes, max ${MAX_NODES})`);
  const normalized = normalizeLayoutArgs(args);
  // Container detected → edge-only fix (keep node positions, only distribute ports)
  if (graph.containers.length > 0) {
    return handleEdgeOnlyFix(rawXml, graph, issues, filePath);
  }
  // Flat diagram → full ELK repositioning
  try {
    const elkGraph = buildElkGraph(graph, normalized);
    const laidOut = await runElkLayout(elkGraph, TIMEOUT_MS);
    const { xml, repositionedNodes } = applyLayoutToXml(rawXml, laidOut);
    if (repositionedNodes.length === 0) return error('ELK layout produced no position changes');
    validateReparse(xml);
    fs.writeFileSync(filePath, xml, 'utf-8');
    return JSON.stringify({
      status: 'fixed',
      message: `Fixed ${issues.length} issues with ELK ${normalized.algorithm} layout. ${repositionedNodes.length} nodes repositioned.`,
    });
  } catch (e: any) {
    console.error('[drawio-apply] ELK layout error:', e);
    return error('Layout engine failed. Please check input diagram and retry.');
  }
}

/** Normalize layout args with safe defaults and upper bounds (SEC-03). */
export function normalizeLayoutArgs(args: Record<string, unknown>): NormalizedArgs {
  const VALID_ALG = ['layered', 'force', 'mrtree', 'radial'];
  const VALID_DIR = ['DOWN', 'RIGHT', 'LEFT', 'UP'];
  const algorithm = typeof args.algorithm === 'string' && VALID_ALG.includes(args.algorithm)
    ? args.algorithm : 'layered';
  // SEC-03: Cap spacing to MAX_SPACING to prevent resource exhaustion
  const rawSpacing = typeof args.spacing === 'number' && args.spacing > 0 ? args.spacing : 80;
  const spacing = Math.min(rawSpacing, MAX_SPACING);
  const direction = typeof args.direction === 'string' && VALID_DIR.includes(args.direction.toUpperCase())
    ? args.direction.toUpperCase() : 'DOWN';
  return { algorithm, spacing, direction };
}

/**
 * Edge-only fix for container diagrams: distribute edge ports to prevent stacking.
 * Keeps all node positions unchanged. Only modifies edge style attributes.
 */
function handleEdgeOnlyFix(
  rawXml: string, graph: DiagramGraph, issues: object[], filePath: string,
): string {
  try {
    let xml = rawXml;
    const nodeMap = new Map([...graph.nodes, ...graph.containers].map(n => [n.id, n]));
    const edgesBySource = new Map<string, typeof graph.edges>();
    const edgesByTarget = new Map<string, typeof graph.edges>();
    for (const e of graph.edges) {
      if (!edgesBySource.has(e.sourceId)) edgesBySource.set(e.sourceId, []);
      edgesBySource.get(e.sourceId)!.push(e);
      if (!edgesByTarget.has(e.targetId)) edgesByTarget.set(e.targetId, []);
      edgesByTarget.get(e.targetId)!.push(e);
    }
    for (const [nodeId, edges] of edgesBySource) {
      if (edges.length <= 1 || !nodeMap.has(nodeId)) continue;
      for (let i = 0; i < edges.length; i++) {
        const exitX = (i + 1) / (edges.length + 1);
        xml = addPortToEdge(xml, edges[i].id, 'exit', exitX, 1);
      }
    }
    for (const [nodeId, edges] of edgesByTarget) {
      if (edges.length <= 1 || !nodeMap.has(nodeId)) continue;
      for (let i = 0; i < edges.length; i++) {
        const entryX = (i + 1) / (edges.length + 1);
        xml = addPortToEdge(xml, edges[i].id, 'entry', entryX, 0);
      }
    }
    if (xml === rawXml) {
      return JSON.stringify({ status: 'already_good', message: 'Container diagram — no edge routing improvements needed.' });
    }
    validateReparse(xml);
    fs.writeFileSync(filePath, xml, 'utf-8');
    return JSON.stringify({
      status: 'fixed',
      message: `Fixed edge routing for container diagram. ${issues.length} issues detected, ports distributed.`,
    });
  } catch (e: any) {
    console.error('[drawio-apply] Edge-only fix error:', e);
    return error('Edge routing fix failed. Please check diagram structure.');
  }
}

/** Add exit/entry port coordinates to an edge style attribute. */
function addPortToEdge(xml: string, edgeId: string, type: 'exit' | 'entry', x: number, y: number): string {
  const escaped = edgeId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(<mxCell\\b[^>]*\\bid="${escaped}"[^>]*style=")([^"]*)("`);
  return xml.replace(regex, (_match, pre: string, style: string, post: string) => {
    let clean = style.replace(new RegExp(`${type}X=[^;]*;?`, 'g'), '');
    clean = clean.replace(new RegExp(`${type}Y=[^;]*;?`, 'g'), '');
    clean = clean.replace(new RegExp(`${type}Dx=[^;]*;?`, 'g'), '');
    clean = clean.replace(new RegExp(`${type}Dy=[^;]*;?`, 'g'), '');
    const port = `${type}X=${x.toFixed(2)};${type}Y=${y};${type}Dx=0;${type}Dy=0;`;
    return `${pre}${clean}${port}${post}`;
  });
}

/** BR-7: Re-parse fixed XML to ensure it's valid before writing to file. */
function validateReparse(xml: string): void {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'drawio-fix-'));
  try {
    const tmpFile = path.join(tmpDir, 'fixed.drawio');
    fs.writeFileSync(tmpFile, xml, 'utf-8');
    parseDrawio(tmpFile); // Throws if XML is broken
  } finally {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch (cleanupErr) {
      console.error('[drawio-apply] Temp cleanup failed:', cleanupErr);
    }
  }
}

function error(msg: string): string {
  return JSON.stringify({ error: msg });
}
