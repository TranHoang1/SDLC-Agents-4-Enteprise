/**
 * SA4E-95 - TemplateMarker records a section skipped due to TEMPLATE layout.
 * These sections are JS-rendered and cannot be parsed statically (BR-10).
 */
export interface TemplateMarker {
  /** Name of the skipped section */
  sectionName: string;
  /** Rule type this section belongs to */
  ruleType: string;
  /** Reason for skipping */
  reason: string;
}
