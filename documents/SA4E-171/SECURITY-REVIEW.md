# 🔒 Security Design Review — SA4E-171

## Document Information

| Field | Value |
|-------|-------|
| Ticket | SA4E-171 |
| Title | Migrate Pega Rules from knowledge_entries to symbols table |
| Reviewed Document | TDD.md v1.0 (2025-07-27) |
| Assessor | Security Agent |
| Date | 2025-07-27 |
| Status | Complete |

---

## Executive Summary

The TDD for SA4E-171 describes a data migration from `knowledge_entries` to `symbols` table with dual-write/dual-read patterns, a CLI migration script, and enrichment pipeline extension. The design is **generally sound** from a security perspective — it leverages existing parameterized queries, reuses the established `IsolationLayer` for `project_id` scoping, and introduces no new HTTP endpoints.

**Key strengths:**
- All SQL uses parameterized queries (no string interpolation)
- FTS query sanitization regex strips dangerous characters
- Feature flag enables safe rollback
- CLI-only migration script (no HTTP exposure)
- project_id scoping explicitly addressed (SEC-04)

**Key concerns:** 2 Medium and 2 Low findings related to FTS sanitization gaps, missing query length validation, env-var boolean parsing, and OOM protection completeness.

**Overall Risk Rating:** Medium

| Severity | Count |
|----------|-------|
| 🔴 Critical | 0 |
| 🟠 High | 0 |
| 🟡 Medium | 2 |
| 🔵 Low | 2 |
| ℹ️ Informational | 2 |

---

## Findings Summary

| # | Title | Severity | OWASP | CWE | Location |
|---|-------|----------|-------|-----|----------|
| 1 | FTS MATCH query sanitization allows potential injection characters | Medium | A03:2021 | CWE-943 | TDD S5.6 (searchPegaSymbols) |
| 2 | No query length/size limit on FTS search input | Medium | A05:2021 | CWE-400 | TDD S5.6 (searchPegaSymbols) |
| 3 | Feature flag PEGA_DUAL_WRITE boolean parsing inconsistency | Low | A05:2021 | CWE-1188 | TDD S5.5 (env var) |
| 4 | Large rule JSON OOM protection missing in live dual-write path | Low | A05:2021 | CWE-770 | TDD S7.4 vs FSD SEC-06 |
| 5 | Dual-read search does not use IsolationLayer for symbols_fts query | Informational | A01:2021 | CWE-863 | TDD S5.6 |
| 6 | Migration script logs FQN on error — acceptable data exposure | Informational | A09:2021 | CWE-532 | TDD S7.4, S9.1 |

---

## Detailed Findings

### Finding #1: FTS MATCH query sanitization allows potential injection characters

| Attribute | Value |
|-----------|-------|
| **Severity** | Medium |
| **OWASP Category** | A03:2021 — Injection |
| **CWE** | CWE-943: Improper Neutralization of Special Elements in Data Query Logic |
| **CVSS Score** | 5.3 |
| **Location** | TDD S5.6 — searchPegaSymbols() / TDD S7.2 |
| **Status** | Open |

**Description:**

The TDD specifies this FTS sanitization regex:
```typescript
const ftsQuery = query.replace(/[^\w\s*":.]/g, ' ').trim() || '*';
```

This allows through: `*`, `"`, `:`, `.` — all of which have special semantics in SQLite FTS5 MATCH syntax:
- `*` = prefix wildcard
- `"` = phrase queries
- `:` = column filter (e.g., `name:value`)
- Unbalanced `"` quotes can cause FTS5 parse errors (caught by try/catch, but causes search failure)

The existing `MemoryEngine.search()` uses the **same regex** and wraps in try/catch, so this is consistent with the project pattern. However, the FTS5 column filter `:` is particularly concerning for symbols_fts — an attacker could craft `kind:admin_secret` to target specific columns they shouldn't access (though project_id scoping mitigates cross-tenant risk).

**Impact:**
- FTS parse errors silently degrade search (returns empty array)
- Column filter operator (`:`) could be used to probe FTS column data within the user's own project scope
- No cross-tenant data leakage due to project_id WHERE clause

**Remediation:**

```typescript
// Stricter sanitization for FTS5 — also strip : and balance quotes
private sanitizeFtsQuery(query: string): string {
  // Strip all FTS5 special operators except basic word characters and spaces
  let sanitized = query.replace(/[^\w\s]/g, ' ').trim();
  // Limit to reasonable search length
  if (sanitized.length > 200) sanitized = sanitized.slice(0, 200);
  return sanitized || '*';
}
```

**Compensating control:** The try/catch around the FTS query + fallback to empty results prevents crashes. This is defense-in-depth that already exists.

---

### Finding #2: No query length/size limit on FTS search input

| Attribute | Value |
|-----------|-------|
| **Severity** | Medium |
| **OWASP Category** | A05:2021 — Security Misconfiguration |
| **CWE** | CWE-400: Uncontrolled Resource Consumption |
| **CVSS Score** | 4.3 |
| **Location** | TDD S3.2 / S5.6 — searchPegaSymbols() |
| **Status** | Open |

