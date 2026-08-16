/**
 * SA4E-106 — PegaContentExtractor: converts raw Pega rule JSON into readable,
 * structured text (identity, parameters, steps, expressions, Java snippets) so
 * the LLM enrichment pipeline can generate summary + pseudo code + tags.
 */

import { PegaLogicNormalizer } from './PegaLogicNormalizer.js';

/** Field prefixes considered Pega internal metadata (px/pz/__) — excluded from dumps. */
const INTERNAL_PREFIXES = ['px', 'pz', '__'];

/** Max items rendered per array in structured blocks. */
const MAX_DUMP_ITEMS = 200;

/** Max lines for the generic scalar fallback dump. */
const MAX_DUMP_LINES = 250;

/** Array keys that carry rule logic, rendered by buildLogicBlocks(). */
const LOGIC_ARRAY_KEYS = [
  'pySteps', 'steps', 'pyActions', 'pyRows', 'pyTableRows', 'pyDecisionRules',
  'pyStrategyGroups', 'pyAlternates', 'pyFlowActions', 'pyShapes', 'pyNodes',
];

/** JSON-compatible object shape operated on (all values optional). */
export type PegaRuleJson = Record<string, unknown>;

/**
 * Extract readable content from a Pega rule JSON payload.
 * @param ruleJson - Raw Pega rule JSON (from Pega API or export)
 * @returns Structured text covering identity, parameters, logic and Java code
 */
export function extractRuleContent(ruleJson: PegaRuleJson): string {
  const sections: string[] = [];

  sections.push(buildHeader(ruleJson));

  const parameters = buildParameters(ruleJson);
  if (parameters) sections.push(parameters);

  const logic = buildLogic(ruleJson);
  if (logic) sections.push(logic);

  const java = buildJavaBlock(ruleJson);
  if (java) sections.push(java);

  const fields = buildFieldDump(ruleJson);
  if (fields) sections.push(fields);

  return sections.join('\n\n');
}

/** Build the identity header: rule type, class, name, ruleset. */
function buildHeader(ruleJson: PegaRuleJson): string {
  const name = scalar(
    ruleJson.pyRuleName, ruleJson.pyActivityName, ruleJson.pyModelName,
    ruleJson.pyTransformName, ruleJson.pyLabel,
  ) || 'Unnamed';

  const ruleset = scalarStr(ruleJson.pyRuleset);
  const version = scalarStr(ruleJson.pyRulesetVersion);

  const lines = [
    `RULE TYPE: ${scalar(ruleJson.pxObjClass) || 'Unknown'}`,
    `CLASS: ${scalarStr(ruleJson.pyClassName) || '@baseclass'}`,
    `NAME: ${name}`,
    `RULESET: ${ruleset || '-'}${version ? ` (${version})` : ''}`,
  ];

  const label = scalarStr(ruleJson.pyLabel, ruleJson.pyDescription, ruleJson.pyShortDescription);
  if (label && label !== name) lines.push(`LABEL: ${label}`);

  return lines.join('\n');
}

/** Build the parameters + pages block (activity/flow I/O). */
function buildParameters(ruleJson: PegaRuleJson): string | null {
  const out: string[] = [];

  const rawParams = ruleJson.pyParameters;
  if (Array.isArray(rawParams) && rawParams.length > 0) {
    out.push('PARAMETERS:');
    for (const p of rawParams.slice(0, MAX_DUMP_ITEMS)) {
      if (typeof p !== 'object' || !p) continue;
      const name = scalarStr(p.pyParameterName, p.pyName, p.pyLabel) || scalar(p.pyPropertyName);
      if (!name) continue;
      const mode = scalarStr(p.pyMode, p.pyType) || 'input';
      const def = scalar(p.pyDefaultValue, p.pyValue);
      out.push(`  - ${name}${def ? ` = ${def}` : ''} (${mode})`);
    }
  }

  const rawPages = ruleJson.pyPages;
  if (Array.isArray(rawPages) && rawPages.length > 0) {
    out.push('PAGES:');
    for (const pg of rawPages.slice(0, MAX_DUMP_ITEMS)) {
      if (typeof pg !== 'object' || !pg) continue;
      const name = scalarStr(pg.pyName, pg.pyPageName) || scalar(pg.pyClassName);
      if (!name) continue;
      out.push(`  - ${name} (${scalarStr(pg.pyMode) || 'page'})`);
    }
  }

  return out.length > 0 ? out.join('\n') : null;
}

/** Build the logic block for the rule type. */
function buildLogic(ruleJson: PegaRuleJson): string | null {
  const pxObjClass = String(ruleJson.pxObjClass || '');

  switch (pxObjClass) {
    case 'Rule-Obj-Activity':
      return `LOGIC (Activity Steps):\n${PegaLogicNormalizer.normalizeActivity(ruleJson)}`;
    case 'Rule-Obj-Model':
      return `LOGIC (Data Transform):\n${PegaLogicNormalizer.normalizeDataTransform(ruleJson)}`;
    case 'Rule-Obj-DecisionTable':
    case 'Rule-Declare-DecisionTable':
      return buildDecisionTable(ruleJson);
    case 'Rule-Obj-When':
    case 'Rule-Declare-Expressions':
    case 'Rule-Declare-Pages':
      return buildExpressionBlock(ruleJson);
    default:
      return buildExpressionBlock(ruleJson) ?? buildLogicBlocks(ruleJson);
  }
}

