/**
 * SA4E-222 Scope B — SchemaDrivenRenderer.
 *
 * Resolves EnrichedSchema.nested_logic_paths (dotted / `[]` / `[].` notation)
 * against a rule JSON and renders them through the shared `renderPathNodes`
 * path-walker. Tolerates partial resolution: an unresolvable path is skipped
 * with a WARN (OQ-5) and rendering continues; if ALL paths miss, returns null so
 * the caller falls back to the generic extractor (FR-B-6 / AC-B-3).
 *
 * Reuses the `[].` path-splitting precedent from PegaGenericRule.extractDependencies.
 */

import type { Logger } from 'pino';
import { renderPathNodes } from './PegaGenericLogicExtractor.js';

interface PathSegment {
  key?: string;
  index?: number;
  wildcard?: boolean;
}

const SEGMENT_RE = /([^.[\]]+)|\[\]|\[(\d+)\]/g;

/** Tokenize a nested path into ordered segments (keys, explicit indices, wildcards). */
function tokenizePath(path: string): PathSegment[] {
  const segs: PathSegment[] = [];
  let m: RegExpExecArray | null;
  SEGMENT_RE.lastIndex = 0;
  while ((m = SEGMENT_RE.exec(path)) !== null) {
    if (m[1] !== undefined) segs.push({ key: m[1] });
    else if (m[2] !== undefined) segs.push({ index: parseInt(m[2], 10) });
    else segs.push({ wildcard: true });
  }
  return segs;
}

/** Recursively resolve path segments, collecting every leaf node reached. */
function resolveNodes(current: unknown, segs: PathSegment[], out: unknown[]): void {
  if (segs.length === 0) {
    if (Array.isArray(current)) out.push(...current);
    else if (current !== undefined && current !== null) out.push(current);
    return;
  }
  const [seg, ...rest] = segs;
  if (seg.wildcard) {
    if (Array.isArray(current)) {
      for (const item of current) resolveNodes(item, rest, out);
    }
    return;
  }
  if (seg.index !== undefined) {
    const item = Array.isArray(current) ? current[seg.index] : undefined;
    resolveNodes(item, rest, out);
    return;
  }
  const next = current && typeof current === 'object'
    ? (current as Record<string, unknown>)[seg.key as string]
    : undefined;
  resolveNodes(next, rest, out);
}

/** Resolve a single nested logic path to its list of leaf nodes. */
export function resolvePath(ruleJson: Record<string, unknown>, path: string): unknown[] {
  const out: unknown[] = [];
  resolveNodes(ruleJson, tokenizePath(path), out);
  return out;
}

/**
 * Render logic using learned schema paths.
 * @returns combined LOGIC blocks, or null when no path resolved (caller falls back).
 */
export function renderSchemaDrivenLogic(
  ruleJson: Record<string, unknown>,
  paths: string[],
  logger?: Logger,
): string | null {
  const blocks: string[] = [];
  for (const path of paths) {
    const nodes = resolvePath(ruleJson, path);
    if (nodes.length === 0) {
      logger?.warn({ path }, '[schema-renderer] Path did not resolve; skipped (tolerant)');
      continue;
    }
    const block = renderPathNodes(nodes, path);
    if (block) blocks.push(block);
  }
  return blocks.length > 0 ? blocks.join('\n\n') : null;
}