**Description:**

The TDD design for `searchPegaSymbols()` and the existing `MemoryEngine.search()` accept `query: string` without any length validation. An extremely long query string (e.g., 100KB+) passed through `mem_search` MCP tool could:
1. Consume excessive CPU in regex replacement
2. Create a very large FTS5 MATCH expression
3. Potentially exhaust SQLite query planner memory

The MCP tool layer may have its own limits, but the design does not specify explicit input size validation at the search method level.

**Impact:**
- Potential DoS via crafted long search queries
- Resource exhaustion on the server processing the search

**Remediation:**

```typescript
// Add at the start of searchPegaSymbols():
private async searchPegaSymbols(query: string, limit: number, scopeCtx?: ScopeContext): Promise<SearchResult[]> {
  if (!scopeCtx?.projectId) return [];
  // SEC: Limit query length to prevent resource exhaustion
  const truncatedQuery = query.slice(0, 500);
  const ftsQuery = truncatedQuery.replace(/[^\w\s*":.]/g, ' ').trim() || '*';
  // ... rest unchanged
}
```

Also add to the `mem_search` Zod schema:
```typescript
const MemSearchSchema = z.object({
  query: z.string().max(500, 'Search query too long'),
  limit: z.number().int().min(1).max(100).default(10),
});
```

---

### Finding #3: Feature flag PEGA_DUAL_WRITE boolean parsing inconsistency

| Attribute | Value |
|-----------|-------|
| **Severity** | Low |
| **OWASP Category** | A05:2021 — Security Misconfiguration |
| **CWE** | CWE-1188: Initialization with Hard-Coded Network Resource Configuration Value |
| **CVSS Score** | 2.0 |
| **Location** | TDD S5.5 — PegaKbSync.ts |
| **Status** | Open |

**Description:**

The TDD specifies:
```typescript
const PEGA_DUAL_WRITE = process.env.PEGA_DUAL_WRITE !== 'false';
```

This means:
- `undefined` → `true` (dual-write ON) — intended
- `'false'` → `false` (dual-write OFF) — intended
- `'FALSE'` → `true` (dual-write ON) — unexpected!
- `'0'` → `true` (dual-write ON) — unexpected!
- `'no'` → `true` (dual-write ON) — unexpected!

An operator trying to disable dual-write with `PEGA_DUAL_WRITE=FALSE` or `PEGA_DUAL_WRITE=0` would fail silently, leaving the feature active when it should be disabled.

**Impact:**
- Rollback procedure (TDD S10.2) may not work if operator uses `FALSE` instead of `false`
- No data breach risk — just operational surprise

**Remediation:**

```typescript
// Case-insensitive, multi-format boolean parsing
const PEGA_DUAL_WRITE = !['false', '0', 'no', 'off'].includes(
  (process.env.PEGA_DUAL_WRITE ?? 'true').toLowerCase()
);
```

---

### Finding #4: Large rule JSON OOM protection missing in live dual-write path

| Attribute | Value |
|-----------|-------|
| **Severity** | Low |
| **OWASP Category** | A05:2021 — Security Misconfiguration |
| **CWE** | CWE-770: Allocation of Resources Without Limits or Throttling |
| **CVSS Score** | 3.1 |
| **Location** | TDD S7.4 vs FSD SEC-06 |
| **Status** | Open |

**Description:**

FSD SEC-06 specifies: "skip rules > 5MB with warning" as mitigation for OOM.
TDD S7.4 mentions this protection for the migration script. However, the TDD does NOT specify a size guard in `syncRuleToSymbols()` (the live dual-write path in S5.5).

If a Pega rule > 5MB is ingested via normal live flow, `JSON.stringify(ruleJson)` could allocate large buffers in the running server process.

**Impact:**
- Memory exhaustion during live dual-write if an oversized rule is ingested
- Migration script is protected (batch processing), but live path is not

**Remediation:**

Add size guard in `syncRuleToSymbols()`:
```typescript
export async function syncRuleToSymbols(
  adapter: DatabaseAdapter,
  ruleJson: Record<string, unknown>,
  projectId: string,
  promptContext: string,
): Promise<{ symbolId: number; fileId: number } | null> {
  const ruleJsonStr = JSON.stringify(ruleJson);
  // SEC-06: Guard against oversized rule JSON in live path
  if (Buffer.byteLength(ruleJsonStr, 'utf-8') > 5 * 1024 * 1024) {
    logger.warn({ projectId, size: ruleJsonStr.length }, 'Rule JSON exceeds 5MB — skipping symbol sync');
    return null;
  }
  // ... rest of function
}
```

---

### Finding #5: Dual-read search does not use IsolationLayer for symbols_fts query (Informational)

