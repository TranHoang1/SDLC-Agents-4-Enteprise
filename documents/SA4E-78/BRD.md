# Business Requirements Document (BRD)

## Code Intelligence System — SA4E-78: Decouple Code Intelligence Indexer from Local Filesystem

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | SA4E-78 |
| Title | Decouple Code Intelligence indexer from local filesystem - architectural refactor |
| Author | BA Agent |
| Version | 1.0 |
| Date | 2026-07-30 |
| Status | Draft |

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
| 1.0 | 2026-07-30 | BA Agent | Initiate document — auto-generated from Jira ticket SA4E-78 |

---

## Sign-Off

| Name | Signature and date |
|------|--------------------|
| | ☐ I agree and confirm all criteria on this BRD as expected requirements |
| | ☐ I agree and confirm all criteria on this BRD as expected requirements |

---

## 1. Introduction

### 1.1 Scope

Refactor the Backend Code Intelligence indexer to eliminate tight coupling with the local filesystem. Currently the indexer (`IndexingEngine`) directly reads files from the server filesystem via synchronous `scanWorkspace()`, watches for changes via chokidar (`FileWatcher`), and resolves dependencies by reading target files with `readFileSync`. This architecture only works when the backend is co-located with the IDE workspace — a constraint that prevents remote/cloud deployment scenarios.

This CR decouples the indexer from direct filesystem access by:
1. Replacing synchronous `scanWorkspace()` with the existing `scanWorkspaceAsync()` (non-blocking)
2. Moving file-watching responsibility to the Extension side, with the Backend receiving change events via API
3. Converting `DependencyResolver` to static-only import parsing (no `readFileSync` of target files)
4. Adding progress reporting and cancellation support for long-running index operations

### 1.2 Out of Scope

- Changes to the Extension's `RemoteBackendClient` transport protocol (MCP/HTTP stays the same)
- Database schema changes (SQLite/PostgreSQL adapter interface unchanged)
- Tree-sitter grammar changes or new language support
- Admin UI changes
- Multi-tenant isolation changes (SA4E-41 scope preserved)

### 1.3 Preliminary Requirement

- Extension must have a file-watching mechanism (VS Code `FileSystemWatcher` API) already available
- Backend must have HTTP/MCP API routes for receiving file change notifications
- `async-file-scanner.ts` (`scanWorkspaceAsync`) must be functional and tested (SA4E-44 delivered this)

---

## 2. Business Requirements

### 2.1 High Level Process Map

The Code Intelligence system provides symbol indexing, cross-file reference resolution, and dependency tracking for the AI agent pipeline. The indexer runs in the Backend and produces a structured database of code symbols used by all agents (SA, DEV, QA) for context-aware operations.

**Current Flow (problematic):**
Extension → Backend co-located → Backend reads filesystem directly → Index DB

**Target Flow (decoupled):**
Extension watches filesystem → pushes changes via API → Backend indexes from API payload → Index DB

![Business Flow](diagrams/business-flow.png)

### 2.2 List of User Stories / Use Cases

| # | Story / Use Case / Epic | Priority | Source Ticket |
|---|-------------------------|----------|---------------|
| 1 | As the Extension, I want to push file change events to the Backend so that the Backend doesn't need direct filesystem access | MUST HAVE | SA4E-78 |
| 2 | As the Backend Indexer, I want to use non-blocking async scanning so that the event loop is not blocked during full workspace indexing | MUST HAVE | SA4E-78 |
| 3 | As the Backend DependencyResolver, I want to resolve dependencies using static import parsing only so that I don't need filesystem access to target files | MUST HAVE | SA4E-78 |
| 4 | As a Developer using the IDE, I want to see indexing progress so that I know when code intelligence is ready | SHOULD HAVE | SA4E-78 |
| 5 | As a Developer, I want to cancel a long-running index operation so that I can reclaim system resources | SHOULD HAVE | SA4E-78 |
| 6 | As the Backend, I want to reuse GraphSyncService instances so that memory allocation is optimized | COULD HAVE | SA4E-78 |

---

### 2.3 Details of User Stories

---

#### Business Flow

**Step 1:** Developer opens workspace in IDE (Extension activates)

**Step 2:** Extension initializes file watcher (VS Code `FileSystemWatcher`) on workspace

