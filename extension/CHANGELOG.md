# Changelog

## [1.10.0] - 2026-07-17

### Added
- **SA4E-29: Generic Schema-Driven Base64 Proxy** — transparent file ↔ base64 bridge for remote backend:
  - `Base64ProxyService` — auto-detects proxy tools from schema (zero hardcoding); rewrites schemas for LLM (hides content_base64, shows file_path)
  - `WrapperServer` — HTTP MCP proxy on port 9181; routes tools/list + tools/call with automatic base64 I/O
  - `execute_dynamic_tool` unwrapping — proxies nested arguments for dynamically-invoked tools
  - `find_tools` response rewriting — schemas in discovery responses consistent with tools/list
  - 29 automated tests (19 UT + 10 IT/E2E-API/PBT) — all passing

### Fixed
- **SA4E-43: Extension compile errors** — created missing langgraph subgraph stubs + fixed type errors + mcpClient property
- **SA4E-42: find_tools re-index** — semantic index now refreshes on child MCP server connect/disconnect events (backend)

## [1.25.0] - 2025-07-29

### Added
- **KSA-254: Chat Panel: Slash Command Menu** — inline / trigger popup for agent selection and steering rule attachment:
  - SlashMenuController — state machine (CLOSED/OPEN/FILTERING) with 6 triggers
  - SlashMenuView — two-section popup (Agents + Steering Rules) with section headers
  - SlashMenuItems — static 6-agent list + dynamic steering rules from chat:steeringLoaded
  - Type-ahead filter (case-insensitive substring match across both sections)
  - Keyboard navigation (ArrowUp/Down/Enter/Escape) crossing section boundaries
  - Agent selection inserts /agent-name  prefix in textarea
  - Steering selection adds context chip via existing ddContextChip()
  - Full accessibility: 
ole=listbox, ria-activedescendant, screen reader announcements
  - 57 automated tests (12 PBT + 30 UT + 15 IT) — all passing


## [1.18.0] - 2025-07-28

### Added
- **KSA-249: Context Usage Graph + Full Hook System** — complete DX improvement suite:
  - `ContextUsageTracker` — tracks token consumption per source (steering files, code-intel, KB, user messages) with real-time percentage breakdown
  - `ConversationManager` — manages multi-turn conversation state, context window limits, and automatic compaction
  - `TokenCounter` — accurate token estimation for messages, tool calls, and system prompts
  - **Hook System** — full lifecycle hooks (`hook-loader.ts`, `hook-executor.ts`, `hook-events.ts`, `hook-commands.ts`) for pre/post agent execution, tool calls, and streaming events
  - **Workflow Executor** — orchestrates multi-agent workflows with state transitions and hook integration
  - **Context Usage Graph visualization** — real-time webview showing token usage breakdown by category
  - **Workflow Graph visualization** — interactive workflow state diagram in chat panel

### Changed
- **Chat panel** enhanced with context usage indicators and conversation management
- **LangGraph engine** integrated with hook system for extensible agent pipelines
- **All agent nodes** (BA, SA, QA, DEV, DevOps, Security, TA, UI) updated with hook support
- **Steering files** updated with Phase 1-7 SDLC patterns and shared quality gates

## [1.10.0] - 2025-07-20

### Added
- **KSA-111: Prebuilt onnxruntime-node binaries** — extension now ships with prebuilt `onnxruntime-node` native binaries for all supported platforms (win32-x64, linux-x64, darwin-x64, darwin-arm64), eliminating the need for users to compile native addons
- **GitHub Release asset hosting** — onnxruntime-node v1.22.0 binaries hosted on GitHub Release `onnxruntime-node-v1.22.0` for reliable distribution
- **`NativeAddonManager` onnxruntime support** — extended native addon resolution to handle onnxruntime-node alongside better-sqlite3, with platform-specific binary selection

### Changed
- **`onnxruntime-node` dependency** — upgraded to ^1.22.0 with prebuilt binary support
- **`.vscodeignore` updated** — includes onnxruntime-node prebuilt binaries while excluding source/build artifacts
- **`build-native.yml` workflow** — extended matrix to build onnxruntime-node binaries alongside better-sqlite3

## [1.9.4] - 2025-07-19

### Added
- **Multi-version Node binary support** — prebuilt `better-sqlite3` binaries now built for Node 20, 22, and 24 (12 binaries total: 3 Node versions × 4 platforms)
- **Node 22 LTS support** — N-API v9, MODULE_VERSION 127

### Changed
- **Binary naming scheme** — switched from `napi-v{n}-{platform}-{arch}` to `node-v{major}-{platform}-{arch}` to correctly distinguish Node 20 vs 22 (both share N-API v9)
- **`NativeAddonManager` resolution strategy** — now resolves by Node major version first, falls back to closest lower Node version, then legacy N-API-based keys for backward compatibility
- **`build-native.yml` workflow** — builds 12 matrix entries (3 Node versions × 4 platforms), removed `napi_version` input parameter
- **`release-manifest.json`** — added `nodeVersionMap` metadata and 12 binary entries with new naming scheme

