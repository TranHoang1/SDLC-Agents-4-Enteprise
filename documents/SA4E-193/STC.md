# Software Test Cases (STC)

## SDLC Agents 4 Enterprise — SA4E-193: Create Config Commands — /create-new-agent, hook, steering, skill

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | SA4E-193 |
| Title | Create Config Commands — /create-new-agent, hook, steering, skill |
| Parent Epic | SA4E-181 — Chat Module — OpenCode Parity + Agentic Config System |
| Author | QA Agent |
| Version | 2.0 |
| Date | 2026-08-23 |
| Status | Draft |
| Related STP | documents/SA4E-193/STP.md (v2.0) |
| Related FSD | documents/SA4E-193/FSD.md (v2.1) |
| Related TDD | documents/SA4E-193/TDD.md (v2.0) |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-08-22 | QA Agent | Initial draft from FSD v1.0 baseline scenarios |
| 2.0 | 2026-08-23 | QA Agent | Complete rewrite — supersedes v1.0 entirely. 51 test cases across 6 levels (PBT/UT/IT/E2E-Extension/E2E-UI/SIT); ValidationGate negative corpus for D-1..D-7; per-command happy/alternative/exception coverage UC-01..04; hot-reload detection and editor-open tests; full RTM to BRD ACs, FSD BRs/ERR codes/NFR §8.1 |

---

## Test Case ID Scheme by Level Ranges

| Level | ID Range / Prefix | Count | Automation | Tools |
|-------|-------------------|-------|------------|-------|
| Property-Based Test | PBT-01 .. PBT-05 | 5 | Automated | fast-check + vitest |
| Unit Test | UT-01 .. UT-14 | 14 | Automated | vitest ^4.1.8 (pure modules, no vscode mock) |
| Integration Test | IT-01 .. IT-08 | 8 | Automated | vitest + temp-dir real FS + vi.mock("vscode") |
| E2E-API/E2E-Extension | E2E-EXT-01 .. E2E-EXT-08 | 8 | Automated | @vscode/test-electron (real extension host) |
| E2E-UI | E2E-UI-01 .. E2E-UI-06 | 6 | Automated | Playwright + webview automation |
| SIT (manual exploratory) | SIT-01 .. SIT-10 | 10 | Manual | Extension Development Host (F5), human tester |
| **Total** | | **51** | **41 automated (80%) / 10 manual (20%)** | |

### Shared Fixture Reference (used verbatim in steps below)

| Fixture ID | Concrete Value |
|------------|---------------|
| DESC-AGENT-A | `A documentation agent that generates API docs from code comments` |
| DESC-AGENT-B | `A senior code reviewer that reviews TypeScript changes for security issues` |
| NAME-AGENT | `my-code-reviewer` |
| SUGGEST-AGENT-A | `documentation-agent-that` (BR-04 first-3-qualifying-words) |
| DESC-HOOK | `Auto-validate XML when draw.io files are edited` |
| NAME-HOOK | `xml-validate-drawio` |
| HOOK-VALID | `{"enabled":true,"name":"Xml Validate Drawio","description":"Validate draw.io XML on edit","version":"1","when":{"type":"fileEdited","patterns":["*.drawio","*.xml"]},"then":{"type":"askAgent","prompt":"Validate XML syntax and report errors"}}` |
| HOOK-FENCED | HOOK-VALID wrapped in triple-backtick fence labelled `json` (D-2 corpus) |
| HOOK-MALFORMED | `{"enabled": true, "when": {"type": "fileEdited"` (truncated JSON) |
| HOOK-UNKNOWN-KEY | `{"eventType":"fileEdited","name":"X","when":{"type":"fileEdited"},"then":{"type":"askAgent","prompt":"p"}}` (`eventType` not in allowed set → BR-09 reject) |
| HOOK-XOR-CMD | `then:{"type":"runCommand"}` with NO `command` field (BR-08 XOR violation) |
| HOOK-XOR-PROMPT | `then:{"type":"askAgent"}` with NO `prompt` field |
| HOOK-PATTERNS-PROMPTSUBMIT | `when:{"type":"promptSubmit","patterns":["*.ts"]}` (patterns on non-file event) |
| HOOK-EMPTY-ACTION | valid hook whose `then` additionally carries `"command":""` (D-7 canonical omission target) |
| DESC-STEERING | `Always use semantic versioning for git tags` |
| NAME-STEERING | `semver-git-tags` |
| STEERING-BAD-ENUM | frontmatter `inclusion: sometimes`; body `Use semver tags.` |
| STEERING-BODYLESS | frontmatter `inclusion: auto` only; zero non-empty body lines |
| STEERING-NO-FM | body-only markdown `# Semver rule` + line `Always tag with vX.Y.Z.` (AF-23 acceptable) |
| DESC-SKILL | `Review code security vulnerabilities` |
| NAME-SKILL | `sec-review-skill` |
| SKILL-MISMATCH-FM | LLM frontmatter `name: other-skill`, confirmed name `my-skill` (D-5 corpus) |
| INVALID-NAMES | `My Agent!` · `../etc/passwd` · `-bad-name` · `9lives` · `UPPER_CASE` · `` (empty) |
| EMPTY-DESCS | `` (empty) · `   ` (whitespace-only) |
| DESC-VIETNAMESE | `Một agent dịch tài liệu tiếng Việt` → expected suggestion `agent-new` (AF-05) |
| DOUBLE-FM-PAYLOAD | content beginning `---\nname: wrong-name\nlabel: Wrong\n---\nYou are a reviewer.` (D-1/GAP-02 corpus) |
| EMPTY-STREAM | mocked LLM stream yielding `""` then `"  "` (D-4 corpus) |

---

## 1. Property-Based Tests (PBT) — Automated

### PBT-01: Name extractor always yields kebab-safe suggestion or fallback

| Field | Value |
|-------|-------|
| **ID** | PBT-01 |
| **Title** | For any random description string, `extractNameFromDescription` returns a value matching `^[a-z][a-z0-9-]*$` OR exactly `{prefix}-new` |
| **Level** | PBT |
| **Priority** | High |
| **Type** | Property-Based — correctness invariant |
| **Requirement** | BR-04, FSD §3.7.5/§6.6.1; TDD C3/C6 |
| **Preconditions** | `name-extractor.ts` compiled and exported |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Generate 200+ randomized descriptions via fast-check `fc.string()` (mixed unicode, digits, punctuation, whitespace runs) | No exception thrown for any input |
| 2 | Call `extractNameFromDescription(desc, prefix)` for prefixes `agent`, `hook`, `rule`, `skill` | Output is either regex-valid kebab-case or exactly `{prefix}-new` |
| 3 | Assert output contains only `[a-z0-9-]`, ≤ 3 hyphen-joined segments, never starts with `-` or digit unless fallback used | Invariant holds for all inputs |

**Test Data:** randomized strings incl. `"3d renderer helper"`, `"Đà Nẵng review"`, `"!!! @@@ ###"`, `"a b c d e"`.
**Postconditions:** none (pure function).

---

### PBT-02: buildAgentFrontmatter is deterministic and label derivation is correct

| Field | Value |
|-------|-------|
| **ID** | PBT-02 |
| **Level** | PBT |
| **Priority** | High |
| **Type** | Property-Based — determinism + BR-19 |
| **Requirement** | BR-18, BR-19, FSD §3.7.1 |
| **Preconditions** | Agent frontmatter builder exported from handler/module |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | For random pairs `(name, description)` call builder twice with identical inputs | Byte-identical output both times |
| 2 | Parse emitted YAML frontmatter | `phase` = `implementation`, `tools` = `["read","write","shell","@mcp"]` defaults present (BR-18) |
| 3 | For name tokens like `code-reviewer` assert label derivation property: label = Title-Cased split-on-`-` join (BR-19) | Holds for every generated kebab name |

**Test Data:** generated names `my-code-reviewer`, `xml-hook-helper`, single-token `reviewer`.
**Postconditions:** none.

---

### PBT-03: Gate normalization makes fenced input equivalent to unfenced