| Attribute | Value |
|-----------|-------|
| **Severity** | Informational |
| **OWASP Category** | A01:2021 — Broken Access Control |
| **CWE** | CWE-863: Incorrect Authorization |
| **CVSS Score** | 0.0 |
| **Location** | TDD S5.6 — searchPegaSymbols() |
| **Status** | Acceptable |

**Description:**

The existing `MemoryEngine.search()` uses `buildScopeClause()` which delegates to `IsolationLayer.buildReadFilter()` — handling USER/PROJECT/SHARED scopes with fail-closed behavior (`1=0` if no projectId).

The new `searchPegaSymbols()` uses a simpler check:
```typescript
if (!scopeCtx?.projectId) return [];
// ... AND s.project_id = ?
```

This is functionally equivalent for Pega symbols (always PROJECT scope). However, it does not leverage the centralized IsolationLayer. If scope logic evolves in the future (e.g., SHARED Pega rules), this method would need separate updates.

**Impact:** None currently. Defense-in-depth recommendation only.

**Remediation (optional):**
Add a comment explaining the simplified scope:
```typescript
// SEC-04: Pega symbols are always PROJECT-scoped (no USER/SHARED variants).
// Simplified scope check is intentional here.
```

---

### Finding #6: Migration script logs FQN on error (Informational)

| Attribute | Value |
|-----------|-------|
| **Severity** | Informational |
| **OWASP Category** | A09:2021 — Security Logging and Monitoring Failures |
| **CWE** | CWE-532: Insertion of Sensitive Information into Log File |
| **CVSS Score** | 0.0 |
| **Location** | TDD S7.4, S9.1 |
| **Status** | Acceptable |

**Description:**

TDD states: "Progress output does not include rule content (only counts + FQN on error)". FQN format is `{pxObjClass}:{pyClassName}:{pyRuleName}` — this reveals Pega rule naming which is business metadata but **not PII or credentials**.

This is acceptable for an admin CLI tool that requires direct DB access.

**Impact:** None. FQN is metadata, not secret data.

---

## SEC-04 Verification (HIGH from FSD)

**Status: ADEQUATELY ADDRESSED**

The TDD correctly enforces `project_id` scoping in all new query paths:

| Query Location | Enforcement Method | Verified |
|----------------|-------------------|----------|
| symbols_fts search (dual-read) | `AND s.project_id = ?` (parameterized) | Yes |
| knowledge_fts search (existing) | `buildScopeClause()` → IsolationLayer | Yes |
| Migration script reads | `WHERE project_id = ?` if --project-id | Yes |
| Migration script writes | Carries project_id from source row | Yes |
| Virtual file UPSERT | project_id in UNIQUE constraint | Yes |
| Symbol UPSERT | project_id stored in row | Yes |
| Fail-closed guard | `if (!scopeCtx?.projectId) return []` | Yes |

The existing `IsolationLayer.buildReadFilter()` already returns `1=0` (deny-all) when no projectId is provided. The new method mirrors this with early return.

---

## SEC-06 Verification (MEDIUM from FSD)

**Status: PARTIALLY ADDRESSED**

- Migration script: Protected (batch processing + skip > 5MB) ✅
- Live `syncRuleToSymbols()` path: No explicit size guard specified ⚠️

See Finding #4 for remediation.

---

## Authentication & Authorization Review

| Aspect | Status | Notes |
|--------|--------|-------|
| Migration script access control | ✅ | CLI-only, requires direct DB access (admin env vars) |
| Search API authorization | ✅ | Inherits existing project_id scoping via ScopeContext |
| Enrichment task authorization | ✅ | Same security context as existing TaskWorker |
| Feature flag access | ✅ | Env var (no runtime toggle API) — admin-only |
| No new HTTP endpoints | ✅ | No new attack surface |

---

## Dependency Risk Assessment

No new dependencies introduced. All libraries are existing:

| Dependency | Risk | Notes |
|-----------|------|-------|
| better-sqlite3 11.x | None new | Existing, FTS5 MATCH queries |
| pg 8.x | None new | FK constraint drop (admin operation) |
| node:util parseArgs | None | Built-in Node.js module |
| node:crypto createHash | None | Standard SHA-256 |
| zod 3.x | None new | Payload validation |

---

## Remediation Priority

| Priority | Finding | Effort | Business Impact |
|----------|---------|--------|-----------------|
| 1 | #2 — Add query length limit | Low (5 min) | Prevents DoS |
| 2 | #4 — Add size guard in syncRuleToSymbols | Low (5 min) | Prevents OOM in production |
| 3 | #1 — Tighten FTS sanitization | Low (10 min) | Reduces injection surface |
| 4 | #3 — Fix boolean env var parsing | Low (5 min) | Operational robustness |

---

## Verdict

**No Critical or High findings. TDD design is approved for implementation** with the recommendation to address the 2 Medium findings (query length limit + FTS sanitization) during implementation.

The design correctly handles the primary security concern (SEC-04: project_id scoping) and uses established patterns from the codebase.
