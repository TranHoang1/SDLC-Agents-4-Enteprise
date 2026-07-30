# TASK — Work Package 5: Security Hardening

## 1. Summary

Security assessment of the Pega parser module and hardening for L3-L4 execution capabilities. The new evaluation capabilities introduce expression injection, XSS, DoS, and stack overflow attack surfaces. This WP builds a sandboxed execution environment with validation, whitelisting, sanitization, and rate limiting.

Reference: [Upgrade Plan §7](../SA4E-56/pega-parser-upgrade-plan.md#7-work-package-5-security-hardening)

## 2. Risk Register

| ID | Risk | Likelihood | Impact | Severity | Mitigation |
|----|------|-----------|--------|----------|------------|
| S-R01 | **Expression injection** — crafted `.pega` file injects malicious expression | Low | Critical | Critical | Sandbox with function whitelist; no `eval()`/`new Function()`; depth limit |
| S-R02 | **HTML XSS** — property values containing `<script>` in UI renderer output | Medium | High | High | HTML-escape all property values, labels, descriptions before rendering |
| S-R03 | **DoS via CPU exhaustion** — decision table with 1M+ rows | Low | High | High | Enforce maxRows=10000, maxEvalTime=5s per query |
| S-R04 | **Stack overflow** — deeply nested expression recursion | Low | Medium | Medium | Max evaluation depth: 100 nested calls |
| S-R05 | **Unbounded memory** — large clipboard context from crafted input | Low | Medium | Medium | Max clipboard depth: 20; max page entries: 5000 |
| S-R06 | **Worker thread pool exhaustion** — concurrent evaluation flood | Low | Medium | Medium | Rate limiter: max 50 concurrent evaluations; queue overflow → 429 |
| S-R07 | **Function whitelist bypass** — unknown @function discovered | Medium | High | High | Whitelist is deny-by-default; new functions require code review |

## 3. Components

| Component | File | Responsibility |
|-----------|------|----------------|
| **PegaEvaluationSandbox** | `backend/src/modules/pega/security/PegaEvaluationSandbox.ts` | Wrap evaluator in worker_thread with timeout (5s default); resource limits |
| **PegaExpressionValidator** | `backend/src/modules/pega/security/PegaExpressionValidator.ts` | Pre-evaluation: validate AST against grammar rules, depth limits, function whitelist |
| **PegaFunctionWhitelist** | `backend/src/modules/pega/security/PegaFunctionWhitelist.ts` | Registry of allowed function names with arg count validation |
| **PegaHtmlSanitizer** | `backend/src/modules/pega/security/PegaHtmlSanitizer.ts` | Escape HTML in UI renderer output (label, value, description) |
| **PegaRateLimiter** | `backend/src/modules/pega/security/PegaRateLimiter.ts` | Limit concurrent evaluations (50) and per-request evaluation count |
| **PegaAccessPolicyParser** | `backend/src/modules/pega/security/PegaAccessPolicyParser.ts` | Parse Rule-Admin-Product/Access Group rules for access policies |

## 4. Sandbox Architecture

```
Main Thread (Hono)
  └─ PegaEvaluationSandbox
       ├─ PegaExpressionValidator (pre-check: depth, whitelist, grammar)
       ├─ Serialize AST + clipboard context → worker payload
       ├─ Post to worker_thread pool
       ├─ Wait with timeout (5s default)
       └─ On timeout: terminate worker, return timeout error

Worker Thread (pool)
  └─ PegaExpressionEvaluator
       ├─ Deserialize payload
       ├─ Walk ExpressionAST
       ├─ Resolve property references against clipboard
       ├─ Call whitelisted functions via PegaFunctionWhitelist
       └─ Report result or error
```

## 5. Effort: 3 person-weeks

| Activity | Weeks | Dependencies |
|----------|-------|-------------|
| Security audit of current codebase | 0.5 | None |
| Expression sandbox (worker_thread + timeout) | 1 | WP1 expression evaluator |
| Expression validator + function whitelist | 0.5 | Sandbox |
| HTML sanitizer for UI renderer | 0.5 | WP4 section renderer |
| Rate limiter + access policy parser | 0.5 | None |
| Penetration test (injection, DoS, edge cases) | 0.5 | All sandbox components |

## 6. Dependencies

| Dependency | Type | Notes |
|-----------|------|-------|
| WP1 — Expression Language Parser | Strong | Must exist before sandbox can wrap it |
| WP3 — Decision evaluator | Strong | Rate limiting per-request |
| WP4 — UI section renderer | Moderate | HTML sanitizer needed at render time |
| WP7 — Worker pool | Overlap | Can reuse worker_thread timeout mechanism |

## 7. Out of Scope
- Authentication/authorization (Bearer token validation already exists)
- Network-level security (TLS, firewall rules)
- Production access policy enforcement
- Secrets management