# Business Requirements Document (BRD)

## Code Intelligence MCP Server — SA4E-56: Unified Code & Pega Rule Indexing Pipeline

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | SA4E-56 |
| Title | Unified Code & Pega Rule Indexing Pipeline |
| Author | BA Agent |
| Version | 1.0 |
| Date | 2026-07-26 |
| Status | Draft |

---

## Author Tracking

| Role | Name - Position | Responsibility |
|------|-----------------|----------------|
| Author | BA Agent – Business Analyst | Create document |
| Peer Reviewer | TA Agent – Technical Analyst | Review document |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-07-26 | BA Agent | Initiate document — auto-generated from Jira ticket SA4E-56 |

---

## Sign-Off

| Name | Signature and date |
|------|--------------------|
| | ☐ I agree and confirm all criteria on this BRD as expected requirements |
| | ☐ I agree and confirm all criteria on this BRD as expected requirements |

---

## 1. Introduction

### 1.1 Scope

SA4E-56 introduces a **unified single-pipeline indexing system** that handles both source code (TypeScript, JavaScript, Java, Python, Kotlin, Go, Rust, Apex) and Pega rules (.pega files) through the same `POST /api/index/source` API endpoint. The scope includes:

- **Unified Indexing API**: A single REST endpoint (`POST /api/index/source`) that accepts files of all supported types, writes them to the workspace, indexes symbols via tree-sitter, resolves dependencies across files, and returns a dependency list with content hashes for change detection.
- **Dependency Resolution**: A new `DependencyResolver` module that parses import statements from TypeScript/JavaScript (`from`/`require`), Java (`import`), Python (`import`/`from`), and Pega rules (reference fields, step methods, pxRuleReferences) to build concrete file-to-file dependency graphs with SHA-256 content hashes.
- **Pega Rule Parsing**: A complete AST parser (`PegaRuleAstParser`) covering 20+ Pega rule types (Activity, DataTransform, Flow, FlowAction, Class, Property, When, Decision Table, Decision Tree, Connector, Service, UI Section, Parse Rule, Access Role, Agent, Test, File, Admin, Utility, Edit, Correspondence, Survey) with symbol extraction and cross-rule reference resolution.
- **Pega Platform Integration via VS Code Extension**: A Settings panel section for Pega Platform connection configuration (endpoint URL, username, password), Test Connection capability, and Fetch Context command that creates `pega-project.json` and `Application.xml` from live Pega server metadata. The `IndexingService` now automatically detects Pega projects during workspace indexing and performs BFS-based rule crawling via `PegaHttpClient`.
- **Version-Aware Deduplication**: The indexing API accepts `gitHash`/`checksum` fields per file. When a file's content hash matches the previously indexed version, the file is skipped — enabling efficient incremental re-indexing.

### 1.2 Out of Scope

- Pega Platform server-side deployment or management (the extension connects to an existing Pega Platform instance)
- Non-textual Pega assets (binary file types, images attached to Pega rules)
- Custom Pega rule types not covered by the 20+ built-in AST builders
- Real-time Pega rule sync or webhook-based change detection (crawl is on-demand during workspace indexing)
- GUI for Pega rule editing within VS Code (Pega rules are read-only indexed artifacts)

### 1.3 Preliminary Requirement

- Backend Node.js server running with tree-sitter WASM grammars installed for source code parsing
- VS Code extension version ≥ 1.16.0 installed
- For Pega features: A running Pega Platform instance (any version that supports PRRestService REST APIs) with operator credentials
- For Pega crawling: Backend must have the pega module routes registered (`/api/v1/pega/*`)

---

## 2. Business Requirements

### 2.1 High Level Process Map

The unified indexing pipeline processes files through a single flow:

1. **Client sends files** via `POST /api/index/source` → includes file content, optional gitHash/checksum
2. **Backend validates and writes** files to workspace (path-safety checked via `resolveWithinWorkspace`)
3. **Backend checks dedup** — if content hash matches existing record, skip re-indexing
4. **Tree-sitter indexer parses** each file using the appropriate language grammar (or Pega parser for .pega files)
5. **Dependency Resolver** scans imports/references in each file and resolves to concrete file paths with SHA-256 hashes
6. **Results stored** in database (files table, symbols table, relationships table)
7. **Backend returns** response with counts (written/skipped/rejected) and full dependency list (`deps` array)
8. **Extension side** (for Pega projects): During workspace indexing, the extension detects Pega projects, BFS-crawls rules from the Pega Platform, and ingests them into the backend

### 2.2 List of User Stories / Use Cases

| # | Story / Use Case / Epic | Priority | Source Ticket |
|---|-------------------------|----------|---------------|
| 1 | As a developer/CI system, I want to POST source code files (any type including .pega) to a single endpoint so that all code entities get indexed and dependency lists are returned | MUST HAVE | SA4E-56 |
| 2 | As a developer, I want the indexer to resolve imports/references to concrete file paths with content hashes so that the system can track cross-file dependencies and detect stale references | MUST HAVE | SA4E-56 |
| 3 | As a developer, I want to configure Pega Platform connection in VS Code and crawl Pega rules from the extension so that Pega rule artifacts are indexed alongside source code | MUST HAVE | SA4E-56 |
| 4 | As a developer, I want the parser to extract symbols and relationships from 20+ Pega rule types so that the code intelligence graph includes Pega artifacts | MUST HAVE | SA4E-56 |
| 5 | As a developer, I want the indexing API to accept gitHash/checksum and skip unchanged files so that re-indexing is efficient | SHOULD HAVE | SA4E-56 |

---

### 2.3 Details of User Stories

---

#### Business Flow

**Step 1:** Backend receives source files via `POST /api/index/source` with file content and optional gitHash/checksum for version-aware dedup.

**Step 2:** Backend validates file paths against workspace root (path-safety check). Files outside workspace are rejected.

**Step 3:** For each file, backend checks if content hash matches existing database record. If matched, file is skipped.

**Step 4:** New/changed files are written to the workspace filesystem and indexed via tree-sitter (or regex fallback) for symbol extraction.

**Step 5:** `DependencyResolver` parses all import statements and references in each file, resolving them to concrete file paths with expected SHA-256 content hashes.

**Step 6:** Backend returns response with written count, skipped count, rejected paths, and full dependency array.

**Step 7 (Extension):** During workspace indexing, the extension checks for Pega project markers (pega-project.json, Application.xml). If found, it BFS-crawls Pega rules from the configured Pega Platform endpoint and ingests them into the backend via crawl-plan/crawl-batch API.

> **Note:** Pega crawling is extension-driven. The backend serves as the storage and indexing engine, while the extension orchestrates the crawl by fetching rules from the Pega Platform and sending them to the backend in batches.

---

#### STORY 1: Unified Indexing API

> As a developer or CI system, I want to POST source code files of any supported type including .pega to a single endpoint (`POST /api/index/source`) so that all code entities get indexed and dependency lists are returned in a single response.

**Requirement Details:**

1. The endpoint `POST /api/index/source` accepts a `{ files: [{ path, content, gitHash?, checksum? }] }` JSON body
2. All supported source code extensions must be accepted: `.ts`, `.tsx`, `.js`, `.jsx`, `.kt`, `.kts`, `.java`, `.py`, `.go`, `.rs`, `.c`, `.cpp`, `.h`, `.hpp`, `.cs`, `.rb`, `.php`, `.swift`, `.scala`, `.sql`, `.sh`, `.yaml`, `.yml`, `.json`, `.toml`, `.gradle.kts`, `.cls`, `.trigger`, `.pega`
3. Authentication is required via Bearer token (session validation)
4. X-Project-Id and X-Workspace-Root headers control scoping (falls back to boot config)
5. Response format: `{ written, skipped, rejected, deps, projectId }`
6. Path-safety check rejects files with `../` traversal outside workspace

