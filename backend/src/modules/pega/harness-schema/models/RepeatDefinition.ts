/**
 * SA4E-95 — RepeatDefinition captures a repeating layout (page list).
 * Maps to JSON Schema array type with items definition.
 */
import type { ExtractedField } from './ExtractedField.js';

/** Repeating layout definition from pyPageListProperty */
export interface RepeatDefinition {
  /** Property name without leading dot (BR-16) */
  propertyName: string;
  /** Class of items in the page list */
  itemClass: string;
  /** Fields extracted from within the repeat body */
  fields: ExtractedField[];
  /** Nested repeats (array of arrays) */
  nestedRepeats: RepeatDefinition[];
}