| Field | Value |
|-------|-------|
| **ID** | PBT-03 |
| **Level** | PBT |
| **Priority** | High |
| **Type** | Property-Based — normalization equivalence |
| **Requirement** | AF-13, AF-24, D-2 fix, FSD §6.6.2 NORMALIZE |
| **Preconditions** | ValidationGate exported |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Generate random valid hook JSON objects constrained to schema | Serialization succeeds |
| 2 | Run gate on raw JSON vs same JSON wrapped in ```json fence with random surrounding whitespace/prose | Both runs `{ok:true}` with IDENTICAL `normalized` bytes |
| 3 | Repeat equivalence for steering markdown bodies fenced as ```markdown | Same equivalence holds |

**Test Data:** generated hooks across full BR-08 conditional matrix.
**Postconditions:** nothing written anywhere (gate is pure).

---

### PBT-04: Kebab gate rejects every path-traversal/unsafe string (security property)

| Field | Value |
|-------|-------|
| **ID** | PBT-04 |
| **Level** | PBT |
| **Priority** | High |
| **Type** | Property-Based — Security |
| **Requirement** | BR-03, BR-05, TDD §6.1, ERR-CMD-02 |
| **Preconditions** | ValidationGate + path-composition helper available |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Generate hostile strings: `../../etc/passwd`, `..\\windows\\system32`, `C:\\Temp\\x.md`, `/abs/path`, `.gitignore`, `%00` | None match `^[a-z][a-z0-9-]*$` |
| 2 | Feed each as confirmed name into gate pre-write validation | `{ok:false}` naming kebab-case violation; NO target path composed |
| 3 | Containment property: resolved write-path (valid names only) always startsWith `<workspace>/.code-intel/<typeDir>/` | Never violated for any generated valid name |

**Test Data:** corpus above plus 100 random unsafe strings containing at least one of `./\\: % ..`.
**Postconditions:** no filesystem access performed.

---

### PBT-05: Canonical hook serializer omits empty action fields without semantic loss

| Field | Value |
|-------|-------|
| **ID** | PBT-05 |
| **Level** | PBT |
| **Priority** | Medium |
| **Type** | Property-Based — canonical form (D-7) |
| **Requirement** | D-7 fix, §6.6.2 CMD2 serialize step, BR-20 |
| **Preconditions** | Gate hook branch exported |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Generate valid hooks randomly injecting empty-string action fields (`command:""` under askAgent etc.) | Serializer accepts input |
| 2 | Parse serialized output back to object | Empty-string action fields OMITTED; `enabled` bool and `version` string default `"1"` preserved |
| 3 | Round-trip deep-equal(original minus empty fields, reparsed) | Equal for all iterations |

**Test Data:** HOOK-EMPTY-ACTION plus generated variants.
**Postconditions:** none.

---

## 2. Unit Tests (UT) — Automated

### UT-01: Name suggestion from qualifying English description

| Field | Value |
|-------|-------|
| **ID** | UT-01 |
| **Title** | extractNameFromDescription picks first ≤3 words of length >2, lowercase, hyphen-joined |
| **Level** | UT |
| **Priority** | High |
| **Type** | Functional — BR-04 algorithm (FSD TC-01 expectation) |
| **Requirement** | BR-04, FSD §3.7.5; NFR-P2 ≤ 5 ms |
| **Preconditions** | Pure module under test |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | `extractNameFromDescription("A documentation agent that generates API docs from code comments", "agent")` | Returns `documentation-agent-that` exactly |
| 2 | Time 1000 invocations with `performance.now()` | p95 ≤ 5 ms per invocation (NFR-P2) |

**Test Data:** DESC-AGENT-A.
**Postconditions:** none.

---

### UT-02: Fallback suggestion for non-Latin / short-word descriptions

| Field | Value |
|-------|-------|
| **ID** | UT-02 |
| **Level** | UT |
| **Priority** | High |
| **Type** | Functional — AF-05, TC-20 |
| **Requirement** | BR-04 fallback clause |
| **Preconditions** | Module under test |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | `extractNameFromDescription("Một agent dịch tài liệu tiếng Việt", "agent")` | Returns `agent-new` (all tokens stripped) |
| 2 | `("Do it", "hook")`, `("Do it", "rule")`, `("Do it", "skill")` | Return `hook-new`, `rule-new`, `skill-new` |
| 3 | `("Fix bugs", "agent")` | Returns `fix-bugs` |

**Test Data:** DESC-VIETNAMESE; `"Do it"`; `"Fix bugs"`.
**Postconditions:** none.

---

### UT-03: Hyphenated input token merging in extractor

| Field | Value |
|-------|-------|
| **ID** | UT-03 |
| **Level** | UT |
| **Priority** | Medium |
| **Type** | Functional — §6.6.1 edge case |
| **Requirement** | BR-04, FSD §6.6.1 hyphenated row |
| **Preconditions** | Module under test |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Call with `"pre-commit check helper"` | Hyphen stripped → token `precommit`; result = first 3 qualifying words joined → exact expected string asserted in test (`precommit-check-helper`) |

**Test Data:** `"pre-commit check helper"`, `"draw.io auto validate"`.
**Postconditions:** none.

---

### UT-04: Digit-leading suggestion is advisory-only and caught downstream

| Field | Value |
|-------|-------|
| **ID** | UT-04 |
| **Level** | UT |
| **Priority** | Medium |
| **Type** | Negative — §6.6.1 digit-leading case |
| **Requirement** | BR-03 enforcement point; TDD §6.1 note 4 |
| **Preconditions** | Gate name re-validation exported |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | `extractNameFromDescription("3d renderer helper", "agent")` | Suggestion `3d-renderer-helper` produced (advisory only) |
| 2 | Feed `3d-renderer-helper` into gate pre-write validation | Rejected: fails kebab regex (starts with digit); reason mentions kebab-case |

**Test Data:** `"3d renderer helper"`.
**Postconditions:** no write attempted.

---

### UT-05: Agent frontmatter defaults and label derivation

| Field | Value |
|-------|-------|
| **ID** | UT-05 |
| **Level** | UT |
| **Priority** | High |
| **Type** | Functional — BR-18/BR-19 |
| **Requirement** | BR-18, BR-19, FSD §3.7.1 |
| **Preconditions** | Builder exported |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | `buildAgentFrontmatter("my-code-reviewer", DESC-AGENT-B)` | FM contains `name: my-code-reviewer`, `label: My Code Reviewer`, folded `description`, `phase: implementation`, default tools array |
| 2 | Omit optional args | Defaults applied without error (BR-18) |

**Test Data:** NAME-AGENT + DESC-AGENT-B.
**Postconditions:** none.

---

### UT-06: Gate strips echoed frontmatter on agent path (D-1/GAP-02 regression)

| Field | Value |
|-------|-------|
| **ID** | UT-06 |
| **Title** | DOUBLE-FM-PAYLOAD normalizes to exactly ONE frontmatter block |
| **Level** | UT |
| **Priority** | High |
| **Type** | Negative/Regression — ValidationGate CMD1 branch |
| **Requirement** | ERR-CMD-09, GAP-02, D-1; FSD TC-16/TC-17 |
| **Preconditions** | Gate exported; canonical builder available |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | `validate("agent", DOUBLE-FM-PAYLOAD, "my-code-reviewer", DESC-AGENT-B)` | `{ok:true}` with normalized content |
| 2 | Count leading `---…---` blocks in normalized output | Exactly ONE block remains; its `name:` = `my-code-reviewer` (confirmed wins over echoed `wrong-name`) |
| 3 | Assert body preserved (`You are a reviewer.` present, ≥1 non-empty line BR-11) | Passes |

**Test Data:** DOUBLE-FM-PAYLOAD, NAME-AGENT.
**Postconditions:** none. **FAILS on pre-fix baseline (D-1) — regression target.**

---

### UT-07: Gate rejects empty agent body (BR-11)

| Field | Value |
|-------|-------|
| **ID** | UT-07 |
| **Level** | UT |
| **Priority** | High |
| **Type** | Negative |
| **Requirement** | BR-11, ERR-CMD-04 |
| **Preconditions** | Gate exported |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | `validate("agent", "\n\n   \n", NAME-AGENT, DESC-AGENT-B)` | After FM-strip leaves empty body ⇒ `{ok:false}` citing empty body/generation failure; nothing eligible for disk |

