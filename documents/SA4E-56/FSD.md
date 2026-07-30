# Functional Specification Document (FSD)

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
| Related BRD | BRD-v1-SA4E-56.docx |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-07-26 | BA Agent | Initiate document — auto-generated from BRD and Jira ticket SA4E-56 |

---

## 1. Introduction

### 1.1 Purpose

This Functional Specification Document (FSD) specifies the functional requirements for the **Unified Code & Pega Rule Indexing Pipeline** (SA4E-56). It defines the API contracts, processing logic, data models, integration specifications, and user-facing behaviors for extending the Code Intelligence MCP Server to support a unified indexing pipeline that handles both source code and Pega rules through a single endpoint, with automatic dependency resolution, version-aware deduplication, and Pega Platform integration via the VS Code extension.

### 1.2 Scope

This FSD covers:

- **Unified Indexing API** (`POST /api/index/source`): Extended to accept all file types including `.pega`, with gitHash/checksum-based deduplication and dependency list return
- **Dependency Resolution Engine**: Functional specification of how imports (TS/JS, Java, Python) and Pega rule references are resolved to `FileDependency` objects
- **Pega Rule Parser**: Specification of the `.pega` file parsing logic for 20+ Pega rule types
- **Pega Platform Integration**: Settings panel UI, credential management, project detection, BFS crawl orchestration
- **Version-Aware Deduplication**: Content-hash-based skip logic for incremental indexing

Out of scope: Deployment architecture, CI/CD pipeline configuration, performance benchmarking, tree-sitter WASM grammar loading internals (TDD scope).

### 1.3 Definitions & Acronyms

| Term | Definition |
|------|------------|
| BFS | Breadth-First Search — traversal strategy for crawling Pega rules starting from seed keys |
| Content Hash | First 16 hex chars of SHA-256 hash of file content, used for deduplication |
| FileDependency | Interface representing a resolved dependency: `{ path, expectedHash, sourceType, sourceUrl? }` |
| ILanguageParser | Interface for language-specific parsers — `parse(source, filePath) → ParseResult` |
| Pega Rule AST | Abstract Syntax Tree representation of a parsed Pega rule with properties, children, references |
| PegaHttpClient | Extension-side HTTP client for communicating with Pega Platform REST APIs |
| SecretStorage | VS Code API for secure credential storage backed by OS keychain |
| tree-sitter | Parser generator tool for incremental parsing of source code files |
| WASM | WebAssembly — binary format for tree-sitter grammars |

### 1.4 References

| Document | Location |
|----------|----------|
| BRD | `documents/SA4E-56/BRD.md` |
| Pega Parser Source | `backend/src/engine/parsers/languages/pega-parser.ts` |
| Dependency Resolver Source | `backend/src/engine/parsers/dependency-resolver.ts` |
| Indexing API Routes | `backend/src/server/routes/api-index.ts` |
| Extension Pega Client | `extension/src/services/PegaHttpClient.ts` |
| Provider Config Service | `extension/src/services/ProviderConfigService.ts` |
| Settings Panel | `extension/src/panels/settings/SettingsPanel.ts` |
| Settings Message Handler | `extension/src/panels/settings/SettingsMessageHandler.ts` |
| Indexing Service | `extension/src/services/IndexingService.ts` |
| Types Definition | `backend/src/engine/parsers/types.ts` |

---

## 2. System Overview

### 2.1 System Context Diagram

The Unified Code & Pega Rule Indexing Pipeline involves the following actors and systems:

- **Developer / CI System** → Sends source files via `POST /api/index/source`
- **Code Intelligence MCP Server (Backend)** → Receives files, indexes symbols, resolves dependencies, returns results
- **VS Code Extension** → Provides Pega Platform settings UI, detects Pega projects, crawls rules
- **Pega Platform** → External rule repository; serves rule objects via REST APIs
- **VS Code SecretStorage** → Securely stores Pega credentials (OS keychain)
- **Database** → Stores indexed files, symbols, relationships, Pega rules

### 2.2 System Architecture

The system is split into two main components:

**Backend (Node.js / Hono)**:
- `POST /api/index/source` — Unified indexing endpoint accepting all file types
- `TreeSitterIndexer` — Tree-sitter-based parsing engine with dependency resolution integration
- `DependencyResolver` — File-level import/reference resolver for TS/JS, Java, Python, and Pega
- `PegaFileParser` + `PegaRuleAstParser` — Pega rule parsing with 20+ rule type builders
- `FileScanner` — Workspace file scanner with `.pega` extension support
- `IndexingEngine` — Orchestrates full/partial indexing including `indexSingleFile()`
- `POST /api/v1/pega/*` — Pega rule ingestion endpoints (crawl-plan, crawl-batch, etc.)

**Extension (VS Code / TypeScript)**:
- `SettingsPanel` — Webview-based settings UI with Pega Platform Connection section
- `PegaHttpClient` — HTTP client for Pega Platform REST APIs
- `IndexingService.indexPegaProject()` — Pega project detection and BFS rule crawl
- `ProviderConfigService.updatePegaConfig()` — Credential management via SecretStorage
- `AuthManager.getLastUsername()` — Login UX improvement (remembers last username)

