/**
 * SA4E-95 - FieldExtractor: extracts fields from pyRows/pyCells hierarchy.
 * Implements BR-11, BR-17: only FIELD type cells, strip leading dot from pyValue.
 */
import type { ExtractedField } from '../models/ExtractedField.js';
import type { ResolvedContext } from '../models/ResolvedContext.js';

/**
 * Extracts field definitions from Pega section row/cell structures.
 * Only pyType=FIELD cells produce schema properties (BR-17).
 */
export class FieldExtractor {
  /**
   * Extract fields from pyRows -> pyCells hierarchy.
   * @param json - Section body JSON containing pyRows
   * @param pageContext - Resolved page context for ownership
   * @returns Array of extracted field definitions
   */
  extractFromJson(
    json: Record<string, unknown>,
    pageContext: ResolvedContext
  ): ExtractedField[] {
    const rows = json.pyRows;
    if (!Array.isArray(rows)) return [];

    const fields: ExtractedField[] = [];
    for (const row of rows) {
      if (!row || typeof row !== 'object') continue;
      const cells = (row as Record<string, unknown>).pyCells;
      if (!Array.isArray(cells)) continue;

      for (const cell of cells) {
        if (!cell || typeof cell !== 'object') continue;
        const field = this.extractFromCell(cell as Record<string, unknown>, pageContext);
        if (field) fields.push(field);
      }
    }
    return fields;
  }

  /**
   * Extract a single field from a cell object.
   * Only processes cells with pyType=FIELD (BR-17).
   * @param cell - Cell JSON object
   * @param pageContext - Parent page context
   * @returns ExtractedField or null if cell is not a FIELD
   */
  extractFromCell(
    cell: Record<string, unknown>,
    pageContext: ResolvedContext
  ): ExtractedField | null {
    const pyType = String(cell.pyType ?? '').toUpperCase();
    if (pyType !== 'FIELD') return null;

    const rawValue = String(cell.pyValue ?? cell.pyPropertyName ?? '');
    if (!rawValue) return null;

    // BR-11: Strip leading dot from property binding
    const propertyName = rawValue.startsWith('.') ? rawValue.substring(1) : rawValue;
    if (!propertyName) return null;

    return {
      propertyName,
      pyFormat: String(cell.pyFormat ?? cell.pyFieldFormat ?? 'Default'),
      readOnly: cell.pyReadOnly === true || cell.pyReadOnly === 'true',
      label: cell.pyLabel ? String(cell.pyLabel) : undefined,
      required: cell.pyRequired === true || cell.pyRequired === 'true',
      pageContext: pageContext.objectPath || pageContext.className,
    };
  }
}
