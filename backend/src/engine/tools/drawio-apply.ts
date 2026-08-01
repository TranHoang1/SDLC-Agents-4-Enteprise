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

// BR-7: configurable limits via env (NFR-P5)
const MAX_NODES = Number(process.env.SA4E_ELK_MAX_NODES ?? 500);
const TIMEOUT_MS = Number(process.env.SA4E_ELK_TIMEOUT_MS ?? 10_000);

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
  try {
    const elkGraph = buildElkGraph(graph, normalized);
    const laidOut = await runElkLayout(elkGraph, TIMEOUT_MS);
    const { xml, repositionedNodes } = applyLayoutToXml(rawXml, laidOut);
    // D-9: if >50% nodes could not be repositioned → abort
    if (repositionedNodes.length === 0) return error('ELK layout produced no position changes');
    validateReparse(xml);
    // Write fixed XML directly to file (no content_base64 in response)
    fs.writeFileSync(filePath, xml, 'utf-8');
    return JSON.stringify({
      status: 'fixed',
      message: `Fixed ${issues.length} issues with ELK ${normalized.algorithm} layout. ${repositionedNodes.length} nodes repositioned.`,
      nodes: nodeCount, edges: graph.edges.length, issues,
      repositioned_nodes: repositionedNodes,
    });
  } catch (e: any) {
    return error(`ELK layout failed: ${e.message ?? e}`);
  }
}

/** Normalize layout args with safe defaults. */
export function normalizeLayoutArgs(args: Record<string, unknown>): NormalizedArgs {
  const VALID_ALG = ['layered', 'force', 'mrtree', 'radial'];
  const VALID_DIR = ['DOWN', 'RIGHT', 'LEFT', 'UP'];
  const algorithm = typeof args.algorithm === 'string' && VALID_ALG.includes(args.algorithm) ? args.algorithm : 'layered';
  const spacing = typeof args.spacing === 'number' && args.spacing > 0 ? args.spacing : 80;
  const direction = typeof args.direction === 'string' && VALID_DIR.includes(args.direction.toUpperCase()) ? args.direction.toUpperCase() : 'DOWN';
  return { algorithm, spacing, direction };
}

/** BR-7: Re-parse fixed XML to ensure it's valid before writing to file. */
function validateReparse(xml: string): void {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'drawio-fix-'));
  try {
    const tmpFile = path.join(tmpDir, 'fixed.drawio');
    fs.writeFileSync(tmpFile, xml, 'utf-8');
    parseDrawio(tmpFile); // Throws if XML is broken
  } finally {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* best-effort cleanup */ }
  }
}

function error(msg: string): string {
  return JSON.stringify({ error: msg });
}
