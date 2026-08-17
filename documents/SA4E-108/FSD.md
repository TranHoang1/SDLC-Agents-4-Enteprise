# Functional Specification Document (FSD)

## SA4E Code Intelligence — SA4E-108: [Indexing] Project-Type-Aware Workspace Indexing Strategy

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | SA4E-108 |
| Title | [Indexing] Project-Type-Aware Workspace Indexing Strategy |
| Author | BA Agent |
| Reviewer | TA Agent |
| Version | 1.0 |
| Date | 2026-08-13 |
| Status | Draft |
| Related BRD | BRD-v1-SA4E-108.docx |

---

## 1. Use Cases

### UC-01: Detect Project Type Automatically

**Actor:** Developer (via Extension)
**Preconditions:** Workspace opened, backend running, KB contains PROJECT_TYPE_CONFIG entries
**Postconditions:** Project type detected and cached in registry

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | Developer | | Triggers workspace indexing (open workspace or manual re-index) |
| 2 | | Extension | Sends indexing request to backend with workspace_path |
| 3 | | Backend | Queries KB for all PROJECT_TYPE_CONFIG entries (mem_search) |
| 4 | | Backend | Caches type definitions in-memory if not already cached |
| 5 | | Backend | Scans workspace root (up to 2 levels) for build-file signatures |
| 6 | | Backend | For each KB type definition, matches signals against found files |
| 7 | | Backend | Each match returns confidence score (0.0-1.0) |
| 8 | | Backend | Selects highest-confidence type (>= 0.5 threshold) |
| 9 | | Backend | Persists detected type in project_type_cache table |
| 10 | | Backend | Returns DetectionResult to indexing pipeline |

**Alternative Flows:**

- **AF-1 (Cache Hit):** At step 5, if project_type_cache has valid entry → skip to step 10
- **AF-2 (Multiple Types):** At step 8, if multiple types tie → trigger mono-repo detection (UC-04)
- **AF-3 (KB Empty):** At step 3, if no PROJECT_TYPE_CONFIG in KB → use built-in fallback defaults

**Exception Flows:**

- **EF-1 (KB Unavailable):** At step 3, if KB connection fails → log warning, use fallback (UC-06)
- **EF-2 (Detection Timeout):** If detection exceeds 500ms → abort, use fallback
- **EF-3 (No Match):** If no type >= 0.5 confidence → trigger LLM discovery (UC-09) + use fallback

---

### UC-02: Exclude Build Artifacts by Type

**Actor:** System (automatic)
**Preconditions:** Project type detected (UC-01 complete)
**Postconditions:** Type-specific artifacts excluded from scan

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | | Backend | Receives DetectionResult with project_type |
| 2 | | Backend | Loads exclude_patterns from KB type definition |
| 3 | | Backend | Merges with base excludes (.git/, .svn/, .hg/) |
| 4 | | Backend | Replaces DEFAULT_EXCLUDE with merged patterns |
| 5 | | Backend | Passes resolved excludes to async-file-scanner |

**Alternative:** If type is "fallback" → use DEFAULT_EXCLUDE unchanged.

---

### UC-03: Prioritize Source Roots

**Actor:** System (automatic)
**Preconditions:** Type detected, source_roots in type definition

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | | Backend | Loads source_roots and test_roots from type definition |
| 2 | | Backend | Classifies directories: production / test / config / other |
| 3 | | Backend | Orders scan: source_roots → test_roots → remaining |
| 4 | | Backend | Tags each file with source_category metadata |

---

### UC-04: Detect Mono-repo Sub-Projects

**Actor:** System (triggered by mono_repo_signals match)
**Preconditions:** Mono-repo signal detected

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | | Backend | Detects mono-repo signal file (lerna.json, nx.json, etc.) |
| 2 | | Backend | Parses workspace definition to enumerate packages |
| 3 | | Backend | Runs UC-01 independently for each sub-project |
| 4 | | Backend | Assigns per-project strategy |
| 5 | | Backend | Stores sub-project boundaries in cache |

**Exceptions:**
- Parse failure → fall back to single-project detection
- > 20 sub-projects → index top 20, log warning

---

### UC-05: Cache Project Type

