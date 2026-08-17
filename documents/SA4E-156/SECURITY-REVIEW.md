# Security Design Review — SA4E-156

## Document Information

| Field | Value |
|-------|-------|
| Ticket | SA4E-156 |
| Feature | [Pega Indexing] Schema-Driven Relative Discovery + DataPage Enumeration |
| Reviewed Document | TDD.md v1.0 |
| Reviewer | Security Agent |
| Date | 2025-01-27 |
| Review Type | Architecture / Design Review (static — no code audit) |

---

## Executive Summary

The design is **generally sound** for a localhost-only developer tool. The attack surface is limited because the backend only listens on `127.0.0.1` and credentials never leave the extension process. The primary risks are around **stored rule content** (potential sensitive data in Pega rules saved unencrypted to disk/SQLite) and the **no-auth localhost endpoint** assumption (which is safe only if port binding is properly restricted).

**Overall Risk Rating: Low** (with 2 Medium findings requiring attention)

| Severity | Count |
|----------|-------|
| 🔴 Critical | 0 |
| 🟠 High | 0 |
| 🟡 Medium | 2 |
| 🔵 Low | 3 |
| ℹ️ Informational | 2 |

---

## Findings

| # | Severity | Category | Finding | Location | Recommendation |
|---|----------|----------|---------|----------|----------------|
| 1 | 🟡 Medium | A05 — Security Misconfiguration | No authentication on `/api/v1/pega/ingest-rule` | TDD §3.2 | Add localhost-only binding verification + optional shared secret header for defense-in-depth |
| 2 | 🟡 Medium | A02 — Cryptographic Failures | Rule JSON files saved unencrypted to workspace (`./rules/*.pega.json`) | TDD §7.3, §4.1 | Document data classification; warn user if rules contain PII; consider optional at-rest encryption for sensitive environments |
| 3 | 🔵 Low | A03 — Injection | `ruleJson` stored as-is without sanitization (TDD §7.1: "No sanitization — stored as-is") | TDD §7.1 | Acceptable for SQLite parameterized queries, but add a note that any future rendering of ruleJson content (logs, UI) MUST apply output encoding |
| 4 | 🔵 Low | A05 — Security Misconfiguration | No rate limiting on ingest-rule endpoint | TDD §3.2 | Acceptable for localhost, but add connection-count monitoring to detect runaway BFS loops |
| 5 | 🔵 Low | A09 — Security Logging | No audit trail for ingested rules (who ingested what, when) | TDD §12 | Add structured log entry per ingest with timestamp + projectId + pxObjClass for forensics |
| 6 | ℹ️ Info | A06 — Vulnerable Components | Dependencies (Hono 4.x, Zod 3.x, better-sqlite3 9.x) — no known CVEs at time of review | TDD §1.3 | Monitor advisories; pin exact versions in package-lock.json |
| 7 | ℹ️ Info | Best Practice | `dedupSet` grows unbounded (warning only at 100K) | TDD §7.4 | Consider hard cap (e.g., 200K entries) to prevent OOM in edge cases with misconfigured schemas |

---

## Detailed Analysis

### 1. Authentication & Authorization

| Aspect | Assessment |
|--------|------------|
| Extension → Pega Server | ✅ Good — Basic/OAuth credentials stored in VS Code SecretStorage, never forwarded to backend |
| Extension → Backend (localhost) | ⚠️ Acceptable with caveats — "No auth (localhost only)" is industry-standard for dev tools (similar to LSP servers, webpack-dev-server) |
| Credential isolation | ✅ Good — "Pega credentials never leave the Extension process" (TDD §7.2) |

**Risk of "no auth on localhost":**
- On shared developer machines or containers with port forwarding, another process could call the endpoint
- **Mitigation already present:** Sequential writes to SQLite WAL mode + Hono bodyLimit means abuse impact is limited to disk usage
- **Recommended defense-in-depth:** Bind to `127.0.0.1` explicitly (not `0.0.0.0`) + optionally generate a per-session random token at startup shared with extension via stdout/config

**Verdict:** Acceptable for a VS Code extension's local backend. Document the assumption explicitly.

---

### 2. Data Protection

| Data | At Rest | In Transit | Risk |
|------|---------|------------|------|
| Pega credentials | VS Code SecretStorage (OS keychain) | HTTPS to Pega Server | ✅ Secure |
| Rule JSON (full content) | Unencrypted files: `./rules/{type}/{name}.pega.json` | HTTP localhost (no TLS needed) | ⚠️ See Finding #2 |
| Rule JSON in SQLite | `knowledge_entries` table, unencrypted WAL DB | In-process (no network) | ⚠️ Same as above |
| dedupSet / fetchQueue | In-memory only | N/A | ✅ No persistence concern |

**PII in Pega Rules:**
- Pega rules (Activity, Flow, Section, DataPage definitions) are **metadata/configuration** — they define business logic, not contain customer data
- However: Rule XML/JSON MAY contain hardcoded test values, sample data, or embedded comments with internal system names
- **Recommendation:** Treat rule files as "internal/confidential" but not "PII-containing" unless the Pega application indexes Data- rules that contain sample records

---

### 3. API Security

