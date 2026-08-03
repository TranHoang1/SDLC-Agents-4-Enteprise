/**
 * SA4E-85 — ContextBadge utility functions.
 * Pure helpers for token formatting and color computation.
 */

/**
 * Determine progress bar color based on usage percentage.
 * Green (>50% free) → Yellow (20-50% free) → Red (<20% free).
 */
export function getBarColor(percent: number): string {
  if (percent >= 80) return 'var(--vscode-errorForeground, #f44)';
  if (percent >= 50) return 'var(--vscode-editorWarning-foreground, #cca700)';
  return 'var(--vscode-terminal-ansiGreen, #4ec9b0)';
}

/**
 * Format token count for compact display.
 * @example formatTokens(12000) → "12K"
 * @example formatTokens(500) → "500"
 */
export function formatTokens(count: number): string {
  if (count >= 1000) return `${Math.round(count / 1000)}K`;
  return `${count}`;
}

/**
 * Extract file name from full path for compact display.
 * Handles both forward and backslash separators.
 */
export function extractFileName(filePath: string): string {
  const segments = filePath.replace(/\\/g, '/').split('/');
  return segments[segments.length - 1] || filePath;
}
