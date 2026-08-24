/**
 * SA4E-193 — Frontmatter utilities shared by ValidationGate branches.
 *
 * PURE functions only — NO vscode imports — unit-testable without host mocks.
 * Extracted from validation-gate.ts (TDD C1 helper) so the gate stays within
 * the 200-line file budget while gaining the D-1 double-frontmatter guard.
 */

export const KEBAB_CASE_RE = /^[a-z][a-z0-9-]*$/;
const FRONTMATTER_DELIM = "---";

/** Split a leading YAML frontmatter block ("---" ... "---") from markdown content. */
export function splitFrontmatter(content: string): { frontmatter: string | null; body: string } {
  const lines = content.split(/\r?\n/);
  if ((lines[0] ?? "").trim() !== FRONTMATTER_DELIM) {
    return { frontmatter: null, body: content };
  }
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === FRONTMATTER_DELIM) {
      return { frontmatter: lines.slice(1, i).join("\n"), body: lines.slice(i + 1).join("\n") };
    }
  }
  return { frontmatter: null, body: content }; // unterminated block => not frontmatter
}

/** True when content opens with a terminated "--- ... ---" frontmatter block. */
export function hasFrontmatterBlock(content: string): boolean {
  return splitFrontmatter(content).frontmatter !== null;
}

/** Remove ONE leading frontmatter block if the LLM echoed its own (ERR-CMD-09/GAP-02/D-1). */
export function stripEchoedFrontmatter(content: string): string {
  const { frontmatter, body } = splitFrontmatter(content);
  return frontmatter === null ? content : body;
}

/** Parse simple `key: value` pairs from a frontmatter body (first occurrence wins). */
export function parseFrontmatterFields(frontmatter: string): Map<string, string> {
  const fields = new Map<string, string>();
  for (const line of frontmatter.split(/\r?\n/)) {
    const idx = line.indexOf(":");
    if (idx <= 0) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim().replace(/^["']|["']$/g, "");
    if (key && !fields.has(key)) fields.set(key, value);
  }
  return fields;
}

/** Canonical agent frontmatter builder (moved verbatim from ConfigCommands.ts L568-584). */
export function buildAgentFrontmatter(name: string, description: string): string {
  const label = name
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
  return [
    "---",
    `name: ${name}`,
    `label: ${label}`,
    `description: >`,
    `  ${description}`,
    "phase: implementation",
    'tools: ["read", "write", "shell", "@mcp"]',
    "---",
  ].join("\n");
}

/** Count non-empty (non-whitespace-only) lines — BR-11 body requirement. */
export function nonEmptyLineCount(text: string): number {
  return text.split(/\r?\n/).filter((line) => line.trim().length > 0).length;
}
