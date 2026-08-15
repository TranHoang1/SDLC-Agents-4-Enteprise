# Security Design Review — SA4E-108

## Project-Type-Aware Workspace Indexing Strategy

| Field | Value |
|-------|-------|
| Reviewer | Security Agent |
| Date | 2026-08-13 |
| TDD Version | 1.0 |
| Overall Risk | LOW |

---

## Findings

| # | Severity | Category | Finding | Recommendation | Status |
|---|----------|----------|---------|----------------|--------|
| 1 | Medium | Input Validation | LLM discovery prompt includes raw filenames — potential prompt injection | Sanitize filenames: strip non-alphanumeric except `./-_`, truncate 100 chars | Open |
| 2 | Low | Data Integrity | JSON.parse before Zod could throw on malformed KB entries | Wrap in try/catch, reject on parse failure | Addressed in TDD |
| 3 | Low | Path Traversal | source_roots from KB could contain `../` patterns | Validate paths relative, reject `..` segments | Open |
| 4 | Low | DoS | No limit on signals array size per config | Add max 20 signals to Zod schema | Open |
| 5 | Info | Rate Limiting | 1/workspace/24h in SQLite — adequate for single instance | Future: distributed rate limit for multi-instance | Accepted |
| 6 | Info | Secrets | No secrets in KB configs — structural data only | N/A | N/A |

---

## Summary

- **0 Critical** | **0 High** | **1 Medium** | **3 Low** | **2 Info**
- Design is sound — KB-driven with Zod validation
- Findings addressable during implementation

## Recommendation

✅ Proceed to Phase 4 — add filename sanitization + path validation to dev checklist.