**Actor:** System (after detection)

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | | Backend | Detection returns type + confidence + source_roots |
| 2 | | Backend | Computes SHA256 of build file for invalidation check |
| 3 | | Backend | Writes to project_type_cache table |
| 4 | | Backend | On next index: compares build_file_hash → skip if unchanged |

**Cache Invalidation:** Build file changed/removed → delete cache → re-detect.

---

### UC-06: Fallback to Default Strategy

**Actor:** System (when no match)

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | | Backend | No type >= 0.5 confidence |
| 2 | | Backend | Activates DEFAULT_EXCLUDE + DEFAULT_EXTENSIONS |
| 3 | | Backend | Logs warning with workspace path |
| 4 | | Backend | Proceeds with indexing normally |
| 5 | | Backend | Triggers UC-09 (LLM discovery) in background |

---

### UC-07: Separate Test from Production Code

**Actor:** System (during scan)

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | | Backend | Loads test_roots patterns from type definition |
| 2 | | Backend | For each file: match against test patterns |
| 3 | | Backend | Assign source_category: test / production / config / other |
| 4 | | Backend | Store category in file metadata |

---

### UC-08: Add New Project Type via KB

**Actor:** Platform Engineer

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | Admin | | Prepares PROJECT_TYPE_CONFIG JSON |
| 2 | Admin | | Calls mem_ingest(content, type="ARCHITECTURE", tags="project-type-config,{id}") |
| 3 | | KB | Stores entry |
| 4 | | Backend | Next detection includes new type (after cache refresh) |

**Alternative:** First startup with empty KB → auto-ingest 15 seed types from JSON file.

---

### UC-09: LLM Auto-Discovery

**Actor:** System (async, triggered by UC-06)
**Preconditions:** Fallback activated, rate limit not exceeded, LLM available

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | | Backend | Checks rate limit (1/workspace/24h) |
| 2 | | Backend | Collects top 50 filenames from root |
| 3 | | Backend | Sends to LLM with discovery prompt |
| 4 | | LLM | Returns PROJECT_TYPE_CONFIG JSON or null |
| 5 | | Backend | Validates with zod schema |
| 6 | | Backend | Checks dedup (type_id not in KB) |
| 7 | | Backend | Ingests to KB with auto_discovered=true |

**Exceptions:** Rate limited → skip | LLM timeout → abort | Invalid schema → reject | Null → no action | Duplicate → skip

---

## 2. Business Rules

| ID | Rule | Source |
|----|------|--------|
| BR-01 | Confidence threshold = 0.5 (below → fallback) | BRD Story 1 |
| BR-02 | Type excludes REPLACE DEFAULT_EXCLUDE; base excludes always apply | BRD Story 2 |
| BR-03 | Source roots indexed BEFORE other files | BRD Story 3 |
| BR-04 | Mono-repo: max 20 sub-projects | BRD Story 4 |
| BR-05 | Cache valid if build file hash unchanged | BRD Story 5 |
| BR-06 | Manual re-index bypasses cache | BRD Story 5 |
| BR-07 | Fallback = DEFAULT_EXCLUDE + DEFAULT_EXTENSIONS | BRD Story 6 |
| BR-08 | Detection < 500ms including KB query | BRD NFR |
| BR-09 | KB type definitions cached in-memory | BRD Story 8 |
| BR-10 | Cache invalidated on KB update or manual refresh | BRD Story 8 |
| BR-11 | LLM discovery: 1/workspace/24h | BRD Story 9 |
| BR-12 | LLM output must pass zod validation | BRD Story 9 |
| BR-13 | Auto-discovered types flagged auto_discovered=true | BRD Story 9 |
| BR-14 | LLM discovery async, non-blocking | BRD Story 9 |
| BR-15 | KB unavailable → built-in fallback defaults | BRD Story 8 |

---

## 3. Data Specifications

### 3.1 ProjectTypeConfig (KB Entry)

```typescript
interface ProjectTypeConfig {
  type_id: string;
  display_name: string;
  signals: Signal[];
  source_roots: string[];
  test_roots?: string[];
  exclude_patterns: string[];
  extensions: string[];
  mono_repo_signals?: string[];
  priority?: number;
  auto_discovered?: boolean;
}

interface Signal {
  file: string;
  confidence: number;
}
```

### 3.2 DetectionResult