### Fixed
- **Node 20 vs 22 binary mismatch** — previously both resolved to same `napi-v9` binary despite having different MODULE_VERSION (115 vs 127), causing potential ABI incompatibility

## [1.9.2] - 2025-07-18

### Fixed
- **KSA-175: VSIX missing `better-sqlite3` JS wrapper** — `.vscodeignore` now explicitly includes `mcp-server/node_modules/**` while excluding native build artifacts (`.build/`, `deps/`, `src/`, binaries). Previously `vsce` respected `.gitignore`'s blanket `node_modules/` exclusion, causing runtime `MODULE_NOT_FOUND` errors.
- **KSA-175: Lazy-load `better-sqlite3` with binding fallback** — `database-manager.js` now defers `require('better-sqlite3')` and supports `BETTER_SQLITE3_BINDING` env var for prebuilt native addon path. Falls back to resolving from `mcp-server/node_modules/better-sqlite3` if standard require fails.

### Changed
- **`.vscodeignore` restructured** — added `!mcp-server/node_modules/**` inclusion rule with targeted exclusions for native build artifacts (`better-sqlite3/build/**`, `better-sqlite3/deps/**`, `onnxruntime-node/bin/**`, `prebuild-install/**`, `node-gyp/**`)

## [1.2.0] - 2026-05-16

### Breaking Changes
- **Removed `Kiro SDLC: Run Code Indexer` command** — MCP servers handle indexing automatically
- **Removed `kiroSdlc.preferredIndexer` setting** — replaced by MCP variant selection
- **Removed bundled indexer scripts** — no longer injected into workspace

### Added
- **MCP Code Intelligence integration** — extension now injects MCP server config into `.kiro/settings/mcp.json`
- **MCP variant picker** — choose Python, Node.js, or Kotlin MCP server during injection
- **`src/mcp-injector.ts`** — new module handling MCP config injection and legacy migration
- **Auto-migration on upgrade** — legacy `.analysis/code-intelligence/scripts/` folder automatically removed

### Changed
- **"Inject All" flow** — now asks for MCP variant instead of indexer language
- **"Inject Selective"** — indexer option replaced by "Code Intelligence MCP Server" option
- **Status check** — verifies `code-intelligence` key in `mcp.json` instead of `index-config.json`
- **Version bumped** to 1.2.0

### Removed
- **`src/indexer.ts`** — entire file deleted (deprecated)
- **`INDEXER_BASE`, `INDEXER_OPTIONS`, `INDEXER_SCRIPTS`** from config.ts
- **`resources/.analysis/code-intelligence/scripts/`** — no longer bundled

## [1.0.6] - 2026-05-10

### Fixed (Code Review)
- **Removed dead code** — `recordFileInjected()` and `saveWorkspaceVersion()` no-op stub deleted
- **Removed semver sort bug** — `loadWorkspaceVersion()` used string sort for versions (1.0.9 > 1.0.10); function removed entirely
- **Fixed `updateSkipModified` logic** — now correctly skips user-modified files (state="modified") instead of all hash-diff files
- **Fixed unused `proc` variable** in `indexer.ts` `executeIndexer`
- **Removed `async` from sync functions** — `injectComponent`, `injectComponentFiltered`, `forceUpdate` no longer misleadingly async
- **Cleaned unused imports** — `detectModifiedFiles`, `loadWorkspaceManifest` removed from `extension.ts`

### Added
- **`src/file-utils.ts`** — extracted file copy utilities (single responsibility): `copyDirRecursive`, `copyDirFiltered`, `copySelectedItems`
- **`IndexerScript` interface** in `config.ts` — proper type annotation for `INDEXER_SCRIPTS`

### Changed
- **`injector.ts` refactored** — reduced from 240 to ~190 lines by extracting file utils
- **`checksum.ts` optimized** — `getFileStatuses` skips hash computation for outdated files (version mismatch already sufficient)
- **`updateSkipModified` and `updateWithBackup`** now receive `FileStatus[]` (user-modified only) instead of `ModifiedFile[]`

## [1.0.5] - 2026-05-10

### Added
- **Per-file version tracking** — each injected file now records its own version independently in `.kiro/.sdlc-manifest.json`
- **"Show File Versions" in Status** — output channel shows every file with its version, state (current/outdated/modified/missing)
- **"Show Details" on upgrade notification** — see exactly which files are outdated before updating
- **`getVersionReport()`** — generates human-readable report: `file.md [v1.0.3 → v1.0.5]`
- **Legacy migration** — auto-migrates old `.kiro/.sdlc-version` to new per-file manifest on first run

