# 🔒 Security Design Review — SA4E-79

## Document Information

| Field | Value |
|-------|-------|
| Project | SDLC-Agents-4-Enterprise |
| Ticket | SA4E-79 |
| Feature | On-Demand Client LLM Enrichment for KB Entries |
| Date | 2025-07-20 |
| Reviewer | Security Agent |
| TDD Version | 1.0 |
| Architecture | Plugin (VS Code Extension + Backend MCP Server) |

---

## Executive Summary

The SA4E-79 TDD proposes a well-designed client-side enrichment fallback for KB entries. The design demonstrates strong security awareness with atomic operations for race safety, parameterized SQL queries, input length validation, and scope-based authorization.

**No Critical or High severity issues found.** The design leverages existing security infrastructure (ScopeContext, SEC-02/SEC-03 binding, RBAC tool access) effectively. The few findings are Medium and Low severity, representing defense-in-depth improvements rather than exploitable vulnerabilities.

**Overall Risk Rating: Low**

| Severity | Count |
|----------|-------|
| 🔴 Critical | 0 |
| 🟠 High | 0 |
| 🟡 Medium | 3 |
| 🔵 Low | 3 |
| ℹ️ Informational | 2 |

---

## Findings Table

| # | Finding | Severity | Category | OWASP | Mitigation Status |
|---|---------|----------|----------|-------|-------------------|
| F-01 | Stored XSS via tags/summary in FTS index or admin UI rendering | Medium | Injection | A03:2021 | Partially mitigated — length limits exist but no content sanitization |
| F-02 | structured_map schema validation incomplete — accepts arbitrary keys | Medium | Input Validation | A03:2021 | Not addressed in TDD |
| F-03 | Scope check bypassed when scopeCtx.projectId is undefined | Medium | Authorization | A01:2021 | Partially addressed — relies on fallback behavior |
| F-04 | No rate limiting on mem_enrich calls per session | Low | DoS | A05:2021 | Partially mitigated by batch cap (3/search) |
| F-05 | Prompt injection via crafted KB entry content | Low | AI Security | A03:2021 | Mitigated by delimiters + JSON validation |
| F-06 | pending_hits content preview (300 chars) information exposure | Low | Data Exposure | A01:2021 | Acceptable — same access as mem_search |
| F-07 | Silent failure mode may mask persistent attack patterns | Informational | Monitoring | A09:2021 | By design (BR-09) but limits attack detection |
| F-08 | No audit trail for failed enrichment attempts | Informational | Monitoring | A09:2021 | Only success is logged |

---

## Detailed Findings

### F-01: Stored XSS via tags and summary (Medium)

**Category:** A03:2021 — Injection | **CWE:** CWE-79 | **CVSS:** 5.4

**Description:**
The handleEnrich dispatcher validates max length (500 chars) for summary and tags, but does not sanitize HTML/script content. If these values are rendered in the admin UI or any HTML context without output encoding, stored XSS is possible.

**Evidence (TDD Section 5.1):**
```typescript
// Only length and emptiness validated — no content sanitization
if (summary.length > 500) {
  return 'Error: Invalid metadata - summary too long (max 500)';
}
// tags stored directly after trim
```

**Impact:** A malicious client LLM output could inject script tags into summary/tags. If admin UI renders without encoding, XSS executes in admin context.

**Likelihood:** Low — requires compromised LLM output AND unencoded rendering.

**Remediation:**
```typescript
// Option A: Sanitize at storage layer
const sanitizedSummary = summary.trim().replace(/[<>]/g, '').slice(0, 500);
const sanitizedTags = (tags || '').trim().replace(/[<>]/g, '').slice(0, 500);

// Option B (preferred): Ensure output encoding at all rendering layers
// Admin UI must use textContent or framework auto-escaping (React/Vue default)
```

---

### F-02: structured_map Schema Validation Incomplete (Medium)

**Category:** A03:2021 — Injection | **CWE:** CWE-20 | **CVSS:** 4.8

**Description:**
The handleEnrich implementation only validates total JSON size (100KB) for structured_map. It does not reject unknown keys, validate array item types, or limit nesting depth.

**Evidence (TDD Section 5.1):**
```typescript
if (structuredMap) {
  const mapJson = JSON.stringify(structuredMap);
  if (mapJson.length > 102400) {
    return 'Error: Invalid metadata - structured_map too large (max 100KB)';
  }
}
// No schema validation — any JSON object passes
```

**Impact:** Arbitrary keys pollute KB data model; deeply nested objects could cause issues in downstream consumers.

**Remediation:**
```typescript
function validateStructuredMap(map: unknown): boolean {
  if (typeof map !== 'object' || map === null || Array.isArray(map)) return false;
  const m = map as Record<string, unknown>;
  const allowedKeys = ['summary', 'business_entities', 'actors', 'business_rules', 'tags'];
  for (const key of Object.keys(m)) {
    if (!allowedKeys.includes(key)) return false;
  }
  for (const key of ['business_entities', 'actors', 'business_rules', 'tags']) {
    if (m[key] && (!Array.isArray(m[key]) || !(m[key] as unknown[]).every(v => typeof v === 'string'))) {
      return false;
    }
  }
  if (m.summary && typeof m.summary !== 'string') return false;
  return true;
}
```

---

### F-03: Scope Check Bypassed When scopeCtx.projectId is Undefined (Medium)

**Category:** A01:2021 — Broken Access Control | **CWE:** CWE-862 | **CVSS:** 5.0

**Description:**
The scope check short-circuits when scopeCtx?.projectId is undefined:

```typescript
if (scopeCtx?.projectId && entry.project_id
    && entry.project_id !== scopeCtx.projectId) {
  return `Error: Entry #${entryId} not accessible in current scope`;
}
```

In shared API key mode or when X-Project-Id header is missing, any authenticated caller could enrich entries from any project.

**Mitigating factor:** In production with JWT, SEC-03 binding (verifyProjectBinding in tools.ts) prevents access to ungranted projects.

**Remediation (fail-closed):**
```typescript
// Require project scope for enrichment operations
if (!scopeCtx?.projectId) {
  return 'Error: Project scope required for enrichment';
}
if (entry.project_id && entry.project_id !== scopeCtx.projectId) {
  return `Error: Entry #${entryId} not accessible in current scope`;
}
```

---

### F-04: No Rate Limiting on mem_enrich (Low)

**Category:** A05:2021 — Security Misconfiguration | **CWE:** CWE-770 | **CVSS:** 3.7

**Description:** No server-side rate limit on mem_enrich endpoint. A malicious client could bypass extension batch limits and call directly.

**Mitigating factors:** Each call requires valid pending entry_id; entries transition to done (one-shot); pool is naturally bounded.

**Status:** ✅ Acceptable risk. Note for DEV awareness.

---

### F-05: Prompt Injection via Crafted KB Entry Content (Low)

**Category:** A03:2021 — Injection | **CWE:** CWE-74 | **CVSS:** 3.1

**Description:** Entry content could contain adversarial instructions targeting the enrichment LLM prompt.

**Existing mitigations (adequate):**
1. Clear delimiters (---) in prompt
2. JSON schema validation on output
3. Content truncation to 4000 chars
4. Low temperature (0.3)
5. Backend validation on stored values (length limits, parameterized SQL)

**Status:** ✅ Adequately mitigated by multi-layer defense.

---

### F-06: pending_hits Content Preview Exposure (Low)

**Category:** A01:2021 — Broken Access Control | **CWE:** CWE-200 | **CVSS:** 2.0

**Description:** Modified mem_search returns 300-char previews of pending entries that may not match the search query (selected by status only).

**Mitigating factors:** Same scope check applies; caller already has full read access via mem_search.

**Status:** ✅ Acceptable by design.

---

### F-07: Silent Failure Mode Masks Attack Patterns (Informational)

**Category:** A09:2021 — Monitoring | **CWE:** CWE-778

**Description:** Per BR-09, failed enrichment is silent. Repeated failures indicating attacks would not trigger alerts.

**Recommendation:** Emit structured warning when consecutiveFailures exceeds threshold.

---

### F-08: No Audit Trail for Failed Enrichment Attempts (Informational)

**Category:** A09:2021 — Monitoring | **CWE:** CWE-778

**Description:** handleEnrich only audit-logs successful enrichments. Scope violations and validation failures are not logged.

**Recommendation:** Add `engine.auditLog('ENRICH_REJECTED', entryId)` for failed attempts.

---

## Security Design Strengths

| # | Strength | Evidence |
|---|----------|----------|
| 1 | Parameterized SQL queries — no string interpolation | All queries use ? placeholders |
| 2 | Atomic UPDATE WHERE — race safety at DB level | WHERE enrichment_status='pending' |
| 3 | Leverages existing auth (SEC-02, SEC-03, RBAC) | ScopeContext inherited from tools.ts |
| 4 | Idempotent design — 409 on duplicate | No data corruption on retry |
| 5 | Input length limits | summary 500, tags 500, structured_map 100KB |
| 6 | Non-blocking error handling | fire-and-forget with try/catch |
| 7 | Dedup with stale timeout | 60s cleanup prevents memory leaks |
| 8 | Content truncation for LLM | 4000 char cap limits attack surface |
| 9 | Audit logging (enriched_by + enriched_at) | Source tracking for forensics |
| 10 | Backward compatibility (default 'done') | No migration disruption |

---

## Recommendations Summary

### DEV Requirements (during implementation)

| # | Action | Finding | Effort |
|---|--------|---------|--------|
| 1 | Add structured_map schema validation (reject unknown keys, validate types) | F-02 | Low |
| 2 | Make scope check fail-closed (require projectId present) | F-03 | Low |
| 3 | Consider HTML entity encoding for summary/tags if admin UI renders them | F-01 | Low |

### Long-term Hardening (post-implementation)

| # | Action | Finding | Effort |
|---|--------|---------|--------|
| 4 | Add audit logging for rejected enrichment attempts | F-08 | Low |
| 5 | Add structured warning for consecutive failures threshold | F-07 | Low |
| 6 | Consider server-side rate limit on mem_enrich | F-04 | Medium |

---

## Verdict

**✅ PASS — No Critical or High findings. Proceed to Phase 4 (Test Planning).**

The TDD security design (Section 8) is well-considered and addresses major attack vectors. Medium findings are defense-in-depth improvements for DEV implementation, not blockers.

---

## Appendix

### A. Review Methodology
- Static design review against OWASP Top 10 (2021)
- Verified TDD claims against actual backend source (tools.ts, search.ts, crud.ts, models.ts, TaskWorker.ts)
- Cross-referenced with FSD Section 14.8 (TA Security Assessment)
- Checked existing auth middleware (jwt-auth.ts, api-key-auth.ts, SEC-02/SEC-03)

### B. Scope Limitations
- Design review only — no runtime testing
- Extension-side security depends on VS Code sandbox (not verified)
- Client LLM behavior is non-deterministic
- Network-layer security (TLS) not in scope
