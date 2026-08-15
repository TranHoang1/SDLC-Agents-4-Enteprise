# Functional Specification Document (FSD) — Concise

## SA4E-160: [Pega Indexing] Auto-load Class Hierarchy via D_pzInheritanceListofClass API

---

| Field | Value |
|-------|-------|
| Ticket | SA4E-160 |
| Author | BA Agent |
| Version | 1.0 |
| Date | 2025-07-27 |
| Status | Draft |
| Parent | SA4E-156 |

---

## 1. Use Cases

### UC-01: Auto-resolve Class Hierarchy on Fetch

**Actor:** Extension (PegaMcpTools crawlRules)

**Precondition:** BFS crawl is active; a `Rule-Obj-Class` rule has just been fetched from Pega.

**Main Flow:**

1. Extension fetches a rule where `pxObjClass = "Rule-Obj-Class"`
2. Extension checks `hierarchyResolved` set — if className already present, SKIP (end)
3. Extension adds className to `hierarchyResolved`
4. Extension calls `PegaHttpClient.fetchClassHierarchy(className)`
5. API returns `pxResults[]` with parent class names
6. Extension filters out `@baseclass` and the class itself
7. For each remaining parent: check `visited` set — if not present, push to BFS queue as `{ ruleType: "Rule-Obj-Class", className: "@baseclass", ruleName: parentClassName }`
8. Parents are processed in subsequent BFS iterations (recursive hierarchy discovery)

**Postcondition:** All ancestor classes are enqueued for download.

---

### UC-02: Graceful Degradation on API Failure

**Actor:** Extension (PegaHttpClient)

**Precondition:** `fetchClassHierarchy` is invoked but Pega API is unreachable or returns error.

**Main Flow:**

1. Extension attempts POST to primary endpoint (`/api/CodeIntelligence/v1/...`)
2. Primary fails (network timeout, non-200, parse error) — try fallback endpoint (`/PRRestService/CodeIntelligence/v1/...`)
3. Fallback also fails — log warning, return empty array `[]`
4. Caller (crawlRules) continues BFS without hierarchy data for this class
5. Backend `computeNextBatch` still provides direct deps (pyDerivesFrom, pySuperClass) as secondary discovery

**Postcondition:** Crawl continues; partial hierarchy may still be discovered via backend direct deps.

**Exception Flows:**

| Condition | Behavior |
|-----------|----------|
| Network timeout (per `fetchWithRetry`) | Retry per existing retry policy, then fail gracefully |
| HTTP 404 | DataPage not available on this Pega version — skip, log |
| HTTP 200 but empty `pxResults` | Return `[]` — class has no parents (or is root) |
| Response JSON missing `pxResults` key | Treat as failure, try next endpoint |
| className is `@baseclass` or empty | Return `[]` immediately — no API call made |

---

### UC-03: Dual Discovery Mechanism (API + Backend)

**Actor:** Extension + Backend

**Precondition:** A Rule-Obj-Class has been ingested by backend.

**Main Flow:**

1. Extension enqueues hierarchy parents via UC-01 (API-driven)
2. Separately, extension POSTs fetched rules to `/pega/crawl-batch`
3. Backend `computeNextBatch` extracts direct deps (pyClassName, pyDerivesFrom, pySuperClass) from ingested rule JSON
4. Backend returns `nextBatch[]` with unfetched dependencies
5. Extension enqueues nextBatch items into BFS queue
6. Dedup via `visited` set prevents double-fetching classes discovered by both mechanisms

**Postcondition:** Full inheritance chain discovered through complementary paths.

---

## 2. Business Rules

| ID | Rule | Enforcement |
|----|------|-------------|
| BR-01 | `fetchClassHierarchy` SHALL be called only when `pxObjClass === "Rule-Obj-Class"` | Conditional check in crawlRules loop |
| BR-02 | Each class hierarchy resolved at most once per crawl session via `hierarchyResolved` Set | Check `hierarchyResolved.has(className)` before API call |
| BR-03 | `@baseclass` SHALL never be enqueued for download or trigger hierarchy resolution | Filter in `fetchClassHierarchy` return + guard at method entry |
| BR-04 | Backend `computeNextBatch` SHALL continue extracting direct class deps independently | No changes to backend crawl-batch logic |
| BR-05 | Dual endpoint fallback: try `/api/CodeIntelligence/v1/...` first, fall back to `/PRRestService/CodeIntelligence/v1/...` | Sequential attempt in `fetchClassHierarchy` |
| BR-06 | All parent classes enqueued regardless of `pyInheritanceType` (pattern, directed, both) | No type-based filtering in results processing |
| BR-07 | Parent classes already in `visited` set SHALL NOT be re-enqueued | Check `visited.has(parentKey)` before queue push |