The indexing flow:
1. **Direct API**: Developer/CI → POST files → Backend indexes + returns deps
2. **Extension-driven Pega crawl**: Extension detects Pega project → BFS crawl Pega Platform → Ingest into Backend

---

## 3. Functional Requirements

### 3.1 Feature: Unified Indexing API (`POST /api/index/source`)

**Source:** BRD Story 1 — Unified Indexing API

#### 3.1.1 Description

The `POST /api/index/source` endpoint is the single entry point for indexing all source code and Pega rule files. It accepts a batch of files, writes them to the workspace (with path-safety validation), performs version-aware deduplication, indexes each file for symbols and relationships, resolves all cross-file dependencies, and returns a comprehensive response.

#### 3.1.2 Use Case

**Use Case ID:** UC-01
**Actor:** Developer / CI System
**Preconditions:** Valid authentication session exists; Backend is running with tree-sitter grammars loaded
**Postconditions:** Files are written to workspace; Database contains indexed symbols, relationships, and dependency records; Response with results is returned

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | Developer sends POST /api/index/source | | HTTP POST with JSON body: `{ files: [{ path, content, gitHash?, checksum? }] }` |
| 2 | | Backend validates | Extracts X-Project-Id and X-Workspace-Root headers; validates Bearer token |
| 3 | | Backend checks path safety | For each file, calls `resolveWithinWorkspace()` to prevent path traversal |
| 4 | | Backend checks dedup | For files with gitHash/checksum: queries `files` table for matching `content_hash` |
| 5 | | Backend writes files | Creates directories and writes file contents to workspace |
| 6 | | Backend indexes each file | Calls `indexer.indexSingleFile()` → tree-sitter parse → symbol extraction → relationship extraction |
| 7 | | Backend resolves dependencies | `DependencyResolver.resolve()` parses imports/references → resolves to FileDependency[] |
| 8 | | Backend collects deps | Collects all FileDependency objects, deduplicating by path |
| 9 | | Backend returns response | JSON: `{ written: N, skipped: N, rejected: [...], deps: [...], projectId: "..." }` |

**Alternative Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| AF-01 | No X-Project-Id header | Falls back to boot `config.projectId` from server config |
| AF-02 | No X-Workspace-Root header | Falls back to boot `config.workspace` from server config |
| AF-03 | gitHash/checksum matches existing hash | File is counted in `skipped`, not written or re-indexed |
| AF-04 | No gitHash/checksum provided | File is always written and indexed (no dedup check) |

**Exception Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| EF-01 | Authentication fails (invalid/expired token) | Returns HTTP 401 `{ error: "Unauthorized" }` |
| EF-02 | `files` array is missing or not an array | Returns HTTP 400 `{ error: "files array required" }` |
| EF-03 | File path escapes workspace (path traversal) | File added to `rejected` array; logged as warning; other files continue |
| EF-04 | File write fails | Logged as error; other files continue; affected file not in `written` count |
| EF-05 | Indexing of a single file fails (parse error) | Error logged as warning; other files continue; dependencies still resolved for successful files |

#### 3.1.3 Business Rules

| Rule ID | Rule | Source |
|---------|------|--------|
| BR-01 | Only authenticated requests (valid Bearer token) may access `/api/index/source` | BRD Story 1 AC-3 |
| BR-02 | Files with path traversal (`../`) outside workspace are rejected, never written | BRD Story 1 AC-2 |
| BR-03 | Content hash comparison uses first 16 hex chars of SHA-256 | BRD Story 5 |
| BR-04 | Empty `files` array returns `{ written: 0, ... }` with HTTP 200, not an error | BRD Story 1 AC-4 |
| BR-05 | All supported extensions including .pega are accepted through the same endpoint | BRD Story 1 AC-1 |
| BR-06 | Rejected files due to path safety are logged but do not fail the entire request | BRD Story 1 requirement 6 |

#### 3.1.4 Data Specifications

**Input Data (request body JSON):**

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| files | Array | Yes | Must be non-null array | Array of source file objects |
| files[].path | String | Yes | Must be relative path, no `..` traversal | File path relative to workspace root |
| files[].content | String | Yes | Must be non-empty string | Full text content of the file |
| files[].gitHash | String | No | First 16 chars used for hash comparison | Git commit hash for version detection |
| files[].checksum | String | No | First 16 chars used for hash comparison | Alternative content checksum |

**Output Data (response JSON):**

| Field | Type | Description |
|-------|------|-------------|
| written | Number | Count of files successfully written and indexed |
| skipped | Number | Count of files skipped due to hash match (dedup) |
| rejected | String[] | List of file paths rejected for path-safety violations |
| deps | FileDependency[] | All collected file dependencies (deduplicated by path) |
| projectId | String | The project scope used for indexing |

**FileDependency Object:**

