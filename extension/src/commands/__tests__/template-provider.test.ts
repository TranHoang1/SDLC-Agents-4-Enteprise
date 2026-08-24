/**
 * SA4E-193 — Unit tests for the TemplateProvider facade (TDD C2).
 *
 * Focus: D-5 fallback-side fix — deterministic scaffolds MUST use the
 * user-confirmed name (never re-derive from description), and the agent
 * scaffold returns BODY ONLY so the gate prepends exactly one frontmatter
 * block (D-1 root cause). Also verifies prompt access is non-empty per type.
 */
import { describe, it, expect } from "vitest";
import { getFallbackScaffold, getLlmPrompt, getTemplateSpec } from "../template-provider";

const CONFIRMED = "sec-review-skill";
const DESCRIPTION = "Review code security vulnerabilities in pull requests";

describe("getLlmPrompt — single accessor for *_LLM_PROMPT constants (D-6)", () => {
  it.each(["agent", "hook", "steering", "skill"] as const)(
    "returns a non-empty distinct system prompt for %s",
    (type) => {
      const prompt = getLlmPrompt(type);
      expect(prompt.length).toBeGreaterThan(50);
      expect(getLlmPrompt(type)).toBe(prompt); // stable reference per type
    }
  );

  it("returns different prompts per config type", () => {
    const prompts = new Set(["agent", "hook", "steering", "skill"].map((t) => getLlmPrompt(t as "agent")));
    expect(prompts.size).toBe(4);
  });
});

describe("getFallbackScaffold — confirmedName honored (D-5)", () => {
  // STC: UT-06 step 3 / TC-17 companion — agent fallback carries NO frontmatter
  it("agent scaffold is BODY ONLY — zero frontmatter delimiters (D-1 root fix)", () => {
    const scaffold = getFallbackScaffold("agent", CONFIRMED, DESCRIPTION);
    expect(scaffold).not.toContain("---");
    expect(scaffold).toContain(CONFIRMED); // uses confirmed name, not re-derived
  });

  it("steering scaffold titles with the confirmed name and defaults inclusion auto", () => {
    const scaffold = getFallbackScaffold("steering", CONFIRMED, DESCRIPTION);
    expect(scaffold).toContain(`# ${CONFIRMED}`);
    expect(scaffold).toContain("inclusion: auto");
    expect(scaffold).toContain("[Define rule 1]"); // [placeholder] marker (FR-COMMON-02)
  });

  it("skill scaffold frontmatter name equals the confirmed folder name (AF-33/D-5)", () => {
    const scaffold = getFallbackScaffold("skill", CONFIRMED, DESCRIPTION);
    expect(scaffold).toMatch(new RegExp(`^---\\nname: ${CONFIRMED}\\ndescription:`));
    expect(scaffold).toContain("## Workflow");
  });

  it("hook scaffold parses as schema-valid JSON with askAgent instructions", () => {
    const parsed = JSON.parse(getFallbackScaffold("hook", CONFIRMED, DESCRIPTION));
    expect(parsed.enabled).toBe(true); // BR-20
    expect(parsed.version).toBe("1"); // BR-20
    expect(parsed.when.type).toBe("promptSubmit");
    expect(parsed.then.type).toBe("askAgent");
    expect(parsed.then.prompt).toContain(CONFIRMED);
    expect(parsed.then).not.toHaveProperty("command"); // D-7 canonical omission
  });

  it("scaffolds embed the raw description for user refinement", () => {
    for (const type of ["agent", "steering", "skill"] as const) {
      expect(getFallbackScaffold(type, CONFIRMED, DESCRIPTION)).toContain(DESCRIPTION);
    }
  });
});

describe("getTemplateSpec — best-effort spec reader (OI-08 pending)", () => {
  it("never throws; returns string or undefined", () => {
    let result: string | undefined;
    expect(() => {
      result = getTemplateSpec("agent");
    }).not.toThrow();
    if (result !== undefined) expect(typeof result).toBe("string");
  });
});