/** Build readable rows for a Pega decision table. */
function buildDecisionTable(ruleJson: PegaRuleJson): string | null {
  const rows: unknown[] =
    (ruleJson.pyDecisionRules as unknown[]) || (ruleJson.pyTableRows as unknown[]) || (ruleJson.pyRows as unknown[]);
  if (!Array.isArray(rows) || rows.length === 0) return null;

  const lines = ['LOGIC (Decision Table):'];
  for (let i = 0; i < rows.length && i < MAX_DUMP_ITEMS; i++) {
    const row = rows[i];
    if (typeof row !== 'object' || !row) continue;
    const rec = row as Record<string, unknown>;
    const when = scalarStr(rec.pyWhenCondition, rec.pyWhenName, rec.pyCondition, rec.pyInput);
    const result = scalarStr(rec.pyResult, rec.pyResultValue, rec.pyValue) || scalar(rec.pyOutput);
    lines.push(`  - ${when || `Row ${i + 1}`}: ${result || ''}`);
  }
  return lines.join('\n');
}

/** Build readable expression fields for When / Declare rules. */
function buildExpressionBlock(ruleJson: PegaRuleJson): string | null {
  const lines: string[] = [];
  for (const key of ['pyWhenText', 'pyExpression', 'pyFormula', 'pyWhenCondition', 'pyDescription']) {
    const value = ruleJson[key];
    if (typeof value === 'string' && value.trim()) lines.push(`${key}: ${value.trim()}`);
  }
  return lines.length > 0 ? `LOGIC (Expression):\n${lines.join('\n')}` : null;
}

/** Generic block renderer for known logic arrays (flows, trees, strategies). */
function buildLogicBlocks(ruleJson: PegaRuleJson): string | null {
  const sections: string[] = [];

  for (const key of LOGIC_ARRAY_KEYS) {
    const arr = ruleJson[key];
    if (!Array.isArray(arr) || arr.length === 0) continue;
    const lines = [`LOGIC (${key}):`];
    for (let i = 0; i < arr.length && i < MAX_DUMP_ITEMS; i++) {
      lines.push(`  - ${formatItem(arr[i])}`);
    }
    sections.push(lines.join('\n'));
  }

  return sections.length > 0 ? sections.join('\n\n') : null;
}

/** Render a single logic item — primitive or flattened scalar fields. */
function formatItem(item: unknown): string {
  if (typeof item !== 'object' || item === null) return String(item ?? '');
  const parts: string[] = [];
  for (const [key, value] of Object.entries(item as Record<string, unknown>)) {
    if (isInternalKey(key)) continue;
    if (value === null || value === undefined) continue;
    if (Array.isArray(value) || typeof value === 'object') continue;
    const s = String(value).trim();
    if (!s) continue;
    parts.push(`${key}: ${s}`);
    if (parts.length >= 8) break;
  }
  return parts.length > 0 ? parts.join(' | ') : '(object)';
}

/** Extract top-level Java code fields (snippets, Code-Java rule payloads). */
function buildJavaBlock(ruleJson: PegaRuleJson): string | null {
  const out: string[] = [];
  for (const key of Object.keys(ruleJson)) {
    if (!key.toLowerCase().includes('java')) continue;
    const value = ruleJson[key];
    if (typeof value === 'string' && value.trim()) out.push(`${key}:\n${value.trim()}`);
  }
  return out.length > 0 ? `JAVA:\n${out.join('\n\n')}` : null;
}

/** Scalar-only fallback dump; arrays/objects are covered by logic blocks. */
function buildFieldDump(ruleJson: PegaRuleJson): string | null {
  const lines: string[] = [];
  for (const [key, value] of Object.entries(ruleJson)) {
    if (lines.length >= MAX_DUMP_LINES) break;
    if (isInternalKey(key) || isHeaderKey(key)) continue;
    if (value === null || value === undefined) continue;
    if (Array.isArray(value) || typeof value === 'object') continue;
    const s = String(value).trim();
    if (!s) continue;
    lines.push(`${key}: ${s}`);
  }
  return lines.length > 0 ? `FIELDS:\n${lines.join('\n')}` : null;
}

/** Keys already rendered in the header — excluded from the scalar dump. */
function isHeaderKey(key: string): boolean {
  return [
    'pxObjClass', 'pyClassName', 'pyRuleName', 'pyActivityName', 'pyModelName',
    'pyTransformName', 'pyRuleset', 'pyRulesetVersion', 'pyLabel', 'pyDescription',
    'pyShortDescription', 'pyParameters', 'pyPages',
  ].includes(key);
}

/** Pega internal metadata fields (px/pz/__) — always excluded. */
function isInternalKey(key: string): boolean {
  return INTERNAL_PREFIXES.some((prefix) => key.startsWith(prefix));
}

/** First non-empty scalar (string/number/boolean) among candidate values. */
function scalar(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  }
  return undefined;
}

/** First non-empty string among candidate values. */
function scalarStr(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return undefined;
}