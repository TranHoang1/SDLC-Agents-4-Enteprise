import { PegaRuleAstParser } from '../PegaRuleAstParser.js';
import type { PegaRuleAst } from '../PegaRuleAst.js';

export interface RoundTripResult {
  ruleName: string;
  ruleType: string;
  success: boolean;
  originalFields: string[];
  preservedFields: string[];
  lostFields: string[];
  addedFields: string[];
  differences: string[];
}

// Map of rule types to their name-carrying fields (in priority order)
const RULE_TYPE_NAME_FIELDS: Record<string, string[]> = {
  'Rule-Obj-Activity': ['pyActivityName', 'pyRuleName'],
  'Rule-Obj-Model': ['pyModelName', 'pyRuleName'],
  'Rule-Obj-Flow': ['pyFlowName', 'pyRuleName'],
  'Rule-Obj-FlowAction': ['pyRuleName'],
  'Rule-Obj-Class': ['pyRuleName'],
  'Rule-Obj-When': ['pyRuleName'],
  'Rule-Obj-Property': ['pyRuleName'],
  'Rule-Declare-DecisionTable': ['pyRuleName'],
  'Rule-Declare-DecisionTree': ['pyRuleName'],
  'Rule-Declare-Expressions': ['pyRuleName'],
  'Rule-Declare-Pages': ['pyRuleName'],
  'Rule-Connect-REST': ['pyRuleName'],
  'Rule-Connect-SOAP': ['pyRuleName'],
  'Rule-HTML-Section': ['pyRuleName'],
  'Rule-Utility-Function': ['pyRuleName'],
  'Rule-Access-Role': ['pyRuleName'],
};

function getPrimaryNameField(ruleType: string): string {
  const fields = RULE_TYPE_NAME_FIELDS[ruleType];
  return fields ? fields[0] : 'pyRuleName';
}

function serializeAst(ast: PegaRuleAst): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  result.pxObjClass = ast.ruleType;
  result.pyClassName = ast.className;

  // Use the correct name field for the rule type
  if (ast.name) {
    const nameField = getPrimaryNameField(ast.ruleType);
    result[nameField] = ast.name;
  } else {
    result.pyRuleName = '';
  }

  if (ast.ruleset) result.pyRuleset = ast.ruleset;
  if (ast.rulesetVersion) result.pyRuleSetVersion = ast.rulesetVersion;
  if (ast.label) result.pyLabel = ast.label;

  // Restore properties
  for (const [key, val] of Object.entries(ast.properties)) {
    if (val !== undefined && val !== null) {
      result[key] = val;
    }
  }

  // Serialize children back to arrays based on rule type
  if (ast.children.length > 0) {
    const firstChild = ast.children[0];
    if (firstChild.type === 'Step') {
      result.steps = ast.children.map(c => ({ ...c.properties }));
    } else if (firstChild.type === 'Action') {
      result.pyActions = ast.children.map(c => ({ ...c.properties }));
    } else if (['Start', 'Assignment', 'Action', 'End'].includes(firstChild.type)) {
      result.pyShapes = ast.children.map(c => ({ pyShapeType: c.type, ...c.properties }));
    } else if (firstChild.type === 'DecisionRow') {
      result.pyDecisionTableRows = ast.children.map(c => ({ ...c.properties }));
    } else if (firstChild.type === 'StrategyComponent') {
      result.pyComponents = ast.children.map(c => ({ ...c.properties }));
    } else if (firstChild.type === 'Header') {
      result.pyHeaders = ast.children.map(c => ({ ...c.properties }));
    } else if (firstChild.type === 'RuleReference') {
      result.pxRuleReferences = ast.children.map(c => ({ ...c.properties }));
    } else if (firstChild.type === 'Page') {
      result.pyPages = ast.children.map(c => ({ ...c.properties }));
    } else if (firstChild.type === 'Parameter') {
      result.pyParameters = ast.children.map(c => ({ ...c.properties }));
    } else if (firstChild.type === 'Permission') {
      result.pyOperations = ast.children.map(c => ({ ...c.properties }));
    } else if (firstChild.type === 'Layout') {
      result.pyLayouts = ast.children.map(c => ({ ...c.properties }));
    } else {
      const arrayKey = `${firstChild.type}List`;
      result[arrayKey] = ast.children.map(c => ({ type: c.type, ...c.properties }));
    }
  }

  return result;
}