| Control | Status | Notes |
|---------|--------|-------|
| Input validation (Zod) | ✅ Implemented | `projectId` regex-constrained, `pxObjClass` required, body size limited |
| Body size limit | ✅ 10MB | Appropriate for large rule JSON |
| Rate limiting | ❌ None | Acceptable for localhost — sequential calls from single extension |
| CORS | N/A | Backend is localhost-only, no browser clients |
| Error information leakage | ✅ Good | Errors return code + message, no stack traces |
| Timeout | ✅ 10s on ingest-rule call from extension side | Prevents hung connections |

**projectId validation:** `z.string().regex(/^[a-f0-9]{12}$/)` — strong constraint, prevents injection via projectId.

**ruleJson validation:** `z.record(z.unknown())` — permissive by design (rules have arbitrary structure). The Zod refine ensures `pxObjClass` is present. This is correct — the backend should accept any valid JSON rule regardless of structure.

---

### 4. Dependency Risks

| Dependency | Version | Known Issues | Risk |
|-----------|---------|--------------|------|
| Hono | 4.x | No known CVEs | ✅ Low |
| Zod | 3.x | No known CVEs | ✅ Low |
| better-sqlite3 | 9.x | No known CVEs | ✅ Low |
| Node.js crypto | Built-in | N/A | ✅ Low |
| esbuild | latest | Build-only, not runtime | ✅ None |

**Note:** All dependencies are well-maintained, widely-used libraries. No typosquatting concerns. The design introduces no new external dependencies beyond what the project already uses.

---

### 5. Infrastructure Security

| Aspect | Assessment |
|--------|------------|
| Network binding | Must verify backend binds to `127.0.0.1` only (not `0.0.0.0`) |
| Port exposure | Backend port from VS Code settings — not exposed externally |
| Secrets in config | ✅ No secrets in code/config — all credentials in SecretStorage |
| File system access | Extension writes to workspace `./rules/` directory — user-controlled |
| Process isolation | Backend and Extension are separate processes on same machine |

**Recommendation:** Ensure `HttpServer.ts` uses `hostname: '127.0.0.1'` explicitly in the Hono serve config.

---

### 6. Injection Risks

| Vector | Assessment | Mitigation |
|--------|------------|------------|
| SQL Injection | ✅ Safe | Parameterized queries (`$1, $2`) via better-sqlite3 prepared statements |
| Command Injection | ✅ Safe | No shell/exec calls in design |
| Path Traversal | ✅ Mitigated | `path.basename(pyRuleName)` + character replacement (TDD §7.3) |
| XSS | N/A | No HTML rendering — REST API only |
| Prototype Pollution | ⚠️ Low risk | `z.record(z.unknown())` parses JSON — standard `JSON.parse` is safe; no `Object.assign` with raw user objects |
| ReDoS | ✅ Low | Zod regex `/^[a-f0-9]{12}$/` is anchored and bounded — no catastrophic backtracking |

**`traversePath` analysis:** Operates on parsed JSON objects using property access (`obj[key]`). No `eval()`, no `Function()` constructor, no dynamic code execution. Safe by construction.

---

### 7. Session Management

| Aspect | Assessment |
|--------|------------|
| Pega auth session | Managed by existing `PegaHttpClient` — out of scope for this ticket |
| Backend session | Stateless (no session) — each POST is independent | ✅ Appropriate |
| Token lifetime | N/A — no tokens issued by backend |
| CSRF | N/A — no browser clients, no cookies |

---

## Positive Security Practices Noted ✅

1. **Credential isolation** — Pega auth never touches the backend process
2. **Fail-fast validation** — Zod at route boundary rejects malformed input early
3. **Bounded recursion** — dedupSet guarantees BFS termination (no infinite loops)
4. **Path sanitization** — `path.basename()` prevents directory traversal in file saves
5. **Error code pattern** — Structured error responses without stack trace leakage
6. **Body size limit** — 10MB cap prevents memory exhaustion from oversized payloads
7. **Sequential writes** — SQLite WAL mode with no parallel writes avoids corruption

---

## Recommendations Summary

### Immediate (before implementation)

1. **Verify localhost binding** — Ensure `HttpServer.ts` binds to `127.0.0.1` (not `0.0.0.0`). Add a startup log confirming binding address.
2. **Document the "no auth" assumption** — Add a security note in TDD §7 stating: "This endpoint is safe without auth ONLY because the server binds exclusively to loopback. If network binding changes, auth MUST be added."

### Short-term (during implementation)

3. **Add ingestion audit log** — Structured log per rule: `{ event: 'rule_ingested', projectId, pxObjClass, timestamp }` for debugging and forensics.
4. **Output encoding on any future rendering** — If rule content is ever displayed in webview or logs, apply HTML/JSON encoding to prevent stored XSS.

### Long-term (hardening)

5. **Optional per-session token** — Generate random token at backend startup, pass to extension, validate on each request. Defense-in-depth for shared machine scenarios.
6. **Hard cap on dedupSet** — Add configurable max (default 200K) with graceful abort + user notification.
7. **Data classification documentation** — Document what rule types may contain sensitive data and provide guidance for enterprise environments.

---

## Conclusion

No Critical or High findings. The design appropriately leverages localhost isolation, parameterized queries, and input validation. The two Medium findings (no-auth endpoint + unencrypted rule files) are **acceptable for the current threat model** (single-user dev tool on localhost) but should be documented as constraints. No TDD changes required — proceed to Phase 4.