**Test Data:** whitespace-only content.
**Postconditions:** none.

---

### UT-08: Hook gate — strict JSON parse and unknown top-level keys (BR-09)

| Field | Value |
|-------|-------|
| **ID** | UT-08 |
| **Level** | UT |
| **Priority** | High |
| **Type** | Negative — ValidationGate CMD2 branch |
| **Requirement** | BR-09, ERR-CMD-04, FSD TC-10 |
| **Preconditions** | Gate exported |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | `validate("hook", HOOK-VALID, NAME-HOOK, DESC-HOOK)` | `{ok:true}`; normalized is 2-space-indent JSON |
| 2 | `validate("hook", HOOK-MALFORMED, …)` | `{ok:false}`; reason = parse error (ERR-CMD-04) |
| 3 | `validate("hook", HOOK-UNKNOWN-KEY, …)` | `{ok:false}`; reason names key `eventType`; allowed set ⊆ {enabled,name,description,version,when,then} quoted |

**Test Data:** HOOK-VALID / HOOK-MALFORMED / HOOK-UNKNOWN-KEY.
**Postconditions:** none.

---

### UT-09: Hook gate strips markdown code fences (D-2/AF-13 regression)

| Field | Value |
|-------|-------|
| **ID** | UT-09 |
| **Level** | UT |
| **Priority** | High |
| **Type** | Negative/Regression |
| **Requirement** | AF-13, D-2, GAP-01; FSD TC-18 |
| **Preconditions** | Gate exported |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | `validate("hook", HOOK-FENCED, NAME-HOOK, DESC-HOOK)` | `{ok:true}` — fences stripped before strict parse |
| 2 | Compare `normalized` with UT-08 step 1 output | Identical canonical bytes |

**Test Data:** HOOK-FENCED.
**Postconditions:** none. **FAILS on pre-fix baseline (D-2) — regression target.**

---

### UT-10: Hook conditional matrix enforcement (BR-08 XOR rules)

| Field | Value |
|-------|-------|
| **ID** | UT-10 |
| **Level** | UT |
| **Priority** | High |
| **Type** | Negative — conditional consistency (FSD TC-11, EF-15) |
| **Requirement** | BR-08, ERR-CMD-04 |
| **Preconditions** | Gate exported |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Validate hook with `then` = HOOK-XOR-CMD | `{ok:false}`: command required iff runCommand |
| 2 | Validate hook with `then` = HOOK-XOR-PROMPT | `{ok:false}`: prompt required iff askAgent |
| 3 | Validate hook with `when` = HOOK-PATTERNS-PROMPTSUBMIT | `{ok:false}`: patterns only for fileEdited/fileCreated/fileDeleted |
| 4 | Validate all-positive matrix (5 when.types × 2 then.types) | All `{ok:true}` with canonical serialization |

**Test Data:** XOR fixtures + generated matrix.
**Postconditions:** none.

---

### UT-11: Steering gate — optional frontmatter, enum check, body required (BR-10/BR-11)

| Field | Value |
|-------|-------|
| **ID** | UT-11 |
| **Level** | UT |
| **Priority** | High |
| **Type** | Functional + Negative — ValidationGate CMD3 branch |
| **Requirement** | BR-10, BR-11, AF-23, EF-23 |
| **Preconditions** | Gate exported |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Validate STEERING-NO-FM (body-only markdown) | `{ok:true}` — frontmatter OPTIONAL per AF-23 |
| 2 | Validate steering with valid FM `inclusion: auto` + body line | `{ok:true}` |
| 3 | Validate STEERING-BAD-ENUM (`inclusion: sometimes`) | `{ok:false}` citing enum {auto, manual, always} (BR-10) |
| 4 | Validate STEERING-BODYLESS | `{ok:false}`: body must contain ≥1 non-empty instruction line (BR-11) |

**Test Data:** STEERING-* fixtures.
**Postconditions:** none.

---

### UT-12: Skill gate forces frontmatter name to confirmed name (D-5/AF-33 regression)

| Field | Value |
|-------|-------|
| **ID** | UT-12 |
| **Level** | UT |
| **Priority** | High |
| **Type** | Regression + Negative — ValidationGate CMD4 branch |
| **Requirement** | AF-33, D-5, FSD TC-21; folder invariant §3.7.4 |
| **Preconditions** | Gate exported |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | `validate("skill", SKILL-MISMATCH-FM-content, "my-skill", DESC-SKILL)` | `{ok:true}`; normalized FM `name:` REWRITTEN to `my-skill` |
| 2 | Validate skill missing `description` in FM | `{ok:false}`: description required (§3.7.4) |
| 3 | Validate skill with zero non-empty body lines | `{ok:false}` (BR-11) |

**Test Data:** SKILL-MISMATCH-FM; name `my-skill`.
**Postconditions:** none.

---

### UT-13: Empty LLM completion treated as generation failure (D-4/AF-04 regression)

| Field | Value |
|-------|-------|
| **ID** | UT-13 |
| **Level** | UT |
| **Priority** | High |
| **Type** | Regression |
| **Requirement** | AF-04, D-4, FSD TC-19; FR-COMMON-02 promotion rule |
| **Preconditions** | Gate exported |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | `validate("agent", raw, NAME-AGENT, DESC-AGENT-B)` where raw = `""` then `"   "` variants | `{ok:false}` "empty generation" for BOTH — never a body-less file eligible for write |

**Test Data:** EMPTY-STREAM.
**Postconditions:** none.

---

### UT-14: Canonical hook serialization omits empty action fields (D-7)

| Field | Value |
|-------|-------|
| **ID** | UT-14 |
| **Level** | UT |
| **Priority** | Medium |
| **Type** | Functional — canonical form |
| **Requirement** | D-7, BR-20 defaults |
| **Preconditions** | Gate exported |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Validate HOOK-EMPTY-ACTION | `{ok:true}` |
| 2 | Inspect serialized output | `"command":""` ABSENT; defaults present when omitted: `enabled:true`, `version:"1"` |

**Test Data:** HOOK-EMPTY-ACTION.
**Postconditions:** none.

---

## 3. Integration Tests (IT) — Automated (real temp FS + mocked vscode API)

### IT-01: CMD1 full pipeline writes valid agent file

| Field | Value |
|-------|-------|
| **ID** | IT-01 |
| **Level** | IT |
| **Priority** | High |
| **Type** | Integration — happy path UC-01 (FSD TC-01/TC-02) |
| **Requirement** | FR-CMD-01, FR-COMMON-01, AC CMD1-1..4; BR-05 path |
| **Preconditions** | Temp workspace dir; InputBox mocked to return [DESC-AGENT-B, NAME-AGENT]; fake LLM streams body `"You are a senior code reviewer focused on TypeScript security."` |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Invoke `handleCreateNewAgent` with no rawArgs | Two InputBox calls observed: description prompt then pre-filled name prompt |
| 2 | Await completion; read `.code-intel/agents/my-code-reviewer.md` | File EXISTS; UTF-8 decodable |
| 3 | Parse frontmatter | Exactly ONE FM block: name=`my-code-reviewer`, label=`My Code Reviewer`, phase=`implementation`, tools default array |
| 4 | Inspect mock-captured LLM call | Message #1 = AGENT_LLM_PROMPT embedding Section-7 field specs (AC CMD1-2) |

**Test Data:** DESC-AGENT-B, NAME-AGENT.
**Postconditions:** file in temp dir; harness cleans up.

---

### IT-02: CMD2 fenced JSON from LLM lands as clean hook file

| Field | Value |
|-------|-------|
| **ID** | IT-02 |
| **Level** | IT |
| **Priority** | High |
| **Type** | Integration — AF-13 normalization through real write (D-2 regression) |
| **Requirement** | AF-13, D-2, AC CMD2-1..3 |
| **Preconditions** | Mocked LLM returns HOOK-FENCED text; inputs stubbed to DESC-HOOK / NAME-HOOK |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Run hook handler end-to-end | Completes with success toast call |
| 2 | Read `.code-intel/hooks/xml-validate-drawio.json`; `JSON.parse` | Parses CLEANLY — zero backticks/fences on disk |
| 3 | Deep-compare parsed object to HOOK-VALID semantics | Equal; conditionals consistent |