| Field | Type | Description |
|-------|------|-------------|
| path | String | Resolved file path relative to workspace |
| expectedHash | String | SHA-256 hash (first 16 hex chars) of target file content |
| sourceType | String | `"local"` if file exists and was hashed; `"remote"` if file not found |
| sourceUrl | String | Optional URL for external dependencies (future use) |

#### 3.1.5 UI Specifications

*No dedicated UI for this API feature. The endpoint is consumed programmatically by CI systems and the VS Code extension's IndexerHttpClient.*

#### 3.1.6 API Contract (Functional View)

**Endpoint:** `POST /api/index/source`
**Purpose:** Index source code and Pega rule files, returning dependency lists

**Input Parameters:**

| Parameter | Type | Required | Business Rule | Description |
|-----------|------|----------|---------------|-------------|
| X-Project-Id | Header | No (boot default) | BR-01 | Project scope for multi-tenant indexing |
| X-Workspace-Root | Header | No (boot default) | BR-02 | Workspace root path for path-safety checks |
| Authorization | Header | Yes | BR-01 | Bearer token from login session |
| files | Body/JSON | Yes | BR-04 | Array of source file objects |

**Output Data:**

| Field | Type | Description |
|-------|------|-------------|
| written | Number | Count of files written and indexed |
| skipped | Number | Count of files skipped (content unchanged) |
| rejected | String[] | Paths rejected for safety violations |
| deps | FileDependency[] | Resolved dependency list |
| projectId | String | Active project scope |

**Business Error Scenarios:**

| Scenario | User Message | Trigger Condition |
|----------|-------------|-------------------|
| Unauthenticated | `{ "error": "Unauthorized" }` | Missing or invalid Bearer token |
| Invalid input | `{ "error": "files array required" }` | Body missing `files` field or files is not an array |
| Project required | `{ "error": "X-Project-Id required for indexing" }` | No X-Project-Id header and no boot config |
| Internal error | `{ "error": "Internal error" }` | Unexpected backend error |

---

### 3.2 Feature: Dependency Resolution

**Source:** BRD Story 2 — Dependency Resolution

#### 3.2.1 Description

The `DependencyResolver` is a new module that parses all import statements and rule references within indexed files and resolves them to concrete file paths with expected SHA-256 content hashes. It supports four language families: TypeScript/JavaScript (ESM + CJS), Java, Python, and Pega rules.

#### 3.2.2 Use Cases

**Use Case ID:** UC-02
**Actor:** Indexer (TreeSitterIndexer / IndexingEngine)
**Preconditions:** File content is available as a string; file path and workspace root are known
**Postconditions:** Array of `FileDependency` objects returned; each resolved dependency has a concrete path and content hash (if file exists locally)

**Main Flow (general resolution):**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | Indexer calls resolver | | `dependencyResolver.resolve(source, filePath, workspace)` |
| 2 | | System detects file extension | `.ts/.tsx/.js/.jsx/.mjs/.cjs` → TS/JS resolver; `.java` → Java resolver; `.py` → Python resolver; `.pega` → Pega resolver |
| 3 | | System parses imports | Applies language-specific regex patterns to extract import/reference paths |
| 4 | | System resolves paths | Relative imports resolved against file directory; known library imports skipped |
| 5 | | System computes hashes | For local files: reads file, computes SHA-256, takes first 16 hex chars |
| 6 | | System returns deps | Array of FileDependency with path, expectedHash, sourceType |

**Alternative Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| AF-01 | File not found locally | Returns `sourceType: 'remote'` with empty `expectedHash` |
| AF-02 | No imports found | Returns empty array `[]` |
| AF-03 | Unsupported file extension | Returns empty array `[]` |
| AF-04 | Pega file with invalid JSON | Catches JSON parse error, returns empty array |

**Pega-Specific Resolution Flow:**

| Step | System | Description |
|------|--------|-------------|
| 1 | | Parse `.pega` JSON content |
| 2 | | Call `PegaRuleAstParser.parse(json)` to extract structured AST |
| 3 | | Iterate over `ast.references` array |
| 4 | | For each reference: convert to file path via `pegaRefToFilePath(ruleType, className, ruleName)` |
| 5 | | For each resolved file path: try `readFileSync` to compute SHA-256 hash |
| 6 | | If file exists locally → `sourceType: 'local'` with hash; else → `sourceType: 'remote'` |

#### 3.2.3 Business Rules

| Rule ID | Rule | Source |
|---------|------|--------|
| BR-10 | Dependency resolver only resolves relative imports (starting with `.`) for TS/JS and Python; Java excludes JDK/lib imports | BRD Story 2 |
| BR-11 | Local file resolution tries extensions in priority order: .ts → .tsx → .js → .jsx → .mjs → .cjs → .d.ts | BRD Story 2 AC-1 |
| BR-12 | If no extension match, tries index variants: /index.ts → /index.tsx → ... → /index.cjs | BRD Story 2 |
| BR-13 | Pega references resolved via AST traversal, not regex; covers 20+ rule types | BRD Story 4 |
| BR-14 | Expected hash is SHA-256 first 16 hex chars of the target file content | BRD Story 2 AC-5 |