**Data Fields (request body):**

| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| files | Array | Yes | Array of source file objects | See files[].path, files[].content |
| files[].path | String | Yes | Relative path within workspace | `src/parsers/pega-parser.ts` |
| files[].content | String | Yes | Full file content | `import { ... } from './types'` |
| files[].gitHash | String | No | Git commit hash for version-aware dedup | `a1b2c3d4` |
| files[].checksum | String | No | Content checksum for version-aware dedup | `e5f6...` |

**Acceptance Criteria:**

1. `POST /api/index/source` with valid `.pega`, `.ts`, `.java`, `.py` files all return HTTP 200 with written count
2. `POST /api/index/source` with a file path using `../` traversal returns the file in the `rejected` array
3. `POST /api/index/source` without authentication returns HTTP 401
4. `POST /api/index/source` with `files: []` (empty array) returns `{ written: 0, skipped: 0, rejected: [], deps: [], projectId }` with HTTP 200
5. The response `deps` array is non-empty when files contain import/reference statements

---

#### STORY 2: Dependency Resolution

> As a developer, I want the indexer to resolve all imports/references in source files to concrete file paths with content hashes so that the system can track cross-file dependencies and detect when referenced files have changed.

**Requirement Details:**

1. `DependencyResolver` must support TypeScript/JavaScript import resolution: both ES module (`from 'module'`) and CommonJS (`require('module')`) syntax
2. Java import resolution: `import com.example.MyClass` → resolves to file paths excluding JDK and common library imports (java.*, javax.*, org.springframework.*, etc.)
3. Python import resolution: relative imports (`from .module import ...`) resolved to `.py` file paths
4. Pega rule reference resolution: Parse Pega rule JSON to extract references from step methods, action transforms, pxRuleReferences array, shapes, pyWhenCondition, pyFlowActionName, and pyClassName fields
5. Local file resolution must try extension priority: `.ts` → `.tsx` → `.js` → `.jsx` → `.mjs` → `.cjs` → `.d.ts`, then fall back to index files
6. Each resolved dependency must include an `expectedHash` (first 16 hex chars of SHA-256 of the target file content)
7. Dependencies with `sourceType: 'remote'` have empty `expectedHash` (file not found locally)
8. Pega dependencies resolved via `PegaRuleAstParser` AST traversal — each reference becomes a `FileDependency`

**Data Fields:**

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| path | String | Resolved file path | `src/engine/parsers/types.ts` |
| expectedHash | String | SHA-256 hash (first 16 hex chars) | `a1b2c3d4e5f67890` |
| sourceType | String | `'local'` or `'remote'` | `local` |
| sourceUrl | String | Optional URL for remote dependencies | `https://...` (when applicable) |

**Acceptance Criteria:**

1. A TypeScript file with `import { X } from './types'` produces a dependency with path `./types.ts` (or `.tsx`, `.js`, etc.)
2. A Java file with `import com.example.service.MyService;` produces a dependency with path `com/example/service/MyService.java`
3. A Python file with `from .utils import helper` produces a dependency with path `utils.py`
4. A `.pega` file with an Activity step calling another activity produces a dependency pointing to the target `.pega` file
5. `expectedHash` is correctly computed as SHA-256 of the resolved file's content (first 16 hex chars)
6. Files that don't exist locally are returned with `sourceType: 'remote'` and empty `expectedHash`

---

#### STORY 3: Pega Platform Integration

> As a developer, I want to configure Pega Platform connection details in VS Code extension settings and crawl Pega rules from the extension so that Pega rule artifacts are indexed alongside source code during workspace indexing.

**Requirement Details:**

1. VS Code Settings panel must include a "Pega Platform Connection" section with:
   - **Endpoint URL** input (text field, default `http://localhost:8080/prweb`)
   - **Username** input (text field)
   - **Password** input (password field, stored securely via VS Code SecretStorage)
   - **Test Connection** button — validates connection by calling `PegaHttpClient.getOperatorContext()`
   - **Fetch Context** button — fetches full Pega context from server, creates `pega-project.json` and `Application.xml` in workspace root
