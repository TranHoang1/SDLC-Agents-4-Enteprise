# Business Requirements Document (BRD)

## SA4E — SA4E-160: [Pega Indexing] Auto-load Class Hierarchy via D_pzInheritanceListofClass API

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | SA4E-160 |
| Title | [Pega Indexing] Auto-load Class Hierarchy via D_pzInheritanceListofClass API |
| Author | BA Agent |
| Version | 1.0 |
| Date | 2025-07-27 |
| Status | Draft |
| Parent Ticket | SA4E-156 (Schema-Driven Relative Discovery + DataPage Enumeration) |

---

## Author Tracking

| Role | Name - Position | Responsibility |
|------|-----------------|----------------|
| Author | BA Agent – Business Analyst | Create document |
| Peer Reviewer | TA Agent – Technical Architect | Review document |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-07-27 | BA Agent | Initiate document — auto-generated from Jira ticket SA4E-160 |

---

## Sign-Off

| Name | Signature and date |
|------|--------------------|
| | ☐ I agree and confirm all criteria on this BRD as expected requirements |
| | ☐ I agree and confirm all criteria on this BRD as expected requirements |

---

## 1. Introduction

### 1.1 Scope

Enhance the Pega workspace indexing pipeline (SA4E-156) to automatically resolve the **full class inheritance hierarchy** when downloading a Rule-Obj-Class. Currently, the system only downloads direct class references (`pyClassName`, `pyDerivesFrom`, `pySuperClass`) extracted from rule JSON. This leaves gaps when rules reference OOTB/platform classes (e.g., `Common-BC-EDA-Tracking-Event`, `FLAudit-Work-`, `Work-Cover-`) whose parent classes are not present in the local workspace.

The solution calls the Pega DataPage `D_pzInheritanceListofClass` for each fetched class to retrieve its full inheritance chain (pattern + directed), then auto-enqueues all parent classes for download with deduplication.

### 1.2 Out of Scope

- Changes to the Pega DataPage `D_pzInheritanceListofClass` definition itself (assumed pre-existing on Pega platform)
- Modifications to the schema-driven relative discovery logic (SA4E-156 — unchanged)
- Downloading rule artifacts other than Rule-Obj-Class from the hierarchy
- UI changes to the VS Code extension
- Authentication/authorization changes for Pega API access

### 1.3 Preliminary Requirement

- SA4E-156 implemented and functional (schema-driven crawl pipeline)
- DataPage `D_pzInheritanceListofClass` must exist and be accessible on the target Pega server
- Backend `/pega/crawl-batch` endpoint operational with `computeNextBatch` returning class dependencies
- Extension `PegaHttpClient` has network access to Pega server API endpoints

---

## 2. Business Requirements

### 2.1 High Level Process Map

When the Pega indexing pipeline encounters a Rule-Obj-Class during the BFS crawl:

1. Extension fetches the class rule JSON from Pega
2. Extension calls `D_pzInheritanceListofClass` API with the class name
3. API returns all parent classes (pattern + directed inheritance) in `pxResults[]`
4. Extension filters out `@baseclass` and the class itself
5. Extension checks each parent against the visited set (dedup)
6. Unvisited parents are enqueued for download as Rule-Obj-Class
7. Process repeats recursively until no new parents are discovered

### 2.2 List of User Stories / Use Cases

| # | Story / Use Case / Epic | Priority | Source Ticket |
|---|-------------------------|----------|---------------|
| 1 | As a developer, I want all parent classes in the inheritance hierarchy automatically downloaded so that class resolution is complete for code intelligence | MUST HAVE | SA4E-160 |
| 2 | As a developer, I want the hierarchy resolution to support both pattern and directed inheritance types | MUST HAVE | SA4E-160 |
| 3 | As a developer, I want deduplication so that each class hierarchy is resolved only once per crawl session | MUST HAVE | SA4E-160 |
| 4 | As a developer, I want the backend to continue providing direct class dependencies (pyClassName, pyDerivesFrom, pySuperClass) via computeNextBatch | MUST HAVE | SA4E-160 |

