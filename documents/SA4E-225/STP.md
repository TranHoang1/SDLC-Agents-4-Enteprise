# Software Test Plan (STP)

## SDLC-Agents-4-Enterprise code-intel indexer — SA4E-225: Incomplete language support — Scala, C/C++, C#, Ruby, PHP, Swift, Bash, PowerShell lack parser/regex patterns for symbol extraction

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | SA4E-225 |
| Title | Incomplete language support: Scala, C/C++, C#, Ruby, PHP, Swift, Bash, PowerShell lack parser/regex patterns for symbol extraction |
| Author | QA Agent |
| Version | 1.0 |
| Date | 2026-08-28 |
| Status | Draft |
| Related BRD | documents/SA4E-225/BRD.md (v1.0) |
| Related FSD | documents/SA4E-225/FSD.md (v1.1 — TA-Enriched) |
| Related TDD | documents/SA4E-225/TDD.md (v1.0) |

---

## Author Tracking

| Role | Name - Position | Responsibility |
|------|-----------------|----------------|
| Author | QA Agent – QA Engineer | Create document |
| Peer Reviewer | To be assigned – Tech Lead / SA | Review document |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-08-28 | QA Agent | Initiate document — derived from BRD, FSD (TA-enriched), and TDD |

---

## Sign-Off

| Name | Signature and date |
|------|--------------------|
| | ☐ I agree and confirm the test plan in this STP |
| | ☐ I agree and confirm the test plan in this STP |

---

## 1. Introduction

### 1.1 Purpose