#### 3.2.4 Data Specifications

**Input:**

| Parameter | Type | Description |
|-----------|------|-------------|
| source | String | Full file content to scan for imports/references |
| filePath | String | Relative path of the file (used for extension detection and directory resolution) |
| workspace | String | Absolute workspace root path (used for local file lookups) |

**Output:**

| Field | Type | Description |
|-------|------|-------------|
| deps | FileDependency[] | Array of resolved dependencies |

---

### 3.3 Feature: Pega Rule Parsing

**Source:** BRD Story 4 — Pega Rule Parsing

#### 3.3.1 Description

`PegaFileParser` implements `ILanguageParser` for `.pega` files. It parses JSON-formatted Pega rule exports, extracting one symbol per file (kind: `pega-rule`) and all cross-rule references (kind: `references`). Under the hood, `PegaRuleAstParser` provides specialized AST builders for 20+ rule types, extracting properties, children nodes, and reference relationships.

#### 3.3.2 Use Case

**Use Case ID:** UC-03
**Actor:** TreeSitterIndexer
**Preconditions:** File has `.pega` extension; file content is valid JSON
**Postconditions:** ParseResult with 1 pega-rule symbol + N relationship objects; errors array if JSON is invalid

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | Indexer calls parser | | `pegaParser.parse(source, filePath)` |
| 2 | | System parses JSON | Validates that content is valid JSON object |
| 3 | | System extracts rule metadata | Reads `pxObjClass`, `pyClassName`, ruleName fields |
| 4 | | System creates symbol | One symbol with kind `pega-rule`, name, signature (JSON of ruleType/className/ruleset) |
| 5 | | System extracts relationships | Calls `extractRelationships()` which uses `PegaRuleAstParser.parse()` |
| 6 | | System returns ParseResult | `{ symbols: [symbol], relationships: [...], errors: [] }` |

**Exception Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| EF-01 | Invalid JSON | Returns `{ symbols: [], relationships: [], errors: [{ message: "Invalid JSON in .pega file", line: 1, column: 0 }] }` |
| EF-02 | Empty or non-object JSON | Returns error `{ message: "Empty or non-object JSON" }` |

#### 3.3.3 Business Rules

| Rule ID | Rule | Source |
|---------|------|--------|
| BR-20 | Each .pega file produces exactly one symbol of kind `pega-rule` | BRD Story 4 |
| BR-21 | Pega rule name is extracted from (in order): pyRuleName, pyActivityName, pyModelName, pyFlowName, or filename | BRD Story 4 |
| BR-22 | Rule type is determined by `pxObjClass` field | BRD Story 4 |
| BR-23 | Cross-rule references are stored as `ExtractedRelationship` with kind `references` | BRD Story 4 |
| BR-24 | PegaRuleAstParser supports 20+ rule types via specialized builders (Activity, DataTransform, Flow, etc.) | BRD Story 4 |

#### 3.3.4 Data Specifications

**ExtractedSymbol (pega-rule):**

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| name | String | Rule name | `CreateOrder` |
| kind | String | Always `"pega-rule"` | `pega-rule` |
| filePath | String | Relative file path | `WorkOrder.CreateOrder.Rule-Obj-Activity.pega` |
| startLine | Number | Always 1 | 1 |
| endLine | Number | Always 1 | 1 |
| signature | String | JSON with ruleType, className, ruleset, etc. | `{"ruleType":"Rule-Obj-Activity","className":"Work-Order","ruleset":"MyApp","rulesetVersion":"01.01.01"}` |
| parameters | String | The pxObjClass value | `Rule-Obj-Activity` |
| docComment | String | pyDescription field or null | `"Creates a new work order in the system"` |

**ExtractedRelationship (reference):**

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| sourceSymbol | String | Source file path | `WorkOrder.CreateOrder.Rule-Obj-Activity.pega` |
| targetSymbol | String | Target file path | `WorkOrder.ValidateAddress.Rule-Obj-Activity.pega` |
| kind | String | Always `"references"` | `references` |
| filePath | String | Source file path | `WorkOrder.CreateOrder.Rule-Obj-Activity.pega` |
| line | Number | Always 1 | 1 |
| metadata | Object | Rule reference details | `{ ruleType, className, ruleName, role }` |

---

### 3.4 Feature: Pega Platform Integration (Extension)

**Source:** BRD Story 3 — Pega Platform Integration

#### 3.4.1 Description

The VS Code extension adds a "Pega Platform Connection" section to the Settings panel, allowing users to configure Pega Platform endpoint, credentials, test connectivity, and fetch Pega project context. During workspace indexing, the `IndexingService` automatically detects Pega projects and performs BFS-based rule crawling from the configured Pega Platform instance.

#### 3.4.2 Use Cases

