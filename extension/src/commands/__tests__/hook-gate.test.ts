/**
 * SA4E-193 — Unit tests for the hook branch of the ValidationGate
 * (TDD C1 helper, FSD §6.6.2 CMD2).
 *
 * Covers STC cases UT-08, UT-09, UT-10, UT-14 and mandated regressions:
 * D-2 (fenced JSON stripped before strict parse), D-7 (canonical serializer
 * omits empty action fields). Corpus mirrors testdata/hook-payloads.csv.
 */
import { describe, it, expect } from "vitest";
import { validateHookContent, serializeHookCanonical } from "../hook-gate";
import { ValidationGate } from "../validation-gate";

// ---- Fixtures (STC §2 Test Data + testdata/hook-payloads.csv) --------------
const NAME_HOOK = "watch-ts";
const DESC_HOOK = "Watch TS files";
/** CSV UT-08-valid: valid fileEdited + patterns + runCommand. */
const HOOK_VALID = JSON.stringify({
  enabled: true,
  name: "watch-ts",
  description: "Watch TS files",
  version: "1",
  when: { type: "fileEdited", patterns: ["**/*.ts"] },
  then: { type: "runCommand", command: "npm test" },
});
const HOOK_MALFORMED = '{"name": "broken", "when": ';
/** STC HOOK-FENCED: HOOK_VALID wrapped in a labelled markdown fence (D-2 corpus). */
const HOOK_FENCED = "```json\n" + HOOK_VALID + "\n```";
/** STC HOOK-XOR-CMD: runCommand without command (BR-08). */
const HOOK_XOR_CMD =
  '{"name":"x","description":"d","when":{"type":"promptSubmit"},"then":{"type":"runCommand"}}';
/** STC HOOK-XOR-PROMPT: askAgent without prompt (BR-08). */
const HOOK_XOR_PROMPT =
  '{"enabled":true,"name":"bad-hook","description":"d","when":{"type":"promptSubmit"},"then":{"type":"askAgent"}}';
/** STC HOOK-PATTERNS-PROMPTSUBMIT: patterns on non-file event (BR-08). */
const HOOK_PATTERNS_PROMPTSUBMIT =
  '{"name":"x","description":"d","when":{"type":"promptSubmit","patterns":["*.ts"]},"then":{"type":"askAgent","prompt":"p"}}';
/** STC HOOK-EMPTY-ACTION: valid askAgent hook carrying residual empty "command" (D-7). */
const HOOK_EMPTY_ACTION_OBJ = {
  enabled: true,
  name: "Empty Action",
  description: "Residual empty command field",
  version: "1",
  when: { type: "promptSubmit" },
  then: { type: "askAgent", prompt: "Check for TODOs", command: "" },
};

const WHEN_TYPES = ["promptSubmit", "agentStop", "fileEdited", "fileCreated", "fileDeleted"] as const;

function buildHook(whenType: string, thenType: "askAgent" | "runCommand"): string {
  return JSON.stringify({
    name: `${whenType}-${thenType}`,
    description: "matrix probe",
    when: whenType.startsWith("file") ? { type: whenType, patterns: ["*.md"] } : { type: whenType },
    then:
      thenType === "askAgent"
        ? { type: thenType, prompt: "do it" }
        : { type: thenType, command: "echo hi" },
  });
}

// ---------------------------------------------------------------------------
describe("UT-08 — strict JSON parse and top-level key allowlist (BR-09)", () => {
  // STC: UT-08 step 1 — valid hook passes with canonical 2-space JSON output
  it("accepts the valid fileEdited hook and emits 2-space-indent JSON", () => {
    const result = validateHookContent(HOOK_VALID);
    expect(result.ok).toBe(true);
    expect(result.normalized.split("\n")[1]).toMatch(/^ {2}"/);
    expect(JSON.parse(result.normalized)).toEqual(JSON.parse(HOOK_VALID));
  });

  // STC: UT-08 step 2 — malformed JSON fails with parse reason (ERR-CMD-04)
  it("rejects malformed JSON citing the SyntaxError", () => {
    const result = validateHookContent(HOOK_MALFORMED);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/invalid hook JSON/i);
  });

  // STC: UT-08 step 3 — unknown key named; allowed set quoted (testdata UT-10)
  it("rejects unknown top-level key eventType and lists allowed keys", () => {
    const result = validateHookContent('{"eventType":"fileEdited","name":"x"}');
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('"eventType"');
    for (const key of ["enabled", "name", "description", "version", "when", "then"]) {
      expect(result.reason).toContain(`"${key}"`);
    }
  });

  it("rejects non-object payloads (arrays, scalars, null)", () => {
    expect(validateHookContent("[]").reason).toMatch(/must be a JSON object/);
    expect(validateHookContent("42").reason).toMatch(/must be a JSON object/);
  });
});

