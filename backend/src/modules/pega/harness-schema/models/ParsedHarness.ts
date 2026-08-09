/**
 * SA4E-95 — ParsedHarness intermediate representation.
 * Top-level structure produced by HarnessParser after recursive descent.
 */
import type { ParsedSection } from './ParsedSection.js';
import type { TemplateMarker } from './TemplateMarker.js';

/** Page context entry from pyPagesAndClasses */
export interface PageContext {
  page: string;
  className: string;
  mode?: string;
}

/** Metadata about the harness source */
export interface HarnessMetadata {
  insKey: string;
  updateDateTime: string;
  ruleSetVersion?: string;
}

/** Complete parsed harness IR — output of parser stage */
export interface ParsedHarness {
  ruleType: string;
  primaryClass: string;
  contextPages: PageContext[];
  sections: ParsedSection[];
  templateMarkers: TemplateMarker[];
  metadata: HarnessMetadata;
}