**Test Data:** HOOK-FENCED.
**Postconditions:** valid file persisted.

---

### IT-03: Gate rejection persists NOTHING (BR-07 core proof)

| Field | Value |
|-------|-------|
| **ID** | IT-03 |
| **Level** | IT |
| **Priority** | High |
| **Type** | Integration — exception flows EF-03/EF-13/EF-15 |
| **Requirement** | BR-07, ERR-CMD-04, GAP-01 closure; FSD TC-10 |
| **Preconditions** | Three sub-runs with mocked LLM returning HOOK-MALFORMED, HOOK-XOR-CMD content, EMPTY-STREAM respectively; FS snapshot before each |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Run hook handler with HOOK-MALFORMED mock | Error toast once with template `Failed to create hook: {reason}`, reason non-generic |
| 2 | List `.code-intel/hooks/` after run | ZERO new files vs snapshot (nothing written) |
| 3 | Repeat for XOR-violating and empty-stream mocks | Same outcome all three: `{ok:false}` ⇒ zero disk writes |

**Test Data:** HOOK-MALFORMED, HOOK-XOR-CMD, EMPTY-STREAM.
**Postconditions:** workspace unchanged except possibly pre-created parent dirs (allowed).

---

### IT-04: Fresh-workspace recursive folder creation (CMD4)

| Field | Value |
|-------|-------|
| **ID** | IT-04 |
| **Level** | IT |
| **Priority** | High |
| **Type** | Integration — BR-06 (FSD TC-05) |
| **Requirement** | BR-06, AC CMD4-2, UC-04 |
| **Preconditions** | Temp workspace WITHOUT `.code-intel/` at all |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Run skill handler with DESC-SKILL / NAME-SKILL | Chain `.code-intel/skills/sec-review-skill/` created recursively |
| 2 | Verify SKILL.md parses | FM name = `sec-review-skill`; description non-empty; sections or scaffold placeholders present |
| 3 | Re-run same command twice | Idempotent mkdir — no error on existing dirs (AF-34) |

**Test Data:** DESC-SKILL, NAME-SKILL.
**Postconditions:** skill package complete.

---

### IT-05: UTF-8 encoding and single-complete write contract

| Field | Value |
|-------|-------|
| **ID** | IT-05 |
| **Level** | IT |
| **Priority** | Medium |
| **Type** | Integration — BR-16, PL-4 property 2 |
| **Requirement** | BR-16, TDD §6.6.3 |
| **Preconditions** | Description containing multi-byte chars: "Tránh hardcode secrets trong mã nguồn"; fs call spy attached |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Run steering handler with that description | Written without throwing |
| 2 | Strict-decode file bytes as UTF-8 | Diacritics intact (`Tránh`, `mã`, `nguồn`); no replacement chars |
| 3 | Inspect fs spy | Exactly ONE `writeFile` call per artifact (watcher can never observe partial content) |

**Test Data:** Vietnamese description above.
**Postconditions:** valid UTF-8 steering file.

---

### IT-06: Collision pre-check forbids silent overwrite (BR-12/GAP-05)

| Field | Value |
|-------|-------|
| **ID** | IT-06 |
| **Level** | IT |
| **Priority** | High |
| **Type** | Integration — EF-05/EF-14, FSD TC-12 |
| **Requirement** | BR-12, ERR-CMD-06, GAP-05 invariant |
| **Preconditions** | Pre-create `.code-intel/agents/my-code-reviewer.md` containing sentinel `SENTINEL-ORIGINAL` |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Run agent handler resolving to SAME confirmed name | Warning surface invoked BEFORE any write |
| 2 | Policy mock answers cancel | Sentinel content UNCHANGED — silent overwrite never occurs |
| 3 | Policy mock answers confirm/rename | Either overwrite-with-warning recorded OR renamed `{name}-2.md` created; exactly one branch holds (OI-01 pending) |

**Test Data:** sentinel file + NAME-AGENT.
**Postconditions:** no data loss in cancel branch.

---

### IT-07: LLM outage falls back to deterministic scaffold (FR-COMMON-02)

| Field | Value |
|-------|-------|
| **ID** | IT-07 |
| **Level** | IT |
| **Priority** | High |
| **Type** | Integration — taxonomy F1–F3 + D-1 regression on fallback path; NFR-P3 |
| **Requirement** | FR-COMMON-02, ERR-CMD-03, AF-03/12/22/32; NFR-P3 ≤ 100 ms p95 |
| **Preconditions** | `vscode.lm.selectChatModels` mocked: `[]` (F2), selection throw (F1), request rejection (F3) variants |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Run ALL four handlers offline | Each completes with `[placeholder]` scaffold at correct BR-05 paths |
| 2 | Open offline agent artifact | Exactly ONE frontmatter block; its `name:` = user-confirmed name (TC-17 regression, post-D-1-fix) |
| 3 | Measure submit→write duration per command | p95 ≤ 100 ms (NFR-P3) |
| 4 | Check console.debug fallback log | Emitted with type+error (audit trail §7.3) |

**Test Data:** DESC fixtures; NAME fixtures.
**Postconditions:** four scaffold artifacts exist. **Step 2 FAILS on pre-fix baseline (D-1).**

---

### IT-08: Editor-open failure does NOT flip success to failure (D-3 regression)

| Field | Value |
|-------|-------|
| **ID** | IT-08 |
| **Level** | IT |
| **Priority** | High |
| **Type** | Integration — EF-06, ERR-CMD-08 |
| **Requirement** | ERR-CMD-08, BR-13, FR-COMMON-03/04; TDD M1 isolation |
| **Preconditions** | Stub `openTextDocument` to REJECT after successful write |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Run agent handler; force open rejection | File EXISTS on disk (write already succeeded) |
| 2 | Inspect notification calls | Success toast STILL shown; NO `Failed to create agent` error toast; optional non-blocking warning allowed |
| 3 | Confirm watcher event | Create event still observed despite open failure |

**Test Data:** NAME-AGENT + DESC-AGENT-B.
**Postconditions:** success preserved. **FAILS on pre-fix baseline (D-3).**

---

## 4. E2E-API / E2E-Extension Tests — Automated (real VS Code extension host)

### E2E-EXT-01: Command registration contract (BR-01)

| Field | Value |
|-------|-------|
| **ID** | E2E-EXT-01 |
| **Level** | E2E-API/E2E-Extension |
| **Priority** | High |
| **Type** | Automated (@vscode/test-electron) — registration + INT-5 |
| **Requirement** | BR-01, FSD §2.2 registrar row |
| **Preconditions** | Extension activated in test host with a workspace folder open |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | `vscode.commands.getCommands()` filtered | Contains exactly `create-new-agent`, `create-new-hook`, `create-new-steering`, `create-new-skill` |
| 2 | Execute each ID with immediately-cancelled stubbed inputs | No "command not found"; dispatch OK |

**Test Data:** n/a.
**Postconditions:** no files created.

---

### E2E-EXT-02: CMD1 end-to-end in real host → artifact + editor open

| Field | Value |
|-------|-------|
| **ID** | E2E-EXT-02 |
| **Level** | E2E-API/E2E-Extension |
| **Priority** | High |
| **Type** | Automated — UC-01 happy path; AC CMD1-4/5; NFR-E1 |
| **Requirement** | FR-CMD-01, FR-COMMON-03, BR-05 |
| **Preconditions** | Real-host workspace seeded EMPTY; InputBox stubbed [DESC-AGENT-B, NAME-AGENT]; LLM mocked at API boundary |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | `executeCommand("create-new-agent")` | Resolves without rejection |
| 2 | Stat `.code-intel/agents/my-code-reviewer.md` | Present; single FM block; body ≥1 line |
| 3 | Active editor URI equals written path within 1 s of write | Editor auto-opened (standard editor while SA4E-190 pending); NFR-E1 measured |
| 4 | Captured info-toast | `✅ Agent "my-code-reviewer" created at .code-intel/agents/my-code-reviewer.md` |

