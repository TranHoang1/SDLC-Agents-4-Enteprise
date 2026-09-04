# 🔒 Security Assessment Report

> **Phase 5.7 — Implementation (Code) Security Review**
> Adapted from `documents/templates/SECURITY-REPORT-TEMPLATE.md`

## Document Information

| Field | Value |
|-------|-------|
| Project | SDLC-Agents-4-Enterprise — code-intel indexer |
| Ticket | SA4E-225 |
| Scope | Implemented regex symbol-extraction for 9 languages + PowerShell `.ps1` indexing |
| Review Type | Code review (static analysis of implemented source) |
| Date | 2026-08-28 |
| Assessor | Security Agent |
| Version | 1.0 |

## Files Reviewed

| File | Relevance |
|------|-----------|
| `backend/src/engine/parsers/signature-extractor.ts` | Engine: `getPatterns`, `matchAll` call, size guard (C2) |
| `backend/src/engine/parsers/languages/scala.ts` | New patterns |
| `backend/src/engine/parsers/languages/c.ts` | New patterns |
| `backend/src/engine/parsers/languages/cpp.ts` | New patterns |
| `backend/src/engine/parsers/languages/csharp.ts` | New patterns (template-built) |
| `backend/src/engine/parsers/languages/ruby.ts` | New patterns |
| `backend/src/engine/parsers/languages/php.ts` | New patterns |
| `backend/src/engine/parsers/languages/swift.ts` | New patterns (template-built, C4) |
| `backend/src/engine/parsers/languages/bash.ts` | New patterns |
| `backend/src/engine/parsers/languages/powershell.ts` | New patterns |
| `backend/src/engine/parsers/languages/builtin.ts` | Relocated 7 existing consts |
| `backend/src/engine/parsers/languages/index.ts` | `LANGUAGE_PATTERNS` barrel |
| `backend/src/engine/parsers/tree-sitter-indexer.ts` | `extToLanguage` routing (lines 112-128) |
| `backend/src/config/index.ts` | `DEFAULT_EXTENSIONS` (`.ps1` added, line 27) |
| `backend/src/engine/indexer/project-type/resolver.ts` | `FALLBACK_EXTENSIONS` (`.ps1` added, line 23) |
| `backend/src/engine/parsers/__tests__/sa4e-225-language-extraction.test.ts` | STC TC-001..TC-015 |

## Executive Summary

The implemented SA4E-225 change was reviewed line-by-line for the primary risk vector — **ReDoS** — plus general injection, input-validation, and configuration concerns. All 9 new `PatternDef[]` sets, the relocated builtins, the routing table, and the config/extension changes were inspected. The design-phase conditions **C1 (ReDoS CI gate), C2 (size guard), C3 (no grammar-config entries), and C4 (Swift `\s+`)** are all **confirmed implemented in code**.

No `new RegExp(userInput)` was found anywhere in the reviewed code; file content is exclusively the **match subject**, never compiled into a pattern. All new regexes are anchored (`^`), run under the forced `gm` flag, use linear character classes, and where needed exclude control keywords via single linear negative lookaheads. The per-line size guard (C2) caps `matchAll` input at 8192 chars/line, eliminating the multi-megabyte single-line ReDoS vector entirely.

**Overall Risk Rating:** 🔵 **Low**

