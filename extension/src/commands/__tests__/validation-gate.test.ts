/**
 * SA4E-193 — Unit tests for the ValidationGate agent branch + NORMALIZE step
 * (TDD C1/C5, FSD §6.6.2 CMD1).
 *
 * Covers STC cases UT-05..07, UT-13 and mandated regressions D-1 (double
 * frontmatter) and D-4 (empty stream promotion). Corpus mirrors
 * documents/SA4E-193/testdata/*.csv. Pure modules — no vscode mock needed.
 */
import { describe, it, expect } from "vitest";
import { ValidationGate, normalize, stripCodeFences } from "../validation-gate";
import {
  KEBAB_CASE_RE,
  buildAgentFrontmatter,
  nonEmptyLineCount,
  parseFrontmatterFields,
  splitFrontmatter,
  stripEchoedFrontmatter,
} from "../frontmatter-utils";

// ---- Fixtures (STC §2 Test Data + testdata/frontmatter-cases.csv) ----------
const DESC_AGENT_B =
  "A senior code reviewer that reviews TypeScript changes for security issues";
const NAME_AGENT = "my-code-reviewer";
/** STC DOUBLE-FM-PAYLOAD: ONE echoed frontmatter block + real body. */
const ECHOED_FM_PAYLOAD = "---\nname: wrong-name\nlabel: Wrong\n---\nYou are a reviewer.";
/** testdata UT-06-double: TWO consecutive frontmatter blocks, no real body. */
const DOUBLE_FM_PAYLOAD = "---\nname: wrong-name\n---\n---\nname: my-agent\n---";

/** Count standalone `---` delimiter lines — one frontmatter block == exactly 2. */
function countDelimiters(content: string): number {
  return content.split(/\r?\n/).filter((line) => line.trim() === "---").length;
}

function frontmatterOf(content: string): Map<string, string> {
  return parseFrontmatterFields(splitFrontmatter(content).frontmatter ?? "");
}

// ---------------------------------------------------------------------------
describe("UT-05 — buildAgentFrontmatter canonical shape", () => {
  // STC: UT-05 — canonical builder emits name/label/folded description/phase/tools
  it("emits label Title Case, folded description, phase and default tools (BR-18/BR-19)", () => {
    const fm = buildAgentFrontmatter(NAME_AGENT, DESC_AGENT_B);
    const fields = frontmatterOf(fm);
    expect(fields.get("name")).toBe(NAME_AGENT);
    expect(fields.get("label")).toBe("My Code Reviewer");
    expect(fields.get("phase")).toBe("implementation");
    expect(JSON.parse(fields.get("tools") ?? "")).toEqual(["read", "write", "shell", "@mcp"]);
    expect(fm).toContain("description: >");
    expect(fm).toContain(`  ${DESC_AGENT_B}`);
  });
});

describe("frontmatter-utils — pure helpers", () => {
  it("splitFrontmatter separates block and body; unterminated block is not frontmatter", () => {
    const { frontmatter, body } = splitFrontmatter("---\na: b\n---\nBody");
    expect(frontmatter).toBe("a: b");
    expect(body).toBe("Body");
    expect(splitFrontmatter("---\nunterminated").frontmatter).toBeNull();
    expect(splitFrontmatter("No block here").frontmatter).toBeNull();
  });

  it("stripEchoedFrontmatter removes exactly ONE leading block (ERR-CMD-09)", () => {
    expect(stripEchoedFrontmatter(ECHOED_FM_PAYLOAD)).toBe("You are a reviewer.");
    const twice = stripEchoedFrontmatter(DOUBLE_FM_PAYLOAD);
    expect(twice.startsWith("---")).toBe(true); // second block survives one strip
  });

  it("KEBAB_CASE_RE admits kebab-case only (BR-03 charset guards path traversal)", () => {
    expect(KEBAB_CASE_RE.test("my-code-reviewer")).toBe(true);
    expect(KEBAB_CASE_RE.test("../evil")).toBe(false);
    expect(KEBAB_CASE_RE.test("MyAgent")).toBe(false);
    expect(KEBAB_CASE_RE.test("9lives")).toBe(false);
    expect(KEBAB_CASE_RE.test("my_agent")).toBe(false);
  });

  it("nonEmptyLineCount ignores whitespace-only lines (BR-11 measure)", () => {
    expect(nonEmptyLineCount("\n\n   \nreal\n\t\n")).toBe(1);
  });
});

