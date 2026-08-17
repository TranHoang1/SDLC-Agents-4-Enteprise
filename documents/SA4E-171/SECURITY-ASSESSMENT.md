# 🔒 Security Assessment Report

## Document Information

| Field | Value |
|-------|-------|
| Project | SDLC-Agents-4-Enterprise (Backend) |
| Scope | SA4E-171 — Pega Symbol Sync & Dual-Read Implementation |
| Date | 2025-07-14 |
| Assessor | Security Agent |
| Version | 1.0 |

## Executive Summary

The SA4E-171 implementation introduces dual-write (Pega rules → symbols table) and dual-read (FTS search across both knowledge_entries and symbols) capabilities. Overall, the code demonstrates **good security awareness** with parameterized queries used consistently, project_id scoping enforced at the search entry point (SEC-04), a 5MB size guard for resource protection, and FTS query sanitization addressing Design Review findings.

The implementation properly addresses all 4 Design Review findings from Phase 3.7. No Critical or High severity vulnerabilities were identified. Two Medium findings relate to database portability and a potential ILIKE wildcard bypass, and two Low/Informational findings cover minor defense-in-depth improvements.

**Overall Risk Rating:** Low

| Severity | Count |
|----------|-------|
| 🔴 Critical | 0 |
| 🟠 High | 0 |
| 🟡 Medium | 2 |
| 🔵 Low | 1 |
| ℹ️ Informational | 1 |

---

## Design Review Findings Verification (Phase 3.7)

| # | Finding | Status | Evidence |
|---|---------|--------|----------|
| 1 | FTS sanitization — strip `:` and `"` | ✅ **ADDRESSED** | `sanitizeFtsQuery()` uses `/[^\w\s*]/g` which strips ALL non-word/non-space/non-asterisk chars including `:` and `"` |
| 2 | Query length limit 200 chars | ✅ **ADDRESSED** | `MAX_FTS_QUERY_LENGTH = 200` constant, applied via `.slice(0, MAX_FTS_QUERY_LENGTH)` |
| 3 | PEGA_DUAL_WRITE boolean parsing | ✅ **ADDRESSED** | `parseDualWriteFlag()` uses `.toLowerCase() !== 'false'` for case-insensitive boolean parsing |
| 4 | 5MB size guard in live path | ✅ **ADDRESSED** | `MAX_RULE_SIZE_BYTES = 5 * 1024 * 1024` checked in `syncRuleToSymbols()` before any DB write |

---

## Findings by OWASP Top 10 (2021)

### A01:2021 — Broken Access Control
No issues found ✅

Project_id scoping (SEC-04) is correctly enforced:
- `searchPegaSymbols()` returns `[]` immediately when `!scopeCtx?.projectId`
- All SQL queries include `AND s.project_id = ?` with parameterized binding
- `syncRuleToSymbols()` requires `projectId` parameter and passes it to all sub-queries
- `fetchBatch()` in migration script supports optional `--project-id` filter with parameterized query

### A02:2021 — Cryptographic Failures
No issues found ✅

`createHash('sha256')` used for content deduplication (appropriate for integrity checks, not security-critical).

### A03:2021 — Injection
See Finding #1 (ILIKE wildcard escape gap) — Medium severity.

All other SQL operations use parameterized queries consistently (both `?` for SQLite and `$N` for PostgreSQL). No string concatenation/interpolation in SQL.

### A04:2021 — Insecure Design
No issues found ✅

### A05:2021 — Security Misconfiguration
See Finding #2 (SQLite-specific datetime function) — Medium severity.

### A06:2021 — Vulnerable and Outdated Components
No issues found ✅ (no new dependencies introduced by this ticket)

### A07:2021 — Identification and Authentication Failures
No issues found ✅

### A08:2021 — Software and Data Integrity Failures
No issues found ✅

### A09:2021 — Security Logging and Monitoring Failures
No issues found ✅

Appropriate logging present:
- `logger.warn()` for skipped oversized rules and missing fields
- `logger.debug()` for successful syncs
- Migration script outputs batch progress to stdout

### A10:2021 — Server-Side Request Forgery (SSRF)
No issues found ✅ (no outbound HTTP requests in scope)

---

## Detailed Findings

### Finding #1: PostgreSQL ILIKE Pattern — Missing Wildcard Escape

| Attribute | Value |
|-----------|-------|
| **Severity** | 🟡 Medium |
| **OWASP Category** | A03:2021 — Injection |
| **CWE** | CWE-943: Improper Neutralization of Special Elements in Data Query Logic |
| **CVSS Score** | 4.3 |
| **Location** | `backend/src/modules/memory/engine/pega-search.ts:135` |
| **Status** | Open |