**Test Data:** DESC-AGENT-B / NAME-AGENT.
**Postconditions:** file persisted; timing logged.

---

### E2E-EXT-03: CMD2 end-to-end produces schema-valid hook JSON

| Field | Value |
|-------|-------|
| **ID** | E2E-EXT-03 |
| **Level** | E2E-API/E2E-Extension |
| **Priority** | High |
| **Type** | Automated — UC-02 happy path; AC CMD2-1..4 |
| **Requirement** | FR-CMD-02, BR-08/09/20 |
| **Preconditions** | Stubbed inputs DESC-HOOK / NAME-HOOK; mocked LLM returns HOOK-FENCED |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | `executeCommand("create-new-hook")` | Toast `✅ Hook "xml-validate-drawio" created at .code-intel/hooks/xml-validate-drawio.json` |
| 2 | Read + parse file from real disk | Valid object; keys within allowed set; conditionals hold; defaults enabled/version present |
| 3 | Editor opened on the .json document | Active editor URI matches |

**Test Data:** HOOK-FENCED.
**Postconditions:** hook persisted.

---

### E2E-EXT-04: CMD3 end-to-end writes steering rule

| Field | Value |
|-------|-------|
| **ID** | E2E-EXT-04 |
| **Level** | E2E-API/E2E-Extension |
| **Priority** | High |
| **Type** | Automated — UC-03 happy path; AC CMD3-1..4 |
| **Requirement** | FR-CMD-03, BR-10/11 |
| **Preconditions** | Stubbed inputs DESC-STEERING / NAME-STEERING; mocked LLM returns valid body-only markdown (AF-23 shape) |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | `executeCommand("create-new-steering")` | Toast `✅ Steering rule "semver-git-tags" created at .code-intel/steering/semver-git-tags.md` |
| 2 | Read file | Body-only markdown accepted; ≥1 non-empty instruction line |
| 3 | Editor opened | URI match |

**Test Data:** DESC-STEERING / NAME-STEERING.
**Postconditions:** steering file persisted.

---

### E2E-EXT-05: CMD4 end-to-end creates folder + SKILL.md

| Field | Value |
|-------|-------|
| **ID** | E2E-EXT-05 |
| **Level** | E2E-API/E2E-Extension |
| **Priority** | High |
| **Type** | Automated — UC-04 happy path; AC CMD4-1..3 |
| **Requirement** | FR-CMD-04, BR-06, §3.7.4 folder contract |
| **Preconditions** | Fresh workspace; stubbed inputs DESC-SKILL / NAME-SKILL |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | `executeCommand("create-new-skill")` | Toast `✅ Skill "sec-review-skill" created at .code-intel/skills/sec-review-skill/SKILL.md` |
| 2 | Verify directory contents | Folder exists containing SKILL.md; FM name == folder name == `sec-review-skill` |
| 3 | Editor opened on SKILL.md | URI match |

**Test Data:** DESC-SKILL / NAME-SKILL.
**Postconditions:** skill package persisted.

---

### E2E-EXT-06: No workspace folder ⇒ commands not registered

| Field | Value |
|-------|-------|
| **ID** | E2E-EXT-06 |
| **Level** | E2E-API/E2E-Extension |
| **Priority** | Medium |
| **Type** | Automated — security/trust guard (FSD §7.1) |
| **Requirement** | TDD §6.2 Workspace Trust row |
| **Preconditions** | Host launched WITHOUT workspace folder |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Activate extension; filter getCommands | None of the four IDs registered (or invocation safe no-op) |
| 2 | Attempt direct executeCommand | No exception escapes; no filesystem access attempted |

**Test Data:** n/a.
**Postconditions:** host stable.

---

### E2E-EXT-07: Inline rawArgs skips description dialog (AF-01 family)

| Field | Value |
|-------|-------|
| **ID** | E2E-EXT-07 |
| **Level** | E2E-API/E2E-Extension |
| **Priority** | Medium |
| **Type** | Automated — alternative flows AF-01/11/21/31 |
| **Requirement** | AF-01, INT-5 rawArgs payload |
| **Preconditions** | Invocation arg `{ rawArgs: DESC-HOOK }`; name InputBox stubbed NAME-HOOK |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Execute create-new-hook with rawArgs payload | Description InputBox NEVER shown (spy count 0 for first dialog) |
| 2 | Verify artifact | `.code-intel/hooks/xml-validate-drawio.json` valid as E2E-EXT-03 |

**Test Data:** rawArgs=DESC-HOOK.
**Postconditions:** one dialog interaction only.

---

### E2E-EXT-08: Failure toast templates exact across all four commands (ERR-CMD-04)

| Field | Value |
|-------|-------|
| **ID** | E2E-EXT-08 |
| **Level** | E2E-API/E2E-Extension |
| **Priority** | Medium |
| **Type** | Automated — BR-14 negative-path message contracts |
| **Requirement** | BR-14, ERR-CMD-04, §3.8.4 failure template |
| **Preconditions** | Four runs with gate-rejecting mocked content (malformed hook / bad steering enum / empty agent stream / skill missing description) |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Run each failing command | Error toast matches `Failed to create {agent|hook|steering rule|skill}: {reason}` — type noun EXACT per catalogue |
| 2 | FS snapshot before/after each run | Zero new artifacts in all four runs |

**Test Data:** negative corpus fixtures.
**Postconditions:** no partial files anywhere.

---

## 5. E2E-UI Tests — Automated (chat webview via Playwright)

### E2E-UI-01: Slash menu lists and filters the four commands

| Field | Value |
|-------|-------|
| **ID** | E2E-UI-01 |
| **Level** | E2E-UI |
| **Priority** | High |
| **Type** | Automated (Playwright) — §3.8.1 UI spec |
| **Requirement** | BR-01, FSD §3.8.1 row 1; INT-5 |
| **Preconditions** | Chat webview loaded in automation browser |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Type `/create-new-` into chat input | Menu shows EXACTLY 4 entries: create-new-agent/hook/steering/skill |
| 2 | Arrow-down + Enter on "create-new-agent" (or click) | Command dispatched (host spy receives `create-new-agent`) |

**Test Data:** query `/create-new-`.
**Postconditions:** dispatch recorded.

---

### E2E-UI-02: Description dialog prompt and placeholder exactness per command

| Field | Value |
|-------|-------|
| **ID** | E2E-UI-02 |
| **Level** | E2E-UI |
| **Priority** | Medium |
| **Type** | Automated — §3.8.2 fixed strings |
| **Requirement** | BRD Step 2 strings; FSD §3.8.2 rows 1–2 |
| **Preconditions** | Each command invoked with empty rawArgs so dialog appears |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Invoke each command; capture description InputBox | Prompts exactly: "Describe the agent you want to create" / "…the hook…" / "…the steering rule…" / "…the skill…" |
| 2 | Capture placeholders | Exactly the four §3.8.2 placeholders incl. agent example "e.g., A documentation agent that generates API docs from code comments" |

**Test Data:** n/a (string contracts).
**Postconditions:** dialogs cancelled.

---

### E2E-UI-03: Empty description guard and Esc silent abort

| Field | Value |
|-------|-------|
| **ID** | E2E-UI-03 |
| **Level** | E2E-UI |
| **Priority** | High |
| **Type** | Automated — EF-01/ERR-CMD-01 visible guard (FSD TC-06/TC-07) |
| **Requirement** | BR-02, ERR-CMD-01 |
| **Preconditions** | Agent command invoked; dialog open |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Submit EMPTY description | Inline message "Description is required"; flow stays on dialog; nothing created |
| 2 | Submit whitespace-only `"   "` | Same rejection (trim length > 0 required) |
| 3 | Press Esc at dialog | SILENT abort: no toast, no file, chat ready |

**Test Data:** EMPTY-DESCS.
**Postconditions:** zero side effects.

---

### E2E-UI-04: Invalid name inline kebab-case validation + retry accepted

