import { PegaRuleAstParser } from '../PegaRuleAstParser.js';

export interface Mutation {
  name: string;
  description: string;
  apply(original: Record<string, unknown>): Record<string, unknown>;
}

export interface MutationTestResult {
  mutationName: string;
  originalValid: boolean;
  mutatedValid: boolean;
  detectedDifference: boolean;
  parserErrorMessage?: string;
}

export class PegaMutationTester {
  private parser: PegaRuleAstParser;

  constructor(parser?: PegaRuleAstParser) {
    this.parser = parser ?? new PegaRuleAstParser();
  }

  mutateFieldValue(original: Record<string, unknown>, field: string, newValue: unknown): Record<string, unknown> {
    const clone = structuredClone(original);
    setNestedField(clone, field, newValue);
    return clone;
  }

  removeField(original: Record<string, unknown>, field: string): Record<string, unknown> {
    const clone = structuredClone(original);
    deleteNestedField(clone, field);
    return clone;
  }

  changeType(original: Record<string, unknown>, newType: string): Record<string, unknown> {
    const clone = structuredClone(original);
    clone.pxObjClass = newType;
    return clone;
  }

  addRandomField(original: Record<string, unknown>): Record<string, unknown> {
    const clone = structuredClone(original);
    clone[`pyExtraField_${Date.now()}`] = `extra_value_${Math.random().toString(36).substring(2, 8)}`;
    return clone;
  }

  removeChild(original: Record<string, unknown>, childArray: string, index: number): Record<string, unknown> {
    const clone = structuredClone(original);
    const arr = clone[childArray];
    if (Array.isArray(arr)) {
      arr.splice(index, 1);
    }
    return clone;
  }

  private parseSafely(json: Record<string, unknown>): { success: boolean; error?: string } {
    try {
      this.parser.parse(json);
      return { success: true };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  }

  private fingerprint(json: Record<string, unknown>): string {
    try {
      const ast = this.parser.parse(json);
      const childTypes = ast.children.map(c => c.type).join(',');
      const refNames = ast.references.map(r => r.ruleName).sort().join(',');
      const propEntries = Object.entries(ast.properties)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
        .join(',');
      return `${ast.ruleType}|${ast.name}|${ast.className}|${ast.children.length}|${childTypes}|${refNames}|${propEntries}`;
    } catch {
      return '__parse_error__';
    }
  }

  testMutation(original: Record<string, unknown>, mutation: Mutation): MutationTestResult {
    const originalResult = this.parseSafely(original);
    const originalFingerprint = originalResult.success ? this.fingerprint(original) : '__parse_error__';

    const mutated = mutation.apply(original);
    const mutatedResult = this.parseSafely(mutated);
    const mutatedFingerprint = mutatedResult.success ? this.fingerprint(mutated) : '__parse_error__';

    const detectedDifference = originalFingerprint !== mutatedFingerprint;

    return {
      mutationName: mutation.name,
      originalValid: originalResult.success,
      mutatedValid: mutatedResult.success,
      detectedDifference,
      parserErrorMessage: mutatedResult.error,
    };
  }

  runMutationSuite(sample: Record<string, unknown>): MutationTestResult[] {
    const mutations: Mutation[] = [
      {
        name: 'change-pxObjClass',
        description: 'Change pxObjClass to a different rule type',
        apply: (orig) => this.changeType(orig, 'Rule-Obj-Flow'),
      },
      {
        name: 'remove-pyClassName',
        description: 'Remove pyClassName field',
        apply: (orig) => this.removeField(orig, 'pyClassName'),
      },
      {
        name: 'change-label',
        description: 'Change pyLabel to different value',
        apply: (orig) => this.mutateFieldValue(orig, 'pyLabel', 'MUTATED_LABEL'),
      },
      {
        name: 'add-random-field',
        description: 'Add a random extra field',
        apply: (orig) => this.addRandomField(orig),
      },
      {
        name: 'remove-first-step',
        description: 'Remove first child from steps array',
        apply: (orig) => this.removeChild(orig, 'steps', 0),
      },
      {
        name: 'remove-pyActions',
        description: 'Remove pyActions array entirely',
        apply: (orig) => this.removeField(orig, 'pyActions'),
      },
      {
        name: 'set-empty-string',
        description: 'Set pyLabel to empty string',
        apply: (orig) => this.mutateFieldValue(orig, 'pyLabel', ''),
      },
      {
        name: 'set-null-value',
        description: 'Set pyClassName to null',
        apply: (orig) => this.mutateFieldValue(orig, 'pyClassName', null),
      },
      {
        name: 'add-malformed-array',
        description: 'Add invalid array field',
        apply: (orig) => this.mutateFieldValue(orig, 'steps', 'not-an-array'),
      },
    ];

    return mutations.map(m => this.testMutation(sample, m));
  }
}

function setNestedField(obj: Record<string, unknown>, field: string, value: unknown): void {
  const parts = field.split('.');
  let current = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (!(part in current) || typeof current[part] !== 'object') {
      current[part] = {};
    }
    current = current[part] as Record<string, unknown>;
  }
  current[parts[parts.length - 1]] = value;
}

function deleteNestedField(obj: Record<string, unknown>, field: string): void {
  const parts = field.split('.');
  let current = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (!(part in current) || typeof current[part] !== 'object') return;
    current = current[part] as Record<string, unknown>;
  }
  delete current[parts[parts.length - 1]];
}
