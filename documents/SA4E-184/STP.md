# Software Test Plan (STP)

## SA4E-184 — WebModule: Internet/Network Tools

| Field | Value |
|-------|-------|
| Ticket | SA4E-184 |
| Related TDD | TDD-v1-SA4E-184.docx |
| Version | 1 |

---

## 1. Test Strategy

### 1.1 Scope

Unit testing for WebSearchHandler — the only handler missing test coverage.
Other handlers (FetchUrlHandler) and utilities already have tests.

### 1.2 Test Levels

| Level | Scope | Tool | Status |
|-------|-------|------|--------|
| UT | WebSearchHandler logic | Vitest + mocked fetch | ❌ To create |
| UT | FetchUrlHandler logic | Vitest + mocked fetch | ✅ Exists |
| UT | Utility functions | Vitest | ✅ Exists |

### 1.3 Test Approach

Follow existing pattern from `fetch-url-handler.test.ts`:
- Mock `global.fetch` via `vi.stubGlobal`
- Create real `RateLimiter` (high RPM to not interfere with logic tests)
- Create real `WebModuleConfig` with test values
- Verify handler behavior for success, failure, caching, rate limiting

---

## 2. Test Cases — WebSearchHandler

| TC-ID | Category | Description | Priority |
|-------|----------|-------------|----------|
| TC-01 | Happy Path | Search with valid query returns structured results from SearXNG | Critical |
| TC-02 | Happy Path | Search respects num_results limit (caps at 10) | High |
| TC-03 | Happy Path | Search with category and language parameters | Medium |
| TC-04 | Fallback | SearXNG fails → falls back to DuckDuckGo | Critical |
| TC-05 | Caching | Same query returns cached result without refetching | Critical |
| TC-06 | Caching | no_cache=true bypasses cache | High |
| TC-07 | Validation | Empty query throws INVALID_URL error | Critical |
| TC-08 | Rate Limit | Rate limit exhausted throws RATE_LIMITED error | High |
| TC-09 | Error | Both SearXNG and DuckDuckGo fail → TIMEOUT error | High |
| TC-10 | Edge Case | Query with special characters encoded properly | Medium |

---

## 3. Requirements Traceability Matrix (RTM)

| Requirement | Test Cases |
|-------------|-----------|
| AC-1.1 (structured results) | TC-01 |
| AC-1.2 (SearXNG + DDG fallback) | TC-01, TC-04 |
| AC-1.3 (caching 10 min) | TC-05, TC-06 |
| AC-1.4 (max 10 results) | TC-02 |
| AC-1.5 (category/language) | TC-03 |
| AC-1.6 (rate limiting) | TC-08 |
| BR-03 (token bucket) | TC-08 |
| BR-10 (cache TTL) | TC-05 |

---

## 4. Test Environment

- Runtime: Node.js 18+
- Framework: Vitest
- Mocking: `vi.stubGlobal('fetch', ...)` for HTTP calls
- No external services needed (all mocked)
- Run: `npx vitest run backend/src/modules/web/__tests__/web-search-handler.test.ts`