**Description:**

In `searchPgSymbols()`, the ILIKE pattern is constructed as:
```ts
const pattern = `%${ftsQuery.replace(/[*"]/g, '')}%`;
```

While `sanitizeFtsQuery()` strips most special characters (via `/[^\w\s*]/g`), the PostgreSQL ILIKE wildcard `_` (underscore) is NOT escaped. Since `_` is a word character (`\w` includes `_`), it passes through `sanitizeFtsQuery()` unmodified and acts as a single-character wildcard in ILIKE patterns.

**Impact:**

An attacker could craft queries with `_` to perform broader ILIKE matching than intended (e.g., `a_b` matches `aXb` for any X). The practical impact is limited because:
1. Results are still scoped by `project_id` and `kind LIKE 'pega_%'`
2. This only affects search precision, not authorization bypass
3. Only affects the PostgreSQL path (SQLite uses FTS5 MATCH which is safe)

**Evidence:**
```ts
// pega-search.ts:135 — underscore not escaped for ILIKE
const pattern = `%${ftsQuery.replace(/[*"]/g, '')}%`;
// Input: "Rule_Name" → pattern: "%Rule_Name%" — _ acts as single-char wildcard
```

**Remediation:**
```ts
async function searchPgSymbols(
  adapter: DatabaseAdapter,
  ftsQuery: string, limit: number, projectId: string,
): Promise<SearchResult[]> {
  const sql = `SELECT s.id, s.name, s.kind, s.signature, s.doc_comment,
                      s.summary, s.enrichment_status, 1.0 AS score
               FROM symbols s
               WHERE s.name ILIKE $1
                 AND s.kind LIKE 'pega_%'
                 AND s.project_id = $2
               ORDER BY s.name LIMIT $3`;
  try {
    // Escape ILIKE wildcards before wrapping with %
    const escaped = ftsQuery.replace(/[*"]/g, '').replace(/[%_\\]/g, '\\$&');
    const pattern = `%${escaped}%`;
    const rows = await adapter.allAsync<any>(sql, [pattern, projectId, limit]);
    return rows.map(mapSymbolRow);
  } catch {
    return [];
  }
}
```

**References:**
- [CWE-943](https://cwe.mitre.org/data/definitions/943.html)
- [PostgreSQL LIKE/ILIKE documentation](https://www.postgresql.org/docs/current/functions-matching.html)

---

### Finding #2: SQLite-Only `datetime('now')` in Cross-Database Code

| Attribute | Value |
|-----------|-------|
| **Severity** | 🟡 Medium |
| **OWASP Category** | A05:2021 — Security Misconfiguration |
| **CWE** | CWE-474: Use of Function with Inconsistent Implementations |
| **CVSS Score** | 4.0 |
| **Location** | `backend/src/modules/pega/PegaSymbolSync.ts:193` |
| **Status** | Open |

**Description:**

`createEnrichmentTaskIfNeeded()` uses SQLite-specific `datetime('now')` in the INSERT statement:
```ts
`INSERT INTO pending_tasks (task_type, entry_id, status, payload, max_retries, created_at)
 VALUES (?, ?, ?, ?, 3, datetime('now'))`
```

The rest of the codebase correctly uses `this.dialect.now()` (from `DialectHelper`) to generate database-engine-appropriate timestamp expressions. This function will fail on PostgreSQL (`datetime` is not a PostgreSQL function), causing task creation to silently fail (the error is not propagated since `createEnrichmentTaskIfNeeded` is called after the main sync operations).

**Impact:**

On PostgreSQL deployments:
- Enrichment tasks for newly synced Pega rules will NOT be created
- Symbols will exist in the table but remain in `enrichment_status = NULL` permanently
- No error visible at the API level (the `syncRuleToSymbols` call succeeds)
- This is a **functional correctness issue** — symbols won't get enriched summaries

**Evidence:**
```ts
// PegaSymbolSync.ts:193 — SQLite-only function
await adapter.runAsync(
  `INSERT INTO pending_tasks (task_type, entry_id, status, payload, max_retries, created_at)
   VALUES (?, ?, ?, ?, 3, datetime('now'))`,
  [TaskType.CODE_ENRICHMENT, symbolId, TaskStatus.PENDING, payload],
);

// Contrast with PendingTaskRepository.ts:22 — correct cross-DB pattern
`INSERT INTO pending_tasks (task_type, entry_id, status, payload, max_retries, project_id, created_at)
 VALUES (?, ?, ?, ?, ?, ?, ${this.dialect.now()})`,
```

**Remediation:**

Option A (Preferred — use ISO string as parameter):
```ts
async function createEnrichmentTaskIfNeeded(
  adapter: DatabaseAdapter, symbolId: number, symbolName: string,
  kind: string, filePath: string, projectId: string,
): Promise<void> {
  const sym = await adapter.getAsync<{ enrichment_status: string | null }>(
    'SELECT enrichment_status FROM symbols WHERE id = ? AND project_id = ?',
    [symbolId, projectId],
  );
  if (sym?.enrichment_status === 'COMPLETED') return;

  const payload = JSON.stringify({
    symbolId, symbolName, symbolKind: kind,
    projectId, filePath, workspaceType: 'pega',
  });

  const now = new Date().toISOString();
  await adapter.runAsync(
    `INSERT INTO pending_tasks (task_type, entry_id, status, payload, max_retries, created_at)
     VALUES (?, ?, ?, ?, 3, ?)`,
    [TaskType.CODE_ENRICHMENT, symbolId, TaskStatus.PENDING, payload, now],
  );
}
```

**References:**
- [CWE-474](https://cwe.mitre.org/data/definitions/474.html)
- Project pattern: `PendingTaskRepository.ts:22`

---

### Finding #3: Missing `project_id` Scope in Enrichment Status Check

| Attribute | Value |
|-----------|-------|
| **Severity** | 🔵 Low |
| **OWASP Category** | A01:2021 — Broken Access Control |
| **CWE** | CWE-639: Authorization Bypass Through User-Controlled Key |
| **CVSS Score** | 2.5 |
| **Location** | `backend/src/modules/pega/PegaSymbolSync.ts:182` |
| **Status** | Open |

**Description:**

In `createEnrichmentTaskIfNeeded()`, the check for existing enrichment status uses only `id`:
```ts
const sym = await adapter.getAsync<{ enrichment_status: string | null }>(
  'SELECT enrichment_status FROM symbols WHERE id = ?', [symbolId],
);
```

While `id` is an auto-increment primary key (unique globally), the pattern is inconsistent with the project's SEC-04 policy of always including `project_id` in queries for defense-in-depth.

**Impact:**

Minimal in current implementation because:
1. `symbolId` is derived from `upsertSymbol()` which just ran in the same function
2. It's a status read, not a data mutation
3. The `id` column is globally unique

However, this violates the defense-in-depth principle established by SEC-04.

**Remediation:**
```ts
const sym = await adapter.getAsync<{ enrichment_status: string | null }>(
  'SELECT enrichment_status FROM symbols WHERE id = ? AND project_id = ?',
  [symbolId, projectId],
);
```

---

### Finding #4: Inconsistent `sanitizeFtsQuery` Implementations

| Attribute | Value |
|-----------|-------|
| **Severity** | ℹ️ Informational |
| **OWASP Category** | A05:2021 — Security Misconfiguration |
| **CWE** | CWE-1164: Irrelevant Code |
| **CVSS Score** | 0.0 |
| **Location** | `backend/src/modules/memory/engine/pega-search.ts:84` vs `backend/src/engine/query/query-layer.ts:168` |
| **Status** | Open |

**Description:**

Two different `sanitizeFtsQuery` implementations exist in the codebase with different sanitization rules:

| File | Regex | Preserves |
|------|-------|-----------|
| `pega-search.ts:84` | `/[^\w\s*]/g` | word chars, spaces, `*` |
| `query-layer.ts:168` | `/[^\w\s*"]/g` | word chars, spaces, `*`, `"` (double quote) |

The pega-search version is more restrictive (strips `"`), which aligns with Design Review Finding #1. The query-layer version preserves `"` for FTS5 phrase queries. Neither implementation in query-layer has a length limit.

**Impact:**

No direct security impact — this is a maintainability concern. Having two sanitization functions with different rules increases the risk of future inconsistencies.

**Remediation:**

Extract a shared `sanitizeFtsQuery` utility with configuration:
```ts
// shared/fts-sanitizer.ts
export function sanitizeFtsQuery(
  query: string,
  opts: { maxLength?: number; allowQuotes?: boolean } = {},
): string {
  const regex = opts.allowQuotes ? /[^\w\s*"]/g : /[^\w\s*]/g;
  const sanitized = query.replace(regex, ' ').replace(/\s+/g, ' ').trim();
  const limited = opts.maxLength ? sanitized.slice(0, opts.maxLength) : sanitized;
  return limited || '*';
}
```

---

## Security Positive Observations

The implementation demonstrates strong security practices:

| Practice | Evidence |
|----------|----------|
| ✅ Parameterized queries everywhere | All SQL uses `?` / `$N` placeholders — zero string interpolation |
| ✅ Project_id scoping at search entry | `searchPegaSymbols()` early-returns on missing `projectId` |
| ✅ Resource limits | 5MB size guard, 200-char query limit, batch size capping (1-1000) |
| ✅ Feature flag safety | `parseDualWriteFlag()` handles undefined, case-insensitive comparison |
| ✅ Non-fatal dual-write | `syncRuleToSymbols` failure doesn't break the existing KB sync path |
| ✅ Input validation | `extractRequiredFields()` validates presence of all required Pega fields |
| ✅ Idempotent migration | `migrate-pega-symbols.ts` checks existing symbols before insert |
| ✅ Safe CLI argument parsing | `node:util parseArgs` with bounded `batchSize` (1-1000) |
| ✅ No hardcoded secrets | Feature flag read from `process.env`, no credentials in code |
| ✅ Proper error boundaries | try/catch in search functions return `[]` on failure (no crash) |

---

## Dependency Vulnerabilities

No new dependencies introduced by SA4E-171. All imports are from existing project modules.

| Dependency | Status |
|-----------|--------|
| crypto (Node.js built-in) | ✅ No issues |
| pino (existing) | ✅ No known CVEs |
| node:util (Node.js built-in) | ✅ No issues |

---

## Remediation Priority

| Priority | Finding | Effort | Impact |
|----------|---------|--------|--------|
| 1 | #2 — SQLite datetime in cross-DB code | Low (1 line change) | Breaks PostgreSQL enrichment task creation |
| 2 | #1 — ILIKE wildcard escape | Low (1 line addition) | Broader search results than intended on PG |
| 3 | #3 — project_id in enrichment check | Low (add 1 param) | SEC-04 defense-in-depth compliance |
| 4 | #4 — Inconsistent sanitizers | Medium (refactor) | Maintainability improvement |

---

## Recommendations Summary

### Immediate Actions (Medium)
1. Fix `datetime('now')` → use ISO string parameter or `dialect.now()` in `PegaSymbolSync.ts:193`
2. Add ILIKE wildcard escape (`%`, `_`, `\`) in `pega-search.ts:135`

### Short-term Improvements (Low)
3. Add `AND project_id = ?` to enrichment status check in `PegaSymbolSync.ts:182`

### Long-term Hardening (Informational)
4. Extract shared `sanitizeFtsQuery` utility to eliminate duplicate implementations

---

## Appendix

### A. Tools & Methodology
- Static code analysis (manual review of 6 TypeScript source files)
- Pattern comparison with existing codebase conventions
- Cross-reference with Design Review findings (Phase 3.7)
- OWASP Testing Guide v4.2 methodology (code review checklist)

### B. Scope Limitations
- **NOT tested:** Runtime behavior, dynamic testing, penetration testing
- **NOT tested:** Network-level security, TLS configuration
- **NOT tested:** Authentication middleware integration (out of scope for this ticket)
- **Assumption:** `DatabaseAdapter.allAsync/runAsync/getAsync` correctly implement parameterized queries (verified by code pattern consistency)

### C. Files Reviewed

| File | Lines | Purpose |
|------|-------|---------|
| `backend/src/modules/pega/pega-mapping.ts` | 78 | Mapping table, resolveSymbolKind, isPegaKind, buildVirtualPath, buildFqn |
| `backend/src/modules/pega/PegaSymbolSync.ts` | 196 | syncRuleToSymbols, dual-write, feature flag, 5MB guard |
| `backend/src/modules/memory/engine/pega-search.ts` | 148 | Dual-read FTS search, sanitizeFtsQuery, mergeDedupResults |
| `backend/src/engine/enrichment/CodeEnrichmentHandler.ts` | 158 | isPegaKind integration, strategy selection |
| `backend/src/engine/enrichment/CodeEnrichmentTaskCreator.ts` | 141 | workspaceType='pega' dynamic assignment |
| `backend/scripts/migrate-pega-symbols.ts` | 156 | CLI migration script |

### D. Glossary
- **CVSS**: Common Vulnerability Scoring System
- **CWE**: Common Weakness Enumeration
- **FTS**: Full-Text Search
- **ILIKE**: Case-insensitive LIKE operator (PostgreSQL)
- **SEC-04**: Project security requirement for project_id scoping in all queries