---

### 2.3 Details of User Stories

---

#### Business Flow

**Problem (Before SA4E-160):**

**Step 1:** Extension crawls rules via BFS (SA4E-156 pipeline)
**Step 2:** When a Rule-Obj-Class is fetched, backend `computeNextBatch` extracts direct references: `pyClassName`, `pyDerivesFrom`, `pySuperClass`
**Step 3:** Only these direct parent classes are enqueued for download
**Step 4:** OOTB/platform classes (e.g., `Work-Cover-`) reference further parent classes that are never discovered
**Step 5:** Code intelligence has incomplete class hierarchy — broken resolution for inheritance-based lookups

**Solution (After SA4E-160):**

**Step 1:** Extension crawls rules via BFS (SA4E-156 pipeline — unchanged)
**Step 2:** When a Rule-Obj-Class is fetched, extension calls `fetchClassHierarchy(className)`
**Step 3:** `fetchClassHierarchy` POSTs to `D_pzInheritanceListofClass` DataPage with `{"classname": "<className>"}`
**Step 4:** API returns `pxResults[]` — each entry has `pyClassName` + `pyInheritanceType` (pattern/directed/both)
**Step 5:** Extension filters results: excludes self + `@baseclass`
**Step 6:** Each remaining parent class is checked against `visited` set — new ones are pushed into the crawl queue as `Rule-Obj-Class`
**Step 7:** Backend `computeNextBatch` still extracts direct deps (pyClassName, pyDerivesFrom, pySuperClass) from ingested rules — providing a secondary discovery path
**Step 8:** Between both mechanisms (API hierarchy + direct deps), full inheritance chain is discovered and downloaded

> **Note:** The `hierarchyResolved` set ensures each class's hierarchy is only resolved once, avoiding duplicate API calls even if the same class is referenced multiple times.

---

#### STORY 1: Auto-load Full Class Inheritance Hierarchy

> As a developer, I want all parent classes in the inheritance hierarchy automatically downloaded so that class resolution is complete for code intelligence.

**Requirement Details:**

1. When the extension fetches a `Rule-Obj-Class` during the BFS crawl, it SHALL call `fetchClassHierarchy(className)` to resolve the full inheritance chain
2. The method calls Pega API endpoint `POST /api/CodeIntelligence/v1/datapage/list?dataPageName=D_pzInheritanceListofClass` with body `{"classname": "<className>"}`
3. The response `pxResults[]` contains all ancestor classes with their inheritance type
4. All returned parent class names (excluding self and `@baseclass`) are enqueued as `Rule-Obj-Class` for download
5. This runs alongside (not replacing) the backend `computeNextBatch` direct dependency extraction

**API Contract:**

| Field | Direction | Type | Description |
|-------|-----------|------|-------------|
| classname | Request body | string | The class to resolve hierarchy for |
| pxResults | Response | Array | List of parent class entries |
| pxResults[].pyClassName | Response | string | Parent class name |
| pxResults[].pyInheritanceType | Response | string | `"pattern"`, `"directed"`, or `"both"` |

**Acceptance Criteria:**

1. When a `Rule-Obj-Class` is fetched, `fetchClassHierarchy` is called with the class name
2. All parent classes returned by the API are enqueued for download (if not already visited)
3. The enqueued parents are processed in subsequent BFS iterations (they themselves may trigger further hierarchy resolution)
4. Classes that are already in the `visited` set are NOT re-fetched
5. If the API call fails (network error, non-200), the crawl continues without the hierarchy data (graceful degradation)
6. `@baseclass` is never enqueued regardless of API response

---

#### STORY 2: Support Pattern and Directed Inheritance

> As a developer, I want the hierarchy resolution to support both pattern and directed inheritance types.

