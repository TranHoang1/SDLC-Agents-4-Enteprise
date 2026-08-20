/**
 * SA4E-183 — Diff utility helpers.
 * Computes unified diffs, counts lines, truncates large diffs,
 * and detects sensitive file patterns. Pure functions, no side effects.
 */

import { createTwoFilesPatch } from 'diff';

/** Maximum diff content size in bytes (2MB per OI-05) */
const MAX_DIFF_SIZE = 2 * 1024 * 1024;

/** Truncation notice appended when diff exceeds MAX_DIFF_SIZE */
const TRUNCATION_NOTICE = '\n[diff truncated — too large]';

/** Tools that produce file changes worth tracking */
export const DIFF_TRACKED_TOOLS = new Set([
  'write_file',
  'fs_write',
  'str_replace',
  'fs_append',
  'delete_file',
  'stream_write_file',
]);

/** Sensitive file patterns — diff content is redacted for these */
const SENSITIVE_PATTERNS = [
  /\.env($|\.)/i,
  /\.pem$/i,
  /\.key$/i,
  /\.p12$/i,
  /credentials/i,
  /secrets?\//i,
];

/**
 * Compute a unified diff between original and modified content.
 * Uses the `diff` npm package for standard patch format.
 * @param filePath - File path for header display
 * @param original - Content before modification (empty string for new files)
 * @param modified - Content after modification (empty string for deleted files)
 * @returns Unified diff string
 */
export function computeUnifiedDiff(
  filePath: string,
  original: string,
  modified: string
): string {
  return createTwoFilesPatch(
    `a/${filePath}`,
    `b/${filePath}`,
    original,
    modified,
    '', // oldHeader
    '', // newHeader
    { context: 3 }
  );
}

/**
 * Count added and removed lines from a unified diff string.
 * @param diffContent - Unified diff to analyze
 * @returns Object with linesAdded and linesRemoved counts
 */
export function countDiffLines(diffContent: string): {
  linesAdded: number;
  linesRemoved: number;
} {
  let linesAdded = 0;
  let linesRemoved = 0;

  const lines = diffContent.split('\n');
  for (const line of lines) {
    // Skip diff headers (---, +++, @@)
    if (line.startsWith('---') || line.startsWith('+++')) continue;
    if (line.startsWith('+')) linesAdded++;
    else if (line.startsWith('-')) linesRemoved++;
  }

  return { linesAdded, linesRemoved };
}

/**
 * Truncate diff content at MAX_DIFF_SIZE boundary.
 * Appends truncation notice if content exceeds limit.
 * @param diffContent - Raw diff content
 * @returns Truncated or original diff content
 */
export function truncateDiff(diffContent: string): string {
  if (diffContent.length <= MAX_DIFF_SIZE) return diffContent;
  return diffContent.slice(0, MAX_DIFF_SIZE) + TRUNCATION_NOTICE;
}

/**
 * Check if a file path matches sensitive patterns.
 * Sensitive files have their diff content redacted.
 * @param filePath - Absolute or relative file path
 * @returns true if file is sensitive
 */
export function isSensitiveFile(filePath: string): boolean {
  return SENSITIVE_PATTERNS.some((p) => p.test(filePath));
}