| Severity | Count |
|----------|-------|
| 🔴 Critical | 0 |
| 🟠 High | 0 |
| 🟡 Medium | 0 |
| 🔵 Low | 0 |
| ℹ️ Informational | 2 (keep C1 CI gate permanent; minor backtracking note on C# property pattern) |

## Review Verdict

### ✅ APPROVED

All four design-phase security conditions are satisfied in the implementation, and no open vulnerability (ReDoS, injection, misconfiguration, or otherwise) was identified. One **informational** hardening recommendation remains: keep TC-012 (C1) as a permanent required CI gate and consider a periodic ReDoS linter over `languages/*.ts`.

## Findings by OWASP Top 10 (2021)

### A01:2021 — Broken Access Control
No issues found ✅

### A02:2021 — Cryptographic Failures
No issues found ✅

### A03:2021 — Injection
No issues found ✅ — **Verified**: the only `new RegExp(...)` on match data is `new RegExp(pattern.regex, 'gm')` at `signature-extractor.ts:64`, where `pattern.regex` is a **static** literal/constant. File `content` is passed only as the `matchAll` subject, never compiled. No regex-injection (CWE-1333-style tainted-pattern) vector exists.

### A04:2021 — Insecure Design
No issues found ✅ — ReDoS considered and mitigated.

### A05:2021 — Security Misconfiguration
No issues found ✅ — `grammar-config.json` unchanged for the 9 languages (C3); `extToLanguage` is the sole router (no double-routing).

### A06:2021 — Vulnerable and Outdated Components
No issues found ✅ — no new dependencies.

### A07:2021 — Identification and Authentication Failures
N/A ✅

### A08:2021 — Software and Data Integrity Failures
No issues found ✅

### A09:2021 — Security Logging and Monitoring Failures
ℹ️ Informational — TC-012 (C1) must remain an enforced CI gate (see Recommendations).

### A10:2021 — Server-Side Request Forgery (SSRF)
No issues found ✅

## Detailed Findings

### Finding #1: All 9 new regexes are ReDoS-safe (verified) — ✅ PASS

| Attribute | Value |
|-----------|-------|
| **Severity** | ℹ️ Informational (positive control) |
| **OWASP Category** | CWE-1333 (mitigated) |
| **Location** | `languages/{scala,c,cpp,csharp,ruby,php,swift,bash,powershell}.ts` |
| **Status** | Closed |

**Verification matrix (per pattern):**

| Language | Anchored `^` | `m`/`gm` | Nested quantifiers | Dangerous alternation | Control-kw guard | Verdict |
|----------|-------------|----------|--------------------|------------------------|--------------------|---------|
| scala | ✅ | ✅ | none | none (keyword alternation only) | n/a | **Safe** |
| c | ✅ | ✅ | none (`(?:\w+\s+)+` uses disjoint `\w`/`\s` → deterministic partition, linear) | none | function-like `#define` ordering | **Safe** |
| cpp | ✅ | ✅ | none | none | ✅ negative lookahead `(?!if\|for\|...)` | **Safe** |
| csharp | ✅ (template) | ✅ | none (`(X+)*` groups with disjoint keyword classes) | none (keyword alternation) | ✅ negative lookahead `(?!if\|for\|...)` | **Safe** |
| ruby | ✅ | ✅ | none | none | n/a | **Safe** |
| php | ✅ | ✅ | none | none | n/a | **Safe** |
| swift | ✅ (template) | ✅ | none | none | n/a | **Safe** |
| bash | ✅ | ✅ | none | none | ✅ negative lookahead `(?!if\|for\|...)` | **Safe** |
| powershell | ✅ (`param` pattern intentionally unanchored but uses lazy `[^)]*?`) | ✅ | none | none | n/a | **Safe** |

**Conclusion:** No pattern contains `(X+)+`, `(X*)*`, or overlapping-alphabet alternations that would enable exponential backtracking. The only construct with the highest theoretical backtracking cost is the C# property pattern `[\w<>\\[\],\s\.\?]+\s+(\w+)\s*\{\s*(?:get|set|init)` (`languages/csharp.ts:22`) — `(X+)\s+(Y+)` where `X` includes `\s`. This is at most **quadratic** and is fully bounded by the C2 line-length guard (8192 chars), so it cannot reach catastrophic (exponential) behavior. TC-012 (100k-char line) exercises exactly this class and asserts `< 1500 ms`.

### Finding #2: No `new RegExp(userInput)` — file content is match subject only — ✅ PASS

| Attribute | Value |
|-----------|-------|
| **Location** | `signature-extractor.ts:64` |
| **Status** | Closed |

**Evidence:**
```typescript
// signature-extractor.ts:64 — matchAll subject is `content` (file text), NOT a compiled pattern
const matches = content.matchAll(new RegExp(pattern.regex, 'gm'));
```
`pattern.regex` is sourced from static `PatternDef[]` constants (`languages/*.ts`). For C#/Swift it is built once via `new RegExp(\`^${CS_PREFIX}...\`, 'm')` where `CS_PREFIX`/`SWIFT_PREFIX` are **hard-coded string constants**, not runtime input. The indexed source `content` is only ever the second argument (the haystack), so an attacker who controls repo contents cannot influence the regex engine's compiled pattern.

### Finding #3: Per-line size guard (C2) present and correct — ✅ PASS

| Attribute | Value |
|-----------|-------|
| **Location** | `signature-extractor.ts:35-40, 48-51` |
| **Status** | Closed |

**Evidence:**
```typescript
const MAX_LINE_LENGTH = 8192; // line 40
...
const lines = content.split('\n');
// C2 size guard: blank out oversized lines so matchAll operates on bounded input.
const safeContent = lines
  .map((line) => (line.length > MAX_LINE_LENGTH ? '' : line))
  .join('\n');
```
The guard runs **before** any `matchAll`. A 5 MB single line is blanked → `extractSymbols` returns `[]` in bounded time (TC-013 asserts `< 2000 ms` and `length === 0`). This is the primary hard cap that makes residual quadratic patterns (Finding #1 note) non-exploitable.

### Finding #4: Swift `\s+` modifier spacing (C4) implemented — ✅ PASS

| Attribute | Value |
|-----------|-------|
| **Location** | `languages/swift.ts:13, 16-23`; tests `TC-014` |
| **Status** | Closed |

**Evidence:**
```typescript
// swift.ts:13 — modifier group REQUIRES a trailing space
const SWIFT_PREFIX = '(?:@\\w+\\s+)*(?:(?:final|open|public|internal|private|fileprivate|static)\\s+)*';
// swift.ts:16
{ regex: new RegExp(`^${SWIFT_PREFIX}class\\s+(\\w+)`, 'm'), kind: 'class', nameGroup: 1 },
```
`public class Foo` → matches (`class` captured). `publicclass Foo` → the modifier group fails (no space after `public`) and literal `class` is never reached → **no false match** (TC-014 step 4 asserts `has('Foo','class') === false`). C4 satisfied.

### Finding #5: Routing & config changes correct — ✅ PASS

| Attribute | Value |
|-----------|-------|
| **Location** | `tree-sitter-indexer.ts:112-128`, `config/index.ts:27`, `resolver.ts:23`, `languages/index.ts:23-37`, `grammar-config.json` |
| **Status** | Closed |

- `extToLanguage()` (lines 112-128) returns `scala|c|cpp|csharp|ruby|php|swift|bash|powershell` for the 9 new extensions + `.ps1`→`powershell`. ✅
- `DEFAULT_EXTENSIONS` (`config/index.ts:27`) and `FALLBACK_EXTENSIONS` (`resolver.ts:23`) both contain `.ps1`. ✅
- `LANGUAGE_PATTERNS` barrel (`languages/index.ts:23-37`) maps all 16 ids; `typescript…apex` relocated from `signature-extractor.ts` into `builtin.ts` (engine-only file is 141 lines, well under 200 — BR-24). ✅
- `grammar-config.json` verified to contain **none** of the 9 new languages → R5/C3 closed (no phantom `parserModule` import). ✅

### Finding #6 (Informational): Keep C1 as a permanent CI gate — recommended

TC-012 (`sa4e-225-language-extraction.test.ts:349-365`) feeds `'a'.repeat(100_000) + '('` to all 9 languages and asserts completion in `< 1500 ms`. This must be a **required** CI check (not merely a unit test that can be skipped) so a future pattern edit cannot reintroduce catastrophic backtracking.

## Dependency Vulnerabilities

| Dependency | Current Version | CVE | Severity | Fixed In |
|-----------|----------------|-----|----------|----------|
| (none introduced by SA4E-225) | — | — | — | — |

## Security Headers Assessment

N/A — this change exposes no HTTP endpoint; security headers are not applicable to an in-process indexer.

| Header | Status | Recommendation |
|--------|--------|----------------|
| Strict-Transport-Security | N/A | Not applicable (no listener added) |
| Content-Security-Policy | N/A | Not applicable |
| X-Content-Type-Options | N/A | Not applicable |
| X-Frame-Options | N/A | Not applicable |
| Referrer-Policy | N/A | Not applicable |
| Permissions-Policy | N/A | Not applicable |

## Remediation Priority

| Priority | Finding | Effort | Impact |
|----------|---------|--------|--------|
| 1 | (None open) — informational: keep TC-012 CI gate permanent | Low | Prevents future ReDoS regressions |
| 2 | (None open) — optional: periodic ReDoS linter over `languages/*.ts` | Low | Early detection of unsafe patterns |

## Recommendations Summary

### Immediate Actions (Critical/High)
- None required — no open Critical/High findings.

### Short-term Improvements (Medium)
- None required.

### Long-term Hardening (Low/Informational)
1. **C1 permanence** — ensure `sa4e-225-language-extraction.test.ts` TC-012 is part of the required CI pipeline (fail-closed on timeout).
2. **ReDoS linter** — add `safe-regex` / `vuln-regex-detector` to pre-commit or CI for `languages/*.ts` so newly added patterns are automatically vetted.
3. **FSD doc fix** (C3 follow-up) — BA/TA to reconcile FSD §1.2 / §2.2 ("add grammar-config entries") with the superseding §2.4.2; code is correct, only the document text is inconsistent.

## Positive Security Controls ✅

- All 9 + 7 relocated patterns anchored `^` + forced `gm`; linear, no nested overlapping quantifiers.
- Negative-lookahead control-keyword exclusions in C/C++/C#/Bash prevent false positives without dangerous alternations.
- **C2 size guard** (`MAX_LINE_LENGTH = 8192`) blanks oversized lines before `matchAll` — hard ReDoS cap.
- **C4** Swift modifier `\s+` spacing eliminates modifier-smearing false matches.
- `extToLanguage` is the single canonical router; `grammar-config.json` untouched (no phantom parser import).
- Symbols limited to `name.length <= 100` and `signature.slice(0, 500)` (`signature-extractor.ts:69,74`) — bounded output.

## Appendix

### A. Tools & Methodology
- Manual static source review of all listed files (`read`/`grep`/`bash` only; no source modification).
- ReDoS analysis: anchoring, flag application (`new RegExp(re, 'gm')`), quantifier nesting, alternation overlap, lookahead linearity, disjoint character-class partitioning.
- Cross-check of implementation against design conditions C1–C4 and STC TC-001..TC-015.

### B. Scope Limitations
- Static analysis only; the CI pipeline itself was not executed (TC-012/TC-013 timing was verified by reading the test assertions, not by running them).
- Pre-existing `new RegExp(...)` usages in `languages/salesforce-markup/shared.ts`, `languages/salesforce-meta/helpers.ts`, and `ignore/ignore-parser.ts` build patterns from **metadata tag names** (bounded, non-user-regex) and are **out of scope** for SA4E-225; they were noted but not flagged as defects.

### C. Severity Classification
| Severity | CVSS Range | Criteria |
|----------|-----------|----------|
| Critical | 9.0-10.0 | RCE, auth bypass, full breach |
| High | 7.0-8.9 | Privilege escalation, significant data exposure |
| Medium | 4.0-6.9 | DoS requiring local/repo access |
| Low | 0.1-3.9 | Minimal impact |
| Informational | 0.0 | Best-practice / defense-in-depth |

### D. Glossary
- **ReDoS**: Regular Expression Denial of Service (CWE-1333).
- **PatternDef**: `{ regex, kind, nameGroup, signatureGroup? }` contract.
- **extToLanguage**: canonical ext→id router for regex-only languages.
- **C1/C2/C3/C4**: SA4E-225 security conditions from the Phase 3.7 design review.