**Use Case ID:** UC-04 — Configure Pega Platform Connection
**Actor:** Developer (VS Code user)
**Preconditions:** Extension is activated; Settings panel is open
**Postconditions:** Pega credentials are stored in SecretStorage; connection is tested (optional)

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | User opens Settings panel | | Navigates to VS Code extension settings UI |
| 2 | | System shows Pega section | Displays current endpoint/username; password field is masked |
| 3 | User enters endpoint URL | | e.g., `http://pega-server:8080/prweb` |
| 4 | User enters username | | Pega operator ID |
| 5 | User enters password | | Stored via `secrets.store(SECRET_KEYS.pega, password)` |
| 6 | User clicks "Save" | | `ProviderConfigService.updatePegaConfig()` saves to settings + SecretStorage |
| 7 | | System confirms saved | Posts `{ type: "pegaSaved", success: true }` to webview |

**Use Case ID:** UC-05 — Test Pega Connection
**Actor:** Developer
**Preconditions:** Pega endpoint and credentials are configured
**Postconditions:** Connection result displayed; operator context shown on success

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | User clicks "Test Connection" | | Sends message `{ type: "testPegaConnection" }` |
| 2 | | System creates PegaHttpClient | Reads endpoint + credentials from config/SecretStorage |
| 3 | | System calls getOperatorContext() | GET `${endpoint}/api/v1/data/D_OperatorID` with Basic auth |
| 4 | | System displays result | On success: "Connected as operatorId (AppName)"; On failure: error message |

**Use Case ID:** UC-06 — Fetch Pega Context
**Actor:** Developer
**Preconditions:** Pega connection is configured and tested
**Postconditions:** `pega-project.json` and `Application.xml` created in workspace root

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | User clicks "Fetch Context" | | Sends message `{ type: "fetchPegaContext" }` |
| 2 | | System creates PegaHttpClient | Reads credentials from config/SecretStorage |
| 3 | | System fetches operator info | GET D_OperatorID data page |
| 4 | | System fetches case types | GET `/api/v1/casetypes` |
| 5 | | System fetches applications | Fallback to `/api/v1/applications` if needed |
| 6 | | System writes pega-project.json | JSON with isPegaProject, applicationName, operatorId, caseTypes, etc. |
| 7 | | System writes Application.xml | XML with application metadata |
| 8 | | System displays result | "Fetched context: App 'X' (N CaseTypes) → saved pega-project.json" |

**Use Case ID:** UC-07 — Automatic Pega Crawl During Workspace Indexing
**Actor:** IndexingService
**Preconditions:** Workspace indexing is triggered; workspace may contain Pega project
**Postconditions:** Pega rules are discovered, fetched, and ingested into backend

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | IndexingService.indexWorkspace() | | Begins workspace indexing |
| 2 | | System checks Pega project | Looks for `pega-project.json` or `Application.xml` in workspace root |
| 3 | | System detects Pega project | Parses JSON/XML to extract applicationName, pzInsKey, caseTypes |
| 4 | | System seeds crawl queue | Seeds: applicationInsKey, ruleset, case type keys |
| 5 | | System enters BFS loop | While queue not empty and iterations < 1000: |
| 6 | | System calls crawlPlan | POST to backend `/api/v1/pega/crawl-plan` with current queue |
| 7 | | System fetches missing rules | Gets each missing rule from Pega Platform via `getObject()` (batch: 50) |
| 8 | | System calls crawlBatch | POST fetched rules to backend `/api/v1/pega/crawl-batch` |
| 9 | | System updates queue | Adds new keys from `nextBatch` response; removes visited keys |
| 10 | | System reports results | Total rules fetched, stored in KB, stored in graph |

**Alternative Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| AF-05 | No Pega project detected | Skip Pega crawl; proceed with normal code indexing |
| AF-06 | Pega Platform connection fails during crawl | Catch error; report partial results; don't block rest of indexing |
| AF-07 | Backend Pega API unavailable | Rules are fetched but not stored; error is logged non-fatally |
| AF-08 | BFS reaches 1000 iterations | Stop crawl; report what was processed |

#### 3.4.3 UI Specifications

**Screen: Settings Panel — Pega Platform Connection Section**

| No. | Element | Type | Required | Behavior | Validation |
|-----|---------|------|----------|----------|------------|
| 1 | Pega Endpoint | Text input | Yes | Pega Platform base URL; stored in `kiroSdlc.pegaEndpoint` | Must be valid URL; default `http://localhost:8080/prweb` |
| 2 | Pega Username | Text input | Yes | Pega operator ID; stored in `kiroSdlc.pegaUsername` | Non-empty string |
| 3 | Pega Password | Password input | Yes | Stored in SecretStorage (keychain); masked input | Non-empty string |
| 4 | Test Connection | Button | No | Validates connection; shows operator ID + app name on success | Disabled while testing; shows spinner |
| 5 | Fetch Context | Button | No | Fetches full Pega context; creates pega-project.json + Application.xml | Requires workspace folder |
| 6 | Connection Status | Text | No | Shows last test result or error message | Green for success, red for error |

#### 3.4.4 Data Specifications

