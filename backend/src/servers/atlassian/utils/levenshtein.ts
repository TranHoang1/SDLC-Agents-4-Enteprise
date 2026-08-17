/**
 * SA4E-110 - Levenshtein distance algorithm for fuzzy transition matching.
 * Pure function, used by jira_transition_by_name tool.
 */

/**
 * Compute Levenshtein edit distance between two strings.
 * @param a First string
 * @param b Second string
 * @returns Minimum number of single-character edits
 */
export function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;

  if (m === 0) return n;
  if (n === 0) return m;

  // Use single array optimization (O(n) space)
  const prev = Array.from({ length: n + 1 }, (_, i) => i);
  const curr = new Array<number>(n + 1);

  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        prev[j] + 1,       // deletion
        curr[j - 1] + 1,   // insertion
        prev[j - 1] + cost  // substitution
      );
    }
    for (let j = 0; j <= n; j++) prev[j] = curr[j];
  }

  return prev[n];
}