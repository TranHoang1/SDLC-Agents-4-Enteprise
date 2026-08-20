/**
 * CommandPatternMatcher — Pattern-based auto-approve for shell commands.
 * Stores glob-like patterns (e.g., "npm *", "git status", "vitest *").
 * When a shell command matches a stored pattern, it bypasses the approval gate.
 *
 * Patterns use simple glob: `*` matches any sequence of characters.
 * Patterns are session-scoped (cleared on session reset).
 */

/** A stored auto-approve pattern with metadata */
export interface ApprovedPattern {
  pattern: string;
  regex: RegExp;
  addedAt: number;
  matchCount: number;
}

/**
 * Matches shell commands against user-approved glob patterns.
 * Session-scoped: call `clear()` on session reset.
 */
export class CommandPatternMatcher {
  private readonly patterns = new Map<string, ApprovedPattern>();

  /**
   * Add a pattern to the auto-approve set.
   * @param pattern Glob pattern (e.g., "npm *", "git status", "vitest --run *")
   */
  addPattern(pattern: string): void {
    if (this.patterns.has(pattern)) return;
    this.patterns.set(pattern, {
      pattern,
      regex: this.globToRegex(pattern),
      addedAt: Date.now(),
      matchCount: 0,
    });
  }

  /**
   * Remove a pattern from the auto-approve set.
   * @param pattern The exact pattern string to remove
   */
  removePattern(pattern: string): void {
    this.patterns.delete(pattern);
  }

  /**
   * Check if a command matches any stored pattern.
   * @param command The shell command to check
   * @returns The matched pattern string, or null if no match
   */
  matches(command: string): string | null {
    const trimmed = command.trim();
    for (const [key, entry] of this.patterns) {
      if (entry.regex.test(trimmed)) {
        entry.matchCount++;
        return key;
      }
    }
    return null;
  }

  /** Get all stored patterns */
  getPatterns(): ApprovedPattern[] {
    return Array.from(this.patterns.values());
  }

  /** Get pattern count */
  get size(): number {
    return this.patterns.size;
  }

  /** Clear all patterns (session reset) */
  clear(): void {
    this.patterns.clear();
  }

  /**
   * Suggest a pattern from a concrete command.
   * Extracts the base command and replaces arguments with `*`.
   * @example "npm run test" → "npm *"
   * @example "git status" → "git status" (no args to wildcard)
   * @example "vitest --run src/test.ts" → "vitest *"
   */
  static suggestPattern(command: string): string {
    const parts = command.trim().split(/\s+/);
    if (parts.length <= 1) return parts[0] || command;
    // Keep first token (binary), wildcard the rest
    return `${parts[0]} *`;
  }

  /** Convert glob pattern to regex. Only `*` is supported as wildcard. */
  private globToRegex(pattern: string): RegExp {
    const escaped = pattern
      .replace(/[.+^${}()|[\]\\]/g, "\\$&")
      .replace(/\*/g, ".*");
    return new RegExp(`^${escaped}$`, "i");
  }
}
