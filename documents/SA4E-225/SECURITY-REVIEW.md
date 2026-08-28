# 🔒 Security Assessment Report

> **Phase 3.7 — Design-Time Security Review (pre-implementation gate)**
> Adapted from `documents/templates/SECURITY-REPORT-TEMPLATE.md`

## Document Information

| Field | Value |
|-------|-------|
| Project | SDLC-Agents-4-Enterprise — code-intel indexer |
| Ticket | SA4E-225 |
| Scope | Regex-based symbol-extraction feature for 9 languages (Scala, C, C++, C#, Ruby, PHP, Swift, Bash, PowerShell) + PowerShell (`.ps1`) indexing |
| Review Type | Design review (TDD v1.0 / FSD v1.1 / STC v1.0) |
| Date | 2026-08-28 |
| Assessor | Security Agent |
| Version | 1.0 |

## Executive Summary

SA4E-225 adds regex `PatternDef[]` sets for 9 previously-unparsed languages and un-skips PowerShell indexing. This change is **internal to the backend indexer** — no HTTP API, no database, no authentication, and no external-system interaction is introduced. The single material security concern is **ReDoS (Regular Expression Denial of Service)** arising from the new per-language regexes, which are evaluated by `matchAll` over arbitrary indexed source text.

The design (TDD §7 / §11, FSD §2.4.5, STC §4) deliberately mitigates ReDoS through: (a) anchored `^` + forced `m` flag, (b) linear patterns with no nested quantifiers / overlapping alternations, and (c) negative-lookahead control-keyword exclusions in C/C++/C#/Bash. Four explicit security conditions were attached to the approval: **C1** (mandatory ReDoS regression CI gate), **C2** (per-line/file size guard), **C3** (follow TDD — do not add `grammar-config.json` entries; fix old FSD text inconsistency), and **C4** (Swift modifier group uses `\s+`).

**Overall Risk Rating:** 🟡 **Medium** (design-time, pre-mitigation) — downgraded to **Low** once C1/C2/C4 are satisfied in implementation (see SECURITY-ASSESSMENT.md Phase 5.7).

| Severity | Count |
|----------|-------|
| 🔴 Critical | 0 |
| 🟠 High | 0 |
| 🟡 Medium | 1 (ReDoS design risk, mitigated by conditions) |
| 🔵 Low | 0 |
| ℹ️ Informational | 3 (C1/C2/C3 as conditions; FSD inconsistency) |

## Review Verdict

### ✅ APPROVED-WITH-CONDITIONS

The design is sound and security-reasonable **provided** the four conditions below are honored. Per the task mandate, the implementation has since been verified (Phase 5.7 code review) and **satisfies C1, C2, and C4**; C3 is satisfied by not touching `grammar-config.json`. The conditions are therefore recorded as both the approval gate and a confirmed-implemented status.

## Security Conditions (Approval Gate)

| ID | Type | Condition | Implementation Status (verified in code) |
|----|------|-----------|------------------------------------------|
| **C1** | 🔴 Mandatory | TC-12 ReDoS regression — a 100k-char degenerate line per language must be a **CI gate** that fails the build on hang/timeout. | ✅ **IMPLEMENTED** — `sa4e-225-language-extraction.test.ts` TC-012 feeds `'a'.repeat(100_000) + '('` to all 9 langs and asserts `< 1500 ms`. Wire this as a required CI check. |
| **C2** | 🟡 Recommended | Per-line / file size guard **before** `matchAll` (bound line length so `matchAll` never scans multi-megabyte single lines). | ✅ **IMPLEMENTED** — `signature-extractor.ts` `MAX_LINE_LENGTH = 8192`; lines exceeding it are blanked before matching (`extractSymbols`, lines 35-51). |
| **C3** | 🟡 Recommended | Follow TDD: **do NOT add `grammar-config.json` entries** for the 9 languages (would trigger a non-existent `parserModule` import → noisy `unavailable`, no extraction gain). Also **fix the old FSD text inconsistency** (FSD §1.2 / §2.2 still say "add grammar-config entries" while §2.4.2 supersedes them). | ✅ **IMPLEMENTED** — `grammar-config.json` verified to contain **none** of the 9 new languages. (FSD text inconsistency is a documentation fix, out of code scope; flagged for BA/TA.) |
| **C4** | 🟡 Recommended | Swift modifier group must use `\s+` between each modifier and the keyword so `public class Foo` matches (eliminates a false-negative risk). | ✅ **IMPLEMENTED** — `languages/swift.ts` `SWIFT_PREFIX = '(?:@\w+\s+)*(?:(?:final\|open\|public\|internal\|private\|fileprivate\|static)\s+)*'`; TC-014 asserts `public class Foo` matches and `publicclass Foo` does **not**. |

## Findings by OWASP Top 10 (2021)

> ReDoS (CWE-1333 — Inefficient Regular Expression Complexity) does not map cleanly to a single 2021 category; it is tracked as a standalone design finding below. All ten listed categories are otherwise clean because the implemented controls (C1/C2/C4) neutralize the only realistic risk vector.

### A01:2021 — Broken Access Control
No issues found ✅ (no authz surface changed).

### A02:2021 — Cryptographic Failures
No issues found ✅ (no secrets/crypto introduced).

### A03:2021 — Injection
No issues found ✅ (no `new RegExp(userInput)`; regexes are static literals and file content is only ever the **match subject**, never compiled into a pattern).

### A04:2021 — Insecure Design
No issues found ✅ (ReDoS explicitly considered and mitigated by design).

### A05:2021 — Security Misconfiguration
No issues found ✅ (`grammar-config.json` left unchanged per TDD — C3).

### A06:2021 — Vulnerable and Outdated Components
No issues found ✅ (no new dependencies introduced).

### A07:2021 — Identification and Authentication Failures
N/A ✅

### A08:2021 — Software and Data Integrity Failures
No issues found ✅

### A09:2021 — Security Logging and Monitoring Failures
ℹ️ Informational — C1 TC-012 should remain a **permanent CI gate** (ongoing ReDoS monitoring) rather than a one-time check.

### A10:2021 — Server-Side Request Forgery (SSRF)
No issues found ✅

## Detailed Design Finding

### Finding #1: ReDoS exposure from new language regexes (design-time risk)

| Attribute | Value |
|-----------|-------|
| **Severity** | 🟡 Medium (design-time) |
| **OWASP Category** | CWE-1333 (standalone — see note above) |
| **CWE** | CWE-1333: Inefficient Regular Expression Complexity |
| **CVSS Score** | 5.3 (AV:L/AC:H/PR:L/UI:N/S:U/C:N/I:N/A:H — local indexer DoS) |
| **Location** | `backend/src/engine/parsers/languages/*.ts` (9 new `PatternDef[]` sets) |
| **Status** | Mitigated (conditions C1/C2/C4 accepted) |

**Description:**
The new `PatternDef[]` sets are executed by `extractSymbols` → `content.matchAll(new RegExp(pattern.regex, 'gm'))` over arbitrary developer source. A catastrophic-backtracking regex could hang the indexer thread on a hostile/degenerate source line, causing a denial-of-service for the indexing job. The design prevents this through anchored `^`, the forced `m` flag, linear patterns, and negative-lookahead control-keyword exclusions.

**Evidence (design intent — TDD §11.5):**
```
# All patterns anchored + m flag, e.g. C++ free function:
/^\s*(?!if|for|while|switch|return|catch|do|else|delete|new|sizeof|throw|using|template|try|lock|assert)\w[\w:<>\*&~]*\s+(\w+)\s*\(/m
```

**Impact (if conditions ignored):**
An attacker able to place a degenerate source file in a repo (e.g., a 100k-char single line) could hang the indexer. Exploitability is bounded (requires write access to an indexed repo), hence Medium not High.

**Remediation (the conditions themselves):**
- **C1** — TC-012 ReDoS regression as a CI gate (mandatory).
- **C2** — per-line size guard before `matchAll`.
- **C4** — Swift `\s+` modifier spacing (correctness, indirectly reduces false matches).

## Remediation Priority

| Priority | Condition | Effort | Impact |
|----------|-----------|--------|--------|
| 1 | C1 — TC-12 ReDoS CI gate (mandatory) | Low | Blocks catastrophic-backtracking regressions |
| 2 | C2 — size guard before matchAll | Low | Hard cap on `matchAll` input length |
| 3 | C3 — keep grammar-config unchanged + fix FSD text | Low | Avoids noisy `unavailable` + doc clarity |
| 4 | C4 — Swift `\s+` modifier spacing | Low | Eliminates false-negative on `public class Foo` |

## Recommendations Summary

### Immediate Actions (Mandatory)
1. **C1** — Ensure TC-012 (100k-char degenerate line per language, `< 1500 ms`) runs as a **required CI gate**; merge is blocked on failure.

### Short-term Improvements (Recommended)
1. **C2** — keep the `MAX_LINE_LENGTH = 8192` guard; treat it as defense-in-depth even after C1.
2. **C3** — confirm `grammar-config.json` stays untouched for the 9 languages; BA/TA to fix the contradictory FSD §1.2 / §2.2 wording.

### Long-term Hardening (Informational)
1. **C4** — keep `\s+` requirement in Swift (and consider the same for other modifier groups) to avoid modifier-smearing false positives.
2. Periodically re-run a ReDoS linter (e.g., `safe-regex` / `vuln-regex-detector`) over `languages/*.ts` when new patterns are added.

## Positive Security Controls ✅

- Patterns anchored with `^` + forced `m` flag (no mid-string catastrophic matching).
- Linear patterns; control-keyword false positives excluded via **negative lookaheads** (C/C++/C#/Bash), not overlapping alternations.
- Source files are developer-trusted (own repo); no untrusted input reaches the regex compiler.
- `SymbolKind` union kept closed (TA R3) — no new attack surface from union growth.

## Appendix

### A. Tools & Methodology
- Static design review of TDD v1.0, FSD v1.1 (TA-enriched), STC v1.0.
- ReDoS pattern analysis (anchoring, quantifier nesting, alternation overlap, lookahead linearity).
- OWASP Testing Guide v4.2 methodology (injection / DoS sub-chapters).

### B. Scope Limitations
- Design review only; runtime/CI enforcement of C1 was verified by inspecting the test file, not by executing the pipeline.
- Dynamic ReDoS testing (actual timing) is covered by STC TC-012/TC-013 and the Phase 5.7 code review.

### C. Severity Classification
| Severity | CVSS Range | Criteria |
|----------|-----------|----------|
| Critical | 9.0-10.0 | RCE, auth bypass, full breach |
| High | 7.0-8.9 | Privilege escalation, significant data exposure |
| Medium | 4.0-6.9 | DoS requiring local/repo write access, complex exploitation |
| Low | 0.1-3.9 | Minimal impact |
| Informational | 0.0 | Best-practice / defense-in-depth |

### D. Glossary
- **ReDoS**: Regular Expression Denial of Service (CWE-1333).
- **PatternDef**: `{ regex, kind, nameGroup, signatureGroup? }` contract in `signature-extractor.ts`.
- **extToLanguage**: canonical ext→id router for regex-only languages.