2. During workspace indexing (`indexWorkspace()`), the `IndexingService` must:
   - Detect Pega project by checking for `pega-project.json` or `Application.xml`
   - If detected, perform BFS crawl of Pega rules starting from seed keys (application, ruleset, case types)
   - Use `PegaHttpClient.crawlPlan()` to determine which rules need fetching
   - Fetch missing rules in batches of 50 via `PegaHttpClient.getObject()`
   - Ingest fetched rules into backend via `PegaHttpClient.crawlBatch()`
   - Report total rules crawled and stored
3. All Pega credentials must be stored in VS Code SecretStorage (OS keychain), never in plaintext config files

**UI Specifications (Settings Panel):**

| No. | Name | Type | Required | Description | Note |
|-----|------|------|----------|-------------|------|
| 1 | Pega Endpoint | Input (text) | Yes | Pega Platform base URL | Default: `http://localhost:8080/prweb` |
| 2 | Pega Username | Input (text) | Yes | Pega operator ID | |
| 3 | Pega Password | Input (password) | Yes | Pega operator password | Stored in SecretStorage |
| 4 | Test Connection | Button | No | Validates connection to Pega Platform | Calls getOperatorContext() |
| 5 | Fetch Context | Button | No | Fetches and saves Pega project metadata | Creates pega-project.json + Application.xml |

**Acceptance Criteria:**

1. User can configure Pega endpoint/username/password in Settings panel
2. Password is stored in VS Code SecretStorage (not in settings.json)
3. "Test Connection" button shows success message with operator ID and app name when Pega Platform is accessible
4. "Fetch Context" creates `pega-project.json` with application name, operator info, and case types
5. Workspace indexing with a Pega project detects it automatically and shows progress message `🏛️ Pega Project Detected`
6. BFS crawl respects the visited keys set (no duplicates) and max 1000 iterations safety limit

---

#### STORY 4: Pega Rule Parsing

> As a developer, I want the parser to extract symbols and relationships from Pega rule files (.pega) covering 20+ rule types so that the code intelligence graph includes Pega artifacts alongside source code symbols.

**Requirement Details:**

1. `PegaFileParser` implements `ILanguageParser` and handles `.pega` files which are JSON-formatted Pega rule exports
2. For each `.pega` file, the parser must:
   - Extract the rule name from `pyRuleName`, `pyActivityName`, `pyModelName`, or `pyFlowName`
   - Extract the rule type from `pxObjClass`
   - Create a symbol with kind `pega-rule`
   - Generate a JSON signature containing ruleType, className, ruleset, rulesetVersion, label
   - Extract all cross-rule references as `ExtractedRelationship` objects with kind `references`
3. `PegaRuleAstParser` must support the following rule types via specialized AST builders:
   - Activity (Rule-Obj-Activity) — steps with method calls and parameters
   - DataTransform (Rule-Obj-Model) — actions with transforms and when conditions
   - Flow (Rule-Obj-Flow) — shapes with flow actions and conditions
   - FlowAction (Rule-Obj-FlowAction) — UI form actions
   - Class (Rule-Obj-Class) — class definitions with property references
   - Property (Rule-Obj-Property) — field/property definitions
   - When (Rule-Obj-When) — condition rules
   - Decision Table/Tree (Rule-Declare-DecisionTable, Rule-Declare-DecisionTree)
   - Connector (Rule-Connect-*) — integration connectors
   - Service (Rule-Service-*) — API service definitions
   - HTML Section / UI (Rule-HTML-*, Rule-UI-*) — UI form layouts
   - Parse Rules (Rule-Parse-*, Rule-Map-Structured) — structured data parsing
   - Access Roles (Rule-Access-*) — security privileges
   - Agent/Async (Rule-Agent-*, Rule-Async-*) — background processes
   - Test (Rule-Test-*) — test cases
   - File (Rule-File-*) — file definitions
   - Admin/Security (Rule-Admin-*, Rule-Security-*) — admin config
   - Utility (Rule-Utility-*, Rule-Alias-*) — utility functions
   - Edit/Validate (Rule-Edit-*) — edit rules
   - Correspondence (Rule-Corr-*) — email templates
   - Survey (Rule-PegaQ-*) — survey questions
