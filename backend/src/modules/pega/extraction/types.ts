/**
 * SA4E-222 — Shared extraction models for the generic + schema-driven renderers.
 * Models separated from logic per code-standards (each consumer imports these types).
 */

/** Options controlling rule-content extraction dispatch order. */
export interface ExtractOptions {
  /** Nested logic paths resolved from an EnrichedSchema (enables schema-driven mode). */
  nestedLogicPaths?: string[];
  /** Enable the deterministic generic extractor fallback. Default true. */
  genericEnabled?: boolean;
}

/** Result of a single logic-rendering pass. */
export interface LogicRenderResult {
  block: string | null;
  matchedPaths: string[];
}

/**
 * Field keys that signal a node carries logic/relationship semantics.
 * Used by the structural heuristic in PegaGenericLogicExtractor (FR-A-3).
 */
export const RELATIONSHIP_KEYS = [
  'from', 'to', 'when', 'value', 'target', 'result', 'source',
  'expression', 'pyStepNum', 'pyAction', 'pyWhenName', 'pyResult',
  'pySource', 'pyTarget', 'label', 'name', 'id', 'pyLabel',
];
