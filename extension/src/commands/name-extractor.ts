/**
 * SA4E-193 — NameExtractor (C3): kebab-case suggestion from natural-language
 * description (BR-04, FSD §6.6.1). PURE function — advisory only; the InputBox
 * validator (ERR-CMD-02) and the ValidationGate re-check enforce the rule.
 */

/**
 * Implementation-exact algorithm (ConfigCommands.ts L553-563):
 * lowercase -> strip everything except a-z/0-9/whitespace -> drop tokens of
 * length <= 2 -> first three tokens -> join with "-" -> fallback "{prefix}-new".
 */
export function extractNameFromDescription(description: string, prefix: string): string {
  const words = description
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 2)
    .slice(0, 3);
  return words.join("-") || `${prefix}-new`;
}
