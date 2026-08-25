/**
 * SA4E-214 — SchemaAggregator: merge fields from multiple analyze responses.
 * Handles deduplication, category resolution, and field conflict (first-wins).
 */

import type { FieldDescriptor } from '../../../models/pega-schema.models.js';

/**
 * Merge FieldDescriptor arrays from multiple analysis passes (recursive sections).
 * Deduplicates by path — first occurrence wins (append-only, consistent with BR-07).
 */
export class SchemaAggregator {
  /** Merge multiple field arrays into a single deduplicated list. */
  static merge(...fieldArrays: FieldDescriptor[][]): FieldDescriptor[] {
    const seen = new Map<string, FieldDescriptor>();

    for (const fields of fieldArrays) {
      for (const field of fields) {
        // First-wins: do not overwrite existing entries (TDD §12.1 Q2)
        if (!seen.has(field.path)) {
          seen.set(field.path, field);
        }
      }
    }
    return [...seen.values()];
  }

  /** Count fields by category for summary reporting. */
  static countByCategory(fields: FieldDescriptor[]): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const f of fields) {
      counts[f.category] = (counts[f.category] || 0) + 1;
    }
    return counts;
  }

  /** Calculate overall coverage from total fields vs expected minimum. */
  static calculateCoverage(fieldCount: number, expectedMinimum: number): number {
    if (expectedMinimum <= 0) return 0;
    return Math.min(100, Math.round((fieldCount / expectedMinimum) * 100));
  }
}
