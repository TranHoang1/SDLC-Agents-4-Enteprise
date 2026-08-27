/**
 * SA4E — PegaFlowExtractor: reconstructs a Pega flow's real structure (shapes +
 * connectors) from pyModelProcess so the enrichment LLM sees the actual process
 * (Start → tasks → End with branching), not just flow metadata. Mirrors what the
 * Pega flow diagram shows: each shape, what it does, and how shapes connect.
 */

export type PegaRuleJson = Record<string, unknown>;

/** Max shapes/connectors rendered to keep the prompt bounded. */
const MAX_ITEMS = 100;

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>) : null;
}

function str(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/** Map a shape's pxObjClass (Data-MO-*) to a short human-readable shape kind. */
function shapeKind(pxObjClass: string): string {
  const t = pxObjClass.replace(/^Data-MO-/, '');
  const map: Record<string, string> = {
    'Event-Start': 'Start',
    'Event-End': 'End',
    'Activity-Utility': 'Utility',
    'Activity-Assignment': 'Assignment',
    'Activity-Subprocess': 'Subprocess',
    'Activity-Decision': 'Decision',
    'Connector-Transition': 'Transition',
  };
  return map[t] || t || 'Shape';
}

/** Describe what an individual shape does, using its most meaningful fields. */
function describeShape(id: string, shape: Record<string, unknown>): string {
  const kind = shapeKind(str(shape.pxObjClass));
  const name = str(shape.pyMOName) || str(shape.pyShapeDisplayName);
  const label = name ? ` "${name}"` : '';
  const parts: string[] = [`${id} [${kind}]${label}`];

  // Utility/assignment: what rule it runs + call params (the real action).
  const impl = str(shape.pyRuleParamsStreamName) || str(shape.pyImplementation);
  if (impl) parts.push(`runs=${impl}`);
  const callParams = asRecord(shape.pyCallParams);
  if (callParams) {
    const kv = Object.entries(callParams)
      .filter(([, v]) => str(v))
      .map(([k, v]) => `${k}=${str(v)}`);
    if (kv.length) parts.push(`params(${kv.join(', ')})`);
  }
  const harness = str(shape.pyStartingHarness);
  if (harness) parts.push(`harness=${harness}`);
  return parts.join(' ');
}

/** Build "From -> To [condition]" lines for connectors, sorted by source. */
function describeConnectors(connectors: Record<string, unknown>): string[] {
  const lines: string[] = [];
  for (const [id, raw] of Object.entries(connectors)) {
    const c = asRecord(raw);
    if (!c) continue;
    const from = str(c.pyFrom);
    const to = str(c.pyTo);
    if (!from || !to) continue;
    const cond = str(c.pyConditionType) || 'Always';
    const expr = str(c.pyExpression);
    const guard = expr ? `${cond}: ${expr}` : cond;
    lines.push(`  ${from} -> ${to} [${guard}]`);
    if (lines.length >= MAX_ITEMS) break;
  }
  return lines.sort();
}

/**
 * Extract a readable flow structure from a Rule-Obj-Flow's pyModelProcess.
 * Returns null when the rule has no model process (e.g. metadata-only export).
 */
export function extractFlowStructure(ruleJson: PegaRuleJson): string | null {
  const model = asRecord(ruleJson.pyModelProcess);
  if (!model) return null;
  const shapes = asRecord(model.pyShapes);
  const connectors = asRecord(model.pyConnectors);
  if (!shapes && !connectors) return null;

  const lines: string[] = ['LOGIC (Flow):'];

  if (shapes) {
    lines.push('SHAPES:');
    let n = 0;
    for (const [id, raw] of Object.entries(shapes)) {
      const shape = asRecord(raw);
      if (!shape) continue;
      lines.push(`  - ${describeShape(id, shape)}`);
      if (++n >= MAX_ITEMS) break;
    }
  }

  if (connectors) {
    const conn = describeConnectors(connectors);
    if (conn.length) {
      lines.push('FLOW (transitions):');
      lines.push(...conn);
    }
  }

  return lines.length > 1 ? lines.join('\n') : null;
}
