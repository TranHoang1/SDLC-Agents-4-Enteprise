# Technical Design Document (TDD) — Concise

## SA4E-160: [Pega Indexing] Auto-load Class Hierarchy via D_pzInheritanceListofClass API

---

| Field | Value |
|-------|-------|
| Ticket | SA4E-160 |
| Author | SA Agent |
| Version | 1.0 |
| Date | 2025-07-27 |
| Status | Implemented |
| Parent | SA4E-156 |

---

## 1. Architecture Overview

### Decision: Extension-Side Hierarchy Resolution

Class hierarchy resolution executes **entirely on the extension side** (VS Code/Kiro extension), not the backend. Rationale:

1. **Latency** — Extension already holds the BFS loop; adding hierarchy calls inline avoids extra round-trip to backend for orchestration
2. **Simplicity** — Single ownership of the crawl state (`visited`, `hierarchyResolved`, `queue`) in one process
3. **Backend stays stateless** — Backend `computeNextBatch` remains a pure function: rules in → deps out, no session state
4. **Dual discovery** — Extension-side hierarchy API + backend direct deps provide complementary, independent discovery paths with no coupling between them

```
┌─────────────────────────────────────────────────────────┐
│  Extension (PegaMcpTools.crawlRules)                    │
│                                                         │
│  BFS Queue ──► fetch Rule-Obj-Class ──► getObject()     │
│       │                                                 │
│       ├── IF class: fetchClassHierarchy(className)      │
│       │       └── POST D_pzInheritanceListofClass       │
│       │       └── enqueue parents (dedup via visited)   │
│       │                                                 │
│       └── POST /pega/crawl-batch ──► Backend            │
│               └── computeNextBatch() → nextBatch[]      │
│               └── enqueue deps (dedup via visited)      │
└─────────────────────────────────────────────────────────┘
```

---

## 2. Component Design

### 2.1 PegaHttpClient.fetchClassHierarchy()

**Location:** `extension/src/services/PegaHttpClient.ts`

**Responsibility:** Call Pega DataPage API and return filtered parent class names.

**Key Decisions:**

| Decision | Rationale |
|----------|-----------|
| Dual endpoint fallback (primary → fallback) | Different Pega environments expose API under `/api/` or `/PRRestService/` — try both sequentially |
| `Content-Type: text/plain` | Pega CodeIntelligence API convention (body is JSON string but content-type is text/plain) |
| Filter `@baseclass` + self | `@baseclass` is terminal — never download. Self is already being processed |
| Return `string[]` (not objects) | Caller only needs class names for enqueue; `pyInheritanceType` is informational only |
| Reuse `fetchWithRetry` | Existing retry policy (exponential backoff) handles transient failures consistently |

**Guards:**
- `!className` → return `[]`
- `className === '@baseclass'` → return `[]`

### 2.2 PegaMcpTools.crawlRules() — Hierarchy Integration

**Location:** `extension/src/mcp/PegaMcpTools.ts`

**Key Decisions:**

| Decision | Rationale |
|----------|-----------|
| `hierarchyResolved: Set<string>` separate from `visited` | `visited` tracks fetch dedup (insKey-based). `hierarchyResolved` tracks API call dedup (className-based). Different granularity |
| Check `pxObjClass === 'Rule-Obj-Class'` | Only class rules have hierarchy. Other rule types (Flow, Activity) don't have inheritance chains |
| Enqueue parents as `{ ruleType: 'Rule-Obj-Class', className: '@baseclass', ruleName: parent }` | `className: '@baseclass'` signals "fetch by ruleName only" — consistent with existing queue contract |
| Hierarchy call AFTER successful fetch, BEFORE batch POST | Parents discovered early = processed sooner. Doesn't depend on backend response |
| Single `try/catch` wraps fetch + hierarchy | If hierarchy call fails, `visited.add(key.insKey)` ensures BFS continues |

### 2.3 Backend PegaCrawler.computeNextBatch()

**Location:** `backend/src/modules/pega/PegaCrawler.ts`

**Status:** Re-enabled (was previously disabled during SA4E-156 refactoring).

