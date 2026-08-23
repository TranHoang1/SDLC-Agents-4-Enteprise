/**
 * SA4E-193 — ValidationGate (C1): mandatory pre-write content gate (BR-07).
 *
 * PURE functions only — NO vscode imports — unit-testable without host mocks.
 * Algorithm per FSD §6.6.2:
 *   NORMALIZE   strip ONE surrounding markdown fence block (AF-13/AF-24),
 *               trim, reject empty/whitespace-only generation (AF-04/D-4)
 *   CMD1 agent    strip ONE echoed frontmatter block (ERR-CMD-09/GAP-02/D-1),
 *                 reject residual frontmatter (double echo), require >=1
 *                 non-empty body line (BR-11), prepend canonical FM
 *   CMD2 hook     delegated to ./hook-gate (BR-08/BR-09/BR-20/D-2/D-7)
 *   CMD3 steering optional FM w/ inclusion enum (BR-10); body >=1 line (BR-11)
 *   CMD4 skill    FM required incl. name; FORCE name := confirmedName
 *                 (AF-33/D-5); body >=1 line (BR-11)
 */

import { validateHookContent } from "./hook-gate";
import {
  KEBAB_CASE_RE,
  buildAgentFrontmatter,
  hasFrontmatterBlock,
  nonEmptyLineCount,
  parseFrontmatterFields,
  splitFrontmatter,
  stripEchoedFrontmatter,
} from "./frontmatter-utils";

export type ConfigType = "agent" | "hook" | "steering" | "skill";

/** Result-object pattern — `normalized` is the ONLY bytes eligible for disk. */
export interface ValidationResult {
  readonly ok: boolean;
  readonly reason?: string;
  readonly normalized: string;
}

export interface IValidator {
  validate(
    type: ConfigType,
    rawContent: string,
    confirmedName: string,
    description: string
  ): ValidationResult;
}

const FENCE_RE = /^```[a-zA-Z0-9_-]*\r?\n([\s\S]*?)\r?\n?```\s*$/;
const STEERING_INCLUSION_VALUES = ["auto", "manual", "always"];

function fail(reason: string): ValidationResult {
  return { ok: false, reason, normalized: "" };
}

function pass(normalized: string): ValidationResult {
  return { ok: true, normalized };
}

/** Strip ONE surrounding markdown code-fence block when the payload is fully fenced (AF-13/AF-24). */
export function stripCodeFences(content: string): string {
  const match = FENCE_RE.exec(content.trim());
  return match ? match[1] : content;
}

/**
 * NORMALIZE step shared by all types: fences off, trim, reject empty
 * (AF-04/AF-13/AF-24/D-4). An empty LLM stream must NEVER reach disk.
 */
export function normalize(rawContent: string): ValidationResult {
  const stripped = stripCodeFences(rawContent).trim();
  if (stripped.length === 0) return fail("empty generation");
  return pass(stripped);
}

/**
 * CMD1 agent: strip ONE echoed FM block, reject a SECOND residual block
 * (D-1 double-frontmatter regression), require body, prepend canonical FM.
 */
function validateAgent(normalized: string, confirmedName: string, description: string): ValidationResult {
  const stripped = stripEchoedFrontmatter(normalized);
  if (hasFrontmatterBlock(stripped.trim())) {
    return fail("duplicated frontmatter blocks in generated agent content (ERR-CMD-09)");
  }
  const body = stripped.replace(/^\r?\n+/, "");
  if (nonEmptyLineCount(body) === 0) {
    return fail("agent body must contain at least one non-empty line (BR-11)");
  }
  const frontmatter = buildAgentFrontmatter(confirmedName, description);
  const fm = parseFrontmatterFields(splitFrontmatter(frontmatter).frontmatter ?? "");
  if (!fm.get("label") || !fm.get("phase") || description.trim().length === 0) {
    return fail("canonical agent frontmatter incomplete");
  }
  try {
    JSON.parse(fm.get("tools") ?? "");
  } catch (err) {
    return fail(`agent tools field is not a parseable list: ${(err as Error).message}`);
  }
  return pass(`${frontmatter}\n\n${body}`);
}

/** CMD3 steering: optional FM w/ inclusion enum (BR-10); body >=1 line; body untouched. */
function validateSteering(normalized: string): ValidationResult {
  const { frontmatter, body } = splitFrontmatter(normalized);
  const cleanedBody = body.replace(/^\r?\n+/, "");
  if (nonEmptyLineCount(cleanedBody) === 0) {
    return fail("steering body must contain at least one non-empty instruction line (BR-11)");
  }
  if (frontmatter === null) return pass(cleanedBody); // AF-23: frontmatter OPTIONAL
  const inclusion = parseFrontmatterFields(frontmatter).get("inclusion");
  if (!STEERING_INCLUSION_VALUES.includes(inclusion ?? "")) {
    return fail(`steering inclusion "${inclusion ?? ""}" must be one of: auto, manual, always (BR-10)`);
  }
  return pass(`---\n${frontmatter}\n---\n\n${cleanedBody}`);
}

/**
 * CMD4 skill: FM REQUIRED incl. name + description fields; FORCE
 * name := confirmedName (folder invariant AF-33/D-5); body >=1 line.
 */
function validateSkill(normalized: string, confirmedName: string): ValidationResult {
  const { frontmatter, body } = splitFrontmatter(normalized);
  if (frontmatter === null) {
    return fail("SKILL.md requires YAML frontmatter with name and description");
  }
  const fields = parseFrontmatterFields(frontmatter);
  if (!fields.has("name")) {
    return fail("skill frontmatter requires a kebab-case name field (§3.7.4)");
  }
  if (!fields.get("description")) {
    return fail("skill frontmatter requires a non-empty description");
  }
  const cleanedBody = body.replace(/^\r?\n+/, "");
  if (nonEmptyLineCount(cleanedBody) === 0) {
    return fail("skill body must contain at least one non-empty line (BR-11)");
  }
  const forced = frontmatter.replace(/^name:\s*.*$/m, `name: ${confirmedName}`);
  return pass(`---\n${forced}\n---\n\n${cleanedBody}`);
}

/**
 * Mandatory pre-write gate (BR-07). Any failure => NOTHING is written; caller
 * surfaces `reason` in the ERR-CMD-04 toast.
 */
export function validate(
  type: ConfigType,
  rawContent: string,
  confirmedName: string,
  description: string
): ValidationResult {
  const base = normalize(rawContent);
  if (!base.ok) return base;
  // Defense-in-depth re-validation (TDD §6.1 rule 1): never trust earlier-passed state.
  if (!KEBAB_CASE_RE.test(confirmedName)) {
    return fail(`confirmed name "${confirmedName}" violates kebab-case rule (BR-03)`);
  }
  switch (type) {
    case "agent":
      return validateAgent(base.normalized, confirmedName, description);
    case "hook":
      return validateHookContent(base.normalized);
    case "steering":
      return validateSteering(base.normalized);
    case "skill":
      return validateSkill(base.normalized, confirmedName);
  }
}

/** Default gate instance implementing IValidator (handler depends on this abstraction). */
export const ValidationGate: IValidator = { validate };