| Field | Value |
|-------|-------|
| **ID** | E2E-UI-04 |
| **Level** | E2E-UI |
| **Priority** | High |
| **Type** | Automated — ERR-CMD-02 (FSD TC-08) |
| **Requirement** | BR-03, §3.8.3 row 3 |
| **Preconditions** | Valid description submitted; name dialog pre-filled with suggestion |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Replace suggestion with `My Agent!`; submit | Inline error "Name must be kebab-case (e.g., my-agent)"; dialog stays open |
| 2 | Repeat with `-bad-name`, `9lives`, `../etc/passwd` | Rejected each time with same inline pattern message |
| 3 | Correct to `my-code-reviewer`; submit | Accepted; pipeline proceeds; artifact written |

**Test Data:** INVALID-NAMES → NAME-AGENT.
**Postconditions:** valid file created after correction only.

---

### E2E-UI-05: Success toast templates rendered exactly (×4)

| Field | Value |
|-------|-------|
| **ID** | E2E-UI-05 |
| **Level** | E2E-UI |
| **Priority** | Medium |
| **Type** | Automated — FR-COMMON-04 positive templates |
| **Requirement** | BR-14, §3.8.4 success rows |
| **Preconditions** | Four happy-path runs completed (mocked LLM) |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | After each success capture toast DOM/text | Exact four templates with ✅ prefix, quoted name, full relative path incl. extension (.md/.json/.md/SKILL.md) |

**Test Data:** NAME fixtures per command.
**Postconditions:** artifacts exist.

---

### E2E-UI-06: Hot-reload detection — new file appears in UI list ≤ 1 s without restart

| Field | Value |
|-------|-------|
| **ID** | E2E-UI-06 |
| **Level** | E2E-UI |
| **Priority** | High |
| **Type** | Automated timing test — hot-reload detection (FR-COMMON-05 / NFR-E2 / TC-14) |
| **Requirement** | FR-COMMON-05, BR-17, NFR-E2 ≤ 1 s; BRD SM-4 |
| **Preconditions** | Real SA4E-189 watcher active; agents list panel visible; baseline snapshot taken |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Record t0 = write completion of `.code-intel/agents/my-code-reviewer.md` | Write succeeds |
| 2 | Poll agents list every 100 ms until entry appears | Appears ≤ 1 s (300 ms debounce + render); hard-fail threshold 3 s |
| 3 | Repeat 3 consecutive runs with fresh names (`reload-check-a/b/c`) | Budget met ALL runs; NO extension restart during sequence |
| 4 | Negative control: bare folder `.code-intel/skills/orphan-probe/` WITHOUT SKILL.md | Skills list does NOT register it (watcher glob requires SKILL.md — EF-35 contract) |

**Test Data:** reload-check-a/b/c names.
**Postconditions:** list reflects final state; restart counter unchanged.

---

## 6. SIT — Manual Exploratory (Extension Development Host, human tester)

### SIT-01: Full manual happy-path walkthrough of all four commands with real Copilot

| Field | Value |
|-------|-------|
| **ID** | SIT-01 |
| **Level** | SIT |
| **Priority** | High |
| **Type** | Manual functional walkthrough (covers FSD TC-01..TC-05) |
| **Requirement** | UC-01..UC-04 main flows; BRD BO-1 (<60 s), SM-3 |
| **Preconditions** | Extension Development Host running (F5); Copilot signed IN; sandbox workspace empty; stopwatch ready |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Type `/create-new-agent A documentation agent that generates API docs from code comments`; confirm suggested name | `.code-intel/agents/documentation-agent-that.md` created; opens; toast shown |
| 2 | Run hook command typing description manually ("Auto-validate XML when draw.io files are edited") | Dialog→name→generation completes; valid-looking JSON opens |
| 3 | Run steering command inline (`Always use semantic versioning for git tags`) | Steering md created and opened |
| 4 | Run skill command ("Review code security vulnerabilities") | Folder+SKILL.md created recursively |
| 5 | Measure submit→file-visible time per command | Each ≤ 60 s (BO-1/SM-3); record actuals |

**Test Data:** fixtures above.
**Postconditions:** four configs live; screenshots to `evidence/SIT-01-*.png`.

---

### SIT-02: Editor-open visual review experience

| Field | Value |
|-------|-------|
| **ID** | SIT-02 |
| **Level** | SIT |
| **Priority** | Medium |
| **Type** | Manual UX — editor open test (visual half of FR-COMMON-03) |
| **Requirement** | BR-13, NFR-E1 perception |
| **Preconditions** | SIT-01 artifacts present |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Observe tab activation right after each write | Generated doc is ACTIVE tab within ~1 s; readable; no error modals |
| 2 | Confirm current mode is standard text editor (SA4E-190 pending) | Plain text/markdown/json editor used; flow unbroken (GAP-06 disposition noted) |

**Test Data:** existing artifacts.
**Postconditions:** screenshots per command.

---

### SIT-03: Hot-reload perceived timing and no-restart invariant (manual confirmation)

| Field | Value |
|-------|-------|
| **ID** | SIT-03 |
| **Level** | SIT |
| **Priority** | High |
| **Type** | Manual — hot-reload detection cross-check (complements E2E-UI-06) |
| **Requirement** | FR-COMMON-05, BR-17, SM-4 |
| **Preconditions** | Sidebar config panels visible; host NOT restarted since load |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Create one config of EACH type via commands | Each corresponding list gains entry promptly (~≤1 s feel); no reload prompt |
| 2 | Edit a generated steering file and save | List refreshes again on save (OpenInEditor→HotReloaded transition) |
| 3 | Observe throughout | No extension-host restart occurred |

**Test Data:** one fresh name per type.
**Postconditions:** evidence screenshots.

---

### SIT-04: Dual-tab vs fallback editor disposition record (TC-15)

| Field | Value |
|-------|-------|
| **ID** | SIT-04 |
| **Level** | SIT |
| **Priority** | Medium |
| **Type** | Manual compatibility — GAP-06 follow-up marker |
| **Requirement** | BR-13, TC-15 |
| **Preconditions** | SA4E-190 status = To Do (current) |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Generate any config; inspect editor kind | Standard text editor; ZERO console errors about missing custom editor |
| 2 | Log disposition in TEST-REPORT | Follow-up re-test recorded referencing SA4E-190 delivery |

**Test Data:** any fixture.
**Postconditions:** documented follow-up.

---

### SIT-05: Collision UX exploratory (TC-12)

| Field | Value |
|-------|-------|
| **ID** | SIT-05 |
| **Level** | SIT |
| **Priority** | Medium |
| **Type** | Manual — BR-12/GAP-05/OI-01 exploratory |
| **Requirement** | BR-12, ERR-CMD-06 |
| **Preconditions** | Existing `my-code-reviewer.md` from earlier run |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Re-run agent command choosing SAME confirmed name | Warning/collision surface appears (or rename offered); original NOT silently replaced |
| 2 | Explore choices if offered (cancel / confirm-or-rename) | Cancel preserves original bytes; confirm updates with explicit consent; rename creates distinct file |
| 3 | Record observed policy vs OI-01 status | Documented for PO review |

**Test Data:** sentinel-marked original.
**Postconditions:** original content recoverable either way.

---

### SIT-06: Permission-failure UX (write denied)

| Field | Value |
|-------|-------|
| **ID** | SIT-06 |
| **Level** | SIT |
| **Priority** | Medium |
| **Type** | Manual — ERR-CMD-05/07 (FSD TC-13) |
| **Requirement** | ERR-CMD-05, ERR-CMD-07, EF-04/EF-33 |
| **Preconditions** | `.code-intel/agents/` made read-only (Windows ACL deny-write or chmod 555) |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Run agent command attempt | Error toast `Failed to create agent: {OS reason}`; extension does NOT crash; chat usable |
| 2 | Skill variant with denied parent write | Error mentions skill; partial folder cleaned where possible or clearly reported |
| 3 | Restore permissions; retry once | Success path resumes normally |

**Test Data:** NAME-AGENT / NAME-SKILL.
**Postconditions:** permissions restored.

