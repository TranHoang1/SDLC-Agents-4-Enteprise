/**
 * SA4E — PegaNestedLogicExtractor: extracts the REAL logic of declarative Pega
 * rules whose formula/condition lives in nested arrays/objects rather than
 * top-level scalars. Without this, the enrichment LLM only sees metadata and
 * hallucinates pseudo code (e.g. Declare-Expression formulas, When conditions).
 */

export type PegaRuleJson = Record<string, unknown>;

/** Max nested condition rows rendered to keep prompt bounded. */
const MAX_ROWS = 60;

/** Narrow an unknown value to a record for safe property access. */
function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/** First non-empty trimmed string among candidate values. */
function firstStr(...values: unknown[]): string | undefined {
  for (const v of values) {
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return undefined;
}

/**
 * Extract the target-property formula for a Declare-Expression rule.
 * The readable expression lives at pyDefaultExpression.pyExpressionString.
 */
export function extractDeclareExpression(ruleJson: PegaRuleJson): string | null {
  const expr = asRecord(ruleJson.pyDefaultExpression);
  if (!expr) return null;
  const target = firstStr(expr.pyTargetProperty, ruleJson.pyTargetProperty);
  const formula = firstStr(expr.pyExpressionString, expr.pyExpression);
  if (!formula) return null;
  const lhs = target ? `${target} = ` : '';
  return `LOGIC (Declared Expression):\n${lhs}${formula}`;
}

/** Render one When condition row as "Label: <readable condition>". */
function renderConditionRow(row: unknown, index: number): string | null {
  const rec = asRecord(row);
  if (!rec) return null;
  const label = firstStr(rec.pyConditionLabel) || String.fromCharCode(65 + index);
  const cond = firstStr(
    rec.pyConditionValue1String, rec.pyConditionValue1, rec.pyConditionFieldName,
  );
  return cond ? `  ${label}: ${cond}` : null;
}

/**
 * Extract When-rule conditions (pyCondition[]) plus the combining logic string
 * (pyLogicString, e.g. "A AND B OR C"). These are the real evaluated conditions.
 */
export function extractWhenConditions(ruleJson: PegaRuleJson): string | null {
  const rows = ruleJson.pyCondition;
  if (!Array.isArray(rows) || rows.length === 0) return null;
  const lines = ['LOGIC (When Conditions):'];
  for (let i = 0; i < rows.length && i < MAX_ROWS; i++) {
    const line = renderConditionRow(rows[i], i);
    if (line) lines.push(line);
  }
  const combine = firstStr(ruleJson.pyLogicString, ruleJson.pyLogic);
  if (combine) lines.push(`  Combine: ${combine}`);
  return lines.length > 1 ? lines.join('\n') : null;
}

/**
 * Aggregate nested logic extraction for declarative rule types.
 * Returns null when the rule has no recognizable nested logic.
 */
export function extractNestedLogic(ruleJson: PegaRuleJson): string | null {
  return extractDeclareExpression(ruleJson) ?? extractWhenConditions(ruleJson);
}