describe("UT-06 / D-1 regression — agent echoed frontmatter handling", () => {
  // STC: UT-06 — DOUBLE-FM-PAYLOAD normalizes to exactly ONE frontmatter block
  it("strips ONE echoed block; disk bytes carry a single FM named after confirmedName", () => {
    const result = ValidationGate.validate("agent", ECHOED_FM_PAYLOAD, NAME_AGENT, DESC_AGENT_B);
    expect(result.ok).toBe(true);
    expect(countDelimiters(result.normalized)).toBe(2); // open + close of ONE block
    expect(frontmatterOf(result.normalized).get("name")).toBe(NAME_AGENT);
    expect(result.normalized).toContain("You are a reviewer."); // body preserved
  });

  // testdata/frontmatter-cases.csv UT-06-double: double FM => fail, nothing written
  it("rejects residual second frontmatter block (double echo cannot reach disk)", () => {
    const result = ValidationGate.validate("agent", DOUBLE_FM_PAYLOAD, NAME_AGENT, DESC_AGENT_B);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/duplicated frontmatter/i);
    expect(result.normalized).toBe(""); // zero eligible bytes
  });

  // D-1 end-to-end chain: fallback scaffold is body-only, so offline flow yields ONE FM
  it("fallback chain (scaffold -> gate) produces exactly one canonical block (TC-17)", async () => {
    const { getFallbackScaffold } = await import("../template-provider");
    const scaffold = getFallbackScaffold("agent", NAME_AGENT, DESC_AGENT_B);
    expect(scaffold.includes("---")).toBe(false); // body only — D-1 root-cause fix
    const result = ValidationGate.validate("agent", scaffold, NAME_AGENT, DESC_AGENT_B);
    expect(result.ok).toBe(true);
    expect(countDelimiters(result.normalized)).toBe(2);
    expect(frontmatterOf(result.normalized).get("name")).toBe(NAME_AGENT);
  });
});

describe("UT-13 / D-4 — empty generation never reaches disk", () => {
  // STC: UT-13 — "" and "   " variants both fail with "empty generation"
  it.each(["", "   ", "\n\n   \n"])('normalizes raw=%j to failure "empty generation"', (raw) => {
    const result = ValidationGate.validate("agent", raw, NAME_AGENT, DESC_AGENT_B);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("empty generation");
    expect(result.normalized).toBe("");
  });

  it("fenced-but-empty payload also collapses to empty generation (AF-13/D-4)", () => {
    expect(normalize("```\n   \n```").reason).toBe("empty generation");
  });

  // STC: UT-07 — FM-only payload leaves an empty body => BR-11 failure
  it("rejects agent payload whose body is empty after FM strip (BR-11)", () => {
    const result = ValidationGate.validate(
      "agent",
      "---\nname: ghost\n---\n\n   \n",
      NAME_AGENT,
      DESC_AGENT_B
    );
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/BR-11/);
  });
});

describe("gate plumbing — defense-in-depth and fence stripping (AF-24)", () => {
  it("re-validates confirmedName against BR-03 even if upstream skipped it", () => {
    const result = ValidationGate.validate("agent", "Real body.", "../evil", DESC_AGENT_B);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/kebab-case rule \(BR-03\)/);
  });

  it("stripCodeFences unwraps a fully-fenced markdown payload (AF-24)", () => {
    expect(stripCodeFences("```markdown\n# Title\nBody\n```")).toBe("# Title\nBody");
    expect(stripCodeFences("```\nplain\n```")).toBe("plain");
  });

  it("leaves content with inner-only fences untouched (outer wrapper required)", () => {
    const inner = "# Title\n```ts\nlet x;\n```";
    expect(stripCodeFences(inner)).toBe(inner);
  });
});
