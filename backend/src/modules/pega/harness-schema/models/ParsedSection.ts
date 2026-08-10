/**
 * SA4E-95 - ParsedSection represents a single section in the harness tree.
 * Each section has a body type that determines how it contributes to the schema.
 */
import type { ExtractedField } from './ExtractedField.js';
import type { RepeatDefinition } from './RepeatDefinition.js';
import type { ResolvedContext } from './ResolvedContext.js';

/** Body types that determine parsing strategy (BR-01) */
export type BodyType =
  | 'INCLUDE'
  | 'SIMPLELAYOUT'
  | 'FREEFORM'
  | 'REPEATLAYOUT'
  | 'TEMPLATE'
  | 'UNKNOWN';

/** Parsed section node in the harness tree */
export interface ParsedSection {
  name: string;
  sourceClass: string;
  bodyType: BodyType;
  pageContext: ResolvedContext;
  fields: ExtractedField[];
  repeatProperty?: RepeatDefinition;
  children: ParsedSection[];
  depth: number;
}