4. Reference extraction must parse: `pyMethodParameters`, `pyWhenCondition`, `pyFlowActionName`, `pyClassName`, `pySuperClass`, `pyPatternParent`, `pyDerivesFrom`, `pyTransformName`, `pyOnChangeTrigger`, `pxRuleReferences`, step method calls, shape references, and action targets

**Acceptance Criteria:**

1. A `.pega` file with valid JSON produces 1 symbol with kind `pega-rule`
2. An invalid JSON `.pega` file returns a parse error (not a crash)
3. An Activity with a `Call` step to another activity produces a relationship with kind `references`
4. A DataTransform with a `pyWhenCondition` produces a reference to the When rule
5. A Flow with shapes containing `pyFlowActionName` produces references to FlowAction rules
6. A Class with `pxRuleReferences` array produces multiple reference relationships
7. `PegaRuleAstParser.toPromptContext()` produces a human-readable summary of the rule structure

---

#### STORY 5: Version-Aware Deduplication

> As a developer, I want the indexing API to accept optional gitHash/checksum fields and skip files whose content has not changed so that re-indexing is faster and more efficient.

**Requirement Details:**

1. `POST /api/index/source` accepts optional `gitHash` and/or `checksum` fields per file
2. Before writing and indexing a file, the backend checks if a record exists in the `files` table with matching `content_hash`
3. If the first 16 hex chars of gitHash/checksum match the stored `content_hash`, the file is skipped (counted in `skipped` response field)
4. Version-agnostic: the dedup comparison is hash-based, not version-based — any change in file content produces a different hash
5. The skip is per-file: even if one file is skipped, other files in the same batch are still processed

**Acceptance Criteria:**

1. `POST /api/index/source` with the same file content and same gitHash twice: second call returns the file in `skipped` count
2. `POST /api/index/source` with the same file path but different content: file is re-indexed (in `written` count)
3. `POST /api/index/source` without gitHash/checksum: file is always written and indexed (no dedup check)
4. Empty or invalid gitHash/checksum values are ignored (treated as absent)

---

## 3. Dependencies

| Dependency | Type | Related Ticket | Description |
|------------|------|----------------|-------------|
| Tree-sitter WASM Grammars | Infrastructure | N/A | WebAssembly grammars for TypeScript, JavaScript, Java, Python, Kotlin, Go, Rust, Apex |
| Pega Platform | External | N/A | Running Pega Platform instance for Pega rule crawling (extension-side feature) |
| VS Code SecretStorage | Infrastructure | N/A | OS-level secure storage for Pega credentials (extension-side) |
| Backend Pega Routes | Infrastructure | N/A | `/api/v1/pega/*` routes must be registered on the backend for crawl ingestion |
| Node.js fs module | Infrastructure | N/A | File system access for dependency resolver's `readFileSync` local file lookups |

---

## 4. Stakeholders

| Role | Name / Team | Responsibility | Source |
|------|-------------|----------------|--------|
| Developer | Backend Team | Implement unified indexing pipeline, dependency resolver, Pega parser | Feature scope |
| Developer | Extension Team | Implement Pega Platform settings UI, PegaHttpClient, BFS crawl orchestration | Feature scope |
| DevOps | DevOps Team | Deploy backend with tree-sitter WASM grammars, configure Pega Platform connectivity | Cross-team |
| Pega Developer | Pega Team | Configure Pega Platform access, validate Pega rule parsing accuracy | External stakeholder |

---

## 5. Risks and Assumptions