This Test Plan defines the verification strategy for Bug **SA4E-225** in the `code-intel` backend indexer (TypeScript). The change adds regex-based symbol-extraction pattern sets (`PatternDef[]`) for nine languages currently routed to `GENERIC_PATTERNS` only (Scala, C, C++, C#, Ruby, PHP, Swift, Bash, PowerShell), extends `extToLanguage()` routing, and un-skips PowerShell by adding `.ps1` to `DEFAULT_EXTENSIONS` and the mirrored `FALLBACK_EXTENSIONS`. The goal is to confirm each new language extracts the required distinct `SymbolKind` values from real samples, that PowerShell files are no longer skipped, that no regression is introduced to existing tree-sitter languages, and that the new regexes are ReDoS-safe and follow mandated spacing/guard conventions.

### 1.2 Test Objectives

- **OB-1:** Verify every new `PatternDef[]` set extracts the required number of distinct `SymbolKind` values (≥5 for 7 languages; Bash ≥3, PowerShell ≥4 per the TA-approved AC deviation).
- **OB-2:** Verify Scala `SCALA_PATTERNS` detects `object`, `trait`, `case class`, `sealed class`, `def`, `val` on a real Scala sample (BRD Story 1 AC1-3).
- **OB-3:** Verify `.ps1` files are indexed after `DEFAULT_EXTENSIONS` + `FALLBACK_EXTENSIONS` changes (BRD Story 4).
- **OB-4:** Verify no regression — the 9 fully-supported tree-sitter languages (typescript, javascript, python, kotlin, java, go, rust, apex, pega) and the existing `vitest` suite remain green.
- **OB-5:** Verify security conditions — C1 ReDoS regression (CI gate), C2 per-line/file size guard, C4 Swift modifier `\s+` spacing.
- **OB-6:** Verify maintainability — modified source files comply with the ≤200 line rule (split per-language where needed).

### 1.3 References

| Document | Location |
|----------|----------|
| BRD | documents/SA4E-225/BRD.md |
| FSD | documents/SA4E-225/FSD.md |
| TDD | documents/SA4E-225/TDD.md |
| signature-extractor.ts | backend/src/engine/parsers/signature-extractor.ts |
| tree-sitter-indexer.ts | backend/src/engine/parsers/tree-sitter-indexer.ts |
| config/index.ts | backend/src/config/index.ts |
| resolver.ts | backend/src/engine/indexer/project-type/resolver.ts |

> **Note on SECURITY-REVIEW.md:** No `SECURITY-REVIEW.md` exists in `documents/SA4E-225/`. The security conditions **C1, C2, C4** cited in this STP are taken from the task instruction and are corroborated by TDD §7 (Security Design) and TDD §12 (Test Plan table — TC-12 ReDoS) and FSD §9 (Error Handling). They are tracked as test cases TC-012 (C1), TC-013 (C2), TC-014 (C4).

---

## 2. Test Strategy

### 2.1 Test Levels

This change is an internal backend change (no HTTP API, no UI). All tests are automated unit/integration tests executed with **vitest** in-process. E2E-API and E2E-UI levels are **Not Applicable**.

| Level | Scope | Automation | Tools |
|-------|-------|------------|-------|
| UT (Unit) | `extractSymbols(src, lang)` per-language pattern sets; ReDoS (C1); size-guard (C2); Swift spacing (C4) | Automated | vitest |
| IT (Integration) | `.ps1` un-skip via `DEFAULT_EXTENSIONS` + `extToLanguage()` routing (in-process indexer/config) | Automated | vitest |
| Regression | Existing `signature-extractor.test.ts` + `languages/__tests__/*` + tree-sitter language parsers | Automated | vitest (`npm test`) |
| PBT | Not planned (no property-based requirements for this ticket) | — | — |
| E2E-API | N/A — no REST endpoint added | — | — |
| E2E-UI | N/A — no UI change | — | — |
| SIT | Optional manual smoke of a real mixed-language repo index (not required for sign-off) | Manual (optional) | — |

**STP Test Cases Summary Table:**

| Level | Count | Automated | Manual |
|-------|-------|-----------|--------|
| UT | 12 | 12 | 0 |
| IT | 1 | 1 | 0 |
| Regression | 1 | 1 | 0 |
| SIT | 0 | 0 | 0 |
| **Total** | **14** | **14 (100%)** | **0 (0%)** |

> Note: TC-015 (file-size ≤200 lines) is a structural/static vitest check counted under UT in the table above (total 14 = TC-001..TC-014 + TC-015). See §2.6 for the full mapping.

### 2.2 Test Types

| Type | Description | Applicable |
|------|-------------|------------|
| Functional Testing | Per-language symbol extraction; `.ps1` indexing | Yes |
| Regression Testing | Existing languages + suite remain green | Yes |
| Security Testing | ReDoS (C1), size guard (C2) | Yes |
| Performance Testing | Bounded extraction time on degenerate/large input (C1, C2) | Yes |
| Usability / Compatibility | N/A | No |

### 2.3 Test Approach

- **Risk-based, automation-first.** Every acceptance criterion and security condition is covered by an automated vitest test. No criterion relies on manual SIT for sign-off.
- **Fixture-driven.** Each language unit test feeds a **real, curated sample source snippet** to `extractSymbols(content, "<lang>")` and asserts the set of distinct `SymbolKind` values (not just that *some* symbol is found).
- **Reuse of existing harness.** Tests extend `backend/src/engine/parsers/__tests__/signature-extractor.test.ts` and/or add per-language files under `backend/src/engine/parsers/languages/__tests__/` to honor the ≤200-line rule (TDD §5.1).
- **Regression gate.** The existing `vitest` suite is executed as a whole (TC-011); any failure blocks sign-off.
- **CI gate for ReDoS (C1).** TC-012 is treated as a mandatory CI gate — it must pass before merge.

### 2.4 Entry Criteria

| Level | Entry Criteria |
|-------|---------------|
| UT / IT / Regression | Source changes present (signature-extractor.ts or languages/*, tree-sitter-indexer.ts extToLanguage, config/index.ts DEFAULT_EXTENSIONS, resolver.ts FALLBACK_EXTENSIONS); `vitest` installed; build/typecheck passes. |
| SIT (optional) | A sample multi-language repo available locally; indexer runnable via `npm run dev`/tsx. |

### 2.5 Exit Criteria

| Level | Exit Criteria |
|-------|---------------|
| UT / IT / Regression | 100% of the 14 automated test cases executed; **0 Critical/High failures** (TC-001..TC-004, TC-011, TC-012 must all pass); ≤1 Medium failure open with documented waiver. |
| C1 (ReDoS) | TC-012 green in CI — mandatory gate. |
| Regression | Existing suite green; 9 tree-sitter languages unaffected (TC-011). |

### 2.6 Acceptance Criteria & Security Condition → Test Case Mapping

| # | Acceptance Criterion / Condition | Source | Covering Test Cases |
|---|----------------------------------|--------|---------------------|
| AC-1 | `SCALA_PATTERNS` detects object, trait, case class, sealed class, def, val on a real Scala sample | BRD Story 1 AC1-3 | TC-001 |
| AC-2 | Each new language pattern set unit-tested with sample source, extracts ≥5 distinct kinds — **except Bash ≥3 and PowerShell ≥4** (TA deviation) | BRD Story 2/3; FSD §3.3.3; TDD §12 | TC-001 (Scala, 6), TC-002 (C, 6), TC-003 (C++, 6), TC-004 (C#, 7), TC-005 (Ruby, 5), TC-006 (PHP, 6), TC-007 (Swift, ≥5), TC-008 (Bash, 3 — deviated), TC-009 (PowerShell, 4 — deviated) |
| AC-3 | PowerShell files indexed after adding `.ps1` to `DEFAULT_EXTENSIONS` | BRD Story 4 AC1-2 | TC-010 |
| AC-4 | No regression: existing tree-sitter languages unaffected; existing tests pass | BRD Story 5 AC1-3 | TC-011 |
| AC-5 | Each new/modified source file ≤ 200 lines (split per-language if needed) | BRD Story 5 / BR-24 | TC-015 |
| C1 | ReDoS regression — degenerate long-line input per language (especially C#) must not hang/explode | SECURITY (task) / TDD §7/§12 | TC-012 (mandatory CI gate) |
| C2 | Per-line/file size guard present before `matchAll` | SECURITY (task) / TDD §7 | TC-013 |
| C4 | Swift modifier group must use `\s+` so `public class Foo` matches | SECURITY (task) | TC-014 |

---

## 3. Test Scope

### 3.1 Features In Scope

| # | Feature / Story | Priority | FSD Reference | Test Type | Test Cases |
|---|----------------|----------|---------------|-----------|------------|
| 1 | Scala symbol extraction | MUST | UC-1, BR-1..BR-5 | Functional (UT) | TC-001 |
| 2 | C / C++ / C# symbol extraction | HIGH | UC-2, BR-6..BR-11 | Functional (UT) | TC-002, TC-003, TC-004 |
| 3 | Ruby / PHP / Swift / Bash / PowerShell extraction | MEDIUM | UC-3, BR-12..BR-19 | Functional (UT) | TC-005, TC-006, TC-007, TC-008, TC-009 |
| 4 | PowerShell `.ps1` indexing | MEDIUM | UC-4, BR-20..BR-21 | Integration (IT) | TC-010 |
| 5 | No regression & maintainability | MUST | BR-22..BR-25 | Regression + Static | TC-011, TC-015 |
| 6 | Security: ReDoS (C1), size guard (C2), Swift spacing (C4) | MUST/REC | TDD §7/§12 | Security/Non-Func | TC-012, TC-013, TC-014 |

### 3.2 Features Out of Scope

| # | Feature | Reason |
|---|---------|--------|
| 1 | Tree-sitter WASM grammar integration (Phase 4) | Explicitly out of scope per BRD §1.2 / FSD §1.2 |
| 2 | SQL (`.sql`) symbol extraction | Out of scope per BRD §1.2 |
| 3 | Config/data format parsing (yaml/json/toml) | Indexed for search only; no symbol extraction |
| 4 | UI/UX changes | None — backend-only change |
| 5 | `grammar-config.json` / `grammar-registry.ts` edits | TA R5: intentionally unchanged (TDD §1.2) |
| 6 | `SymbolKind` union extension | TA R3: union stays closed (TDD §5.2) |

---

## 4. Test Environment

### 4.1 Environment Requirements

| Environment | URL / Path | Purpose |
|-------------|-----------|---------|
| Local / CI | `backend/` (TypeScript, vitest) | Unit & integration test execution |

- **Runtime:** Node.js (same as backend), `vitest` configured in `backend`.
- **Build/run:** `npx vitest run` (or `npm test`) from `backend/`.
- No database, no external service, no browser required.

### 4.2 Test Data Requirements

| Data Type | Description | Source | Preparation |
|-----------|-------------|--------|-------------|
| Per-language source fixtures | Real sample snippets for Scala, C, C++, C#, Ruby, PHP, Swift, Bash, PowerShell | Curated inline in STC Test Data (or `languages/__tests__/fixtures/`) | Supplied in STC; devs may persist as fixture files |
| Degenerate long-line input | 100k-char single-line strings to stress ReDoS/size guard | Generated in-test (TC-012, TC-013) | Built dynamically in the test |

### 4.3 External Dependencies

| System | Dependency | Mock/Stub Available |
|--------|-----------|---------------------|
| None | N/A | N/A — pure in-process regex matching |

---

## 5. Test Schedule (Estimated)

| Phase | Start | End | Duration | Milestone |
|-------|-------|-----|----------|-----------|
| Test Planning (STP/STC) | 2026-08-28 | 2026-08-28 | 1d | STP + STC approved |
| Test Implementation | 2026-08-29 | 2026-08-29 | 1d | TC-001..TC-015 written |
| Test Execution | 2026-08-29 | 2026-08-30 | 1–2d | All automated tests green; ReDoS gate green |
| Defect Fix & Retest | 2026-08-30 | 2026-08-31 | 1d | 0 Critical/High open |

---

## 6. Resources & Responsibilities

| Role | Name | Responsibility |
|------|------|---------------|
| Test Lead / QA | QA Agent | STP/STC authoring, execution, reporting |
| Developer | Unassigned (DEV) | Implement pattern sets, routing, config; fix defects |
| BA | BA Agent | Clarify acceptance criteria (Scala MUST, deviations) |
| SA | SA Agent | Confirm TA decisions (extToLanguage canonical, no grammar-config change) |
| DevOps | DevOps Agent | Ensure vitest + ReDoS gate run in CI |

---

## 7. Risk & Mitigation

| # | Risk | Impact | Likelihood | Mitigation |
|---|------|--------|------------|-----------|
| 1 | New regexes cause ReDoS / catastrophic backtracking (esp. C# free-function negative-lookahead) | High | Medium | Anchored `^`+`m`, linear patterns (TDD §7); TC-012 mandatory CI gate; TC-013 size guard |
| 2 | `signature-extractor.ts` exceeds 200 lines | Medium | Medium | Split into `languages/*.ts`; TC-015 enforces the rule |
| 3 | False positives (e.g., Swift `public class` not matched due to missing `\s+`) | Medium | Medium | TC-014 asserts `public class Foo` matches |
| 4 | `.ps1` added but `POWERSHELL_PATTERNS` missing → degraded extraction | Medium | Low | TC-009 + TC-010 ship together; both asserted |
| 5 | `.h` parsed as C not C++ (known limitation L1) | Low | — | Documented; no test required (TDD §10.4) |
| 6 | Regression to existing tree-sitter languages | High | Low | TC-011 runs full suite; 9 languages asserted |

---

## 8. Defect Management

### 8.1 Severity Levels

| Severity | Definition | Example |
|----------|-----------|---------|
| Critical | Indexer crash / ReDoS hang on real input | TC-012 fails (catastrophic backtrack) |
| Major | A required language/kind not extracted; `.ps1` still skipped | TC-001 fails; TC-010 fails |
| Minor | Extra noise symbol / minor false positive | Lower-priority kind mismatch |
| Trivial | Typo in test fixture | — |

### 8.2 Priority Levels

| Priority | Definition | SLA |
|----------|-----------|-----|
| P1 | Must fix before merge (Critical/Major on MUST/HIGH langs or C1) | Before merge |
| P2 | Must fix before release (Medium langs, C2/C4) | 1 business day |
| P3 | Should fix if time permits | 3 business days |
| P4 | Nice to fix | Next release |

### 8.3 Defect Lifecycle

```
New → Open → In Progress → Fixed → Ready for Retest → Verified → Closed
                                                      → Reopened → In Progress
```

---

## 9. Test Metrics & Reporting

### 9.1 Metrics

| Metric | Formula | Target |
|--------|---------|--------|
| Test Execution Rate | Executed / Total × 100% | 100% |
| Pass Rate | Passed / Executed × 100% | ≥ 95% |
| Defect Density | Defects / Test Cases | ≤ 0.1 |
| Critical/High Defect Count | Count | 0 |
| ReDoS Gate (C1) | TC-012 status | Must PASS in CI |

### 9.2 Reporting Schedule

| Report | Frequency | Audience |
|--------|-----------|----------|
| Test Completion Report | End of execution | All stakeholders (attached to SA4E-225) |
| Defect Summary | On discovery | Dev team |

---

## 10. Appendix

### 10.1 Regression Strategy (Detail)

1. **Full-suite execution:** `npx vitest run` from `backend/` — all existing `*.test.ts` must pass. Any failure = regression defect (P1).
2. **Targeted tree-sitter assertion:** a focused vitest block calls `extractSymbols` on curated samples for `typescript`, `javascript`, `python`, `kotlin`, `java`, `go`, `rust`, `apex`, `pega` and asserts the previously-validated kinds are still returned (guards against silent re-routing to `GENERIC_PATTERNS`).
3. **Pattern relocation safety:** because TDD §5.1 relocates the 7 existing `PatternDef[]` consts into `languages/builtin.ts`, TC-011 also confirms those languages still resolve (no import/registration gap — R6 mitigation).
4. **ReDoS gate (C1):** TC-012 is a blocking CI check; a hang/timeout fails the build.

### 10.2 Glossary

| Term | Definition |
|------|------------|
| `PatternDef` | `{ regex, kind, nameGroup, signatureGroup? }` in signature-extractor.ts |
| `SymbolKind` | Closed union of 12 symbol categories |
| `extractSymbols` | Engine entry: `extractSymbols(content, language) → ExtractedSymbol[]` |
| `extToLanguage` | Canonical ext→id router for regex-only languages (TDD §5.4) |
| `DEFAULT_EXTENSIONS` | In-code array gating which extensions are indexed (config/index.ts) |
| `FALLBACK_EXTENSIONS` | Mirrored gate in resolver.ts (TDD §5.6) |
| ReDoS | Regular-expression Denial of Service (catastrophic backtracking) |

### 10.3 Assumptions

- Languages are already recognized by `detectLanguage()`; the fix adds regex sets + routing + `.ps1` only (FSD §2.4).
- `vitest` is the test runner and is already configured in `backend`.
- Sample fixtures can be inlined in tests or persisted under `languages/__tests__/fixtures/`.