**Requirement Details:**

1. Pega class inheritance has two types:
   - **Directed**: explicit parent class (e.g., `Work-Cover-` extends `Work-`)
   - **Pattern**: implicit parent by class name pattern (e.g., `MyOrg-MyApp-Work-` is a pattern child of `Work-`)
2. The `D_pzInheritanceListofClass` API returns BOTH types in a single response
3. The extension SHALL download ALL parent classes regardless of inheritance type

**Acceptance Criteria:**

1. Parents with `pyInheritanceType = "pattern"` are enqueued
2. Parents with `pyInheritanceType = "directed"` are enqueued
3. Parents with `pyInheritanceType = "both"` are enqueued
4. No filtering is applied based on inheritance type — all types are treated equally for download

---

#### STORY 3: Deduplication of Hierarchy Resolution

> As a developer, I want deduplication so that each class hierarchy is resolved only once per crawl session.

**Requirement Details:**

1. The extension maintains a `hierarchyResolved` set (separate from `visited`) tracking which classes have already had their hierarchy API call made
2. Before calling `fetchClassHierarchy(className)`, the extension checks if `className` is in `hierarchyResolved`
3. If already resolved, the API call is skipped entirely
4. Each returned parent class is checked against the `visited` set before being enqueued

**Acceptance Criteria:**

1. `fetchClassHierarchy` is called at most once per class name per crawl session
2. Parent classes already in `visited` are NOT re-enqueued
3. The `hierarchyResolved` set persists for the full duration of the crawl
4. Total Pega API calls for hierarchy = number of unique classes fetched (not number of references to those classes)

---

#### STORY 4: Backend computeNextBatch Continues Providing Direct Dependencies

> As a developer, I want the backend to continue providing direct class dependencies (pyClassName, pyDerivesFrom, pySuperClass) via computeNextBatch.

**Requirement Details:**

1. The backend `/pega/crawl-batch` endpoint SHALL continue calling `computeNextBatch` on ingested rules
2. `computeNextBatch` extracts direct class references from rule JSON fields: `pyClassName`, `pyDerivesFrom`, `pySuperClass`
3. These are returned in `nextBatch[]` response field
4. The extension enqueues these dependencies alongside the hierarchy-discovered parents
5. This provides a secondary discovery mechanism for class dependencies not captured by the hierarchy API

**Acceptance Criteria:**

1. `POST /pega/crawl-batch` response includes `nextBatch[]` with `pxObjClass`, `pyClassName`, `pyRuleName`, `insKey`
2. Classes discovered by `computeNextBatch` AND by `fetchClassHierarchy` are both enqueued (dedup via `visited` set prevents duplicates)
3. The two discovery mechanisms are complementary — neither replaces the other

---

## 3. Dependencies

| Dependency | Type | Related Ticket | Description |
|------------|------|----------------|-------------|
| SA4E-156 (Pega Indexing Pipeline) | Internal | SA4E-156 | Parent feature — BFS crawl infrastructure, PegaMcpTools, PegaHttpClient |
| Pega DataPage `D_pzInheritanceListofClass` | External | N/A | Must exist on target Pega server, accessible via CodeIntelligence API |
| Backend `/pega/crawl-batch` endpoint | Internal | SA4E-94 | Must return `computeNextBatch` results with class dependencies |
| PegaHttpClient | Internal | SA4E-156 | HTTP client for Pega API calls — extended with `fetchClassHierarchy` |

---

## 4. Stakeholders

| Role | Name / Team | Responsibility | Source |
|------|-------------|----------------|--------|
| Developer | Dev Team | Implement extension + backend changes | Assignee |
| Architect | SA Agent | Review technical design | Reviewer |
| QA | QA Team | Verify hierarchy completeness | Tester |

---

## 5. Risks and Assumptions