**pega-project.json Structure:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| isPegaProject | Boolean | Yes | Always `true` |
| pegaEndpoint | String | Yes | Configured Pega Platform URL |
| operatorId | String | Yes | Fetched operator ID |
| operatorName | String | No | Fetched operator display name |
| operatorInsKey | String | Yes | Pega insKey for operator |
| accessGroup | String | No | Active access group |
| applicationName | String | Yes | Pega application name |
| applicationInsKey | String | Yes | Pega insKey for application |
| pzInsKey | String | Yes | Same as applicationInsKey |
| organization | String | No | Pega organization |
| division | String | No | Pega division |
| unit | String | No | Pega organizational unit |
| caseTypes | Array | Yes | Array of `{ name, caseTypeID }` objects |
| fetchedAt | ISO String | Yes | Timestamp of context fetch |

---

### 3.5 Feature: Version-Aware Deduplication

**Source:** BRD Story 5

#### 3.5.1 Description

When `POST /api/index/source` receives files with optional `gitHash` or `checksum` fields, the backend checks the `files` table for a record with matching `content_hash`. If the hash matches (first 16 hex chars), the file is skipped — not written to disk and not re-indexed.

#### 3.5.2 Use Case

**Use Case ID:** UC-08
**Actor:** Indexing Engine
**Preconditions:** Incoming file has `gitHash` or `checksum` field; `files` table exists with `content_hash` column
**Postconditions:** If content unchanged: file is counted in `skipped`, not written, not re-indexed

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | | System receives file with gitHash | `{ path, content, gitHash: "a1b2c3d4..." }` |
| 2 | | System queries database | `SELECT content_hash FROM files WHERE relative_path = ? AND project_id = ?` |
| 3 | | System compares hashes | Compares first 16 chars of incoming gitHash vs stored content_hash |
| 4 | | If match → skip | File added to `skipped` count; not written; not indexed |
| 5 | | If no match → process | File written to disk and indexed normally |

#### 3.5.3 Business Rules

| Rule ID | Rule | Source |
|---------|------|--------|
| BR-30 | Hash comparison uses first 16 hex characters only | BRD Story 5 |
| BR-31 | Files without gitHash/checksum are always processed (no dedup check) | BRD Story 5 AC-3 |
| BR-32 | Empty or invalid hash values are silently treated as absent | BRD Story 5 AC-4 |
| BR-33 | Dedup is per-file; even if one file is skipped, other files in the same batch are still processed | BRD Story 5 |

---

## 4. Data Model

### 4.1 Logical Entities

#### Entity: FileDependency

| Attribute | Type | Required | Business Rule | Description |
|-----------|------|----------|---------------|-------------|
| path | String | Yes | BR-10 | Resolved file path relative to workspace |
| expectedHash | String | No (remote) | BR-14 | SHA-256 first 16 hex chars of target file content |
| sourceType | Enum | Yes | BR-11 | `'local'` or `'remote'` |
| sourceUrl | String | No | --- | URL for remote dependencies (future) |

#### Entity: ExtractedSymbol (pega-rule)

| Attribute | Type | Required | Business Rule | Description |
|-----------|------|----------|---------------|-------------|
| name | String | Yes | BR-21 | Pega rule name |
| kind | String | Yes | BR-20 | Always `'pega-rule'` |
| filePath | String | Yes | --- | Relative file path |
| signature | String | Yes | BR-22 | JSON metadata of the rule |
| parameters | String | No | --- | Rule type (pxObjClass) |
| docComment | String | No | --- | Rule description if available |

#### Entity: ExtractedRelationship (pega reference)

| Attribute | Type | Required | Business Rule | Description |
|-----------|------|----------|---------------|-------------|
| sourceSymbol | String | Yes | --- | Source file path |
| targetSymbol | String | Yes | --- | Target file path |
| kind | String | Yes | BR-23 | Always `'references'` |
| metadata | Object | No | BR-24 | Rule type, class, role details |

**Relationships:**

| From Entity | To Entity | Cardinality | Description |
|-------------|-----------|-------------|-------------|
| File | FileDependency | 1:N | A file has many resolved dependencies |
| .pega File | ExtractedSymbol | 1:1 | Each .pega file produces exactly 1 pega-rule symbol |
| .pega File | ExtractedRelationship | 1:N | Each .pega file produces 0..N relationships |
| PegaHttpClient.crawlPlan | Backend | N:1 | Crawl plan request → response with missing keys |
| Settings Panel | ProviderConfigService | N:1 | All config read/write via this service |
| ProviderConfigService | SecretStorage | N:1 | Credentials stored in OS keychain |

---

## 5. Integration Specifications

### 5.1 External System: Pega Platform (via PegaHttpClient)

| Attribute | Value |
|-----------|-------|
| Purpose | Fetch Pega rule data for indexing alongside source code |
| Direction | Outbound (Extension → Pega Platform) |
| Data Format | JSON (REST API responses) |
| Frequency | On-demand (during workspace indexing or user-initiated "Fetch Context") |

**Data Exchange:**