### 5.1 Risks

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Pega Platform version changes may break REST API compatibility | High | Medium | PegaHttpClient tries multiple endpoint URL patterns (with and without /PRRestService prefix) as fallback |
| Large Pega projects with thousands of rules may cause slow workspace indexing | Medium | High | BFS crawl has 1000 iteration safety limit; batch size of 50 rules per request; progress reporting to user |
| tree-sitter WASM grammar unavailable for certain languages | Medium | Low | Regex fallback path still resolves dependencies even without tree-sitter parsing |
| Pega rule JSON format varies across Pega versions | Medium | Medium | PegaRuleAstParser uses field-name-based detection (not position-based); generic builder handles unknown rule types |
| Path-safety bypass via encoded characters | High | Low | `resolveWithinWorkspace()` normalizes paths before validation |

### 5.2 Assumptions

- Pega Platform REST APIs follow standard PRPC patterns (D_OperatorID data page, PRRestService URL structure)
- SHA-256 first 16 hex chars provide sufficient uniqueness for content hash comparison
- VS Code SecretStorage is available on all target platforms (Windows, macOS, Linux)
- .pega files are UTF-8 JSON (not binary formats)
- The backend's tree-sitter/node bindings are available on the target runtime

---

## 6. Non-Functional Requirements

| Category | Requirement | Details |
|----------|-------------|---------|
| Performance | Batch indexing supports at least 50 files per batch | Tree-sitter indexer processes files in batches of 50 |
| Performance | Version-aware dedup should skip unchanged files in < 100ms per file | Hash lookup via indexed `content_hash` column in files table |
| Security | Pega credentials stored in VS Code SecretStorage (OS keychain) | Never stored in settings.json or plaintext files |
| Security | `POST /api/index/source` requires Bearer token authentication | Session validation via `validateSession()` |
| Security | Path traversal attacks prevented | `resolveWithinWorkspace()` rejects any file path escaping workspace root |
| Scalability | BFS crawl limited to 1000 iterations | Safety guard prevents infinite loops on large Pega projects |
| Scalability | Crawl batch size of 50 rules per request | Balances network overhead vs Pega Platform load |
| Availability | Backend Pega API failure is non-fatal | `crawlBatch()`, `crawlPlan()` errors are caught and reported via progress messages; indexing continues for other files |

---

## 7. Related Tickets

| Ticket Key | Summary | Status | Type | Relationship |
|------------|---------|--------|------|--------------|
| SA4E-56 | Unified Code & Pega Rule Indexing Pipeline | To Do | Task | Main ticket |
| SA4E-53 | Indexing Engine Async Refactor | Done | Task | Related — indexing engine foundation |
| SA4E-41 | Path-Safe Indexing (SEC-04/05) | Done | Task | Related — path safety foundation |
| SA4E-44 | Environment Configuration Enhancements | Done | Task | Related — config structure |

---

## 8. Appendix

### Glossary

| Term | Definition |
|------|------------|
| BFS Crawl | Breadth-First Search traversal of Pega rules starting from seed keys |
| tree-sitter | A parser generator tool and incremental parsing library for source code |
| Pega Rule AST | Abstract Syntax Tree representing the structure and references of a Pega rule |
| .pega file | JSON-formatted export of a single Pega Platform rule |
| Dependency Resolver | Module that converts import/reference statements into concrete FileDependency objects |
| Content Hash | First 16 hex characters of SHA-256 hash of file content, used for change detection |
| SecretStorage | VS Code API for secure credential storage (backed by OS keychain) |

### Reference Documents

| Document | Link / Location |
|----------|-----------------|
| BRD Template | `documents/templates/BRD-TEMPLATE.md` |
| FSD Template | `documents/templates/FSD-TEMPLATE.md` |
| Pega Parser Source | `backend/src/engine/parsers/languages/pega-parser.ts` |
| Dependency Resolver Source | `backend/src/engine/parsers/dependency-resolver.ts` |
| Indexing API Routes | `backend/src/server/routes/api-index.ts` |
| Extension Pega Client | `extension/src/services/PegaHttpClient.ts` |
