# Software Test Plan (STP) — SA4E-108

## Project-Type-Aware Workspace Indexing Strategy

| Field | Value |
|-------|-------|
| Author | QA Agent |
| Version | 1.0 |
| Date | 2026-08-13 |

---

## 1. Test Strategy

| Level | Scope | Framework | Coverage |
|-------|-------|-----------|----------|
| UT | Individual functions | Vitest | 90% business logic |
| IT | KB + Detector + Cache + Scanner | Vitest + real SQLite | All UC main flows |
| E2E-API | Full pipeline HTTP | Vitest + supertest | Detection endpoints |
| PBT | Confidence scoring edge cases | fast-check | Boundaries |

---

## 2. RTM (Requirements Traceability)

| BR | Story | Test Cases |
|----|-------|------------|
| BR-01 | Detection threshold | UT-01, UT-02, IT-01, PBT-01 |
| BR-02 | Exclusion replace | UT-03, IT-02 |
| BR-03 | Source root priority | UT-04, IT-03 |
| BR-04 | Mono-repo cap 20 | UT-05, IT-04 |
| BR-05 | Cache validation | UT-06, UT-07, IT-05 |
| BR-07 | Fallback defaults | UT-08, IT-07 |
| BR-08 | 500ms latency | PERF-01 |
| BR-09 | KB in-memory cache | IT-08, IT-09 |
| BR-11 | LLM rate limit | UT-10, IT-10 |
| BR-12 | Zod validation | UT-11, PBT-02 |
| BR-14 | Non-blocking discovery | IT-12 |
| BR-15 | KB fallback | UT-12, IT-13 |

---

## 3. Test Cases

### Unit Tests (12)

| ID | Description | Expected |
|----|-------------|----------|
| UT-01 | matchSignals correct confidence | Highest matching signal score |
| UT-02 | matchSignals no match → 0 | 0.0 |
| UT-03 | Resolver merges base excludes | BASE + type excludes |
| UT-04 | Resolver scanOrder=source_first | source_first |
| UT-05 | hasMonoRepoSignals detection | true for lerna.json |
| UT-06 | Cache miss returns null | null |
| UT-07 | Cache invalidate deletes | null after |
| UT-08 | getFallback returns defaults | DEFAULT_EXCLUDE/EXTENSIONS |
| UT-09 | invalidateConfigCache clears | Reloads from KB next call |
| UT-10 | canDiscover rate limit check | false within 24h |
| UT-11 | Schema rejects invalid config | ZodError |
| UT-12 | loadBuiltInDefaults non-empty | ≥3 types |

### Integration Tests (13)

| ID | Description | Verify |
|----|-------------|--------|
| IT-01 | Java/Maven detection | type=java-maven, conf≥0.9 |
| IT-02 | target/ excluded for Maven | No target/ files |
| IT-03 | Source root priority | src/main first |
| IT-04 | Mono-repo lerna detection | 2+ sub-projects |
| IT-05 | Cache hit fast | Second detect <10ms |
| IT-06 | Redetect bypasses cache | Full detection |
| IT-07 | Unknown workspace fallback | type=fallback |
| IT-08 | Add type at runtime via KB | New type matched |
| IT-09 | Empty KB seeds 15 types | 15 configs loaded |
| IT-10 | Rate limit blocks retry | Second discovery skipped |
| IT-11 | Auto-discovered flag | auto_discovered=true |
| IT-12 | Discovery non-blocking | Pipeline finishes first |
| IT-13 | KB unavailable fallback | Defaults used, no crash |

### PBT (2)

| ID | Property |
|----|----------|
| PBT-01 | ∀ signals, files: 0 ≤ matchSignals ≤ 1 |
| PBT-02 | ∀ valid config JSON: schema.safeParse succeeds |

### Performance (2)

| ID | Target |
|----|--------|
| PERF-01 | Detection < 500ms (10k files) |
| PERF-02 | Cached detection < 10ms |

---

## 4. Test Data

- Fixtures: `tests/fixtures/workspaces/{java-maven,nodejs,python,mono-repo,unknown}/`
- KB seed: `backend/src/data/project-type-seeds.json`

---

## 5. Exit Criteria

- All UT + IT pass
- 0 Critical/High bugs
- PERF-01 met (< 500ms)
- Coverage ≥ 90% for project-type/ modules
