/**
 * SA4E-171 — Pega pxObjClass -> symbol kind mapping.
 * Central mapping table used by PegaKbSync and migration script.
 * Single source of truth for all Pega rule type classification.
 */

/** Map of pxObjClass values to symbol kind values (BR-01). */
export const PEGA_OBJ_CLASS_TO_KIND: ReadonlyMap<string, string> = new Map([
  ['Rule-Obj-Activity', 'pega_activity'],
  ['Rule-Obj-Flow', 'pega_flow'],
  ['Rule-Obj-DataTransform', 'pega_data_transform'],
  ['Rule-Obj-DecisionTable', 'pega_decision_table'],
  ['Rule-Obj-DecisionTree', 'pega_decision_tree'],
  ['Rule-Obj-Section', 'pega_section'],
  ['Rule-Obj-Harness', 'pega_harness'],
  ['Rule-Obj-Report-Definition', 'pega_report'],
  ['Rule-Obj-MapValue', 'pega_map_value'],
  ['Rule-Obj-When', 'pega_when'],
  ['Rule-Declare-Expressions', 'pega_declare_expression'],
  ['Rule-Declare-Pages', 'pega_declare_page'],
  ['Rule-Obj-Validate', 'pega_validate'],
  ['Rule-Obj-ListVw', 'pega_list_view'],
  ['Rule-Obj-Property', 'pega_property'],
  ['Rule-Obj-CaseType', 'pega_case_type'],
]);

/** Prefix for Pega connector rule classes (wildcard match). */
const CONNECTOR_PREFIX = 'Rule-Connect-';

/**
 * Resolve pxObjClass to symbol kind.
 * Uses exact match first, then wildcard prefix for connectors.
 * @param pxObjClass - The Pega rule class identifier
 * @returns Mapped kind, or 'pega_unknown' for unrecognized classes (AF-01)
 */
export function resolveSymbolKind(pxObjClass: string): string {
  const exact = PEGA_OBJ_CLASS_TO_KIND.get(pxObjClass);
  if (exact) return exact;
  if (pxObjClass.startsWith(CONNECTOR_PREFIX)) return 'pega_connector';
  return 'pega_unknown';
}

/**
 * Check if a kind is a Pega symbol kind (RD-01).
 * Uses startsWith pattern for future-proof extensibility.
 * @param kind - Symbol kind string to check
 * @returns true if kind starts with 'pega_'
 */
export function isPegaKind(kind: string): boolean {
  return kind.startsWith('pega_');
}

/**
 * Build virtual file path from rule metadata (BR-02).
 * Format: pega://{pyClassName}/{ruleType}/{pyRuleName}
 * @param pyClassName - Pega class name (e.g., 'Work-HR')
 * @param kind - Symbol kind (e.g., 'pega_activity')
 * @param pyRuleName - Rule name (e.g., 'ApproveLeave')
 * @returns Virtual path string
 */
export function buildVirtualPath(
  pyClassName: string, kind: string, pyRuleName: string,
): string {
  const ruleType = kind.replace('pega_', '');
  return `pega://${pyClassName}/${ruleType}/${pyRuleName}`;
}

/**
 * Build FQN signature string (BR-03).
 * Format: {pxObjClass}:{pyClassName}:{pyRuleName}
 * @param pxObjClass - Pega rule class (e.g., 'Rule-Obj-Activity')
 * @param pyClassName - Pega class name (e.g., 'Work-HR')
 * @param pyRuleName - Rule name (e.g., 'ApproveLeave')
 * @returns Fully-qualified name string
 */
export function buildFqn(
  pxObjClass: string, pyClassName: string, pyRuleName: string,
): string {
  return `${pxObjClass}:${pyClassName}:${pyRuleName}`;
}

/**
 * Resolve the canonical rule name from a Pega rule JSON object.
 * Mirrors PegaRuleAstParser.extractName fallback order (AF-01):
 * pyRuleName → pyActivityName → pyModelName → pyFlowName → pyLabel.
 */
export function resolveRuleNameField(ruleJson: Record<string, unknown>): string {
  const r = ruleJson as Record<string, unknown>;
  return String(
    r.pyRuleName
    || r.pyActivityName
    || r.pyModelName
    || r.pyFlowName
    || r.pyLabel
    || '',
  );
}