---

## 3. API Contract

### 3.1 D_pzInheritanceListofClass DataPage

**Endpoint (primary):**
```
POST {pegaBase}/api/CodeIntelligence/v1/datapage/list?dataPageName=D_pzInheritanceListofClass
```

**Endpoint (fallback):**
```
POST {pegaBase}/PRRestService/CodeIntelligence/v1/datapage/list?dataPageName=D_pzInheritanceListofClass
```

**Request:**

| Header | Value |
|--------|-------|
| Authorization | Bearer / Basic (from `getAuthHeader()`) |
| Content-Type | `text/plain` |
| Accept | `application/json` |

**Request Body:**
```json
{
  "classname": "Work-Cover-"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| classname | string | Yes | Pega class name to resolve hierarchy for |

**Response (200 OK):**
```json
{
  "pxResults": [
    { "pyClassName": "Work-", "pyInheritanceType": "directed" },
    { "pyClassName": "Data-", "pyInheritanceType": "pattern" },
    { "pyClassName": "@baseclass", "pyInheritanceType": "both" }
  ]
}
```

| Field | Type | Description |
|-------|------|-------------|
| pxResults | Array | List of ancestor classes |
| pxResults[].pyClassName | string | Ancestor class name |
| pxResults[].pyInheritanceType | string | `"pattern"` \| `"directed"` \| `"both"` |

**Post-processing by Extension:**
- Filter out entries where `pyClassName === className` (self)
- Filter out entries where `pyClassName === "@baseclass"` (root terminal)
- Return remaining `pyClassName` values as `string[]`

---

### 3.2 fetchClassHierarchy Method Signature

```typescript
/**
 * Fetch full class inheritance hierarchy from Pega.
 * @param className - Class to resolve (e.g. "Common-Work-Activity")
 * @returns Parent class names excluding self and @baseclass
 */
public async fetchClassHierarchy(className: string): Promise<string[]>
```

**Guards:**
- If `!className` — return `[]`
- If `className === "@baseclass"` — return `[]`

---

## 4. Error Handling

| Scenario | HTTP Status | Extension Behavior |
|----------|-------------|-------------------|
| Network timeout | N/A | `fetchWithRetry` handles retries; on final failure, log + try fallback endpoint |
| Connection refused | N/A | Try fallback endpoint; if both fail, return `[]` |
| HTTP 404 | 404 | DataPage doesn't exist on server — `res.ok` is false, try fallback |
| HTTP 401/403 | 401/403 | Auth issue — `res.ok` is false, try fallback (may also fail) |
| HTTP 500 | 500 | Server error — try fallback endpoint |
| Response not JSON | N/A | `res.json()` throws — caught, try fallback |
| `pxResults` not an array | N/A | `!Array.isArray(results)` — `continue` to fallback |
| Empty `pxResults` array | 200 | Valid response — class has no parents, return `[]` |
| Both endpoints fail | N/A | Log `[PegaHttpClient] fetchClassHierarchy attempt failed`, return `[]` |
| Exception in caller (crawlRules) | N/A | Outer catch adds `key.insKey` to visited, continues BFS |

**Key principle:** Hierarchy resolution is best-effort. Failure never blocks the crawl. Backend `computeNextBatch` provides a secondary discovery path.

---

## 5. Data Flow Summary

```
crawlRules BFS loop
  |-- fetch Rule-Obj-Class from Pega (getObject)
  |-- IF pxObjClass === "Rule-Obj-Class" AND NOT hierarchyResolved
  |     |-- hierarchyResolved.add(className)
  |     |-- fetchClassHierarchy(className)
  |     |     |-- POST primary endpoint
  |     |     |-- fallback POST secondary endpoint
  |     |     +-- return filtered parent names[]
  |     +-- for each parent NOT in visited -> queue.push()
  |-- POST fetched rules to /pega/crawl-batch
  |     +-- backend computeNextBatch -> nextBatch[] (direct deps)
  +-- enqueue nextBatch items (dedup via visited)
```

---

## 6. Non-Functional Requirements

| Category | Requirement |
|----------|-------------|
| Performance | Max 1 API call per unique class (via `hierarchyResolved` set) |
| Reliability | Graceful degradation — crawl never blocked by hierarchy API failure |
| Termination | `visited` + `hierarchyResolved` sets guarantee finite execution |
| Compatibility | Dual endpoint fallback supports both Pega URL patterns |
| Idempotency | Same className always produces same hierarchy (API is stateless) |