function getFieldPaths(obj: Record<string, unknown>, prefix = ''): string[] {
  const fields: string[] = [];
  for (const [key, val] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (val !== null && typeof val === 'object' && !Array.isArray(val)) {
      fields.push(...getFieldPaths(val as Record<string, unknown>, path));
    } else if (Array.isArray(val)) {
      fields.push(path);
      for (let i = 0; i < val.length; i++) {
        const item = val[i];
        if (item !== null && typeof item === 'object') {
          fields.push(...getFieldPaths(item as Record<string, unknown>, `${path}[${i}]`));
        }
      }
    } else {
      fields.push(path);
    }
  }
  return fields;
}

export class PegaRoundTripValidator {
  constructor(private parser: PegaRuleAstParser) {}

  validate(json: Record<string, unknown>): RoundTripResult {
    const ruleName = (json.pyRuleName as string) || (json.pyActivityName as string) || (json.pyModelName as string) || 'unknown';
    const ruleType = (json.pxObjClass as string) || 'unknown';

    // Step 1: Parse
    const ast = this.parser.parse(json);

    // Step 2: Serialize back
    const serialized = serializeAst(ast);

    // Step 3: Compare field by field
    const originalFields = getFieldPaths(json);
    const serializedFields = getFieldPaths(serialized);

    const originalSet = new Set(originalFields);
    const serializedSet = new Set(serializedFields);

    // Fields in original that don't exist in serialized (lost)
    const lostFields = originalFields.filter(f => !serializedSet.has(f));

    // Fields in serialized that don't exist in original (added)
    const addedFields = serializedFields.filter(f => !originalSet.has(f));

    // Common fields that have same value (or equivalent)
    const preservedFields = originalFields.filter(f => {
      if (!serializedSet.has(f)) return false;
      const originalVal = getValueAtPath(json, f);
      const serializedVal = getValueAtPath(serialized, f);
      return originalVal !== undefined && serializedVal !== undefined && deepEqual(originalVal, serializedVal);
    });

    const differences: string[] = [];

    // Check lost fields — only flag semantic (non-system) fields as differences
    for (const field of lostFields) {
      const isSystemField = field.startsWith('px') || field.startsWith('pz');
      if (isSystemField) continue; // system fields are expected to be stripped
      differences.push(`Field "${field}" was lost during round-trip`);
    }

    // Check added fields — only flag non-system fields
    for (const field of addedFields) {
      if (field.startsWith('px') || field.startsWith('pz')) continue;
      // Rule name normalization: ignore when a type-specific name field
      // (eg pyActivityName) exists alongside pyRuleName
      if (field === 'pyRuleName' && originalFields.some(f => f.startsWith('py') && f.endsWith('Name') && f !== 'pyRuleName')) continue;
      if (!originalFields.includes(field)) {
        differences.push(`Field "${field}" was added during round-trip`);
      }
    }

    // Check value changes in common fields
    for (const field of preservedFields) {
      const originalVal = getValueAtPath(json, field);
      const serializedVal = getValueAtPath(serialized, field);
      if (!deepEqual(originalVal, serializedVal)) {
        differences.push(`Field "${field}" value changed: ${JSON.stringify(originalVal)} -> ${JSON.stringify(serializedVal)}`);
      }
    }

    return {
      ruleName,
      ruleType,
      success: differences.length === 0,
      originalFields,
      preservedFields,
      lostFields,
      addedFields,
      differences,
    };
  }

  validateBatch(samples: Record<string, unknown>[]): RoundTripResult[] {
    return samples.map(s => this.validate(s));
  }

  assertPropertiesPreserved(original: Record<string, unknown>, result: RoundTripResult): boolean {
    // Check that all semantic (non-system) fields from the original survived
    const semanticFields = Object.keys(original).filter(k => !k.startsWith('px') && !k.startsWith('pz'));
    for (const field of semanticFields) {
      if (result.lostFields.includes(field)) {
        return false;
      }
    }
    return true;
  }
}

function getValueAtPath(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = obj;
  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    const arrayMatch = part.match(/^(.+)\[(\d+)\]$/);
    if (arrayMatch) {
      const arr = (current as Record<string, unknown>)[arrayMatch[1]];
      if (!Array.isArray(arr)) return undefined;
      current = arr[parseInt(arrayMatch[2], 10)];
    } else if (typeof current === 'object') {
      current = (current as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }
  return current;
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null) return a === b;
  if (typeof a !== typeof b) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((val, idx) => deepEqual(val, b[idx]));
  }
  if (typeof a === 'object' && typeof b === 'object') {
    const aObj = a as Record<string, unknown>;
    const bObj = b as Record<string, unknown>;
    const aKeys = Object.keys(aObj);
    const bKeys = Object.keys(bObj);
    if (aKeys.length !== bKeys.length) return false;
    return aKeys.every(key => deepEqual(aObj[key], bObj[key]));
  }
  return a === b;
}
