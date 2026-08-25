/**
 * SA4E-214 — SchemaValidator: compares rule instance fields against schema.
 * Detects new fields not yet in the enriched schema (progressive discovery).
 * Called during BFS ingestion to incrementally improve schemas.
 */

import type { EnrichedSchema, FieldDescriptor, FieldCategory, FieldFrequency } from '../models/EnrichedSchema';

/**
 * Compare a rule JSON instance against its enriched schema to find new fields.
 * New fields are fields present in the instance but absent from known_fields.
 */
export class SchemaValidator {
  /** Internal Pega prefixes to always skip */
  private static readonly SKIP_PREFIXES = ['px', 'pz', 'pyJava', 'pyVisio'];

  /**
   * Find fields in ruleJson that are not in the schema's known_fields.
   * Skips internal Pega fields (px, pz prefix).
   * @returns Array of new FieldDescriptors (may be empty)
   */
  findNewFields(schema: EnrichedSchema, ruleJson: Record<string, unknown>): FieldDescriptor[] {
    const knownSet = new Set(schema.known_fields);
    const newFields: FieldDescriptor[] = [];

    for (const [key, value] of Object.entries(ruleJson)) {
      if (this.shouldSkip(key)) continue;
      if (knownSet.has(key)) continue;
      // Skip null/empty values — not informative enough
      if (value === null || value === '' || value === undefined) continue;

      newFields.push({
        path: key,
        category: this.inferCategory(key),
        type: this.inferType(value),
        description: `Discovered from rule instance (${typeof value})`,
        frequency: 'rare' as FieldFrequency,
      });
    }
    return newFields;
  }

  /** Check if key should be skipped (internal Pega field). */
  private shouldSkip(key: string): boolean {
    return SchemaValidator.SKIP_PREFIXES.some(p => key.startsWith(p));
  }

  /** Infer category from property name patterns. */
  private inferCategory(name: string): FieldCategory {
    if (/^py(ClassName|RuleName|RuleSet|Label|Purpose|Description)/.test(name)) return 'identity';
    if (/^py(Steps|Connector|Decision|Flow|Action|When|Shape)/.test(name)) return 'logic';
    if (/^py(DataPage|Service|Connect|Queue|External|REST)/.test(name)) return 'connectivity';
    return 'metadata';
  }

  /** Infer type string from a runtime value. */
  private inferType(value: unknown): string {
    if (value === null) return 'null';
    if (Array.isArray(value)) return 'array';
    if (typeof value === 'object') return 'object';
    return typeof value;
  }
}