**Step 3:** Extension triggers full index request to Backend via API (`POST /api/index/full`)

**Step 4:** Backend receives request, begins async scanning of files provided by Extension

**Step 5:** Backend emits progress events (files scanned / total, current phase) to Extension

**Step 6:** Backend completes indexing, stores symbols in database

**Step 7:** When files change, Extension detects via local watcher and pushes change events to Backend via API

**Step 8:** Backend performs incremental index of changed files only

> **Note:** The Backend NEVER accesses the filesystem directly. All file content is provided by the Extension via API payloads or the existing `POST /api/index/source` endpoint.

---

#### STORY 1: Extension-Driven File Watching

> As the Extension, I want to push file change events to the Backend so that the Backend doesn't need direct filesystem access

**Requirement Details:**

1. The chokidar-based `FileWatcher` in the Backend must be removed/disabled
2. The Extension must detect file add/change/delete events using VS Code's `FileSystemWatcher` API
3. The Extension must push change events to the Backend via an API endpoint (e.g., `POST /api/index/file-events`)
4. Events must include: file path (relative), event type (add/change/delete), and optionally file content for add/change
5. The Backend must process these events to perform incremental indexing (add/change) or removal (delete)

**Acceptance Criteria:**

1. FileWatcher class (chokidar) is no longer started by the Backend in any deployment mode
2. Extension sends file change events to Backend within 500ms of detection (debounced)
3. Backend correctly indexes new/changed files when receiving add/change events
4. Backend correctly removes file records when receiving delete events
5. No chokidar dependency required at runtime for the decoupled architecture
6. Existing `POST /api/index/source` endpoint continues to work for batch file uploads

---

#### STORY 2: Non-Blocking Async Full Index

> As the Backend Indexer, I want to use non-blocking async scanning so that the event loop is not blocked during full workspace indexing

**Requirement Details:**

1. `runFullIndex()` must replace `scanWorkspace()` (sync) with `scanWorkspaceAsync()` (async, chunked)
2. The `startBackgroundIndexing()` method (currently DISABLED) must be integrated and enabled
3. Async scanning must yield control back to the event loop every N files (currently configured at 50 via `CHUNK_SIZE`)
4. Full index must support scoped execution (per-project, per-workspace) as currently designed

**Acceptance Criteria:**

1. `runFullIndex()` uses `scanWorkspaceAsync()` instead of `scanWorkspace()`
2. Event loop is not blocked — other HTTP requests are processed during indexing
3. Indexing 1000+ files completes without observable request latency degradation (< 100ms p99 for concurrent requests)
4. `startBackgroundIndexing()` is functional and triggers async full index on startup
5. All existing index tests pass without modification

---

#### STORY 3: Static-Only Dependency Resolution

> As the Backend DependencyResolver, I want to resolve dependencies using static import parsing only so that I don't need filesystem access to target files

**Requirement Details:**

1. `DependencyResolver.resolveLocalFile()` must NOT use `readFileSync` to read target files
2. `DependencyResolver.resolvePega()` must NOT use `readFileSync` to read referenced Pega rule files
3. Dependency resolution must be purely based on import statement parsing (already partially implemented for TS/JS/Java/Python)
4. `expectedHash` field should be set to empty string (computed later if needed by separate process)
5. `sourceType` should be determined by import path pattern (relative = 'local', absolute/package = 'remote')

**Data Fields:**

| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| path | string | Yes | Relative path of dependency target | `../utils/helper.ts` |
| expectedHash | string | No | Content hash (empty for static-only) | `""` |
| sourceType | 'local' \| 'remote' | Yes | Whether dependency is in-project | `local` |

**Acceptance Criteria:**

1. `DependencyResolver` contains ZERO `readFileSync` calls
2. `DependencyResolver` contains ZERO `require('fs')` usage
3. TS/JS resolution returns candidate paths without verifying file existence
4. Java resolution unchanged (already static)
5. Python resolution unchanged (already static)
6. Pega resolution returns references without reading target file content (hash = empty)
7. All existing dependency resolution tests pass (adapted for new behavior)

---

#### STORY 4: Progress Reporting

> As a Developer using the IDE, I want to see indexing progress so that I know when code intelligence is ready

**Requirement Details:**