### Changed
- **Workspace tracking format** — replaced single `.kiro/.sdlc-version` (one global version) with `.kiro/.sdlc-manifest.json` (per-file version + hash + injectedAt)
- **Update flow** — now distinguishes "outdated" (old version) from "modified" (user edited same version), shows both in prompt
- **`safeUpdate`** — auto-overwrites when only outdated files exist (no user modifications); prompts only when user has customized files
- **`buildManifestAfterInject`** — records exact version and hash for each file after inject/update

### Removed
- **`saveWorkspaceVersion()`** — replaced by `buildManifestAfterInject()` (no-op stub kept for compat)
- **Version-gating in `detectModifiedFiles`** — removed the `entry.version !== checkVersion` skip that caused the overwrite bug

## [1.0.4] - 2026-05-10

### Fixed
- **Critical: "Inject All" and "Update" now always overwrite outdated files** — previously `detectModifiedFiles` skipped all entries when version mismatched, causing old agent files to persist after upgrade
- **`detectModifiedFiles` removed version-gating** — now compares ALL manifest files against workspace regardless of version, correctly identifying files that differ from bundled content
- **`safeUpdate` distinguishes version upgrade vs same-version** — on upgrade, shows "Overwrite All (recommended)" as default; on same-version, shows standard "Skip Modified" flow
- **`forceUpdate` and `injectAll` use bundled manifest version** instead of hardcoded `EXTENSION_VERSION` constant

### Changed
- **Upgrade prompt UX** — when upgrading (e.g., 1.0.3 → 1.0.4), dialog clearly shows version transition and recommends overwrite since files are outdated, not user-customized

## [1.0.3] - 2026-05-10

### Added
- **SM agent: Project-level workflow** — SM now supports `KSA workflow` syntax (project key without ticket number) to list all tickets and manage project scope
- **SM agent: jira.conf management** — SM creates/updates `jira.conf` when invoked with project-level input; asks user before overwriting if project key differs

### Changed
- **jira.conf simplified** — removed `JIRA_BASE_URL` (unnecessary), only contains `JIRA_PROJECT_PREFIX`
- **SM agent Input Parsing** — now distinguishes ticket-level (`KSA-1`) vs project-level (`KSA workflow`) inputs
- **SM agent prompt** — updated in all 4 locations (agents, prompts, bundled resources)

### Fixed
- **jira.conf project key** — corrected from `ICL2` to `KSA`

## [1.1.0] - 2025-07-14

### Added
- **Checksum management system** (`src/checksum.ts`) — detects user modifications when updating agents by comparing workspace files against bundled manifest
- **`gen-checksums.js` script** — auto-generates `.sdlc-checksums.json` from git-committed content during CI build
- **`sync-from-source.ps1` script** — syncs extension resources from source workspace for development
- **Node.js indexer scripts** (`.analysis/code-intelligence/scripts/nodejs`) — TypeScript-based code intelligence indexer with Vitest tests
- **704 documents** from MCPOrchestration project (templates, workflows, QA summaries)
- **UI Spec template** (`documents/templates/UI-SPEC-TEMPLATE.md`)
- **Workflow documentation** (`documents/workflows/`)

### Changed
- **Refactored `injector.ts`** — uses bundled manifest (`resources/.sdlc-checksums.json`) instead of workspace manifest for tamper-proof update detection
- **Moved GitHub Actions workflows** to repo root (`.github/workflows/`) for proper CI/CD triggering
- **Updated `.kiro` agents** — revised SM agent architecture, updated UI agent prompts
- **Updated `code-intelligence.md` steering** — improved indexer configuration guidance
- **Updated `extension.ts`** — integrated checksum system into activation flow

### Removed
- Legacy `scrum-master-agent.json` and `scrum-master-agent.md` (replaced by new agent design)

## [1.0.0] - 2026-05-09

### Added
- Initial release
- Command: Inject All Agents — copies full SDLC pipeline to workspace
- Command: Inject Selective — pick components to inject
- Command: Run Code Indexer — auto-detect runtime and index source code
- Command: Update Agents — update to latest version
- Command: Show Status — check which components are present
- 9 agents: SM, BA, TA, SA, QA, DEV, DevOps, UI, Security
- 9 steering rules: code-standards, self-learning, file-writing, drawio, jira-workflow, code-intelligence, backend-structure, frontend-structure, kotlin-code-standards
- 8 hooks: code-index (create/edit/delete/full), drawio validation, file-watcher
- 10 document templates: BRD, FSD, TDD, STP, STC, DPG, RLN, UG, TEST-REPORT, SECURITY-REPORT
- Code Intelligence Indexer in 5 languages: Python, Java, PowerShell, Bash, Node.js
- Auto-detect runtime for indexer execution
- Status bar indicator