---

### SIT-07: Cancel/Esc ergonomics across both dialogs

| Field | Value |
|-------|-------|
| **ID** | SIT-07 |
| **Level** | SIT |
| **Priority** | Low |
| **Type** | Manual UX — EF-01/EF-02 cancel branches |
| **Requirement** | ERR-CMD-01/02 silent-abort semantics |
| **Preconditions** | Host idle |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Esc at description dialog ×4 commands | Silent abort each; no toasts; no files |
| 2 | Esc at name dialog after entering description | Silent abort; no artifacts; no orphan state |

**Test Data:** n/a.
**Postconditions:** clean workspace.

---

### SIT-08: Non-Latin (Vietnamese) end-to-end flow

| Field | Value |
|-------|-------|
| **ID** | SIT-08 |
| **Level** | SIT |
| **Priority** | Medium |
| **Type** | Manual — AF-05/TC-20/OI-09 exploration |
| **Requirement** | BR-04 fallback; UTF-8 handling |
| **Preconditions** | Copilot signed in (output language may vary — recorded, not judged) |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Run `/create-new-agent Một agent dịch tài liệu tiếng Việt` | Name dialog pre-filled with `agent-new`; user confirms or edits |
| 2 | Complete generation | File written UTF-8; Vietnamese description intact; flow completes normally |
| 3 | Note LLM output language behaviour | Recorded as OI-09 observation (not pass/fail) |

**Test Data:** DESC-VIETNAMESE; confirmed name `translator-agent`.
**Postconditions:** agent file present.

---

### SIT-09: Streaming perception with a long description

| Field | Value |
|-------|-------|
| **ID** | SIT-09 |
| **Level** | SIT |
| **Priority** | Low |
| **Type** | Manual UX — NFR-P4/P5 observation; OI-07 backlog input |
| **Requirement** | FSD §8.1 P4/P5 context; usability |
| **Preconditions** | Real LLM; long description (~1500 chars) prepared |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Submit ~1500-char description; observe responsiveness | No UI-thread freeze; generation ≤ 60 s or degradation noted for OI-06 timeout promotion |
| 2 | Record time-to-first-feedback impression | Qualitative notes for TL (OI-07 progress indicator need) |

**Test Data:** long release-management-agent description (~1500 chars).
**Postconditions:** notes appended to report.

---

### SIT-10: Cross-feature regression with SA4E-189 sidebar suite

| Field | Value |
|-------|-------|
| **ID** | SIT-10 |
| **Level** | SIT |
| **Priority** | Medium |
| **Type** | Manual regression |
| **Requirement** | BR-17 one-way contract; SA4E-189 unaffected |
| **Preconditions** | Pre-existing configs loaded at host start |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | After creating new configs verify legacy entries | No duplication/loss; ordering stable |
| 2 | Externally edit one legacy agent file and save | Watcher refresh still fires for external edits |
| 3 | Reload window deliberately; verify lists rebuild | Baseline SA4E-189 behaviours intact post-SA4E-193 usage |

**Test Data:** mixed legacy + new configs.
**Postconditions:** regression PASS recorded.

---

## 7. Requirements Traceability Matrix (RTM)

### 7.1 BRD Acceptance Criteria → Test Cases

| Requirement | Source (BRD §2.3) | Test Cases | Coverage |
|-------------|-------------------|------------|----------|
| CMD1-AC1 valid agent .md with all required FM fields | Story 1 AC1 | IT-01, E2E-EXT-02, PBT-02, UT-05 | ✅ |
| CMD1-AC2 LLM prompt includes Section 7 field specs | Story 1 AC2 | IT-01 step 4, SIT-01 (real-provider smoke) | ✅ |
| CMD1-AC3 schema validation before write | Story 1 AC3 | UT-06/07/13, IT-03, PBT-03/04 | ✅ |
| CMD1-AC4 file at `.code-intel/agents/{name}.md` | Story 1 AC4 | IT-01, E2E-EXT-02, PBT-04 containment | ✅ |
| CMD1-AC5 opens in editor post-write | Story 1 AC5 | E2E-EXT-02 step 3, IT-08, SIT-02 | ✅ |
| CMD1-AC6 hot-reload detects without restart | Story 1 AC6 | E2E-UI-06, SIT-03, IT-08 step 3 | ✅ |
| CMD2-AC1 valid hook JSON matching schema | Story 2 AC1 | E2E-EXT-03, IT-02 | ✅ |
| CMD2-AC2 JSON parse + field checks pre-write | Story 2 AC2 | UT-08, UT-09, IT-03 | ✅ |
| CMD2-AC3 conditional fields consistent | Story 2 AC3 | UT-10 matrix, PBT-03 | ✅ |
| CMD2-AC4 write + editor + hot-reload pickup | Story 2 AC4 | E2E-EXT-03, E2E-UI-06 | ✅ |
| CMD3-AC1 valid steering .md generated | Story 3 AC1 | E2E-EXT-04, SIT-01 step 3 | ✅ |
| CMD3-AC2 frontmatter optional; body always present | Story 3 AC2 | UT-11 step 1 (AF-23), IT-05 | ✅ |
| CMD3-AC3 schema validation; correct path | Story 3 AC3 | UT-11 steps 3–4, IT-03 | ✅ |
| CMD3-AC4 editor open + hot-reload immediate | Story 3 AC4 | E2E-EXT-04, SIT-03 | ✅ |
| CMD4-AC1 folder + SKILL.md with FM created | Story 4 AC1 | E2E-EXT-05, IT-04 | ✅ |
| CMD4-AC2 folder on demand, fresh-workspace safe | Story 4 AC2 | IT-04 steps 1 & 3 | ✅ |
| CMD4-AC3 SKILL.md validated; editor; hot-reload registers skill | Story 4 AC3 | UT-12, E2E-EXT-05, E2E-UI-06 step 4 | ✅ |

### 7.2 FSD Business Rules BR-01..BR-20

| Requirement | Source | Test Cases | Coverage |
|-------------|--------|------------|----------|
| BR-01 four command IDs exact | FSD §3.6 | E2E-EXT-01 | ✅ |
| BR-02 description mandatory, silent abort | FSD §3.6 | E2E-UI-03, SIT-07 | ✅ |
| BR-03 kebab-case regex enforcement | FSD §3.6 | E2E-UI-04, UT-04, PBT-04 | ✅ |
| BR-04 suggestion algorithm + fallback | FSD §3.6/§3.7.5 | UT-01/02/03, PBT-01 | ✅ |
| BR-05 fixed target paths only | FSD §3.6 | E2E-EXT-02..05, PBT-04 | ✅ |
| BR-06 mkdir recursive fresh-safe | FSD §3.6 | IT-04 | ✅ |
| BR-07 validate-before-write (GAP-01) | FSD §3.6 | UT-06..14, IT-03, PBT-03/05 | ✅ |
| BR-08 hook conditionals XOR | FSD §3.6/§3.7.2 | UT-10, PBT-03 matrix | ✅ |
| BR-09 hook allowed top-level keys | FSD §3.6 | UT-08 step 3 | ✅ |
| BR-10 steering inclusion enum | FSD §3.6 | UT-11 step 3 | ✅ |
| BR-11 bodies ≥1 non-empty line | FSD §3.6 | UT-07, UT-11 step 4, UT-12 step 3 | ✅ |
| BR-12 collision surfaced, no silent overwrite | FSD §3.6/GAP-05 | IT-06, SIT-05 | ✅ |
| BR-13 post-write auto-open graceful degradation | FSD §3.6 | E2E-EXT-02..05, IT-08, SIT-02/04 | ✅ |
| BR-14 fixed notification templates | FSD §3.8.4 | E2E-UI-05, E2E-EXT-08 | ✅ |
| BR-15 shared pipeline single code path | FSD §3.6/FR-COMMON-01 | IT-01..05 parameterized harness ×4 types | ✅ |
| BR-16 UTF-8, single complete write | FSD §3.6/TDD §6.6.3 | IT-05 | ✅ |
| BR-17 one-way hot-reload contract | FSD §3.6 | E2E-UI-06, SIT-10 | ✅ |
| BR-18 agent defaults phase/tools | FSD §3.6 | UT-05, PBT-02 | ✅ |
| BR-19 label derivation Title Case | FSD §3.6 | UT-05 step 1, PBT-02 step 3 | ✅ |
| BR-20 hook defaults version/enabled | FSD §3.6 | UT-14, E2E-EXT-03 step 2 | ✅ |

