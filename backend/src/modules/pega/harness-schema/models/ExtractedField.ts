/**
 * SA4E-95 - ExtractedField represents a single property binding from a FIELD cell.
 * Only cells with pyType=FIELD are extracted (BR-17).
 */
export interface ExtractedField {
  /** Property name without leading dot (BR-11) */
  propertyName: string;
  /** Widget format determining JSON Schema type (BR-02) */
  pyFormat: string;
  /** Whether field is read-only (BR-12) */
  readOnly: boolean;
  /** Display label from pyLabel */
  label?: string;
  /** Whether field is required */
  required: boolean;
  /** Owning page/class path for schema nesting */
  pageContext: string;
}