describe("UT-10 — conditional matrix enforcement (BR-08 XOR rules)", () => {
  // STC: UT-10 steps 1-3 — XOR violations rejected with BR-08 reasons
  it("rejects runCommand without command (HOOK-XOR-CMD)", () => {
    expect(validateHookContent(HOOK_XOR_CMD).reason).toMatch(
      /command is required when then\.type is "runCommand"/
    );
  });

  it("rejects askAgent without prompt (HOOK-XOR-PROMPT)", () => {
    expect(validateHookContent(HOOK_XOR_PROMPT).reason).toMatch(
      /prompt is required when then\.type is "askAgent"/
    );
  });

  it("rejects patterns on non-file event (HOOK-PATTERNS-PROMPTSUBMIT)", () => {
    expect(validateHookContent(HOOK_PATTERNS_PROMPTSUBMIT).reason).toMatch(
      /patterns is allowed only for/
    );
  });

  it("requires patterns to be an array of strings when present", () => {
    const raw =
      '{"name":"x","description":"d","when":{"type":"fileEdited","patterns":"*.ts"},"then":{"type":"askAgent","prompt":"p"}}';
    expect(validateHookContent(raw).reason).toMatch(/array of strings/);
  });

  // STC: UT-10 step 4 — all-positive matrix (5 when.types × 2 then.types) passes
  it.each(WHEN_TYPES)("accepts every when.type with askAgent action (%s)", (whenType) => {
    const result = validateHookContent(buildHook(whenType, "askAgent"));
    expect(result.ok).toBe(true);
  });

  it.each(WHEN_TYPES)("accepts every when.type with runCommand action (%s)", (whenType) => {
    const result = validateHookContent(buildHook(whenType, "runCommand"));
    expect(result.ok).toBe(true);
  });

  it("rejects unknown when.type and unknown then.type values", () => {
    const badWhen =
      '{"name":"x","description":"d","when":{"type":"onTuesday"},"then":{"type":"askAgent","prompt":"p"}}';
    const badThen =
      '{"name":"x","description":"d","when":{"type":"agentStop"},"then":{"type":"pray"}}';
    expect(validateHookContent(badWhen).reason).toMatch(/must be one of/);
    expect(validateHookContent(badThen).reason).toMatch(/must be one of: askAgent, runCommand/);
  });
});

describe("UT-14 / D-7 — canonical serialization omits empty action fields", () => {
  // STC: UT-14 step 1 — HOOK-EMPTY-ACTION validates OK
  it("accepts HOOK-EMPTY-ACTION through the full gate", () => {
    const result = ValidationGate.validate(
      "hook",
      JSON.stringify(HOOK_EMPTY_ACTION_OBJ),
      NAME_HOOK,
      DESC_HOOK
    );
    expect(result.ok).toBe(true);
  });

  // STC: UT-14 step 2 — "command":"" ABSENT; BR-20 defaults present
  it('omits "command":"" from bytes while keeping prompt and defaults', () => {
    const result = validateHookContent(JSON.stringify(HOOK_EMPTY_ACTION_OBJ));
    const parsed = JSON.parse(result.normalized);
    expect(result.normalized).not.toContain('"command"');
    expect(parsed.then.prompt).toBe("Check for TODOs");
    expect(parsed.enabled).toBe(true);
    expect(parsed.version).toBe("1");
  });

  // D-7 hardening: whitespace-only REQUIRED action field must fail, not vanish
  it("rejects askAgent whose only prompt is whitespace (would be omitted by serializer)", () => {
    const raw =
      '{"name":"x","description":"d","when":{"type":"agentStop"},"then":{"type":"askAgent","prompt":"   "}}';
    const result = validateHookContent(raw);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/prompt is required/);
  });

  // D-7 hardening: runCommand with "" would pass XOR then lose its field on disk
  it("rejects runCommand with empty command instead of emitting an unexecutable hook", () => {
    const raw =
      '{"name":"x","description":"d","when":{"type":"fileCreated"},"then":{"type":"runCommand","command":""}}';
    const result = validateHookContent(raw);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/command is required/);
  });

  it("serializeHookCanonical mutates neither input nor nested objects beyond then", () => {
    const original = { ...HOOK_EMPTY_ACTION_OBJ };
    serializeHookCanonical(original);
    expect(original.then).toHaveProperty("command", ""); // input untouched
  });

  it("applies BR-20 defaults when enabled/version omitted", () => {
    const raw =
      '{"name":"minimal","description":"d","when":{"type":"agentStop"},"then":{"type":"askAgent","prompt":"p"}}';
    const parsed = JSON.parse(validateHookContent(raw).normalized);
    expect(parsed.enabled).toBe(true);
    expect(parsed.version).toBe("1");
  });
});

describe("UT-09 / D-2 regression — fenced hook JSON normalized before parse", () => {
  // STC: UT-09 step 1 — fenced payload passes because NORMALIZE strips fences
  it("strips the ```json wrapper before strict parse (AF-13)", () => {
    const result = ValidationGate.validate("hook", HOOK_FENCED, NAME_HOOK, DESC_HOOK);
    expect(result.ok).toBe(true);
  });

  // STC: UT-09 step 2 — identical canonical bytes as the unfenced variant
  it("produces byte-identical output to validating the unwrapped JSON", () => {
    const fenced = ValidationGate.validate("hook", HOOK_FENCED, NAME_HOOK, DESC_HOOK);
    const plain = ValidationGate.validate("hook", HOOK_VALID, NAME_HOOK, DESC_HOOK);
    expect(fenced.normalized).toBe(plain.normalized);
  });

  it("prose-wrapped JSON still fails strict parse (only surrounding fences are stripped)", () => {
    const prose = 'Here is your hook:\n' + HOOK_VALID;
    const result = ValidationGate.validate("hook", prose, NAME_HOOK, DESC_HOOK);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/invalid hook JSON/);
  });
});