1. The indexing engine must emit progress events during full index operations
2. Progress events must include: phase (scanning/indexing/resolving), current count, total count, percentage
3. Events must be consumable by the Extension via existing communication channel (MCP notifications or HTTP SSE)
4. Progress must update at meaningful intervals (not every file — batched, e.g., every 50 files or every 2 seconds)

**Data Fields:**

| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| phase | string | Yes | Current indexing phase | `scanning` / `indexing` / `resolving` |
| current | number | Yes | Files processed so far | `150` |
| total | number | Yes | Total files to process (0 if unknown) | `500` |
| percentage | number | Yes | Completion percentage | `30` |
| message | string | No | Human-readable status message | `Indexing TypeScript files...` |

**Acceptance Criteria:**

1. Extension receives progress events during `runFullIndex()`
2. Progress shows scanning phase (file discovery), indexing phase (symbol extraction), resolving phase (cross-references)
3. Progress updates arrive at least every 2 seconds during active indexing
4. Progress event includes meaningful `total` after scanning phase completes
5. Final event indicates 100% completion

---

#### STORY 5: Cancellation Support

> As a Developer, I want to cancel a long-running index operation so that I can reclaim system resources

**Requirement Details:**

1. `runFullIndex()` must accept an `AbortSignal` parameter
2. At each batch boundary (every N files), the indexer must check if the signal is aborted
3. If aborted, the indexer must cleanly stop processing, commit any in-progress batch, and return partial results
4. The Extension must be able to trigger cancellation via API (e.g., `POST /api/index/cancel`)
5. Cancellation must be cooperative (not forceful — no data corruption)

**Acceptance Criteria:**

1. `runFullIndex(scope?, signal?: AbortSignal)` signature accepts optional AbortSignal
2. Cancellation stops indexing within 1 batch cycle (< 100 files processed after cancel)
3. Database remains consistent after cancellation (no partial file records without symbols)
4. Cancelled index can be resumed by calling `runFullIndex()` again (unchanged files are skipped via hash check)
5. Extension can call cancel API and receive confirmation within 500ms

---

#### STORY 6: GraphSyncService Instance Reuse

> As the Backend, I want to reuse GraphSyncService instances so that memory allocation is optimized

**Requirement Details:**

1. Currently `syncGraphNodes()` creates a new `GraphSyncService` instance on every call
2. The instance should be created once (in constructor or lazily) and reused across all `syncGraphNodes()` calls
3. This is a minor optimization but improves GC pressure during large index operations

**Acceptance Criteria:**

1. `GraphSyncService` is instantiated once and stored as instance field
2. All calls to `syncGraphNodes()` reuse the same instance
3. No behavioral change — same sync results as before
4. Memory allocation during full index is measurably reduced (fewer GC pauses)

---

## 3. Dependencies

| Dependency | Type | Related Ticket | Description |
|------------|------|----------------|-------------|
| VS Code FileSystemWatcher API | System | N/A | Extension needs VS Code's watcher API to detect file changes |
| scanWorkspaceAsync (SA4E-44) | Internal | SA4E-44 | Async file scanner already implemented, needs integration |
| POST /api/index/source | Internal | N/A | Existing API endpoint for batch file upload from Extension |
| RemoteBackendClient (MCP) | Internal | N/A | Extension→Backend communication channel for progress/cancel |
| CodeIntelUploader | Internal | N/A | Existing batch upload mechanism in Extension |
| Tree-sitter indexer | Internal | N/A | Symbol extraction must continue to work with async-provided files |
| DatabaseAdapter interface | Internal | N/A | SQLite/PostgreSQL compatibility must be maintained |

---

## 4. Stakeholders

| Role | Name / Team | Responsibility | Source |
|------|-------------|----------------|--------|
| Development Team | Backend Team | Implement indexer refactor | Ticket assignee |
| Development Team | Extension Team | Implement Extension-side file watcher + API push | Related component |
| Product Owner | Project Lead | Approve architectural change | Ticket reporter |
| QA | QA Team | Validate all existing tests pass + new behavior | Standard |

---

## 5. Risks and Assumptions

