/**
 * SA4E-193 — Unit tests for the ValidationGate steering (CMD3) and skill
 * (CMD4) branches (TDD C1/C5, FSD §6.6.2).
 *
 * Covers STC cases UT-11 and UT-12 plus the mandated D-5 regression (skill
 * frontmatter name forced to the user-confirmed name). Corpus mirrors
 * documents/SA4E-193/testdata/frontmatter-cases.csv.
 */
import { describe, it, expect } from "vitest";
import { ValidationGate } from "../validation-gate";
import { parseFrontmatterFields, splitFrontmatter } from "../frontmatter-utils";

/** STC SKILL-MISMATCH-FM corpus: LLM name differs from confirmed folder name. */
const SKILL_MISMATCH_PAYLOAD =
  "---\nname: other-skill\ndescription: Review code security vulnerabilities\n---\n" +
  "## When to Use\n\nUse during security review of pull requests.";

function frontmatterOf(content: string): Map<string, string> {
  return parseFrontmatterFields(splitFrontmatter(content).frontmatter ?? "");
}

describe("UT-11 — steering branch (BR-10/BR-11, AF-23/AF-24)", () => {
  // STC: UT-11 step 1 — body-only markdown passes (frontmatter OPTIONAL)
  it("accepts body-only steering rule (AF-23)", () => {
    const result = ValidationGate.validate(
      "steering",
      "# Rule title\nAlways use conventional commits.",
      "my-rule",
      "Conventional commits"
    );
    expect(result.ok).toBe(true);
    expect(result.normalized).toContain("# Rule title");
  });

  it("accepts valid frontmatter and preserves it verbatim above the body", () => {
    const raw =
      "---\ninclusion: auto\ndescription: Enforce REST API conventions\n---\n\n# Title\nRule body.";
    const result = ValidationGate.validate("steering", raw, "rest-conventions", "REST rules");
    expect(result.ok).toBe(true);
    expect(frontmatterOf(result.normalized).get("inclusion")).toBe("auto");
  });

  // STC: UT-11 step 3 — invalid enum rejected citing allowed values (BR-10)
  it("rejects inclusion outside auto|manual|always (testdata UT-15-bad-phase)", () => {
    const raw = "---\ninclusion: sometimes\n---\nBody line.";
    const result = ValidationGate.validate("steering", raw, "bad-rule", "desc");
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/auto, manual, always/);
  });

  // STC: UT-11 step 4 — zero non-empty instruction lines rejected (BR-11)
  it("rejects body-less steering rule (BR-11)", () => {
    const result = ValidationGate.validate(
      "steering",
      "---\ninclusion: manual\n---\n\n   \n",
      "my-rule",
      "desc"
    );
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/BR-11/);
  });
});

describe("UT-12 / D-5 regression — skill frontmatter identity", () => {
  // STC: UT-12 step 1 — FM name REWRITTEN to confirmed name (folder invariant AF-33)
  it("forces frontmatter name to the user-confirmed name", () => {
    const result = ValidationGate.validate(
      "skill",
      SKILL_MISMATCH_PAYLOAD,
      "my-skill",
      "Security review skill"
    );
    expect(result.ok).toBe(true);
    const fields = frontmatterOf(result.normalized);
    expect(fields.get("name")).toBe("my-skill");
    expect(fields.get("description")).toBe("Review code security vulnerabilities");
    expect(result.normalized).toContain("## When to Use"); // body preserved
  });

  // STC: UT-12 step 2 — missing description rejected (§3.7.4)
  it("rejects frontmatter without a description field", () => {
    const result = ValidationGate.validate(
      "skill",
      "---\nname: some-skill\n---\nBody line.",
      "my-skill",
      "desc"
    );
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/description/i);
  });

  // FSD §6.6.2 CMD4 REQUIRE: frontmatter must CONTAIN a name field
  it("rejects frontmatter missing the name field instead of silently adding it", () => {
    const result = ValidationGate.validate(
      "skill",
      "---\ndescription: Something useful\n---\nBody line.",
      "my-skill",
      "desc"
    );
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/requires a kebab-case name/i);
  });

  it("rejects skill without any frontmatter block (§3.7.4 REQUIRED)", () => {
    const result = ValidationGate.validate(
      "skill",
      "Just a body, no frontmatter.",
      "my-skill",
      "desc"
    );
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/requires YAML frontmatter/);
  });

  // STC: UT-12 step 3 — zero non-empty body lines rejected (BR-11)
  it("rejects body-less SKILL.md (BR-11)", () => {
    const result = ValidationGate.validate(
      "skill",
      "---\nname: a-skill\ndescription: d\n---\n\n \n",
      "my-skill",
      "desc"
    );
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/BR-11/);
  });
});
