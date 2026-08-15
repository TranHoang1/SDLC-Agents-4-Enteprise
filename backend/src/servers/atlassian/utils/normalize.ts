/**
 * SA4E-110 - String normalization utilities for fuzzy matching.
 * Used by transition_by_name for case-insensitive comparison.
 */

/**
 * Normalize a string for comparison: trim, lowercase, collapse whitespace.
 * @param s Input string
 * @returns Normalized string for comparison
 */
export function normalizeForComparison(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ');
}