**Role:** Extract direct dependencies from ingested rule JSON fields:
- `pyClassName` — the class the rule belongs to
- `pyDerivesFrom` — explicit parent class
- `pySuperClass` — super class reference

**Key Decision:** Backend provides **secondary discovery** — if the extension hierarchy API fails or is unavailable, `computeNextBatch` still discovers direct parent classes from the rule JSON. This is NOT a fallback in the traditional sense — both mechanisms run independently and contribute to the same `visited` set.

---

## 3. API Design

### D_pzInheritanceListofClass DataPage Contract

| Aspect | Value |
|--------|-------|
| Primary endpoint | `POST {base}/api/CodeIntelligence/v1/datapage/list?dataPageName=D_pzInheritanceListofClass` |
| Fallback endpoint | `POST {base}/PRRestService/CodeIntelligence/v1/datapage/list?dataPageName=D_pzInheritanceListofClass` |
| Auth | Bearer / Basic (from `getAuthHeader()`) |
| Content-Type | `text/plain` |
| Request body | `{"classname": "<className>"}` |
| Response | `{"pxResults": [{"pyClassName": "...", "pyInheritanceType": "pattern|directed|both"}]}` |

**Post-processing:** Filter out entries where `pyClassName === className` (self) or `pyClassName === '@baseclass'` (root terminal).

---

## 4. Implementation Checklist

| # | Item | Status | File |
|---|------|--------|------|
| 1 | Backend re-enable `computeNextBatch` (return direct deps) | ✅ Done | `backend/src/modules/pega/PegaCrawler.ts` |
| 2 | Extension `fetchClassHierarchy` method (dual endpoint + filter) | ✅ Done | `extension/src/services/PegaHttpClient.ts` |
| 3 | Extension `crawlRules` integration (`hierarchyResolved` set + enqueue parents) | ✅ Done | `extension/src/mcp/PegaMcpTools.ts` |
| 4 | Remove `computeNamingPatternAncestors` (superseded by API) | ✅ Done | Removed |

---

## 5. Error Handling — Graceful Degradation Pattern

**Principle:** Hierarchy resolution is **best-effort**. Failure never blocks the crawl.

```
fetchClassHierarchy(className)
  ├── Try primary endpoint
  │     ├── res.ok + valid pxResults → return filtered names
  │     └── fail → log, continue to fallback
  ├── Try fallback endpoint
  │     ├── res.ok + valid pxResults → return filtered names
  │     └── fail → log, return []
  └── return [] (crawl continues without hierarchy data)
```

**Degradation levels:**

| Level | Condition | Behavior |
|-------|-----------|----------|
| Full | Both endpoints respond | All ancestors discovered via API |
| Partial | Both endpoints fail | Backend `computeNextBatch` still provides pyDerivesFrom/pySuperClass |
| Minimal | Backend also misses deps | Only explicit references in rule JSON discovered |

**Termination guarantee:** `visited` set + `hierarchyResolved` set + `@baseclass` filter ensure finite execution regardless of hierarchy depth.

---

## 6. Security Considerations

| Aspect | Assessment |
|--------|------------|
| New secrets | None — reuses existing `getAuthHeader()` (Bearer/Basic from workspace config) |
| New endpoints exposed | None — extension calls existing Pega platform DataPage |
| Data sensitivity | Class names only (no PII, no credentials) |
| Auth token scope | Same token already used for all Pega API calls |
| Network exposure | Extension → Pega server (same path as existing crawl) |
| Rate limiting risk | Mitigated by `hierarchyResolved` set (max 1 call per unique class) |

**No new security surface introduced.** This feature reuses the same authenticated HTTP path as the existing crawl pipeline.

---

## 7. Non-Functional Requirements

| Category | Requirement | Implementation |
|----------|-------------|----------------|
| Performance | Max 1 API call per unique class | `hierarchyResolved` Set |
| Reliability | Crawl never blocked by API failure | Graceful degradation (return `[]`) |
| Termination | Finite execution guaranteed | `visited` + `hierarchyResolved` + `@baseclass` filter |
| Compatibility | Works with both Pega URL patterns | Dual endpoint sequential fallback |
| Idempotency | Same className → same hierarchy | Pega DataPage is stateless/idempotent |