| Our Data | External Data | Direction | Business Rule |
|----------|--------------|-----------|---------------|
| Operator credentials (Basic Auth) | D_OperatorID data page | Send | Authenticate to Pega Platform |
| className + key | Rule object JSON | Send/Receive | Fetch individual Pega rule definitions |
| Pega endpoint URL | Operator context, case types, applications | Send/Receive | Fetch project metadata |
| Crawl plan request | Missing rule keys + cached keys | Send/Receive | Determine which rules to fetch next |

**API Endpoints Used:**

| Endpoint | Method | Purpose | Fallback |
|----------|--------|---------|----------|
| `${base}/api/v1/data/D_OperatorID` | GET | Fetch operator context | `${base}/PRRestService/api/v1/data/D_OperatorID` |
| `${base}/api/v1/casetypes` | GET | Fetch case type list | `${base}/PRRestService/api/v1/casetypes` |
| `${base}/api/v1/applications` | GET | Fetch application list | `${base}/PRRestService/api/v1/applications` |
| `${base}/api/v1/objects/{class}/{key}` | GET | Fetch specific rule object | --- |

### 5.2 External System: Backend (via IndexerHttpClient / PegaHttpClient.crawlPlan/Batch)

| Attribute | Value |
|-----------|-------|
| Purpose | Upload source files for indexing and ingest Pega rules |
| Direction | Outbound (Extension → Backend) |
| Data Format | JSON |
| Frequency | On-demand (workspace indexing, manual API calls) |

**Data Exchange:**

