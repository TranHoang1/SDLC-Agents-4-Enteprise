/**
 * SA4E-222 Scope A — PegaGenericLogicExtractor.
 *
 * Deterministic, LLM-free extraction of logic-bearing structures from ANY Pega
 * rule JSON. Reuses `isInternalKey`/`scalarStr` from PegaContentExtractor to avoid
 * duplication. The shared `renderPathNodes` path-walker is also consumed by the
 * schema-driven renderer (Scope B) so both produce identical output shape.
 *
 * Detection heuristics (FR-A-3 / FR-A-4):
 *  - skip px/pz/__ internal keys and known non-logic containers (pyParameters/pyPages/...)
 *  - an array of objects qualifies when it is a known container key, OR when >= 2 of
 *    its child keys intersect RELATIONSHIP_KEYS.
 */

import { isInternalKey, scalarStr } from '../PegaContentExtractor.js';
import { RELATIONSHIP_KEYS, type ExtractOptions } from './types.js';

/** Container keys that always carry rule logic (allowlist). */
const KNOWN_CONTAINER_KEYS = new Set([
  'pySteps', 'steps', 'pyActions', 'pyShapes', 'pyStages', 'pyProcesses',
  'pyRows', 'pyDecisionRules', 'pyNodes', 'pyFlowActions', 'pyModelProcess',
  'pyConditions', 'pyAssignments', 'pyFlowShapes', 'pyConnectors', 'pyWhen',
  'pyTransitions', 'pyCursors', 'pyCells', 'pyBranches', 'pyDecisionTree',
  'pyInputs', 'pyExpressions', 'pyPurposes',
]);

/** Top-level keys that are NOT logic (rendered elsewhere — avoid false positives). */
const EXCLUDED_CONTAINER_KEYS = new Set([
  'pyParameters', 'pyPages', 'pyFields', 'pyColumns',
]);

/** Cap rendered items per collection (FR-A-3 / R-1 mitigation). */
const MAX_DUMP_ITEMS = 200;

/** Relationship pairs rendered as `a -> b` for a logic node. */
const RELATIONSHIP_PAIRS: ReadonlyArray<readonly [string, string]> = [
  ['from', 'to'],
  ['when', 'result'],
  ['pyWhenName', 'pyResult'],
  ['source', 'target'],
  ['pySource', 'pyTarget'],
  ['pyInput', 'pyOutput'],
];

/**
 * Extract generic logic-bearing blocks from a rule JSON.
 * @returns combined `LOGIC (generic: <key>):` blocks, or null if none found (FR-A-6).
 */
export function extractGenericLogic(
  ruleJson: Record<string, unknown>,
  _opts?: ExtractOptions,
): string | null {
  const blocks: string[] = [];
  for (const [key, value] of Object.entries(ruleJson)) {
    if (isInternalKey(key) || EXCLUDED_CONTAINER_KEYS.has(key)) continue;
    if (!Array.isArray(value) || value.length === 0) continue;
    if (!isLogicBearingArray(key, value)) continue;
    const block = renderPathNodes(value as unknown[], key);
    if (block) blocks.push(block);
  }
  return blocks.length > 0 ? blocks.join('\n\n') : null;
}

/** True when the array is a known container OR has >= 2 relationship-bearing keys. */
function isLogicBearingArray(key: string, arr: unknown[]): boolean {
  if (KNOWN_CONTAINER_KEYS.has(key)) return true;
  const keyUnion = new Set<string>();
  for (const item of arr) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
    for (const k of Object.keys(item as Record<string, unknown>)) {
      if (!isInternalKey(k)) keyUnion.add(k);
    }
  }
  let relHits = 0;
  for (const k of keyUnion) if (RELATIONSHIP_KEYS.includes(k)) relHits++;
  return relHits >= 2;
}

/**
 * Render an array of logic nodes with structure (id/name + relationships).
 * SHARED with SchemaDrivenRenderer so generic + schema-driven output is identical.
 * @returns a `LOGIC (generic: <label>):` block, or null when nothing rendered.
 */
export function renderPathNodes(nodes: unknown[], label: string): string | null {
  if (!Array.isArray(nodes) || nodes.length === 0) return null;
  const lines: string[] = [`LOGIC (generic: ${label}):`];
  let rendered = 0;
  for (const node of nodes) {
    if (rendered >= MAX_DUMP_ITEMS) break;
    if (typeof node !== 'object' || node === null) continue;
    const parts = renderNodeParts(node as Record<string, unknown>);
    if (parts.length === 0) continue;
    lines.push(`  - ${parts.join(' | ')}`);
    rendered++;
  }
  return rendered > 0 ? lines.join('\n') : null;
}

/** Build the rendering parts for a single logic node. */
function renderNodeParts(rec: Record<string, unknown>): string[] {
  const parts: string[] = [];
  const shown = new Set<string>();

  // 1) Identity / name
  const id = scalarStr(rec.pyStepId, rec.pyStepName, rec.name, rec.id, rec.pyLabel, rec.pyName, rec.label);
  if (id) parts.push(id);

  // 2) Relationship pairs (only when BOTH sides are present — avoids "? -> x")
  for (const [from, to] of RELATIONSHIP_PAIRS) {
    const f = scalarStr(rec[from]);
    const t = scalarStr(rec[to]);
    if (f && t) {
      parts.push(`${f} -> ${t}`);
      shown.add(from);
      shown.add(to);
    }
  }

  // 3) target = expression
  const target = scalarStr(rec.target, rec.pyTarget, rec.pyStepPage);
  const expr = scalarStr(rec.expression, rec.pyExpression, rec.pyFormula);
  if (target && expr) {
    parts.push(`${target} = ${expr}`);
    shown.add('target');
    shown.add('expression');
  } else if (expr) {
    parts.push(`expr: ${expr}`);
    shown.add('expression');
  } else if (target) {
    parts.push(`target: ${target}`);
    shown.add('target');
  }

  // 4) Single relationship keys not already surfaced (e.g. result, value)
  for (const k of RELATIONSHIP_KEYS) {
    if (shown.has(k)) continue;
    if (k === 'id' || k === 'name' || k === 'label') continue; // covered by identity (1)
    const v = scalarStr(rec[k]);
    if (v) parts.push(`${k}: ${v}`);
  }

  if (parts.length > 0) return parts;

  // 5) Fallback: flatten a few non-internal scalar fields for context.
  const flat: string[] = [];
  for (const [k, v] of Object.entries(rec)) {
    if (isInternalKey(k) || v === null || v === undefined) continue;
    if (Array.isArray(v) || typeof v === 'object') continue;
    const s = String(v).trim();
    if (!s) continue;
    flat.push(`${k}: ${s}`);
    if (flat.length >= 5) break;
  }
  return flat;
}
