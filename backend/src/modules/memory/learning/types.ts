/**
 * SA4E-122: Continuous Learning v2 — shared types for pattern extraction.
 * Defines the core data models used across the learning subsystem.
 */

/** Pattern categories extractable from agent sessions. */
export type PatternType =
  | 'error_resolution'
  | 'user_correction'
  | 'workaround'
  | 'debugging_technique'
  | 'project_specific';

/** A single extracted pattern with metadata. */
export interface ExtractedPattern {
  /** Concise description of the learned pattern. */
  content: string;
  /** Classified type of the pattern. */
  type: PatternType;
  /** Confidence score from extraction heuristics (0–1). */
  confidence: number;
  /** Tags derived from pattern context. */
  tags: string[];
  /** Source context (tool name, error message, etc.). */
  sourceContext: string;
}

/** Result of a full session analysis pass. */
export interface LearningResult {
  /** Patterns successfully ingested as instincts. */
  ingested: IngestedPattern[];
  /** Total patterns extracted before dedup/filtering. */
  extractedCount: number;
  /** Patterns skipped (duplicates or below threshold). */
  skippedCount: number;
}

/** An ingested pattern with its KB entry ID. */
export interface IngestedPattern {
  entryId: number;
  content: string;
  type: PatternType;
  confidence: number;
}

/** Configuration for the learning pipeline. */
export interface LearningConfig {
  /** Minimum confidence to accept a pattern (default 0.4). */
  minConfidence: number;
  /** Initial confidence for ingested instincts (default 0.5). */
  initialInstinctConfidence: number;
  /** Max patterns to extract per session (default 10). */
  maxPatternsPerSession: number;
}

/** Default learning configuration. */
export const DEFAULT_LEARNING_CONFIG: LearningConfig = {
  minConfidence: 0.4,
  initialInstinctConfidence: 0.5,
  maxPatternsPerSession: 10,
};