```typescript
interface DetectionResult {
  project_type: string;
  build_tool: string;
  confidence: number;
  detected_files: string[];
  source_roots: string[];
  test_roots: string[];
  exclude_patterns: string[];
  extensions: string[];
  is_mono_repo: boolean;
  sub_projects?: SubProject[];
}

interface SubProject {
  path: string;
  type: string;
  source_roots: string[];
}
```

### 3.3 Cache Table

```sql
CREATE TABLE IF NOT EXISTS project_type_cache (
  workspace_path TEXT PRIMARY KEY,
  project_type TEXT NOT NULL,
  build_tool TEXT,
  source_roots TEXT NOT NULL,
  test_roots TEXT,
  exclude_patterns TEXT NOT NULL,
  extensions TEXT NOT NULL,
  detection_confidence REAL NOT NULL,
  build_file_hash TEXT,
  is_mono_repo INTEGER DEFAULT 0,
  sub_projects TEXT,
  last_discovery_at TEXT,
  detected_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

---

## 4. API Contracts

### 4.1 ProjectTypeDetector

```typescript
class ProjectTypeDetector {
  async loadTypeDefinitions(): Promise<ProjectTypeConfig[]>;
  async detect(workspacePath: string): Promise<DetectionResult>;
  async redetect(workspacePath: string): Promise<DetectionResult>;
  invalidateCache(): void;
}
```

### 4.2 IndexingStrategyResolver

```typescript
class IndexingStrategyResolver {
  resolve(detection: DetectionResult): IndexingConfig;
  getFallback(): IndexingConfig;
}

interface IndexingConfig {
  sourceRoots: string[];
  excludePatterns: string[];
  includeExtensions: string[];
  testRoots: string[];
  scanOrder: 'source_first' | 'default';
}
```

### 4.3 LLMDiscoveryService

```typescript
class LLMDiscoveryService {
  async discoverAsync(workspacePath: string, files: string[]): Promise<void>;
  canDiscover(workspacePath: string): boolean;
}
```

---

## 5. Processing Logic

### 5.1 Four-Phase Indexing

```
Phase 1 — KB LOAD:
  configs = memSearch("project-type-config", type="ARCHITECTURE", limit=50)
  if empty: configs = builtInDefaults()
  cacheInMemory(configs)

Phase 2 — DETECTION:
  if cache.hasValid(path): return cache.get(path)
  signals = scanBuildFiles(path, depth=2)
  matches = configs.filter(c => matchSignals(c.signals, signals) >= 0.5)
  if empty: triggerDiscovery(path); return FALLBACK
  best = maxByScore(matches)
  if hasMonoRepoSignals(best): return detectSubProjects(path, best)
  return buildResult(best)

Phase 3 — RESOLUTION:
  indexConfig = resolver.resolve(detection)

Phase 4 — INDEXING:
  scanner.scanWorkspaceAsync(indexConfig)
```

---

## 6. Error Handling

| Error | Handling | Impact |
|-------|----------|--------|
| KB connection fail | Use built-in defaults | None |
| Detection timeout | Abort, fallback | None |
| LLM timeout | Abort discovery | None (async) |
| Invalid KB entry | Skip, log warning | Type unavailable |
| Cache write fail | Continue without cache | Performance |

---

## 7. NFR (Quantified)

| ID | Requirement | Target |
|----|-------------|--------|
| NFR-01 | Detection latency | < 500ms p95 |
| NFR-02 | Re-index with cache | >= 50% faster |
| NFR-03 | KB query cached | < 50ms |
| NFR-04 | Type definitions | Unlimited |
| NFR-05 | Mono-repo | Up to 20 sub-projects |
| NFR-06 | Fallback | 100% available |
| NFR-07 | New type | 0 code changes |

---

## 8. Diagram Index

| # | Diagram | Image | Source (editable) |
|---|---------|-------|-------------------|
| 1 | System Context | [system-context.png](diagrams/system-context.png) | [system-context.drawio](diagrams/system-context.drawio) |
| 2 | Detection Sequence | [sequence-detection.png](diagrams/sequence-detection.png) | [sequence-detection.drawio](diagrams/sequence-detection.drawio) |
| 3 | State Machine | [state-detection.png](diagrams/state-detection.png) | [state-detection.drawio](diagrams/state-detection.drawio) |