### 5.1 Risks

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| `D_pzInheritanceListofClass` not available on older Pega versions | Medium | Low | Graceful degradation — if API fails, crawl continues with direct deps only |
| Large hierarchy chains for deeply nested OOTB classes | Low | Medium | Dedup prevents redundant downloads; eventual termination guaranteed by `@baseclass` root |
| API rate limiting when resolving many class hierarchies | Medium | Low | Sequential processing with `fetchWithRetry`; batched crawl limits concurrent Pega calls |
| Incomplete hierarchy response from Pega API | Medium | Low | Backend `computeNextBatch` provides secondary discovery via direct field references |

### 5.2 Assumptions

- `D_pzInheritanceListofClass` returns the complete inheritance chain (all ancestors up to `@baseclass`)
- The API response includes both pattern and directed parents in a single call
- The API is idempotent — same className always returns same hierarchy
- Network latency for hierarchy calls is acceptable (one call per unique class)
- `@baseclass` is always the root terminal — no classes exist above it

---

## 6. Non-Functional Requirements

| Category | Requirement | Details |
|----------|-------------|---------|
| Performance | Hierarchy calls limited to unique classes | `hierarchyResolved` set ensures max 1 API call per class |
| Reliability | Graceful degradation on API failure | If `fetchClassHierarchy` fails, crawl continues without hierarchy data |
| Reliability | Termination guarantee | `visited` set + `hierarchyResolved` set prevent infinite loops |
| Correctness | Complete inheritance chain | All ancestors (pattern + directed) downloaded for every fetched class |
| Compatibility | Dual endpoint fallback | Tries `/api/CodeIntelligence/v1/...` first, falls back to `/PRRestService/CodeIntelligence/v1/...` |

---

## 7. Related Tickets

| Ticket Key | Summary | Status | Type | Relationship |
|------------|---------|--------|------|--------------|
| SA4E-160 | [Pega Indexing] Auto-load Class Hierarchy via D_pzInheritanceListofClass API | In Progress | Story | Main ticket |
| SA4E-156 | [Pega Indexing] Schema-Driven Relative Discovery + DataPage Enumeration | Done | Story | Parent feature |
| SA4E-94 | Pega Indexing — NDJSON Ingest + RuleSet Enumeration | Done | Story | Predecessor |

---

## 8. Appendix

### Glossary

| Term | Definition |
|------|------------|
| D_pzInheritanceListofClass | Pega platform DataPage that returns the full inheritance hierarchy for a given class name, including both pattern and directed ancestors. |
| Pattern Inheritance | Implicit class hierarchy in Pega based on class naming conventions (e.g., `MyOrg-MyApp-Work-` inherits from `Work-` by pattern). |
| Directed Inheritance | Explicit class hierarchy defined via `pyDerivesFrom`/`pySuperClass` fields on the Rule-Obj-Class record. |
| hierarchyResolved | Extension-side Set tracking which classes have already had their hierarchy API call made — prevents duplicate calls. |
| visited | Extension-side Set tracking all rule keys that have been fetched or enqueued — prevents duplicate downloads. |
| computeNextBatch | Backend function that extracts direct class dependencies (pyClassName, pyDerivesFrom, pySuperClass) from ingested rule JSON and returns unfetched ones. |
| @baseclass | The root of all Pega class hierarchies — never downloaded, used as termination condition. |
| OOTB | Out-Of-The-Box — Pega platform-provided classes and rules not part of the custom application. |

### Reference Documents

| Document | Link / Location |
|----------|-----------------|
| SA4E-156 BRD | documents/SA4E-156/BRD.md |
| Extension PegaHttpClient | extension/src/services/PegaHttpClient.ts |
| Extension PegaMcpTools (crawlRules) | extension/src/mcp/PegaMcpTools.ts |
| Backend PegaCrawler (computeNextBatch) | backend/src/modules/pega/PegaCrawler.ts |
| Backend pega-api routes | backend/src/server/routes/pega-api.ts |
