/**
 * SA4E — PegaCaseTypeExtractor: reconstructs a Case Type's real lifecycle
 * (stages → processes, primary + alternate) from pyStages/pyAlternateStages so
 * the enrichment LLM sees the actual case flow — mirroring the Pega Case
 * Lifecycle UI — instead of just case metadata (icon, urgency, display mode).
 */

export type PegaRuleJson = Record<string, unknown>;

/** Max stages/processes rendered to keep the prompt bounded. */
const MAX_ITEMS = 60;

function asArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter(v => v && typeof v === 'object') as Record<string, unknown>[] : [];
}

function str(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/** Render one process line: "Label (flow=FlowName) [start: type/when]". */
function describeProcess(proc: Record<string, unknown>): string {
  const label = str(proc.pyLabel) || str(proc.pyFlowName) || '(process)';
  const flow = str(proc.pyFlowName);
  const startType = str(proc.pyStartType);
  const startWhen = str(proc.pyStartWhen);
  const parts = [`    - ${label}`];
  if (flow && flow !== label) parts.push(`(flow=${flow})`);
  const start = [startType, startWhen && startWhen !== 'Always' ? `when ${startWhen}` : '']
    .filter(Boolean).join(' ');
  if (start) parts.push(`[${start}]`);
  return parts.join(' ');
}

/** Render one stage header + its processes. */
function describeStage(stage: Record<string, unknown>, kind: string): string[] {
  const name = str(stage.pyStageName) || str(stage.pyStageID) || 'Stage';
  const transition = str(stage.pyStageTransition);
  const flags: string[] = [];
  if (str(stage.pyIsInitializationStage) === 'true') flags.push('initial');
  if (str(stage.pyIsTerminalStage) === 'true') flags.push('terminal');
  if (transition) flags.push(transition);
  const status = str(stage.pyStageWorkStatus);
  if (status) flags.push(`status=${status}`);
  const header = `  ${kind}: ${name}${flags.length ? ` [${flags.join(', ')}]` : ''}`;

  const lines = [header];
  const procs = asArray(stage.pyProcesses).slice(0, MAX_ITEMS);
  for (const p of procs) lines.push(describeProcess(p));
  return lines;
}

/**
 * Extract a readable case lifecycle from a Rule-Obj-CaseType.
 * Returns null when the rule has no stages (e.g. metadata-only export).
 */
export function extractCaseTypeLifecycle(ruleJson: PegaRuleJson): string | null {
  const primary = asArray(ruleJson.pyStages);
  const alternate = asArray(ruleJson.pyAlternateStages);
  if (primary.length === 0 && alternate.length === 0) return null;

  const lines: string[] = ['LOGIC (Case Lifecycle):'];

  const caseLabel = str(ruleJson.pyLabel) || str(ruleJson.pyDescription);
  if (caseLabel) lines.push(`CASE: ${caseLabel}`);

  if (primary.length) {
    lines.push('PRIMARY STAGES:');
    for (const s of primary.slice(0, MAX_ITEMS)) lines.push(...describeStage(s, 'Stage'));
  }
  if (alternate.length) {
    lines.push('ALTERNATE STAGES:');
    for (const s of alternate.slice(0, MAX_ITEMS)) lines.push(...describeStage(s, 'Alt Stage'));
  }

  return lines.length > 1 ? lines.join('\n') : null;
}