| Our Data | External Data | Direction | Business Rule |
|----------|--------------|-----------|---------------|
| Source files + paths | Indexed symbols + dependencies | Send/Receive | Unified indexing via POST /api/index/source |
| Pega rule objects | Storage confirmation + next batch keys | Send | Crawl orchestration via POST /api/v1/pega/* |

---

## 6. Processing Logic

### 6.1 Unified Indexing Pipeline Flow

**Trigger:** HTTP POST to `/api/index/source`
**Input:** JSON body with files array
**Output:** JSON response with written/skipped/rejected/deps

**Processing Steps:**

| Step | Description | Error Handling |
|------|-------------|----------------|
| 1 | Extract request scope (projectId from header or boot config, workspace from header or boot config) | Missing projectId → HTTP 400 |
| 2 | Register/update project in admin registry (non-fatal) | Fail silently — logged as warn |
| 3 | For each file in the array: validate path safety via `resolveWithinWorkspace()` | Invalid path → add to rejected list, continue |
| 4 | For each valid file with gitHash/checksum: query DB for existing content_hash match | DB error → continue (treat as no match) |
| 5 | For each match: add to skipped count | No error (intentional skip) |
| 6 | For each non-match: create directories, write file to disk | Write error → log, continue |
| 7 | For each written file: call `indexer.indexSingleFile()` | Index error → log as warn, continue |
| 8 | Collect all dependencies from all indexed files (dedup by path) | --- |
| 9 | Ensure KB entry for project (non-fatal) | Fail silently — logged as warn |
| 10 | Return response JSON | --- |

### 6.2 Pega Project Detection and BFS Crawl Flow

**Trigger:** `IndexingService.indexWorkspace()` → `indexPegaProject()`
**Input:** Workspace root path, optional SecretStorage for credentials
**Output:** Summary string with crawl results

**Processing Steps:**

| Step | Description | Error Handling |
|------|-------------|----------------|
| 1 | Check for `pega-project.json` in workspace root | Not found → try Application.xml |
| 2 | Parse JSON/XML to extract appName, pzInsKey, caseTypes | Parse error → not a Pega project, return null |
| 3 | Build seed keys list: applicationInsKey, ruleset, case type keys | --- |
| 4 | Initialize visited keys Set and currentQueue with seeds | --- |
| 5 | While queue not empty and iterations < 1000: | --- |
| 5a | POST to backend `crawl-plan` with currentQueue + visitedKeys | Network error → break with current results |
| 5b | If no missing keys → break (all cached) | --- |
| 5c | Take first 50 missing keys; for each: call Pega `getObject()` | Fetch error → create minimal object with known fields |
| 5d | POST fetched rules to backend `crawl-batch` | Network error → continue with next batch |
| 5e | Update queue with `nextBatch` keys minus visited | --- |
| 6 | Return summary string with app name and rule counts | --- |

---

## 7. Security Requirements

### 7.1 Authentication & Authorization

| Role | Permissions | Screens/Features |
|------|-------------|-------------------|
| API Consumer (CI/Developer) | Write files, trigger indexing, view dependencies | `POST /api/index/source` — requires Bearer token |
| Extension User (VS Code) | Configure Pega settings, test connection, fetch context | Settings panel — local VS Code (no auth needed) |
| Pega Operator | Access Pega Platform data | Configured via Pega Platform credentials (Basic Auth for Pega APIs) |

### 7.2 Data Sensitivity Classification

| Data Type | Classification | Business Requirement |
|-----------|---------------|---------------------|
| Pega Platform password | Restricted | Stored in VS Code SecretStorage (OS keychain); never in settings.json or logs |
| Pega Platform endpoint URL | Internal | Stored in VS Code settings (kiroSdlc.pegaEndpoint) |
| Source code content | Internal | Written to workspace; indexed into database |
| Authentication tokens | Restricted | Stored in SecretStorage; sent as Bearer header |
| Source file paths | Internal | Validated against workspace root; traversal attempts rejected |

### 7.3 Audit Trail

| Event | Logged Fields | Retention | Business Reason |
|-------|--------------|-----------|-----------------|
| Index API call | projectId, written/skipped/rejected counts, timestamp | 30 days | Usage tracking, debugging |
| Path rejection | rejected file paths, projectId | 30 days | Security monitoring for path traversal attempts |
| Pega crawl | appName, rulesFetched, rulesStored | 30 days | Performance monitoring |
| Authentication failure | HTTP status code, endpoint | 7 days | Security monitoring |

---

## 8. Non-Functional Requirements

| Category | Business Requirement | Acceptance Criteria |
|----------|---------------------|---------------------|
| Performance | Single file indexing completes in < 1 second for typical files | `indexSingleFile()` on a 100KB .ts file returns in < 1000ms |
| Performance | Batch of 50 files indexes in < 30 seconds | 50 x 100KB files process within 30s |
| Efficiency | Dedup check for unchanged files completes in < 100ms each | Hash lookup via indexed content_hash column |
| Security | Path traversal attacks are prevented | `resolveWithinWorkspace()` rejects `../` patterns; test with `../../etc/passwd` |
| Security | Pega credentials never stored in plaintext | Password stored exclusively via `secrets.store()`; verify no settings.json leak |
| Scalability | BFS crawl handles up to 1000 Pega rules | Crawl completes within 5 minutes for 1000 rules |
| Availability | Backend indexing errors non-fatal | Single file failure does not block the entire batch |
| Usability | Pega connection test provides actionable feedback | Shows operator ID + app name on success; specific HTTP error on failure |

---

## 9. Error Handling (User-Facing)

### 9.1 Error Scenarios

| Scenario | Severity | User Message | Expected Behavior |
|----------|----------|-------------|-------------------|
| API authentication failure | Warning | `{ "error": "Unauthorized" }` | User re-authenticates via login panel |
| Invalid file path traversal | Warning | File silently rejected (counted in `rejected` array) | Developer checks file paths; no data loss |
| Pega connection failure | Info | "Connection failed: {error message}" in Settings panel | User checks endpoint URL and credentials |
| Pega crawl failure during indexing | Info | Progress message shows partial results | User can re-index; earlier rules remain stored |
| Invalid .pega JSON | Info | Parser returns error in `parseErrors` count | Developer checks .pega file format |
| Missing gitHash file not found | Info | File indexed as new (no dedup) | Developer ensures file exists in workspace |

### 9.2 Notification Requirements

| Event | Who is Notified | Channel | Timing |
|-------|----------------|---------|--------|
| Pega crawl complete | User | VS Code progress notification | Immediate (end of crawl) |
| Index batch complete | API caller | HTTP response | Immediate (end of request) |
| Pega connection test result | User | Settings panel UI update | Immediate (button click) |
| Path safety violation | Developer | Backend log (warn level) | Immediate (per-file) |

---

## 10. Testing Considerations

### 10.1 Test Scenarios

| ID | Scenario | Input | Expected Output | Priority |
|----|----------|-------|-----------------|----------|
| TC-01 | Index a TypeScript file with imports | `{ files: [{ path: "index.ts", content: "import { X } from './types'" }] }` | `written: 1, deps: [{ path: "types.ts", ... }]` | High |
| TC-02 | Index a .pega file | Valid .pega JSON with a referenced activity | Symbol kind = `pega-rule`, relationship kind = `references` | High |
| TC-03 | Dedup same file twice | First call: file indexed; Second call: same content with gitHash | Second call: `skipped: 1` | High |
| TC-04 | Path traversal rejected | `{ path: "../../etc/passwd" }` | File in `rejected` array | Critical |
| TC-05 | Unauthenticated request | No Authorization header | HTTP 401 | Critical |
| TC-06 | Pega connection test | Valid endpoint + credentials | `success: true` with operator ID | High |
| TC-07 | Pega connection test (invalid) | Invalid credentials | `success: false` with error message | High |
| TC-08 | BFS crawl with circular references | Pega rules that reference each other | Crawl completes (no infinite loop); visited keys set prevents duplicates | High |
| TC-09 | Empty files array | `{ files: [] }` | `{ written: 0, skipped: 0, rejected: [], deps: [] }` | Medium |
| TC-10 | Java import with library exclusion | `import java.util.List; import com.myapp.Service;` | Only `com/myapp/Service.java` in deps | High |

---

## 11. Appendix

### Change Log from BRD

| Change | Description | Rationale |
|--------|-------------|-----------|
| No changes | FSD aligns with BRD stories 1-5 | All requirements directly derived from BRD |

### Diagram Index

| Diagram | File |
|---------|------|
| System Context | [system-context.png](diagrams/system-context.png) *(to be created)* |