### 5.1 Risks

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Extension file watcher may miss events under heavy I/O | Medium | Low | Implement periodic full-sync reconciliation (every 5 min) |
| Removing readFileSync from DependencyResolver reduces dependency accuracy (no hash verification) | Low | High | Accept trade-off: hash computed lazily when file content is available via upload |
| Large workspace initial index via API may overwhelm network | Medium | Medium | Use batched upload (existing MAX_BATCH_SIZE=100) with backpressure |
| Cancellation mid-transaction may leave partial state | High | Low | Use transactional batches — commit only complete batches |
| Progress event overhead may impact indexing throughput | Low | Low | Batch progress updates (every 50 files or 2s interval) |

### 5.2 Assumptions

- The Extension is always running when workspace files change (no offline change detection needed)
- `scanWorkspaceAsync()` (SA4E-44) is stable and handles all edge cases (hidden files, symlinks, large dirs)
- The existing `POST /api/index/source` endpoint provides sufficient API surface for incremental updates
- Backend and Extension communicate via MCP protocol which supports bidirectional notifications
- AbortSignal is available in the Node.js version used by the backend (Node 16+)

---

## 6. Non-Functional Requirements

| Category | Requirement | Details |
|----------|-------------|---------|
| Performance | Full index of 1000 files < 30s | Async scanning must not degrade overall indexing time significantly |
| Performance | Event loop latency < 100ms p99 during indexing | Non-blocking async ensures concurrent requests are not delayed |
| Reliability | No data loss on cancellation | Transactional batch commits ensure database consistency |
| Scalability | Support workspaces up to 10,000 files | Chunked async scanning + batched processing handles large workspaces |
| Maintainability | Zero filesystem imports in DependencyResolver | Clear separation — no `fs` or `path.resolve` + `readFileSync` patterns |
| Compatibility | All existing tests pass | Refactor must be backward-compatible at the API level |
| Observability | Progress visible to user | Extension displays indexing status (scanning/indexing/complete) |

---

## 7. Related Tickets

| Ticket Key | Summary | Status | Type | Relationship |
|------------|---------|--------|------|--------------|
| SA4E-78 | Decouple Code Intelligence indexer from local filesystem | To Do | Story | Main ticket |
| SA4E-44 | Async file scanner implementation | Done | Story | Provides scanWorkspaceAsync |
| SA4E-53 | Indexer async refactor (prepare→runAsync migration) | Done | Story | Previous async work |
| SA4E-41 | Multi-tenant isolation for indexer | Done | Story | Security constraints preserved |

---

## 8. Appendix

### Use Case Diagram

![Use Case Diagram](diagrams/use-case.png)

### Glossary

| Term | Definition |
|------|------------|
| Code Intelligence | System that indexes source code symbols (functions, classes, imports) for AI agent context |
| IndexingEngine | Backend service that orchestrates full and incremental code indexing |
| FileWatcher | Component that detects filesystem changes (currently chokidar, moving to Extension) |
| DependencyResolver | Module that parses import statements to build file dependency graphs |
| scanWorkspaceAsync | Non-blocking async file scanner that yields control to event loop during traversal |
| AbortSignal | Standard Web API for cooperative cancellation of async operations |
| Tree-sitter | Incremental parsing library used for AST-based symbol extraction |
| MCP | Model Context Protocol — communication protocol between Extension and Backend |
| GraphSyncService | Service that projects indexed symbols into graph_nodes for relationship queries |

### Diagram Index

| # | Diagram | Image | Source (editable) |
|---|---------|-------|-------------------|
| 1 | Business Flow | [business-flow.png](diagrams/business-flow.png) | [business-flow.drawio](diagrams/business-flow.drawio) |
| 2 | Use Case | [use-case.png](diagrams/use-case.png) | [use-case.drawio](diagrams/use-case.drawio) |

### Reference Documents

| Document | Link / Location |
|----------|-----------------|
| IndexingEngine source | backend/src/engine/indexer/indexing-engine.ts |
| FileWatcher source | backend/src/engine/indexer/file-watcher.ts |
| AsyncFileScanner source | backend/src/engine/indexer/async-file-scanner.ts |
| DependencyResolver source | backend/src/engine/parsers/dependency-resolver.ts |
| CodeIntelUploader source | extension/src/code-intel/CodeIntelUploader.ts |
| API Index Routes | backend/src/server/routes/api-index.ts |