### 7.3 Error Codes ERR-CMD-01..09, D-register, Key Alternative Flows

| Requirement | Source | Test Cases | Coverage |
|-------------|--------|------------|----------|
| ERR-CMD-01 empty/cancelled description | FSD §9.1 | E2E-UI-03, SIT-07 | ✅ |
| ERR-CMD-02 invalid name inline message | FSD §9.1 | E2E-UI-04, UT-04 | ✅ |
| ERR-CMD-03 LLM unavailable transparent fallback | FSD §9.1 | IT-07 | ✅ |
| ERR-CMD-04 gate rejection, nothing written | FSD §9.1 | IT-03, UT-08/10, E2E-EXT-08 | ✅ |
| ERR-CMD-05 file write failure OS message | FSD §9.1 | SIT-06 | ✅ |
| ERR-CMD-06 collision warning | FSD §9.1 | IT-06, SIT-05 | ✅ |
| ERR-CMD-07 skill folder failure cleanup | FSD §9.1 | SIT-06 step 2 | ✅ |
| ERR-CMD-08 editor-failure warn-only (D-3) | FSD §9.1 | IT-08 | ✅ |
| ERR-CMD-09 duplicated-frontmatter normalize (D-1/GAP-02) | FSD §9.1 | UT-06, IT-07 step 2 | ✅ |
| D-2 fenced JSON normalization | FSD §11.4 | UT-09, IT-02, PBT-03 | ✅ |
| D-4 empty stream promotion | FSD §11.4 | UT-13, IT-03 run 3 | ✅ |
| D-5 skill/frontmatter name forcing | FSD §11.4 | UT-12, E2E-EXT-05 step 2 | ✅ |
| D-7 canonical serialization omission | FSD §11.4 | UT-14, PBT-05 | ✅ |
| AF-05 non-Latin naming | FSD UC-01 | UT-02, SIT-08 | ✅ |
| AF-23 steering frontmatter optional | FSD UC-03 | UT-11 step 1, E2E-EXT-04 | ✅ |

### 7.4 NFR §8.1 Quantified Targets & Common Requirements

| Requirement | Target | Test Cases | Coverage |
|-------------|--------|------------|----------|
| NFR-P2 name-suggestion latency | ≤ 5 ms | UT-01 step 2 | ✅ |
| NFR-P3 fallback submit→write | ≤ 100 ms p95 | IT-07 step 3 | ✅ |
| NFR-E1 editor visible after write | ≤ 1 s p95 | E2E-EXT-02 step 3 | ✅ |
| NFR-E2 hot-reload UI reflection | ≤ 1 s | E2E-UI-06 (×3), SIT-03 | ✅ |
| NFR-P7 artifact size envelopes | hooks ≤ 8 KB; md ≤ 16 KB | IT-01/02 harness size assertions | ✅ |
| SM-3 time-to-config < 60 s | BRD §6 | SIT-01 step 5 | ✅ |
| FR-COMMON-01 shared pipeline | one code path | IT-01..05 parameterized ×4 | ✅ |
| FR-COMMON-02 offline resilience | valid scaffold in every outage | IT-07 (F1/F2/F3) | ✅ |
| FR-COMMON-03 editor auto-open degrade gracefully | standard editor, zero errors | E2E-EXT-02..05, IT-08, SIT-04 | ✅ |
| FR-COMMON-04 notify every terminal outcome | fixed templates | E2E-UI-05, E2E-EXT-08 | ✅ |
| FR-COMMON-05 hot-reload ≤ 1 s no restart | watcher pickup | E2E-UI-06, SIT-03 | ✅ |

**Coverage Summary:**

| Category | Total | Covered | Coverage % |
|----------|-------|---------|------------|
| Use Cases (UC-01..04) | 4 | 4 | 100% |
| Acceptance Criteria (CMD1-6, CMD2-4, CMD3-4, CMD4-3) | 17 | 17 | 100% |
| Business Rules (BR-01..20) | 20 | 20 | 100% |
| Error Codes (ERR-CMD-01..09) | 9 | 9 | 100% |
| Discrepancy regressions (D-1..D-7) | 7 | 7 | 100% |
| FR-COMMON-01..05 | 5 | 5 | 100% |
| **Overall** | **62** | **62** | **100%** |

---

## 8. Appendix

### Appendix A — Test Data Files

Machine-readable fixtures mirroring the Shared Fixture Reference live in:

```
documents/SA4E-193/testdata/
```

**Test Data Files:**

| File | Rows | Covers | Referenced By |
|------|------|--------|---------------|
| `testdata/names-validation.csv` | 9 | BR-03/BR-04 name validation — kebab-case accept/reject, path traversal, empty input, fallback suggestion (`agent`), duplicate name, Vietnamese non-Latin input | PBT-01, PBT-04, UT-01..UT-06, IT-04, E2E-UI-04, SIT-07 |
| `testdata/hook-payloads.csv` | 6 | CMD2 hook JSON corpus — valid fileEdited hook (UT-08-valid), XOR violations askAgent-without-prompt / runCommand-without-command (BR-08), fenced JSON wrapper (D-2/UT-09), unknown top-level key (BR-09/UT-10), patterns on promptSubmit (UT-11) | UT-08, UT-09, UT-10, UT-11, IT-02, IT-03 |
| `testdata/frontmatter-cases.csv` | 5 | Frontmatter handling per config type — double frontmatter agent payload (D-1/UT-06-double), skill FM name mismatch (D-5/UT-12-mismatch), missing description (BR-11/UT-14), invalid steering inclusion enum (BR-10/UT-15-bad-phase), valid skill FM (UT-16) | UT-06, UT-11, UT-12, UT-14 |
| `testdata/e2e-scenarios.csv` | 4 | End-to-end scenarios for all four commands — command, description sample, expected name suggestion, expected output path under `.code-intel/`, editor-open flag | E2E-EXT-01..05, E2E-UI-01..06, SIT-01 |

**Total:** 4 files · **24 data rows** · every automated level (PBT/UT/IT/E2E) has at least one CSV-backed fixture row; manual SIT cases reference the same fixtures via the Shared Fixture Reference table.

### Appendix B — Environment Configuration Notes

- Vitest projects: `extension/src/test/*.test.ts` (UT/PBT), `extension/test/integration/*.it.test.ts` (IT), `extension/test/e2e/*.e2e.test.ts` (@vscode/test-electron).
- `vi.mock("vscode")` factory provides `window.showInputBox/showInformationMessage/showErrorMessage/showWarningMessage`, `workspace.openTextDocument/showTextDocument/workspaceFolders`, and fake `lm.selectChatModels`.
- Temp-workspace helper: `fs.promises.mkdtemp(path.join(os.tmpdir(), "sa4e193-"))`; seeding per `pre-seeded-data.csv`; teardown `rm -rf`.
- Timing assertions use polling waits (50–100 ms interval) with hard ceilings as stated per case.
- Playwright webview selectors prefer `data-testid` attributes (`slash-menu-item-{id}`, `chat-input`, `toast-container`) — to be added by DEV if absent.

### Appendix C — Defect Filing Conventions

- Title: `[SA4E-193][{LEVEL}-{ID}] short symptom`
- Body MUST include: failing test ID, fixture IDs, expected vs actual, evidence path under `documents/SA4E-193/evidence/`, D/GAP reference when applicable.
- Any reopened D-register regression is labelled `severity=Critical` regardless of user-visible impact (see STP §8.3).

---

*STC v2.0 — QA Agent, 2026-08-23. Ground truth: FSD v2.1 (UC-01..04, BR-01..20, ERR-CMD-01..09, TC-01..21, D-1..D-7), TDD v2.0 (ValidationGate design), BRD v2.0 acceptance criteria.*
